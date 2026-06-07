import process from "node:process";

// Server-only config. The .server.ts suffix prevents Vite from bundling
// this file into the client — values here never reach the browser.
//
// On Cloudflare Workers, env binds at REQUEST time. Module-scope reads
// (e.g. `const x = process.env.X`) resolve to undefined — always read
// process.env INSIDE a function or handler.
//
// When to use which env-access pattern:
//   - .server.ts module (this file): server-only helpers reused across
//     handlers. Wrap reads in a function so they run per-request.
//   - inline process.env inside a createServerFn handler: one-off reads
//     not reused elsewhere.
//   - import.meta.env.VITE_FOO: PUBLIC config readable from both client
//     and server (analytics IDs, public URLs). Define in .env with the
//     VITE_ prefix. Never put secrets here — they ship to the browser.

export function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV,
  };
}

/**
 * Mercado Pago server-only credentials.
 * Set these in your .env file (local) and as Cloudflare Workers secrets (prod):
 *   wrangler secret put MP_ACCESS_TOKEN
 *   wrangler secret put SUPABASE_SERVICE_ROLE_KEY
 */
export function getMercadoPagoConfig() {
  return {
    // Secret key — never exposed to the client
    accessToken: process.env.MP_ACCESS_TOKEN ?? "",
  };
}

export function getSupabaseAdminConfig() {
  return {
    // VITE_SUPABASE_URL is a public var — Vite embeds it as a static string
    // at build time (import.meta.env), so it's available in the server bundle
    // without needing to be set as a Cloudflare secret.
    url:
      (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
      process.env.SUPABASE_URL ||
      "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  };
}
