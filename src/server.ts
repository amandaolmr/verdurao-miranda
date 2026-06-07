import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { createClient } from "@supabase/supabase-js";
import { getMercadoPagoConfig, getSupabaseAdminConfig } from "./lib/config.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

/**
 * Mercado Pago webhook handler.
 * Intercepted here because createAPIFileRoute isn't picked up by this TanStack
 * Start configuration — handling directly in the Cloudflare Worker entry point.
 */
async function handleMpWebhook(request: Request): Promise<Response> {
  if (request.method === "GET") return new Response("OK", { status: 200 });
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (body.type !== "payment") return new Response("OK", { status: 200 });

    const paymentId = String((body.data as Record<string, unknown>)?.id ?? "");
    if (!paymentId) return new Response("OK", { status: 200 });

    const { accessToken } = getMercadoPagoConfig();
    if (!accessToken) {
      console.error("[Webhook MP] MP_ACCESS_TOKEN não configurado.");
      return new Response("OK", { status: 200 });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!mpRes.ok) {
      console.error("[Webhook MP] Falha ao buscar pagamento:", mpRes.status);
      return new Response("OK", { status: 200 });
    }

    const payment = (await mpRes.json()) as Record<string, unknown>;
    const mpStatus = payment.status as string;

    const statusPagamento =
      mpStatus === "approved" ? "aprovado"
      : mpStatus === "pending" || mpStatus === "in_process" ? "pendente"
      : mpStatus === "rejected" ? "recusado"
      : mpStatus === "cancelled" ? "cancelado"
      : null;

    if (!statusPagamento) return new Response("OK", { status: 200 });

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

    if (error) console.error("[Webhook MP] Supabase update error:", error.message);

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[Webhook MP] Unhandled error:", err);
    return new Response("OK", { status: 200 });
  }
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Handle MP webhook directly — createAPIFileRoute is not picked up in this config
    const url = new URL(request.url);
    if (url.pathname === "/api/pagamentos/webhook") {
      return handleMpWebhook(request);
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
