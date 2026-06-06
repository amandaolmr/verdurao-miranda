/**
 * QZ Tray integration — silent ESC/POS printing for Bematech MP-2500 TH (80mm)
 *
 * QZ Tray is a Java application that runs locally on Windows and exposes a
 * WebSocket server (wss://localhost:8181). This module:
 *   1. Loads qz-tray.js from the official CDN at runtime.
 *   2. Sets up null-certificate security (QZ Tray will prompt "Allow Always"
 *      on the first connection — the user only needs to approve once).
 *   3. Builds ESC/POS receipts encoded as base64 for the Bematech MP-2500 TH.
 *   4. Sends raw bytes to the default Windows printer via QZ Tray.
 *
 * SETUP (one-time, on the Windows machine):
 *   1. Download and install QZ Tray from https://qz.io/download/
 *   2. Open the admin panel in the browser.
 *   3. Click "Conectar Impressora" — QZ Tray will open a dialog asking if the
 *      site should be trusted. Click "Allow" or "Allow Always".
 *   4. Done — all future connections from the same origin are automatic.
 */

// ─── CDN URL ──────────────────────────────────────────────────────────────────
const QZ_SCRIPT_URL = "https://cdn.qz.io/qz-tray/2.2.4/qz-tray.js";

// ─── ESC/POS constants for Bematech MP-2500 TH (80mm, font A) ────────────────
// 80mm printable width ≈ 72mm → 203 DPI → font A (12 dots/char) → ~48 chars/line
const LINE_WIDTH = 48;

// ─── QZ Tray global type (minimal surface used by this module) ────────────────
declare global {
  interface Window {
    qz?: {
      websocket: {
        connect: (opts?: {
          retries?: number;
          delay?: number;
          host?: string;
          usingSecure?: boolean;
        }) => Promise<void>;
        disconnect: () => Promise<void>;
        isActive: () => boolean;
      };
      printers: {
        getDefault: () => Promise<string>;
        find: (query?: string) => Promise<string | string[]>;
      };
      configs: {
        create: (printer: string, options?: object) => object;
      };
      print: (config: object, data: QZRawData[]) => Promise<void>;
      security: {
        setCertificatePromise: (
          fn: (resolve: (cert: string) => void, reject: (err: unknown) => void) => void,
        ) => void;
        setSignatureAlgorithm: (alg: string) => void;
        setSignaturePromise: (
          fn: (
            toSign: string,
          ) => (resolve: (sig: string) => void, reject: (err: unknown) => void) => void,
        ) => void;
      };
    };
  }
}

interface QZRawData {
  type: string;
  format: string;
  data: string;
  options?: object;
}

/** Status reported by the useQZTray hook. */
export type QZStatus = "idle" | "loading" | "connecting" | "connected" | "error" | "disconnected";

// ─── CP850 encoding table (Portuguese / Latin characters) ─────────────────────
// Bematech MP-2500 TH defaults to Code Page 850 (Multilingual Latin I).
// The table maps Unicode code points > 127 to their CP850 byte equivalents.
const CP850: Record<string, number> = {
  Ç: 0x80,
  ü: 0x81,
  é: 0x82,
  â: 0x83,
  ä: 0x84,
  à: 0x85,
  å: 0x86,
  ç: 0x87,
  ê: 0x88,
  ë: 0x89,
  è: 0x8a,
  ï: 0x8b,
  î: 0x8c,
  ì: 0x8d,
  Ä: 0x8e,
  Å: 0x8f,
  É: 0x90,
  æ: 0x91,
  Æ: 0x92,
  ô: 0x93,
  ö: 0x94,
  ò: 0x95,
  û: 0x96,
  ù: 0x97,
  ÿ: 0x98,
  Ö: 0x99,
  Ü: 0x9a,
  ø: 0x9b,
  "£": 0x9c,
  Ø: 0x9d,
  á: 0xa0,
  í: 0xa1,
  ó: 0xa2,
  ú: 0xa3,
  ñ: 0xa4,
  Ñ: 0xa5,
  ã: 0xc6,
  Ã: 0xc7,
  õ: 0xe4,
  Õ: 0xe5,
  À: 0xb7,
  Á: 0xb5,
  Â: 0xb6,
  È: 0xd4,
  Ê: 0xd2,
  Ë: 0xd3,
  Í: 0xd6,
  Î: 0xd7,
  Ï: 0xd8,
  Ì: 0xde,
  Ó: 0xe0,
  Ô: 0xe2,
  Ò: 0xe3,
  Ú: 0xe9,
  Û: 0xea,
};

function encode(text: string): number[] {
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 128) {
      bytes.push(code);
    } else {
      bytes.push(CP850[ch] ?? 0x3f); // '?' for unmapped characters
    }
  }
  return bytes;
}

function bytesToBase64(bytes: number[]): string {
  return btoa(String.fromCharCode(...bytes));
}

// ─── ESC/POS command builder ──────────────────────────────────────────────────
class EscPos {
  private b: number[] = [];

  private add(bytes: number[]): this {
    this.b.push(...bytes);
    return this;
  }

  /** ESC @ — Initialize printer (clear buffer, reset settings). */
  init(): this {
    return this.add([0x1b, 0x40]);
  }

  /** ESC t 2 — Select Code Page 850 (Multilingual Latin I). */
  codePage850(): this {
    return this.add([0x1b, 0x74, 0x02]);
  }

  /** ESC a 0 — Align left. */
  alignLeft(): this {
    return this.add([0x1b, 0x61, 0x00]);
  }

  /** ESC a 1 — Align center. */
  alignCenter(): this {
    return this.add([0x1b, 0x61, 0x01]);
  }

  /** ESC E 1 — Bold on. */
  boldOn(): this {
    return this.add([0x1b, 0x45, 0x01]);
  }

  /** ESC E 0 — Bold off. */
  boldOff(): this {
    return this.add([0x1b, 0x45, 0x00]);
  }

  /** GS ! 0x01 — Double height (keeps 48-char line width). */
  doubleHeightOn(): this {
    return this.add([0x1d, 0x21, 0x01]);
  }

  /** GS ! 0x00 — Normal character size. */
  normalSize(): this {
    return this.add([0x1d, 0x21, 0x00]);
  }

  /** LF — Line feed. */
  lf(): this {
    return this.add([0x0a]);
  }

  /** ESC d n — Feed n lines. */
  feed(n: number): this {
    return this.add([0x1b, 0x64, n]);
  }

  /** GS V 1 — Partial cut. */
  cut(): this {
    return this.add([0x1d, 0x56, 0x01]);
  }

  /** Append CP850-encoded text without newline. */
  text(s: string): this {
    return this.add(encode(s));
  }

  /** Append CP850-encoded text followed by LF. */
  line(s: string): this {
    return this.text(s).lf();
  }

  /** Print a full-width separator line. */
  separator(char = "-"): this {
    return this.line(char.repeat(LINE_WIDTH));
  }

  /** Print text centered within LINE_WIDTH columns. */
  centeredLine(s: string): this {
    const trimmed = s.slice(0, LINE_WIDTH);
    const pad = Math.max(0, LINE_WIDTH - trimmed.length);
    const left = Math.floor(pad / 2);
    return this.line(" ".repeat(left) + trimmed);
  }

  /**
   * Print a two-column line: left text padded to fill the row with right
   * text flush right. Truncates the left side if necessary to always fit.
   */
  leftRight(left: string, right: string): this {
    const maxLeft = LINE_WIDTH - right.length - 1;
    const l = left.slice(0, maxLeft).padEnd(LINE_WIDTH - right.length);
    return this.line(l + right);
  }

  toBase64(): string {
    return bytesToBase64(this.b);
  }
}

// ─── Receipt helpers ──────────────────────────────────────────────────────────
function fmtMoney(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function fmtQty(qty: number, unidade: string): string {
  const u = (unidade ?? "").toUpperCase();
  if (u === "KG")
    return (
      qty.toLocaleString("pt-BR", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }) + " Kg"
    );
  if (u === "G") return qty.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + "g";
  if (u === "DZ") return qty.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " Dz";
  return `${qty}x`;
}

const PAGAMENTO_LABEL: Record<string, string> = {
  pix: "PIX",
  cartao_credito: "Cartao de Credito",
  cartao_debito: "Cartao de Debito",
  dinheiro: "Dinheiro",
};

// ─── ESC/POS receipt builder ──────────────────────────────────────────────────
/**
 * Generates a complete ESC/POS receipt for the Bematech MP-2500 TH (80mm).
 * Returns a base64-encoded string ready to be sent via QZ Tray raw printing.
 */
export function buildEscPosReceipt(order: any, nomeLoja: string, whatsapp?: string | null): string {
  const esc = new EscPos();
  const shortId = (order.id as string).slice(0, 8).toUpperCase();
  const dataHora = new Date(order.criado_em as string).toLocaleString("pt-BR");
  const subtotal = Number(order.subtotal ?? 0);
  const taxa = Number(order.taxa_entrega ?? 0);
  const total = Number(order.valor_total ?? 0);
  const pagamento =
    PAGAMENTO_LABEL[order.forma_pagamento as string] ?? (order.forma_pagamento as string) ?? "";

  esc
    .init()
    .codePage850()
    // ── Store header ────────────────────────────────────────────────────────
    .alignCenter()
    .boldOn()
    .doubleHeightOn()
    .centeredLine(nomeLoja.toUpperCase())
    .normalSize()
    .boldOff()
    .separator("=")
    // ── Order number + date ─────────────────────────────────────────────────
    .alignLeft()
    .boldOn()
    .text("Pedido #" + shortId)
    .boldOff()
    .text("  " + dataHora)
    .lf()
    .separator()
    // ── Customer info ────────────────────────────────────────────────────────
    .line("Cliente : " + (order.nome_cliente ?? ""))
    .line("Telefone: " + (order.telefone ?? ""));

  if (order.tipo_recebimento === "RETIRADA") {
    esc.line("Tipo    : Retirada na loja");
  } else {
    esc
      .line("Tipo    : Entrega")
      .line(
        "Rua     : " +
          (order.rua ?? "") +
          ", " +
          (order.numero ?? "") +
          (order.complemento ? " - " + order.complemento : ""),
      );
    if (order.bairros?.nome) esc.line("Bairro  : " + (order.bairros.nome as string));
    if (order.referencia) esc.line("Ref     : " + (order.referencia as string));
  }

  esc.separator().boldOn().line("ITENS:").boldOff().separator();

  // ── Line items ─────────────────────────────────────────────────────────────
  (order.itens_pedido ?? []).forEach((it: any) => {
    const qty = fmtQty(Number(it.quantidade), (it.produtos?.unidade_venda as string) ?? "UN");
    const nome = (it.produtos?.nome as string) ?? "";
    const valor = fmtMoney(Number(it.valor_total));
    esc.leftRight(`${qty} ${nome}`, valor);
  });

  esc.separator().leftRight("Subtotal:", fmtMoney(subtotal));

  if (taxa > 0) {
    esc.leftRight("Taxa de entrega:", fmtMoney(taxa));
  }

  esc
    .separator()
    .boldOn()
    .leftRight("TOTAL:", fmtMoney(total))
    .boldOff()
    .separator()
    // ── Payment ──────────────────────────────────────────────────────────────
    .line("Pagamento: " + pagamento);

  if (order.forma_pagamento === "dinheiro") {
    if (order.precisa_troco) {
      esc.line("Troco para: " + fmtMoney(Number(order.valor_troco)));
    } else {
      esc.line("Sem necessidade de troco");
    }
  }

  esc.separator("=").alignCenter().centeredLine("Obrigado pela preferencia!");

  if (whatsapp) {
    const d = whatsapp.replace(/\D/g, "");
    const wpp = d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : whatsapp;
    esc.centeredLine("WhatsApp: " + wpp);
  }

  esc.separator("=").feed(5).cut();

  return esc.toBase64();
}

// ─── Test receipt builder ─────────────────────────────────────────────────────
export function buildTestEscPos(nomeLoja: string): string {
  const esc = new EscPos();
  const now = new Date().toLocaleString("pt-BR");

  esc
    .init()
    .codePage850()
    .alignCenter()
    .boldOn()
    .doubleHeightOn()
    .centeredLine(nomeLoja.toUpperCase())
    .normalSize()
    .boldOff()
    .separator("=")
    .alignLeft()
    .boldOn()
    .line("TESTE DE IMPRESSAO")
    .boldOff()
    .line(now)
    .separator()
    .line("Impressora : Bematech MP-2500 TH")
    .line("Largura    : 80mm (48 colunas)")
    .line("Loja       : " + nomeLoja)
    .line("QZ Tray    : Conectado")
    .separator("=")
    .alignCenter()
    .centeredLine("Impressao OK!")
    .separator("=")
    .feed(5)
    .cut();

  return esc.toBase64();
}

// ─── Script loader ────────────────────────────────────────────────────────────
let scriptPromise: Promise<void> | null = null;

export function loadQZScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.qz) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = QZ_SCRIPT_URL;
    script.onload = () => {
      scriptPromise = null;
      resolve();
    };
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Falha ao carregar QZ Tray. Verifique sua conexão com a internet."));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

// ─── Security — unsigned (QZ Tray will show "Allow / Allow Always" dialog) ────
function setupSecurity(): void {
  if (!window.qz) return;
  // Empty certificate triggers QZ Tray's security dialog on first connection.
  // The user clicks "Allow Always" and the site is permanently trusted.
  window.qz.security.setCertificatePromise((resolve) => resolve(""));
  window.qz.security.setSignatureAlgorithm("SHA512");
  window.qz.security.setSignaturePromise(() => (resolve) => resolve(""));
}

// ─── Connection management ────────────────────────────────────────────────────
export async function connectQZ(): Promise<void> {
  await loadQZScript();
  if (!window.qz) throw new Error("QZ Tray não disponível após carregamento.");
  if (window.qz.websocket.isActive()) return; // already connected
  setupSecurity();
  await window.qz.websocket.connect({ retries: 2, delay: 1 });
}

export async function disconnectQZ(): Promise<void> {
  if (!window.qz?.websocket.isActive()) return;
  await window.qz.websocket.disconnect();
}

export function isQZConnected(): boolean {
  return window.qz?.websocket.isActive() ?? false;
}

// ─── Print functions ──────────────────────────────────────────────────────────
export async function printRawBase64(base64: string): Promise<void> {
  if (!window.qz?.websocket.isActive()) {
    throw new Error("QZ Tray não está conectado.");
  }
  const printer = await window.qz.printers.getDefault();
  const config = window.qz.configs.create(printer);
  await window.qz.print(config, [{ type: "raw", format: "base64", data: base64 }]);
}

export async function printOrder(
  order: any,
  nomeLoja: string,
  whatsapp?: string | null,
): Promise<void> {
  const data = buildEscPosReceipt(order, nomeLoja, whatsapp);
  await printRawBase64(data);
}

export async function printTestPage(nomeLoja: string): Promise<void> {
  const data = buildTestEscPos(nomeLoja);
  await printRawBase64(data);
}
