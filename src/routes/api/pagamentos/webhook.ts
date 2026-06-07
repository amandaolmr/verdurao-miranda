/**
 * Mercado Pago webhook endpoint.
 *
 * MP posts payment notifications to this URL. Register it in the MP dashboard:
 *   https://www.mercadopago.com.br/developers/panel/app/webhooks
 *   URL: https://<seu-dominio>/api/pagamentos/webhook
 *   Events: Payments
 *
 * Always returns HTTP 200 to prevent MP from retrying indefinitely.
 */
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createClient } from "@supabase/supabase-js";
import { getMercadoPagoConfig, getSupabaseAdminConfig } from "@/lib/config.server";

export const APIRoute = createAPIFileRoute("/api/pagamentos/webhook")({
  POST: async ({ request }) => {
    try {
      const body = (await request.json()) as Record<string, unknown>;

      // MP sends: { type: "payment", action: "payment.updated", data: { id: "..." } }
      if (body.type !== "payment") {
        return new Response("OK", { status: 200 });
      }

      const paymentId = String((body.data as Record<string, unknown>)?.id ?? "");
      if (!paymentId) {
        return new Response("Missing payment id", { status: 200 });
      }

      const { accessToken } = getMercadoPagoConfig();
      if (!accessToken) {
        console.error("[Webhook MP] MP_ACCESS_TOKEN não configurado.");
        return new Response("Server misconfigured", { status: 200 });
      }

      // ── Fetch payment from MP to get authoritative status ─────────────────
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!mpRes.ok) {
        console.error("[Webhook MP] Falha ao buscar pagamento:", mpRes.status);
        return new Response("OK", { status: 200 });
      }

      const payment = (await mpRes.json()) as Record<string, unknown>;
      const mpStatus = payment.status as string;

      const statusPagamento: string | null =
        mpStatus === "approved"
          ? "aprovado"
          : mpStatus === "pending" || mpStatus === "in_process"
            ? "pendente"
            : mpStatus === "rejected"
              ? "recusado"
              : mpStatus === "cancelled"
                ? "cancelado"
                : null;

      if (!statusPagamento) {
        return new Response("OK", { status: 200 });
      }

      const { url: supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig();
      if (!supabaseUrl || !serviceRoleKey) {
        console.error("[Webhook MP] Supabase não configurado.");
        return new Response("OK", { status: 200 });
      }

      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const updatePayload: Record<string, unknown> = { status_pagamento: statusPagamento };
      if (mpStatus === "approved") {
        updatePayload.data_pagamento = new Date().toISOString();
        updatePayload.valor_pago = Number(payment.transaction_amount);
      }

      const { error } = await supabaseAdmin
        .from("pedidos")
        .update(updatePayload)
        .eq("id_transacao_mercadopago", paymentId);

      if (error) {
        console.error("[Webhook MP] Supabase update error:", error.message);
      }

      return new Response("OK", { status: 200 });
    } catch (err) {
      console.error("[Webhook MP] Unhandled error:", err);
      // Always return 200 so MP doesn't retry indefinitely
      return new Response("OK", { status: 200 });
    }
  },
  // MP may send a GET to validate the endpoint
  GET: async () => new Response("OK", { status: 200 }),
});
