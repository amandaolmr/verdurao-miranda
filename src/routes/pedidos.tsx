import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, RotateCcw, RefreshCcw, AlertCircle } from "lucide-react";
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
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { addToCart, clearCart } = useCart();
  const navigate = useNavigate();

  // loading combinado: espera auth resolver, depois espera query
  const loading = authLoading || ordersLoading;

  // Ref para o user.id atual — usado no visibilitychange sem precisar
  // re-registrar o listener quando o user muda.
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  // Mutex: evita chamadas concorrentes
  const fetchingRef = useRef(false);

  async function fetchOrders(uid: string) {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    setOrdersLoading(true);
    setLoadError(false);
    setErrorMessage(null);
    console.log("[pedidos] LOADING START");

    try {
      console.log("[pedidos] PEDIDOS QUERY START");
      const { data: pedidos, error } = await supabase
        .from("pedidos")
        .select(
          "*, itens_pedido(*, produtos(id, nome, preco, unidade_venda, imagem_url, permite_fracionamento, quantidade_minima))",
        )
        .eq("cliente_id", uid)
        .order("criado_em", { ascending: false });
      console.log("[pedidos] PEDIDOS QUERY END");
      console.log("PEDIDOS_DATA", pedidos);
      console.error("PEDIDOS_ERROR", error);

      if (error) throw error;

      setOrders(pedidos || []);
    } catch (err: any) {
      console.error("[pedidos] Erro inesperado:", err);
      setLoadError(true);
      setErrorMessage(err?.message ?? String(err) ?? "Erro desconhecido");
    } finally {
      console.log("[pedidos] LOADING END");
      setOrdersLoading(false);
      fetchingRef.current = false;
    }
  }

  // Dispara a query assim que o auth resolver (authLoading false → user disponível)
  useEffect(() => {
    if (authLoading) return;
    if (!user) return; // mostrará tela de login
    console.log("SESSION", user);
    console.log("USER_ID", user.id);
    fetchOrders(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  // Recarrega quando usuário volta ao app (ex: retornando do WhatsApp)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible" && userIdRef.current) {
        console.log("[pedidos] Página visível novamente — recarregando pedidos");
        fetchOrders(userIdRef.current);
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        ) : loadError ? (
          <Card>
            <CardContent className="text-center py-10 space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <p className="font-semibold">Não foi possível carregar seus pedidos.</p>
              {errorMessage && (
                <p className="text-xs font-mono bg-muted rounded px-3 py-2 text-left break-all">
                  {errorMessage}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Verifique sua conexão e tente novamente.
              </p>
              <Button onClick={() => user && fetchOrders(user.id)} className="gap-2">
                <RefreshCcw className="h-4 w-4" />
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : !user ? (
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
