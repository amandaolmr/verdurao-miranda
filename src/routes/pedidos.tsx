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
  console.log("[PEDIDOS_VERSION]", "2026-06-08-build-001");

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

  // Ref para o user.id atual
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
   * Chamado apenas no cleanup de desmonte (navegação entre rotas).
   * NÃO é chamado por eventos de ciclo de vida do browser (visibilitychange,
   * pageshow, focus) — o usuário pode abrir WhatsApp ou trocar de aba
   * sem interromper as queries em andamento.
   */
  function abortInFlight() {
    console.log(
      "[pedidos] REQUEST ABORTED — abortando",
      activeControllersRef.current.size,
      "request(s) (desmonte)",
    );
    fetchingRef.current = false;
    for (const ctrl of activeControllersRef.current) {
      ctrl.abort();
    }
    activeControllersRef.current.clear();
    setExpandedOrders({});
    setOrderItemsById({});
    setDetailsLoadingById({});
    setDetailsErrorById({});
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

    const t0 = performance.now();

    // Retry automático: 3 tentativas, 15s por tentativa.
    // Delays entre tentativas: 2s (após a 1ª) e 5s (após a 2ª).
    // Cobre Supabase free tier cold start (~3-10s) e falhas de rede transitórias.
    // Só falha definitivamente após esgotar todas as tentativas.
    const MAX_ATTEMPTS = 2;
    const RETRY_DELAYS_MS = [1_000];
    const ATTEMPT_TIMEOUT_MS = 8_000;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // Desmonte entre tentativas — para sem atualizar estado
      if (!fetchingRef.current) return;

      if (attempt > 1) {
        const delay = RETRY_DELAYS_MS[attempt - 2];
        console.log(
          `[Pedidos] Tentativa ${attempt}/${MAX_ATTEMPTS} — aguardando ${delay / 1000}s...`,
        );
        await new Promise<void>((r) => setTimeout(r, delay));
        if (!fetchingRef.current) return; // desmontado durante o delay
      }

      const controller = new AbortController();
      activeControllersRef.current.add(controller);
      let isTimedOut = false;

      const raceTimeout = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          isTimedOut = true;
          controller.abort();
          console.warn(
            `[Pedidos] REQUEST_TIMEOUT — tentativa ${attempt}/${MAX_ATTEMPTS} (${ATTEMPT_TIMEOUT_MS / 1000}s)`,
          );
          reject(new Error("TIMEOUT"));
        }, ATTEMPT_TIMEOUT_MS);

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
        console.log(`[Pedidos] REQUEST_START — tentativa ${attempt}/${MAX_ATTEMPTS} uid=`, uid);

        const { data: pedidos, error } = (await Promise.race([
          supabase
            .from("pedidos")
            .select(`id, criado_em, status, forma_pagamento, valor_total`)
            .eq("cliente_id", uid)
            .order("criado_em", { ascending: false }),
          raceTimeout,
        ])) as { data: any; error: any };

        if (error) throw error;

        const elapsed = Math.round(performance.now() - t0);
        console.log(
          elapsed > 2000
            ? `[Pedidos] REQUEST_SUCCESS (lento) — ${elapsed}ms tentativa ${attempt}`
            : `[Pedidos] REQUEST_SUCCESS — ${elapsed}ms tentativa ${attempt}`,
        );
        console.log(`[Pedidos] ${pedidos?.length ?? 0} pedido(s) encontrado(s)`);

        activeControllersRef.current.delete(controller);
        setOrders(pedidos || []);
        setExpandedOrders({});
        setOrderItemsById({});
        setDetailsLoadingById({});
        setDetailsErrorById({});
        setOrdersLoading(false);
        fetchingRef.current = false;
        return; // ✅ sucesso — sai do loop
      } catch (err: any) {
        activeControllersRef.current.delete(controller);

        // Desmonte: AbortError gerado pelo abortInFlight (não por timeout)
        if (err?.name === "AbortError" && !isTimedOut) {
          console.log("[Pedidos] REQUEST ABORTED — componente desmontado");
          return;
        }
        if (!fetchingRef.current) return; // abortInFlight chamado durante await

        if (attempt < MAX_ATTEMPTS) {
          const isTimeout = isTimedOut || err?.message === "TIMEOUT";
          console.warn(
            `[Pedidos] Tentativa ${attempt}/${MAX_ATTEMPTS} falhou` +
              (isTimeout ? " (timeout)" : ` — ${err?.message ?? err}`) +
              " — tentando novamente...",
          );
          continue; // próxima iteração
        }

        // Todas as tentativas esgotadas
        const elapsed = Math.round(performance.now() - t0);
        const isTimeout = isTimedOut || err?.message === "TIMEOUT";
        console.error(
          `[Pedidos] REQUEST_ERROR — ${MAX_ATTEMPTS} tentativas falharam em ${elapsed}ms`,
        );
        setLoadError(true);
        setErrorMessage(
          isTimeout
            ? `Não foi possível carregar após ${MAX_ATTEMPTS} tentativas. Verifique sua conexão.`
            : (err?.message ?? String(err) ?? "Erro desconhecido"),
        );
        setOrdersLoading(false);
        fetchingRef.current = false;
      }
    }
  }

  async function fetchOrderDetails(orderId: string) {
    console.log("[DETALHES] passo 0 — entrada. orderId=", orderId);
    console.log("[DETALHES] passo 0 — detailsLoadingById[orderId]=", detailsLoadingById[orderId]);
    console.log("[DETALHES] passo 0 — orderItemsById[orderId]=", orderItemsById[orderId]);

    if (detailsLoadingById[orderId]) {
      console.log("[DETALHES] passo 0 — bloqueado por loading, retornando cache");
      return orderItemsById[orderId] ?? [];
    }
    if (orderItemsById[orderId]) {
      console.log("[DETALHES] passo 0 — cache hit, retornando");
      return orderItemsById[orderId];
    }

    console.log("[DETALHES] passo 1 — setDetailsLoadingById(true)");
    setDetailsLoadingById((prev) => ({ ...prev, [orderId]: true }));
    setDetailsErrorById((prev) => ({ ...prev, [orderId]: null }));

    const controller = new AbortController();
    activeControllersRef.current.add(controller);

    let isTimedOut = false;

    console.log("[DETALHES] passo 2 — antes do try");

    try {
      // ── TESTE DEFINITIVO: raw fetch, sem Supabase JS client ──────────────────
      // O cliente JS trava antes de enviar a requisição (passo 3 sem passo 4).
      // Se este fetch funcionar, o problema está no cliente Supabase JS.
      console.log("[DETALHES] passo 3.1");
      console.log("[DETALHES] passo 3.2");
      console.log("[REST_TEST] inicio");
      const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) ?? "";
      const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ?? "";

      // Token lido diretamente do hook — sem getSession() que trava após WhatsApp
      const token = session?.access_token ?? SUPABASE_KEY;
      console.log("[REST_TEST] token obtido do hook");

      const url = `${SUPABASE_URL}/rest/v1/itens_pedido?select=*&pedido_id=eq.${orderId}`;
      console.log("[REST_TEST] antes do fetch");

      const response = await fetch(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("[REST_TEST] status=", response.status);
      const json = await response.json();
      console.log("[REST_TEST] json recebido — rows=", Array.isArray(json) ? json.length : json);

      if (!response.ok) {
        throw new Error(`REST_TEST HTTP ${response.status}: ${JSON.stringify(json)}`);
      }

      const data = Array.isArray(json) ? json : [];
      const error = null;

      if (error) {
        console.log("[DETALHES] passo 4a — error !== null, vai lançar");
        throw error;
      }

      console.log("[DETALHES] passo 5 — setOrderItemsById");
      const itens = data || [];
      setOrderItemsById((prev) => ({ ...prev, [orderId]: itens }));

      console.log("[DETALHES] passo 6 — retornando itens. count=", itens.length);
      return itens;
    } catch (err: any) {
      console.log("[DETALHES] catch — err=", err?.name, err?.message);

      if (!activeControllersRef.current.has(controller)) {
        console.log("[DETALHES] catch — controller removido (desmontado), ignorando");
        return [];
      }

      const isAbortOrTimeout =
        isTimedOut || err?.name === "AbortError" || err?.message === "TIMEOUT";
      const message = isAbortOrTimeout
        ? "A consulta de detalhes demorou mais de 8s. Tente novamente."
        : (err?.message ?? String(err) ?? "Erro desconhecido");

      console.error("[DETALHES] catch — setDetailsErrorById:", message);
      setDetailsErrorById((prev) => ({ ...prev, [orderId]: message }));
      return [];
    } finally {
      console.log("[DETALHES] finally — wasActive=", activeControllersRef.current.has(controller));
      const wasActive = activeControllersRef.current.has(controller);
      activeControllersRef.current.delete(controller);
      if (wasActive) {
        setDetailsLoadingById((prev) => ({ ...prev, [orderId]: false }));
      }
    }
  }

  // Busca pedidos apenas na montagem e quando user.id muda (ex: login).
  // NÃO refaz fetch por visibilitychange, focus, pageshow ou qualquer
  // evento de ciclo de vida do browser. O usuário pode abrir WhatsApp,
  // trocar de aba ou bloquear o celular sem perder o estado da página.
  // Atualizações em tempo real são tratadas pelo canal Realtime abaixo.
  useEffect(() => {
    if (!initialized) return;
    if (!user) {
      console.log("[Pedidos] usuário não autenticado");
      setOrdersLoading(false);
      return;
    }
    fetchOrders(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, user?.id]);

  /**
   * Abre o WhatsApp em nova aba/app sem sair da página atual.
   * Não existe mais nenhum listener de visibilitychange, portanto
   * abrir o WhatsApp não causa nenhum abort nem refetch.
   */
  function openWhatsApp(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

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
                      onClick={() => openWhatsApp(buildWaUrl(config, o.id)!)}
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
