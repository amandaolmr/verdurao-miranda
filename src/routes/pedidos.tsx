import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConfig, type ConfigLoja } from "@/hooks/useConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package,
  RotateCcw,
  RefreshCcw,
  AlertCircle,
  MessageCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";

export const Route = createFileRoute("/pedidos")({
  validateSearch: (search: Record<string, unknown>) => ({
    success: typeof search.success === "string" ? search.success : undefined,
  }),
  component: OrdersPage,
});

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_separacao: "Em separação",
  saiu_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const PAGAMENTO_LABEL: Record<string, string> = {
  pix: "PIX",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
  cartao: "Cartão (na entrega)",
};

function buildWaUrl(config: ConfigLoja | null, orderId: string): string | null {
  if (!config?.whatsapp) return null;
  const numero = config.whatsapp.replace(/\D/g, "");
  const fone = numero.startsWith("55") ? numero : `55${numero}`;
  const shortId = orderId.slice(0, 8).toUpperCase();
  const msg = `Olá! Gostaria de falar sobre o pedido #${shortId}.`;
  return `https://wa.me/${fone}?text=${encodeURIComponent(msg)}`;
}

function OrdersPage() {
  const { user, session, loading: authLoading } = useAuth();
  const { success } = Route.useSearch();
  const config = useConfig();
  const [showSuccessBanner, setShowSuccessBanner] = useState(
    () => success === "1" || success === "true",
  );
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

    console.log("[pedidos] fetchOrders START uid=", uid);
    console.log("[pedidos] auth.user=", user);
    console.log("[pedidos] auth.session=", session);

    // Timeout de 10s — evita travar para sempre no Safari iOS
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.warn("[pedidos] Timeout 10s atingido — abortando query");
    }, 10_000);

    try {
      console.log("[pedidos] Supabase query START");
      const { data: pedidos, error } = await supabase
        .from("pedidos")
        .select(
          "*, itens_pedido(*, produtos(id, nome, preco, unidade_venda, imagem_url, permite_fracionamento, quantidade_minima))",
        )
        .eq("cliente_id", uid)
        .order("criado_em", { ascending: false })
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);
      console.log("[pedidos] Supabase query END");
      console.log("[pedidos] pedidos carregados=", pedidos);
      console.log("[pedidos] erro da query=", error);

      if (error) throw error;

      setOrders(pedidos || []);
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = controller.signal.aborted || err?.name === "AbortError";
      console.error("[pedidos] Erro inesperado:", err);
      setLoadError(true);
      setErrorMessage(
        isTimeout
          ? "A consulta demorou mais de 10s. Verifique sua conexão e tente novamente."
          : (err?.message ?? String(err) ?? "Erro desconhecido"),
      );
    } finally {
      console.log("[pedidos] LOADING END ordersLoading → false");
      setOrdersLoading(false);
      fetchingRef.current = false;
    }
  }

  // Dispara a query assim que auth resolver e user estiver disponível.
  // Depende de user?.id para reagir também quando a sessão chega depois do
  // localStorage (ex: TOKEN_REFRESHED no Safari iOS após initializePromise).
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      console.log("[pedidos] auth resolvido — usuário não autenticado");
      return; // mostrará tela de login
    }
    console.log("[pedidos] auth resolvido — user.id=", user.id);
    console.log("[pedidos] session=", session);
    fetchOrders(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

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

  // Auto-dismiss do banner de sucesso após 5s
  useEffect(() => {
    if (!showSuccessBanner) return;
    const t = setTimeout(() => setShowSuccessBanner(false), 5000);
    return () => clearTimeout(t);
  }, [showSuccessBanner]);

  // Realtime: atualiza status do pedido sem precisar recarregar a página
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`pedidos-user-${user.id}`)
      .on(
        "postgres_changes" as any,
        {
          event: "UPDATE",
          schema: "public",
          table: "pedidos",
          filter: `cliente_id=eq.${user.id}`,
        },
        (payload: any) => {
          console.log("[pedidos] realtime update:", payload);
          setOrders((prev) =>
            prev.map((o) => (o.id === payload.new.id ? { ...o, ...payload.new } : o)),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

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

        {showSuccessBanner && (
          <div className="flex items-start gap-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-green-800 dark:text-green-300 text-sm">
                Pedido realizado com sucesso!
              </p>
              <p className="text-xs text-green-700 dark:text-green-400">
                Você pode acompanhar o andamento do seu pedido abaixo.
              </p>
            </div>
            <button
              onClick={() => setShowSuccessBanner(false)}
              className="text-green-600 hover:text-green-800 dark:text-green-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

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
                  <CardTitle className="text-base">
                    Pedido #{o.id.slice(0, 8).toUpperCase()}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.criado_em).toLocaleString("pt-BR")}
                  </p>
                  {o.forma_pagamento && (
                    <p className="text-xs text-muted-foreground">
                      {PAGAMENTO_LABEL[o.forma_pagamento] ?? o.forma_pagamento}
                    </p>
                  )}
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
                <div className="pt-2 flex flex-col gap-2">
                  {buildWaUrl(config, o.id) && (
                    <Button
                      size="sm"
                      className="w-full bg-[#25D366] hover:bg-[#1ebe5d] text-white gap-2"
                      onClick={() => window.open(buildWaUrl(config, o.id)!, "_blank", "noopener,noreferrer")}
                    >
                      <MessageCircle className="h-4 w-4" />
                      Falar com a Loja
                    </Button>
                  )}
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
