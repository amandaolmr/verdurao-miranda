import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Printer, CheckCircle, X, FileDown, Wifi, WifiOff, TestTube2 } from "lucide-react";
import { useConfig } from "@/hooks/useConfig";
import { useQZTray } from "@/hooks/useQZTray";
import { isQZConnected, printOrder as qzPrintOrder } from "@/lib/qzTray";
import { buildReceiptHTML, printReceiptWindow } from "@/components/PrintReceipt";

export const Route = createFileRoute("/admin/pedidos")({
  component: AdminOrders,
});

const STATUS = ["pendente", "em_separacao", "saiu_entrega", "entregue", "cancelado"];

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_separacao: "Em Separação",
  saiu_entrega: "Saiu p/ Entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const PAGAMENTO_LABEL: Record<string, string> = {
  pix: "PIX",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
};

let _audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!_audioCtx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    _audioCtx = new AC();
  }
  return _audioCtx;
}

function unlockAudio() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    /* ignore */
  }
}

function playNotificationSound() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.35, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    };
    beep(880, 0, 0.18);
    beep(1100, 0.22, 0.18);
    beep(880, 0.44, 0.35);
  } catch {
    /* ignore */
  }
}

function formatQtyItem(qty: number, unidade: string): string {
  const u = (unidade ?? "").toUpperCase();
  if (u === "KG")
    return `${qty.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 3 })} Kg`;
  if (u === "G") return `${qty.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} g`;
  if (u === "DZ") return `${qty.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} Dz`;
  return `${qty}x`;
}

function AdminOrders() {
  const config = useConfig();
  const qz = useQZTray();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "ok" | "error">("connecting");
  const initialLoadDone = useRef(false);

  const load = async () => {
    const { data } = await supabase
      .from("pedidos")
      .select(
        "*, itens_pedido(*, produtos(nome, unidade_venda, permite_fracionamento)), bairros(nome)",
      )
      .order("criado_em", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load().then(() => {
      initialLoadDone.current = true;
    });
  }, []);

  // Supabase Realtime: detecta novo pedido
  useEffect(() => {
    const channel = supabase
      .channel("admin-pedidos-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos" },
        (payload) => {
          if (!initialLoadDone.current) return;
          playNotificationSound();
          setNewIds((prev) => new Set([...prev, payload.new.id as string]));
          toast("🛒 Novo pedido recebido!", {
            description: "Um novo pedido aguarda sua aceitação.",
            duration: 20000,
          });
          load();
          // Auto-print via QZ Tray when connected (reads window.qz directly — avoids stale closure)
          if (isQZConnected()) {
            supabase
              .from("pedidos")
              .select(
                "*, itens_pedido(*, produtos(nome, unidade_venda, permite_fracionamento)), bairros(nome)",
              )
              .eq("id", payload.new.id as string)
              .single()
              .then(({ data }) => {
                if (data) {
                  qzPrintOrder(
                    data,
                    configRef.current.nomeLoja,
                    configRef.current.whatsapp || undefined,
                  ).catch((err) => {
                    toast.error(
                      "Erro na impressão automática: " +
                        (err instanceof Error ? err.message : String(err)),
                    );
                  });
                }
              });
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("ok");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setRealtimeStatus("error");
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("pedidos").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Status atualizado");
      setNewIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
      load();
    }
  };

  const nomeLoja = config?.nome_loja || "Verdurão Miranda";
  const whatsapp = config?.whatsapp || "";

  // Keep latest config in a ref to prevent stale closures in Realtime callbacks.
  const configRef = useRef({ nomeLoja: "Verdurão Miranda", whatsapp: "" });
  useEffect(() => {
    configRef.current = { nomeLoja, whatsapp };
  }, [nomeLoja, whatsapp]);

  /**
   * Print via QZ Tray (silent ESC/POS — no browser dialog).
   * Falls back to browser print dialog when QZ Tray is not connected.
   */
  const handlePrint = async (order: any) => {
    if (isQZConnected()) {
      try {
        await qzPrintOrder(order, nomeLoja, whatsapp || undefined);
        toast.success("Impresso via QZ Tray.");
        return;
      } catch (err) {
        toast.error(
          "Falha no QZ Tray — abrindo diálogo do navegador. " +
            (err instanceof Error ? err.message : String(err)),
        );
      }
    }
    // Fallback: open receipt in a new browser tab/window
    const html = buildReceiptHTML(order, nomeLoja, whatsapp, "thermal");
    printReceiptWindow(html);
  };

  /**
   * Gerar PDF (layout A4) — mesma janela, CSS de página A4.
   * Desktop: "Salvar como PDF" no diálogo de impressão.
   * iOS/Android: idem ao handlePrint, mas formatado para A4.
   */
  const handleGeneratePDF = (order: any) => {
    const html = buildReceiptHTML(order, nomeLoja, whatsapp, "a4");
    printReceiptWindow(html);
  };

  // Desbloqueia AudioContext na primeira interação do usuário
  useEffect(() => {
    document.addEventListener("click", unlockAudio, { once: true });
    document.addEventListener("touchstart", unlockAudio, { once: true });
    return () => {
      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Page title + status bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Pedidos</h1>

        {/* Status badges + QZ action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Supabase Realtime */}
          <span
            className={`text-xs flex items-center gap-1.5 ${realtimeStatus === "ok" ? "text-green-600" : realtimeStatus === "error" ? "text-destructive" : "text-muted-foreground"}`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${realtimeStatus === "ok" ? "bg-green-500 animate-pulse" : realtimeStatus === "error" ? "bg-destructive" : "bg-muted-foreground"}`}
            />
            {realtimeStatus === "ok"
              ? "Tempo real ativo"
              : realtimeStatus === "error"
                ? "Tempo real com falha"
                : "Conectando..."}
          </span>

          <span className="hidden text-muted-foreground/40 sm:inline">|</span>

          {/* QZ Tray printer status */}
          <span
            className={`text-xs flex items-center gap-1.5 ${
              qz.status === "connected"
                ? "text-green-600"
                : qz.status === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
            }`}
          >
            {qz.status === "connected" ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}
            {qz.status === "connected"
              ? (qz.printerName ?? "Impressora conectada")
              : qz.status === "connecting"
                ? "Conectando impressora..."
                : qz.status === "error"
                  ? "Erro QZ Tray"
                  : "Impressora desconectada"}
          </span>

          {/* QZ Tray action buttons */}
          {qz.status === "connected" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                onClick={() =>
                  qz
                    .testPrint(nomeLoja)
                    .catch((err) => toast.error(err instanceof Error ? err.message : String(err)))
                }
              >
                <TestTube2 className="h-3.5 w-3.5" />
                Teste de Impressão
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs text-muted-foreground"
                onClick={() => qz.disconnect()}
              >
                <WifiOff className="h-3.5 w-3.5" />
                Desconectar
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              disabled={qz.status === "connecting"}
              onClick={() => qz.connect()}
            >
              <Wifi className="h-3.5 w-3.5" />
              {qz.status === "connecting" ? "Conectando..." : "Conectar Impressora"}
            </Button>
          )}
        </div>
      </div>

      {/* QZ Tray error detail */}
      {qz.status === "error" && qz.error && (
        <p className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">{qz.error}</p>
      )}
      {loading ? (
        <p>Carregando...</p>
      ) : orders.length === 0 ? (
        <p className="text-muted-foreground">Nenhum pedido ainda.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const isNew = newIds.has(o.id);
            return (
              <Card
                key={o.id}
                className={
                  o.status === "pendente"
                    ? "border-2 border-orange-500 bg-orange-50/60 dark:bg-orange-950/20"
                    : isNew
                      ? "border-2 border-green-500 bg-green-50/60 dark:bg-green-950/20"
                      : ""
                }
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold">
                          {o.nome_cliente}{" "}
                          <span className="text-xs text-muted-foreground">#{o.id.slice(0, 8)}</span>
                        </p>
                        {o.status === "pendente" && (
                          <Badge className="bg-orange-500 text-white text-xs animate-pulse">
                            Aguardando Aceitação
                          </Badge>
                        )}
                        {isNew && o.status !== "pendente" && (
                          <Badge className="bg-green-500 text-white text-xs animate-pulse">
                            Novo Pedido
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(o.criado_em).toLocaleString("pt-BR")} · {o.telefone}
                        {o.bairros?.nome ? ` · ${o.bairros.nome}` : ""}
                      </p>
                      {o.tipo_recebimento !== "RETIRADA" && (
                        <p className="text-xs text-muted-foreground">
                          {o.rua}, {o.numero}
                          {o.complemento ? ` — ${o.complemento}` : ""}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={o.tipo_recebimento === "RETIRADA" ? "secondary" : "default"}>
                        {o.tipo_recebimento === "RETIRADA" ? "Retirada" : "Entrega"}
                      </Badge>
                      <Badge variant="outline">
                        {PAGAMENTO_LABEL[o.forma_pagamento] ?? o.forma_pagamento}
                      </Badge>
                      {o.forma_pagamento === "dinheiro" && (
                        <Badge variant="secondary">
                          Troco:{" "}
                          {o.precisa_troco
                            ? `R$ ${Number(o.valor_troco).toFixed(2).replace(".", ",")}`
                            : "Não"}
                        </Badge>
                      )}
                      {o.status === "pendente" ? (
                        <>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={async () => {
                              await updateStatus(o.id, "em_separacao");
                              handlePrint(o);
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aceitar e Imprimir
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updateStatus(o.id, "cancelado")}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Recusar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrint(o)}
                            title="Imprimir pedido (térmica 58mm)"
                          >
                            <Printer className="h-4 w-4 mr-1" />
                            Imprimir
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGeneratePDF(o)}
                            title="Gerar PDF (layout A4)"
                          >
                            <FileDown className="h-4 w-4 mr-1" />
                            Gerar PDF
                          </Button>
                        </>
                      ) : (
                        <>
                          <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                            <SelectTrigger className="w-44">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS.filter((s) => s !== "pendente").map((s) => (
                                <SelectItem key={s} value={s}>
                                  {STATUS_LABEL[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrint(o)}
                            title="Reimprimir pedido (térmica 58mm)"
                          >
                            <Printer className="h-4 w-4 mr-1" />
                            Reimprimir
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGeneratePDF(o)}
                            title="Gerar PDF (layout A4)"
                          >
                            <FileDown className="h-4 w-4 mr-1" />
                            Gerar PDF
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-sm space-y-1">
                    {o.itens_pedido?.map((it: any) => {
                      const qty = formatQtyItem(
                        Number(it.quantidade),
                        it.produtos?.unidade_venda ?? "UN",
                      );
                      return (
                        <div key={it.id} className="flex justify-between">
                          <span>
                            {qty} {it.produtos?.nome}
                          </span>
                          <span>R$ {Number(it.valor_total).toFixed(2).replace(".", ",")}</span>
                        </div>
                      );
                    })}
                    <div className="border-t pt-1 flex justify-between font-bold text-primary">
                      <span>Total</span>
                      <span>R$ {Number(o.valor_total).toFixed(2).replace(".", ",")}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
