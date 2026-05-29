import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";

export const Route = createFileRoute("/pedidos")({
  component: OrdersPage,
});

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_separacao: "Em separação",
  saiu_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) { setLoading(false); return; }
      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("*, itens_pedido(*, produtos(nome))")
        .eq("cliente_id", uid)
        .order("criado_em", { ascending: false });
      setOrders(pedidos || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <h1 className="text-3xl font-black tracking-tight">Meus Pedidos</h1>

        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : !userId ? (
          <Card>
            <CardContent className="text-center py-10 space-y-4">
              <p className="text-muted-foreground">Entre para visualizar seus pedidos.</p>
              <Link to="/login"><Button>Entrar</Button></Link>
            </CardContent>
          </Card>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="text-center py-10 space-y-4">
              <Package className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Você ainda não fez nenhum pedido.</p>
              <Link to="/"><Button>Comprar agora</Button></Link>
            </CardContent>
          </Card>
        ) : (
          orders.map((o) => (
            <Card key={o.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Pedido #{o.id.slice(0, 8)}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.criado_em).toLocaleString("pt-BR")}
                  </p>
                </div>
                <Badge variant="secondary">{STATUS_LABEL[o.status] || o.status}</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {o.itens_pedido?.map((it: any) => (
                  <div key={it.id} className="flex justify-between">
                    <span>{it.quantidade}x {it.produtos?.nome || "Item"}</span>
                    <span className="font-medium">R$ {Number(it.valor_total).toFixed(2).replace(".", ",")}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-primary">R$ {Number(o.valor_total).toFixed(2).replace(".", ",")}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
