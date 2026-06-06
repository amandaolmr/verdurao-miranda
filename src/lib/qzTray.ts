/**
 * QZ Tray integration — silent ESC/POS printing for Bematech MP-2500 TH (80mm)
 *
 * QZ Tray is a Java application that runs locally on Windows and exposes a
 * WebSocket server (wss://localhost:8181). This module connects to it via the
 * official "qz-tray" npm package (no CDN required).
 *
 * SETUP (one-time, on the Windows machine):
 *   1. Download and install QZ Tray from https://qz.io/download/
 *   2. Open the admin panel in the browser and click "Conectar Impressora".
 *   3. QZ Tray shows a security dialog — click "Allow Always" (once only).
 *   4. Done. All future connections from the same origin are automatic.
 */
import qz from "qz-tray";

// ─── ESC/POS constants for Bematech MP-2500 TH (80mm, font A) ────────────────
// 80mm printable ≈ 72mm → 203 DPI → font A (12 dots/char) → ~48 chars/line
const LINE_WIDTH = 48;

/** Status reported by the useQZTray hook. */
export type QZStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error"
  | "disconnected";

// ─── CP850 encoding table (Portuguese / Latin characters) ─────────────────────
// Bematech MP-2500 TH defaults to Code Page 850 (Multilingual Latin I).
const CP850: Record<string, number> = {
  "Ç": 0x80, "ü": 0x81, "é": 0x82, "â": 0x83, "ä": 0x84, "à": 0x85,
  "å": 0x86, "ç": 0x87, "ê": 0x88, "ë": 0x89, "è": 0x8a, "ï": 0x8b,
  "î": 0x8c, "ì": 0x8d, "Ä": 0x8e, "Å": 0x8f, "É": 0x90, "æ": 0x91,
  "Æ": 0x92, "ô": 0x93, "ö": 0x94, "ò": 0x95, "û": 0x96, "ù": 0x97,
  "ÿ": 0x98, "Ö": 0x99, "Ü": 0x9a, "ø": 0x9b, "£": 0x9c, "Ø": 0x9d,
  "á": 0xa0, "í": 0xa1, "ó": 0xa2, "ú": 0xa3, "ñ": 0xa4, "Ñ": 0xa5,
  "ã": 0xc6, "Ã": 0xc7, "õ": 0xe4, "Õ": 0xe5, "À": 0xb7,
  "Á": 0xb5, "Â": 0xb6, "È": 0xd4, "Ê": 0xd2, "Ë": 0xd3,
  "Í": 0xd6, "Î": 0xd7, "Ï": 0xd8, "Ì": 0xde,
  "Ó": 0xe0, "Ô": 0xe2, "Ò": 0xe3, "Ú": 0xe9, "Û": 0xea,
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

  init(): this           { return this.add([0x1b, 0x40]); }
  codePage850(): this    { return this.add([0x1b, 0x74, 0x02]); }
  alignLeft(): this      { return this.add([0x1b, 0x61, 0x00]); }
  alignCenter(): this    { return this.add([0x1b, 0x61, 0x01]); }
  boldOn(): this         { return this.add([0x1b, 0x45, 0x01]); }
  boldOff(): this        { return this.add([0x1b, 0x45, 0x00]); }
  doubleHeightOn(): this { return this.add([0x1d, 0x21, 0x01]); }
  normalSize(): this     { return this.add([0x1d, 0x21, 0x00]); }
  lf(): this             { return this.add([0x0a]); }
  feed(n: number): this  { return this.add([0x1b, 0x64, n]); }
  cut(): this            { return this.add([0x1d, 0x56, 0x01]); }

  text(s: string): this { return this.add(encode(s)); }
  line(s: string): this { return this.text(s).lf(); }

  separator(char = "-"): this {
    return this.line(char.repeat(LINE_WIDTH));
  }

  centeredLine(s: string): this {
    const trimmed = s.slice(0, LINE_WIDTH);
    const pad = Math.max(0, LINE_WIDTH - trimmed.length);
    return this.line(" ".repeat(Math.floor(pad / 2)) + trimmed);
  }

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
  if (u === "G")
    return qty.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + "g";
  if (u === "DZ")
    return (
      qty.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " Dz"
    );
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
export function buildEscPosReceipt(
  order: any,
  nomeLoja: string,
  whatsapp?: string | null,
): string {
  const esc = new EscPos();
  const shortId = (order.id as string).slice(0, 8).toUpperCase();
  const dataHora = new Date(order.criado_em as string).toLocaleString("pt-BR");
  const subtotal = Number(order.subtotal ?? 0);
  const taxa = Number(order.taxa_entrega ?? 0);
  const total = Number(order.valor_total ?? 0);
  const pagamento =
    PAGAMENTO_LABEL[order.forma_pagamento as string] ??
    (order.forma_pagamento as string) ??
    "";

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
    .text("Pedido #" + shortId)
    .boldOff()
    .text("  " + dataHora)
    .lf()
    .separator()
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
    if (order.bairros?.nome)
      esc.line("Bairro  : " + (order.bairros.nome as string));
    if (order.referencia)
      esc.line("Ref     : " + (order.referencia as string));
  }

  esc
    .separator()
    .boldOn()
    .line("ITENS:")
    .boldOff()
    .separator();

  (order.itens_pedido ?? []).forEach((it: any) => {
    const qty = fmtQty(
      Number(it.quantidade),
      (it.produtos?.unidade_venda as string) ?? "UN",
    );
    const nome = (it.produtos?.nome as string) ?? "";
    esc.leftRight(`${qty} ${nome}`, fmtMoney(Number(it.valor_total)));
  });

  esc.separator().leftRight("Subtotal:", fmtMoney(subtotal));
  if (taxa > 0) esc.leftRight("Taxa de entrega:", fmtMoney(taxa));

  esc
    .separator()
    .boldOn()
    .leftRight("TOTAL:", fmtMoney(total))
    .boldOff()
    .separator()
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
    const wpp =
      d.length === 11
        ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
        : whatsapp;
    esc.centeredLine("WhatsApp: " + wpp);
  }

  esc.separator("=").feed(5).cut();
  return esc.toBase64();
}

// ─── Test receipt builder ─────────────────────────────────────────────────────
export function buildTestEscPos(nomeLoja: string, printerName?: string): string {
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
    .line("Impressora : " + (printerName ?? "Padrao do sistema"))
    .line("Modelo     : Bematech MP-2500 TH")
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

// ─── Security — unsigned (QZ Tray prompts "Allow / Allow Always" on 1st use) ──
function setupSecurity(): void {
  // Empty certificate triggers QZ Tray's security dialog on first connection.
  // The operator clicks "Allow Always" once and the site is permanently trusted.
  qz.security.setCertificatePromise((resolve) => resolve(""));
  qz.security.setSignatureAlgorithm("SHA512");
  qz.security.setSignaturePromise(() => (resolve) => resolve(""));
}

// ─── Connection management ────────────────────────────────────────────────────
/**
 * Connect to QZ Tray and return the default printer name.
 * If already connected, just refreshes and returns the printer name.
 */
export async function connectQZ(): Promise<string> {
  if (!qz.websocket.isActive()) {
    setupSecurity();
    await qz.websocket.connect({ retries: 2, delay: 1 });
  }
  const printer = await qz.printers.getDefault();
  // Log all found printers for diagnostics
  const all = await qz.printers.find();
  console.log("[QZ Tray] Impressoras encontradas:", all);
  console.log("[QZ Tray] Impressora padrão:", printer);
  return printer;
}

export async function disconnectQZ(): Promise<void> {
  if (!qz.websocket.isActive()) return;
  await qz.websocket.disconnect();
}

export function isQZConnected(): boolean {
  return qz.websocket.isActive();
}

// ─── Print functions ──────────────────────────────────────────────────────────
export async function printRawBase64(base64: string): Promise<void> {
  if (!qz.websocket.isActive()) {
    throw new Error("QZ Tray não está conectado.");
  }
  const printer = await qz.printers.getDefault();
  const config = qz.configs.create(printer);
  await qz.print(config, [{ type: "raw", format: "base64", data: base64 }]);
}

export async function printOrder(
  order: any,
  nomeLoja: string,
  whatsapp?: string | null,
): Promise<void> {
  await printRawBase64(buildEscPosReceipt(order, nomeLoja, whatsapp));
}

export async function printTestPage(
  nomeLoja: string,
  printerName?: string,
): Promise<void> {
  await printRawBase64(buildTestEscPos(nomeLoja, printerName));
}
