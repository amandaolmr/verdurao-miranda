/**
 * Sistema Universal de Impressão de Pedidos
 *
 * - Desktop (Windows/Mac): window.print() via iframe → caixa de diálogo do sistema
 * - iPhone/iPad: window.print() via iframe → AirPrint + "Salvar como PDF" + apps de impressora
 * - Android: window.print() via iframe → diálogo do sistema → Bluetooth/Wi-Fi/PDF
 *
 * Nenhuma dependência externa (sem jsPDF, sem html2canvas).
 */

const PAGAMENTO_LABEL: Record<string, string> = {
  pix: "PIX",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
};

function escHtml(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatQtyItem(qty: number, unidade: string): string {
  const u = (unidade ?? "").toUpperCase();
  if (u === "KG")
    return `${qty.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 3 })} Kg`;
  if (u === "G") return `${qty.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} g`;
  if (u === "DZ") return `${qty.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} Dz`;
  return `${qty}x`;
}

export function formatWhatsApp(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

/**
 * Gera HTML completo e auto-suficiente do comprovante.
 * pageSize: 'thermal' → papel 58mm (impressoras térmicas ESC/POS)
 *           'a4'     → folha A4 (PDF, impressoras jato de tinta/laser)
 */
export function buildReceiptHTML(
  order: any,
  nomeLoja: string,
  whatsapp: string,
  pageSize: "thermal" | "a4" = "thermal",
): string {
  const isThermal = pageSize === "thermal";
  const subtotal = Number(order.subtotal ?? 0);
  const taxa = Number(order.taxa_entrega ?? 0);
  const total = Number(order.valor_total ?? 0);
  const shortId = order.id.slice(0, 8).toUpperCase();
  const data = new Date(order.criado_em).toLocaleString("pt-BR");
  const wpp = formatWhatsApp(whatsapp);
  const pagamento = PAGAMENTO_LABEL[order.forma_pagamento] ?? escHtml(order.forma_pagamento);

  const itensHTML = (order.itens_pedido ?? [])
    .map((it: any) => {
      const qty = escHtml(formatQtyItem(Number(it.quantidade), it.produtos?.unidade_venda ?? "UN"));
      const nome = escHtml(it.produtos?.nome ?? "");
      const valor = `R$ ${Number(it.valor_total).toFixed(2).replace(".", ",")}`;
      return `<div class="row"><span>${qty} ${nome}</span><span>${valor}</span></div>`;
    })
    .join("");

  const enderecoHTML =
    order.tipo_recebimento !== "RETIRADA"
      ? `<div style="margin-bottom:2px;"><b>Endereço:</b></div>
         <div>${escHtml(order.rua)}, ${escHtml(order.numero)}${order.complemento ? ` — ${escHtml(order.complemento)}` : ""}</div>
         <div>Bairro: ${escHtml(order.bairros?.nome)}${order.referencia ? `<br>Ref: ${escHtml(order.referencia)}` : ""}</div>`
      : "";

  const trocoHTML =
    order.forma_pagamento === "dinheiro"
      ? `<div class="row"><span><b>Troco p/:</b></span><span>${
          order.precisa_troco
            ? `R$ ${Number(order.valor_troco).toFixed(2).replace(".", ",")}`
            : "Sem troco"
        }</span></div>`
      : "";

  const pageRule = isThermal
    ? `@page { size: 58mm auto; margin: 2mm; }`
    : `@page { size: A4; margin: 15mm; }`;

  const bodyWidth = isThermal ? `max-width: 100%;` : `max-width: 120mm; margin: 0 auto;`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pedido #${shortId} — ${escHtml(nomeLoja)}</title>
  <style>
    ${pageRule}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${isThermal ? "11px" : "12px"};
      color: #000;
      background: #fff;
      ${bodyWidth}
      padding: 4px 2px;
      line-height: 1.55;
    }
    .center { text-align: center; }
    .title  { font-size: ${isThermal ? "14px" : "17px"}; font-weight: bold; }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 6px;
      margin-bottom: 2px;
    }
    .row span:last-child { text-align: right; white-space: nowrap; }
    .divider       { border-top: 1px dashed #000; margin: 5px 0; }
    .divider-solid { border-top: 2px solid  #000; margin: 4px 0; }
    .section-title { font-weight: bold; text-transform: uppercase; margin-bottom: 3px; }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      font-size: ${isThermal ? "13px" : "14px"};
      margin-top: 4px;
      gap: 6px;
    }
    @media print { ${pageRule} }
  </style>
</head>
<body>
  <div class="divider-solid"></div>
  <div class="center title">${escHtml(nomeLoja.toUpperCase())}</div>
  <div class="center" style="margin-top:3px;font-weight:bold;">Pedido #${shortId}</div>
  <div class="center" style="margin-bottom:5px;">${data}</div>
  <div class="divider-solid"></div>

  <div style="margin-bottom:2px;"><b>Cliente:</b> ${escHtml(order.nome_cliente)}</div>
  <div style="margin-bottom:2px;"><b>Telefone:</b> ${escHtml(order.telefone)}</div>
  <div style="margin:4px 0 2px;"><b>Tipo:</b> ${order.tipo_recebimento === "RETIRADA" ? "Retirada na loja" : "Entrega"}</div>
  ${enderecoHTML}

  <div class="divider"></div>
  <div class="section-title">Itens</div>
  ${itensHTML}

  <div class="divider"></div>

  <div class="row"><span>Subtotal:</span><span>R$ ${subtotal.toFixed(2).replace(".", ",")}</span></div>
  ${taxa > 0 ? `<div class="row"><span>Entrega:</span><span>R$ ${taxa.toFixed(2).replace(".", ",")}</span></div>` : ""}
  <div class="total-row"><span>TOTAL:</span><span>R$ ${total.toFixed(2).replace(".", ",")}</span></div>

  <div class="divider"></div>

  <div class="row"><span><b>Pagamento:</b></span><span>${pagamento}</span></div>
  ${trocoHTML}

  <div class="divider-solid"></div>
  <div class="center" style="margin:6px 0;font-weight:bold;">Obrigado pela preferência!</div>
  ${wpp ? `<div class="center" style="margin-bottom:4px;"><b>WhatsApp:</b> ${escHtml(wpp)}</div>` : ""}
  <div class="divider-solid"></div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  </script>
</body>
</html>`;
}

/**
 * Imprime o comprovante usando um iframe invisível.
 * Funciona em iOS (AirPrint), Android (diálogo de impressão) e Desktop.
 * Fallback: abre em nova aba se o iframe falhar.
 */
export function printReceiptWindow(html: string): void {
  // Tenta via window.open (melhor suporte iOS Safari)
  const win = window.open("", "_blank", "width=460,height=720,scrollbars=yes");
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    return;
  }

  // Fallback: iframe (evita bloqueio de popup em navegadores restritos)
  const existing = document.getElementById("__receipt-print-iframe");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "__receipt-print-iframe";
  iframe.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => iframe.remove(), 3000);
    }
  }, 300);
}
