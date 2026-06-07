/**
 * Mercado Pago transparent checkout server functions.
 *
 * Environment variables required (never exposed to the browser):
 *   MP_ACCESS_TOKEN          – Mercado Pago secret access token
 *   SUPABASE_SERVICE_ROLE_KEY – Supabase service-role key (bypasses RLS)
 *   VITE_SUPABASE_URL        – Supabase project URL (already in env)
 *
 * The Payment Brick (client-side) tokenises the card and calls onSubmit.
 * onSubmit calls processarPagamento() which runs on the server, so the
 * access token is never sent to the browser.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getMercadoPagoConfig, getSupabaseAdminConfig } from "../config.server";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface PaymentResult {
  status: "approved" | "pending" | "rejected";
  orderId: string | null;
  paymentId: string;
  message: string;
  /** PIX QR-code string (shows in pix app / copy-paste) */
  pixQrCode: string | null;
  /** PIX QR-code as base64 PNG (show as <img>) */
  pixQrCodeBase64: string | null;
}

// ─── Input schema ─────────────────────────────────────────────────────────────

const OrderDataSchema = z.object({
  clienteId: z.string().nullable(),
  nomeCliente: z.string(),
  telefone: z.string(),
  tipoRecebimento: z.enum(["ENTREGA", "RETIRADA"]),
  rua: z.string(),
  numero: z.string(),
  complemento: z.string().nullable(),
  referencia: z.string().nullable(),
  bairroId: z.string().nullable(),
  formaPagamento: z.string(), // "pix" | "cartao_credito" | "cartao_debito"
  precisaTroco: z.boolean().nullable(),
  valorTroco: z.number().nullable(),
  subtotal: z.number(),
  taxaEntrega: z.number(),
  valorTotal: z.number(),
  itens: z.array(
    z.object({
      produtoId: z.string(),
      quantidade: z.number(),
      valorUnitario: z.number(),
      valorTotal: z.number(),
    }),
  ),
});

// The Payment Brick's formData is an opaque record — we pass it through as-is.
const ProcessarPagamentoInput = z.object({
  formData: z.record(z.unknown()),
  orderData: OrderDataSchema,
});

// ─── Server function ──────────────────────────────────────────────────────────

export const processarPagamento = createServerFn({ method: "POST" })
  .inputValidator(ProcessarPagamentoInput)
  .handler(async ({ data }): Promise<PaymentResult> => {
    const { accessToken } = getMercadoPagoConfig();
    if (!accessToken) {
      throw new Error(
        "MP_ACCESS_TOKEN não configurado. Defina a variável de ambiente no servidor.",
      );
    }

    const { url: supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig();
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_URL não configurados.");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Build Mercado Pago payment request ───────────────────────────────────
    const fd = data.formData;
    // Round to 2 decimal places — floating point arithmetic (e.g. 11.48 + 2)
    // can produce values like 13.479999999... which MP rejects as invalid.
    const transactionAmount =
      Math.round(Number(data.orderData.valorTotal) * 100) / 100;
    const mpBody: Record<string, unknown> = {
      transaction_amount: transactionAmount,
      description: `Pedido Verdurão Miranda — ${data.orderData.nomeCliente}`,
      payment_method_id: fd.payment_method_id,
      payer: fd.payer,
    };
    if (fd.token) mpBody.token = fd.token;
    if (fd.installments) mpBody.installments = fd.installments;
    if (fd.issuer_id) mpBody.issuer_id = fd.issuer_id;

    // ── Call Mercado Pago API ────────────────────────────────────────────────
    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(mpBody),
    });

    const mpPayment = (await mpRes.json()) as Record<string, unknown>;

    if (!mpRes.ok) {
      const cause =
        (mpPayment.message as string) ?? (mpPayment.error as string) ?? `HTTP ${mpRes.status}`;
      throw new Error(`Mercado Pago: ${cause}`);
    }

    const mpStatus = mpPayment.status as string;

    // ── Payment rejected — do NOT create order ───────────────────────────────
    if (mpStatus === "rejected") {
      return {
        status: "rejected",
        orderId: null,
        paymentId: String(mpPayment.id),
        message: traduzStatusDetail(mpPayment.status_detail as string),
        pixQrCode: null,
        pixQrCodeBase64: null,
      };
    }

    // ── Upsert client ────────────────────────────────────────────────────────
    if (data.orderData.clienteId) {
      await supabaseAdmin.from("clientes").upsert(
        {
          id: data.orderData.clienteId,
          nome: data.orderData.nomeCliente,
          telefone: data.orderData.telefone,
        },
        { onConflict: "id" },
      );
    }

    // ── Create order ─────────────────────────────────────────────────────────
    const { data: pedido, error: pedidoErr } = await supabaseAdmin
      .from("pedidos")
      .insert({
        cliente_id: data.orderData.clienteId,
        nome_cliente: data.orderData.nomeCliente,
        telefone: data.orderData.telefone,
        tipo_recebimento: data.orderData.tipoRecebimento,
        rua: data.orderData.rua,
        numero: data.orderData.numero,
        complemento: data.orderData.complemento,
        referencia: data.orderData.referencia,
        bairro_id: data.orderData.bairroId,
        forma_pagamento: data.orderData.formaPagamento,
        precisa_troco: data.orderData.precisaTroco,
        valor_troco: data.orderData.valorTroco,
        subtotal: data.orderData.subtotal,
        taxa_entrega: data.orderData.taxaEntrega,
        valor_total: data.orderData.valorTotal,
        status: "pendente",
        status_pagamento: mpStatus === "approved" ? "aprovado" : "pendente",
        metodo_pagamento: fd.payment_method_id as string,
        id_transacao_mercadopago: String(mpPayment.id),
        data_pagamento: mpStatus === "approved" ? new Date().toISOString() : null,
        valor_pago: mpStatus === "approved" ? data.orderData.valorTotal : null,
      })
      .select("id")
      .single();

    if (pedidoErr) throw new Error(pedidoErr.message);

    // ── Create order items ───────────────────────────────────────────────────
    const { error: itensErr } = await supabaseAdmin.from("itens_pedido").insert(
      data.orderData.itens.map((it) => ({
        pedido_id: pedido.id,
        produto_id: it.produtoId,
        quantidade: it.quantidade,
        valor_unitario: it.valorUnitario,
        valor_total: it.valorTotal,
      })),
    );
    if (itensErr) throw new Error(itensErr.message);

    // ── Extract PIX data (pending bank_transfer) ─────────────────────────────
    const txData = (mpPayment.point_of_interaction as Record<string, unknown> | undefined)
      ?.transaction_data as Record<string, unknown> | undefined;

    return {
      status: mpStatus === "approved" ? "approved" : "pending",
      orderId: pedido.id as string,
      paymentId: String(mpPayment.id),
      message:
        mpStatus === "approved"
          ? "Pagamento aprovado com sucesso!"
          : "PIX gerado! Escaneie o QR Code para confirmar o pedido.",
      pixQrCode: (txData?.qr_code as string) ?? null,
      pixQrCodeBase64: (txData?.qr_code_base64 as string) ?? null,
    };
  });

// ─── Human-readable MP status_detail messages ────────────────────────────────
function traduzStatusDetail(statusDetail: string): string {
  const map: Record<string, string> = {
    cc_rejected_bad_filled_card_number: "Número do cartão inválido.",
    cc_rejected_bad_filled_date: "Data de validade inválida.",
    cc_rejected_bad_filled_other: "Dados do cartão incorretos.",
    cc_rejected_bad_filled_security_code: "Código de segurança (CVV) inválido.",
    cc_rejected_blacklist: "Cartão bloqueado para este tipo de operação.",
    cc_rejected_call_for_authorize: "Pagamento requer autorização. Contate a operadora.",
    cc_rejected_card_disabled: "Cartão desabilitado.",
    cc_rejected_card_error: "Erro no processamento. Tente novamente.",
    cc_rejected_duplicated_payment: "Pagamento duplicado detectado.",
    cc_rejected_high_risk: "Recusado por suspeita de fraude.",
    cc_rejected_insufficient_amount: "Saldo insuficiente.",
    cc_rejected_invalid_installments: "Número de parcelas inválido.",
    cc_rejected_max_attempts: "Limite de tentativas atingido. Tente outro cartão.",
    pending_waiting_transfer: "Aguardando confirmação do PIX.",
  };
  return map[statusDetail] ?? `Pagamento recusado. Tente outro cartão ou forma de pagamento.`;
}
