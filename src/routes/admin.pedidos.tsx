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
import { Printer, CheckCircle } from "lucide-react";
import { useConfig } from "@/hooks/useConfig";

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

function playNotificationSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
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
    /* browser may block AudioContext without prior user gesture */
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

function ThermalReceipt({ order, nomeLoja }: { order: any; nomeLoja: string }) {
  return (
    <div
      id="thermal-print"
      style={{
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: 13,
        width: 300,
        margin: "0 auto",
        padding: "8px 4px",
        lineHeight: 1.5,
      }}
    >
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: 16, marginBottom: 2 }}>
        {nomeLoja.toUpperCase()}
      </div>
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        Pedido #{order.id.slice(0, 8).toUpperCase()}
      </div>
      <div style={{ borderTop: "1px dashed #000", marginBottom: 6 }} />

      <div>
        <b>Data:</b> {new Date(order.criado_em).toLocaleString("pt-BR")}
      </div>
      <div>
        <b>Cliente:</b> {order.nome_cliente}
      </div>
      <div>
        <b>Telefone:</b> {order.telefone}
      </div>
      <div style={{ marginTop: 4 }}>
        <b>Tipo:</b> {order.tipo_recebimento === "RETIRADA" ? "Retirada na loja" : "Entrega"}
      </div>
      {order.tipo_recebimento !== "RETIRADA" && (
        <div>
          <b>Endereço:</b> {order.rua}, {order.numero}
          {order.complemento ? ` — ${order.complemento}` : ""}
          <br />
          Bairro {order.bairros?.nome}
          {order.referencia ? (
            <>
              <br />
              Ref: {order.referencia}
            </>
          ) : null}
        </div>
      )}

      <div style={{ borderTop: "1px dashed #000", margin: "8px 0 4px" }} />
      <div style={{ fontWeight: "bold", marginBottom: 4 }}>ITENS</div>
      {order.itens_pedido?.map((it: any) => {
        const qty = formatQtyItem(Number(it.quantidade), it.produtos?.unidade_venda ?? "UN");
        return (
          <div
            key={it.id}
            style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}
          >
            <span>
              {qty} {it.produtos?.nome}
            </span>
            <span>R$ {Number(it.valor_total).toFixed(2).replace(".", ",")}</span>
          </div>
        );
      })}

      <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span>
          <b>Pagamento:</b>
        </span>
        <span>{PAGAMENTO_LABEL[order.forma_pagamento] ?? order.forma_pagamento}</span>
      </div>
      {order.forma_pagamento === "dinheiro" && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
          <span>
            <b>Troco:</b>
          </span>
          <span>
            {order.precisa_troco
              ? `R$ ${Number(order.valor_troco).toFixed(2).replace(".", ",")}`
              : "Não"}
          </span>
        </div>
      )}

      <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span>Subtotal:</span>
        <span>R$ {Number(order.subtotal).toFixed(2).replace(".", ",")}</span>
      </div>
      {Number(order.taxa_entrega) > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
          <span>Entrega:</span>
          <span>R$ {Number(order.taxa_entrega).toFixed(2).replace(".", ",")}</span>
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontWeight: "bold",
          fontSize: 15,
          marginTop: 4,
        }}
      >
        <span>TOTAL:</span>
        <span>R$ {Number(order.valor_total).toFixed(2).replace(".", ",")}</span>
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "10px 0 6px" }} />
      <div style={{ textAlign: "center" }}>Obrigado pela preferência!</div>
    </div>
  );
}

function AdminOrders() {
  const config = useConfig();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [printOrder, setPrintOrder] = useState<any | null>(null);
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
          load();
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

  const handlePrint = (order: any) => {
    setPrintOrder(order);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        setPrintOrder(null);
      });
    });
  };

  const nomeLoja = config?.nome_loja || "Verdurão Miranda";

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #thermal-print, #thermal-print * { visibility: visible; }
          #thermal-print {
            position: fixed;
            top: 0;
            left: 0;
            width: 80mm;
          }
        }
      `}</style>

      {printOrder && (
        <div style={{ position: "absolute", top: -9999, left: -9999, overflow: "hidden" }}>
          <ThermalReceipt order={printOrder} nomeLoja={nomeLoja} />
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Pedidos</h1>
          <span
            className={`text-xs flex items-center gap-1.5 ${realtimeStatus === "ok" ? "text-green-600" : realtimeStatus === "error" ? "text-destructive" : "text-muted-foreground"}`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${realtimeStatus === "ok" ? "bg-green-500 animate-pulse" : realtimeStatus === "error" ? "bg-destructive" : "bg-muted-foreground"}`}
            />
            {realtimeStatus === "ok"
              ? "Tempo real ativo"
              : realtimeStatus === "error"
                ? "Tempo real com falha — execute a migration SQL"
                : "Conectando..."}
          </span>
        </div>
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
                    isNew ? "border-2 border-green-500 bg-green-50/60 dark:bg-green-950/20" : ""
                  }
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold">
                            {o.nome_cliente}{" "}
                            <span className="text-xs text-muted-foreground">
                              #{o.id.slice(0, 8)}
                            </span>
                          </p>
                          {isNew && (
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
                        <Badge
                          variant={o.tipo_recebimento === "RETIRADA" ? "secondary" : "default"}
                        >
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
                        <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                          <SelectTrigger className="w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {STATUS_LABEL[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {(isNew || o.status === "pendente") && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={async () => {
                              await updateStatus(o.id, "em_separacao");
                              handlePrint(o);
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aceitar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePrint(o)}
                          title="Imprimir pedido"
                        >
                          <Printer className="h-4 w-4 mr-1" />
                          Imprimir
                        </Button>
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
    </>
  );
}
