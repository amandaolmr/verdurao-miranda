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
  const { user, session, loading: authLoading, initialized } = useAuth({ redirectToLogin: true });
  const { success } = Route.useSearch();
  const config = useConfig();
  const [showSuccessBanner, setShowSuccessBanner] = useState(
    () => success === "1" || success === "true",
  );
  const [orders, setOrders] = useState<any[]>([]);
  // true inicial evita flash de "sem pedidos" antes do primeiro fetch terminar
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [orderItemsById, setOrderItemsById] = useState<Record<string, any[]>>({});
  const [detailsLoadingById, setDetailsLoadingById] = useState<Record<string, boolean>>({});
  const [detailsErrorById, setDetailsErrorById] = useState<Record<string, string | null>>({});
  const { addToCart, clearCart } = useCart();
  const navigate = useNavigate();

  // loading combinado: espera auth inicializar, depois espera query.
  // Usa `initialized` (não `authLoading`) para evitar loop após retorno do bfcache.
  const loading = !initialized || ordersLoading;

  // Ref para o user.id atual — usado no visibilitychange sem precisar
  // re-registrar o listener quando o user muda.
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  // Mutex: evita chamadas concorrentes
  const fetchingRef = useRef(false);

  // Conjunto de AbortControllers em voo — abortados todos no desmonte do componente.
  // Isso previne que timers de 20s de visitas anteriores disparem depois do remonte
  // e cancelem requests HTTP/2 da nova instância do componente.
  const activeControllersRef = useRef<Set<AbortController>>(new Set());

  /**
   * Aborta todos os requests em andamento e libera o mutex.
   *
   * Chamado:
   *  - no cleanup de desmonte (navegação entre rotas)
   *  - em visibilitychange=hidden (usuário foi para WhatsApp)
   *  - em pageshow(persisted) bfcache restore (safety)
   *
   * Por quê abortar no HIDDEN e não no VISIBLE?
   * O Safari iOS suspende timers quando a página vai para bfcache.
   * Ao retornar, timers "atrasados" disparam imediatamente.
   * Se o setTimeout de 20s estava a 15s quando a página congelou,
   * ao retornar ele dispara em <1s — causando o erro "demorou mais de 20s".
   * Abortando no HIDDEN, o timer é cancelado via abort-event-listener
   * ANTES do bfcache congelar a página. Ao retornar, nenhum timer pendente.
   */
  function abortInFlight() {
    console.log(
      "[pedidos] abortInFlight — abortando",
      activeControllersRef.current.size,
      "request(s)",
    );
    fetchingRef.current = false;
    for (const ctrl of activeControllersRef.current) {
      ctrl.abort();
    }
    activeControllersRef.current.clear();
  }

  // Aborta TODOS os requests em andamento ao navegar para fora desta página.
  useEffect(() => {
    return () => {
      // Reseta o mutex ANTES de abortar, para o novo mount poder chamar fetchOrders
      abortInFlight();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchOrders(uid: string) {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    setOrdersLoading(true);
    setLoadError(false);
    setErrorMessage(null);

    console.log("[pedidos] fetchOrders START uid=", uid);
    console.log("[pedidos] auth.user=", user?.id ?? null);

    // Diagnóstico de sessão/token — ajuda a identificar expiração no Safari iOS
    try {
      const {
        data: { session: diagSession },
      } = await supabase.auth.getSession();
      const expiresAt = diagSession?.expires_at;
      const tokenExpirado = expiresAt ? Math.floor(Date.now() / 1000) > expiresAt : null;
      console.log("[pedidos] DIAG token presente:", !!diagSession?.access_token);
      console.log(
        "[pedidos] DIAG token expira:",
        expiresAt ? new Date(expiresAt * 1000).toISOString() : "N/A",
      );
      console.log("[pedidos] DIAG token expirado:", tokenExpirado);
      console.log("[pedidos] DIAG user.id:", diagSession?.user?.id ?? null);
    } catch (diagErr) {
      console.warn("[pedidos] DIAG erro ao verificar sessão:", diagErr);
    }

    // Controlador para cancelamento por desmonte do componente.
    // NÃO passamos esse sinal direto ao Supabase para evitar cancelar streams
    // HTTP/2 compartilhados que afetem requests de outras instâncias.
    const controller = new AbortController();
    activeControllersRef.current.add(controller);

    let isTimedOut = false;

    // Race entre a query e um timeout de 20s (ou desmonte imediato)
    const raceTimeout = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        isTimedOut = true;
        controller.abort();
        console.warn("[pedidos] Timeout 20s atingido — abortando query");
        reject(new Error("TIMEOUT"));
      }, 20_000);

      // Desmonte imediato cancela o race antes do timer
      controller.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          if (!isTimedOut) reject(new DOMException("unmounted", "AbortError"));
        },
        { once: true },
      );
    });

    try {
      console.log("[pedidos] Supabase query START (etapa 1 - lista leve)");

      const { data: pedidos, error } = (await Promise.race([
        supabase
          .from("pedidos")
          .select(
            `
          id,
          criado_em,
          status,
          forma_pagamento,
          valor_total
        `,
          )
          .eq("cliente_id", uid)
          .order("criado_em", { ascending: false }),
        raceTimeout,
      ])) as { data: any; error: any };

      console.log("[pedidos] Supabase query END");
      console.log("[pedidos] pedidos carregados=", pedidos);
      console.log("[pedidos] erro da query=", error);

      if (error) throw error;

      setOrders(pedidos || []);
      setExpandedOrders({});
      setOrderItemsById({});
      setDetailsLoadingById({});
      setDetailsErrorById({});
    } catch (err: any) {
      // Se o controller já foi removido do Set pelo cleanup de desmonte,
      // o componente foi desmontado — não atualizar estado da nova instância.
      if (!activeControllersRef.current.has(controller)) return;

      const isAbortOrTimeout =
        isTimedOut || err?.name === "AbortError" || err?.message === "TIMEOUT";
      console.error("[pedidos] Erro inesperado:", err);
      setLoadError(true);
      setErrorMessage(
        isAbortOrTimeout
          ? "A consulta demorou mais de 20s. Verifique sua conexão e tente novamente."
          : (err?.message ?? String(err) ?? "Erro desconhecido"),
      );
    } finally {
      // Só atualiza o estado de loading se o controller ainda está no Set
      // (ou seja, não foi desmontado pelo cleanup)
      const wasActive = activeControllersRef.current.has(controller);
      activeControllersRef.current.delete(controller);
      if (wasActive) {
        console.log("[pedidos] LOADING END ordersLoading → false");
        setOrdersLoading(false);
      }
      fetchingRef.current = false;
    }
  }

  async function fetchOrderDetails(orderId: string) {
    if (detailsLoadingById[orderId]) return orderItemsById[orderId] ?? [];
    if (orderItemsById[orderId]) return orderItemsById[orderId];

    setDetailsLoadingById((prev) => ({ ...prev, [orderId]: true }));
    setDetailsErrorById((prev) => ({ ...prev, [orderId]: null }));

    const controller = new AbortController();
    activeControllersRef.current.add(controller); // registra para cancelamento no desmonte

    let isTimedOut = false;

    const raceTimeout = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        isTimedOut = true;
        controller.abort();
        console.warn("[pedidos] Timeout 20s atingido — abortando detalhes do pedido");
        reject(new Error("TIMEOUT"));
      }, 20_000);

      controller.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          if (!isTimedOut) reject(new DOMException("unmounted", "AbortError"));
        },
        { once: true },
      );
    });

    try {
      console.log("[pedidos] Supabase query START (etapa 2 - detalhes)", orderId);

      const { data, error } = (await Promise.race([
        supabase
          .from("itens_pedido")
          .select(
            "*, produtos(id, nome, preco, unidade_venda, imagem_url, permite_fracionamento, quantidade_minima)",
          )
          .eq("pedido_id", orderId),
        raceTimeout,
      ])) as { data: any; error: any };

      if (error) throw error;

      const itens = data || [];
      setOrderItemsById((prev) => ({ ...prev, [orderId]: itens }));
      return itens;
    } catch (err: any) {
      // Desmonte do componente — não atualizar estado
      if (!activeControllersRef.current.has(controller)) return [];

      const isAbortOrTimeout =
        isTimedOut || err?.name === "AbortError" || err?.message === "TIMEOUT";
      const message = isAbortOrTimeout
        ? "A consulta de detalhes demorou mais de 20s. Tente novamente."
        : (err?.message ?? String(err) ?? "Erro desconhecido");

      console.error("[pedidos] Erro ao carregar detalhes do pedido:", err);
      setDetailsErrorById((prev) => ({ ...prev, [orderId]: message }));
      return [];
    } finally {
      const wasActive = activeControllersRef.current.has(controller);
      activeControllersRef.current.delete(controller); // remove do conjunto ativo
      if (wasActive) {
        setDetailsLoadingById((prev) => ({ ...prev, [orderId]: false }));
      }
    }
  }

  // Dispara a query apenas após auth estar completamente inicializado.
  // `initialized` é estável (nunca volta a false) — evita loops infinitos.
  // Depende de user?.id para reagir também quando a sessão chega depois do
  // localStorage (ex: TOKEN_REFRESHED no Safari iOS após initializePromise).
  useEffect(() => {
    if (!initialized) return;
    if (!user) {
      // Auth resolvido sem usuário: para o loading para mostrar o card de login.
      // O useAuth com redirectToLogin=true vai redirecionar em seguida.
      console.log("[pedidos] auth resolvido — usuário não autenticado");
      setOrdersLoading(false);
      return;
    }
    console.log("[pedidos] auth resolvido — user.id=", user.id);
    console.log("[pedidos] session=", session);
    fetchOrders(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, user?.id]);

  // Recarregamento ao retornar do WhatsApp / mudar de aba / bfcache Safari iOS
  useEffect(() => {
    function handleVisibility() {
      const uid = userIdRef.current;
      console.log(
        "[pedidos] visibilitychange —",
        document.visibilityState,
        "| uid=",
        uid ?? "null",
      );

      if (document.visibilityState === "hidden") {
        // Página vai para segundo plano (WhatsApp, bfcache, etc.)
        // Aborta AGORA para que o timer da raceTimeout seja cancelado
        // ANTES do Safari congelar a página. Sem isso, o timer fica
        // "pausado" e dispara imediatamente ao retornar, causando o
        // erro falso "demorou mais de 20s".
        abortInFlight();
        setOrdersLoading(false); // limpa spinner residual
      } else if (document.visibilityState === "visible" && uid) {
        // Retornou — busca pedidos frescos
        console.log("[pedidos] visibilitychange visible — recarregando pedidos");
        fetchOrders(uid);
      }
    }

    // bfcache: Safari iOS restaura a página sem remontagem.
    // pageshow(persisted=true) pode disparar após ou junto com visibilitychange.
    // abortInFlight() aqui é um safety net caso a página tenha congelado com
    // controller ativo (ex.: bfcache sem visibilitychange=hidden antes).
    function handlePageShow(e: PageTransitionEvent) {
      const uid = userIdRef.current;
      console.log(
        "[pedidos] pageshow — persisted=",
        e.persisted,
        "| uid=",
        uid ?? "null",
        "| fetchingRef=",
        fetchingRef.current,
      );

      if (e.persisted && uid) {
        // Garante que não há zombie controllers ou mutex bloqueado
        abortInFlight();
        fetchOrders(uid);
      }
    }

    function handleFocus() {
      // Fallback para browsers sem visibilitychange confiável
      const uid = userIdRef.current;
      console.log("[pedidos] window.focus — uid=", uid ?? "null");
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleFocus);
    };
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

  const handleToggleDetails = async (orderId: string) => {
    const isExpanded = !!expandedOrders[orderId];
    if (isExpanded) {
      setExpandedOrders((prev) => ({ ...prev, [orderId]: false }));
      return;
    }

    setExpandedOrders((prev) => ({ ...prev, [orderId]: true }));
    await fetchOrderDetails(orderId);
  };

  const handleRepeat = async (order: any) => {
    const itens = orderItemsById[order.id] ?? (await fetchOrderDetails(order.id));
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
                      onClick={() =>
                        window.open(buildWaUrl(config, o.id)!, "_blank", "noopener,noreferrer")
                      }
                    >
                      <MessageCircle className="h-4 w-4" />
                      Falar com a Loja
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleToggleDetails(o.id)}
                    disabled={!!detailsLoadingById[o.id]}
                  >
                    {expandedOrders[o.id] ? "Ocultar detalhes" : "Ver detalhes"}
                  </Button>

                  {expandedOrders[o.id] && (
                    <div className="rounded-md border p-3 space-y-2">
                      {detailsLoadingById[o.id] ? (
                        <p className="text-xs text-muted-foreground">Carregando detalhes...</p>
                      ) : detailsErrorById[o.id] ? (
                        <div className="space-y-2">
                          <p className="text-xs text-destructive break-all">
                            {detailsErrorById[o.id]}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fetchOrderDetails(o.id)}
                          >
                            Tentar novamente
                          </Button>
                        </div>
                      ) : orderItemsById[o.id]?.length ? (
                        <div className="space-y-2">
                          {orderItemsById[o.id].map((it: any) => (
                            <div key={it.id} className="flex justify-between">
                              <span>
                                {it.quantidade}x {it.produtos?.nome || "Item"}
                              </span>
                              <span className="font-medium">
                                R$ {Number(it.valor_total).toFixed(2).replace(".", ",")}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Nenhum item encontrado para este pedido.
                        </p>
                      )}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleRepeat(o)}
                    disabled={!!detailsLoadingById[o.id]}
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
