import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, RotateCcw } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";

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
  const { addToCart, clearCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    console.log("[pedidos] LOADING START");

    // Timeout de segurança: se getSession() travar (ex: initializePromise pendente),
    // encerra o loading após 12s para não ficar preso indefinidamente.
    const safetyTimer = setTimeout(() => {
      console.warn("[pedidos] Timeout (12s) — forçando loading=false");
      setLoading(false);
    }, 12_000);

    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData.session?.user?.id ?? null;
        console.log("[pedidos] SESSION", sessionData.session);
        console.log("[pedidos] USER", sessionData.session?.user ?? null);
        setUserId(uid);
        if (!uid) {
          console.log("[pedidos] Usuário não autenticado");
          return;
        }
        const { data: pedidos, error } = await supabase
          .from("pedidos")
          .select(
            "*, itens_pedido(*, produtos(id, nome, preco, unidade_venda, imagem_url, permite_fracionamento, quantidade_minima))",
          )
          .eq("cliente_id", uid)
          .order("criado_em", { ascending: false });
        if (error) {
          console.error("[pedidos] Erro ao carregar pedidos:", error.message);
          toast.error("Erro ao carregar pedidos.");
        }
        setOrders(pedidos || []);
      } catch (err) {
        console.error("[pedidos] Erro inesperado:", err);
        toast.error("Não foi possível carregar seus pedidos.");
      } finally {
        clearTimeout(safetyTimer);
        console.log("[pedidos] LOADING END");
        setLoading(false);
      }
    })();

    return () => clearTimeout(safetyTimer);
  }, []);

  const handleRepeat = (order: any) => {
    const itens = order.itens_pedido ?? [];
    const validos = itens.filter((it: any) => it.produtos);
    if (validos.length === 0) {
      toast.error("Nenhum produto disponível para repetir.");
      return;
    }
    clearCart();
    for (const it of validos) {
      const p = it.produtos;
      addToCart(
        {
          id: it.produto_id ?? p.id,
          nome: p.nome,
          preco: p.preco,
          unidade_venda: p.unidade_venda,
          imagem_url: p.imagem_url,
          permite_fracionamento: p.permite_fracionamento,
          quantidade_minima: p.quantidade_minima,
        },
        Number(it.quantidade),
      );
    }
    toast.success("Itens adicionados ao carrinho!");
    navigate({ to: "/checkout" });
  };

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
              <Link to="/login">
                <Button>Entrar</Button>
              </Link>
            </CardContent>
          </Card>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="text-center py-10 space-y-4">
              <Package className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Você ainda não fez nenhum pedido.</p>
              <Link to="/">
                <Button>Comprar agora</Button>
              </Link>
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
                    <span>
                      {it.quantidade}x {it.produtos?.nome || "Item"}
                    </span>
                    <span className="font-medium">
                      R$ {Number(it.valor_total).toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-primary">
                    R$ {Number(o.valor_total).toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleRepeat(o)}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Repetir pedido
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
