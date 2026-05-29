import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/pedidos")({
  component: AdminOrders,
});

const STATUS = ["pendente", "em_separacao", "saiu_entrega", "entregue", "cancelado"];

function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("pedidos")
      .select("*, itens_pedido(*, produtos(nome)), bairros(nome)")
      .order("criado_em", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("pedidos").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Status atualizado"); load(); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Pedidos</h1>
      {loading ? <p>Carregando...</p> : orders.length === 0 ? (
        <p className="text-muted-foreground">Nenhum pedido ainda.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <Card key={o.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{o.nome_cliente} <span className="text-xs text-muted-foreground">#{o.id.slice(0, 8)}</span></p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.criado_em).toLocaleString("pt-BR")} · {o.telefone} · {o.bairros?.nome}
                    </p>
                    <p className="text-xs text-muted-foreground">{o.rua}, {o.numero} {o.complemento}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{o.forma_pagamento}</Badge>
                    <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="text-sm space-y-1">
                  {o.itens_pedido?.map((it: any) => (
                    <div key={it.id} className="flex justify-between">
                      <span>{it.quantidade}x {it.produtos?.nome}</span>
                      <span>R$ {Number(it.valor_total).toFixed(2).replace(".", ",")}</span>
                    </div>
                  ))}
                  <div className="border-t pt-1 flex justify-between font-bold text-primary">
                    <span>Total</span>
                    <span>R$ {Number(o.valor_total).toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
