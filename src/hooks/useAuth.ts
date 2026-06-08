import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
}

interface UseAuthOptions {
  /** Se true, redireciona para loginPath quando loading=false e sem sessão. */
  redirectToLogin?: boolean;
  loginPath?: string;
}

/**
 * Hook centralizado de autenticação.
 *
 * Regras:
 * - Estado inicial: session=null, loading=true
 * - Usa apenas supabase.auth.getSession() e onAuthStateChange()
 * - Sem leitura manual de localStorage
 * - loading=false sempre é garantido (via finally)
 * - pageshow revalida sessão ao retornar de app externo (Safari iOS)
 */
export function useAuth(options?: UseAuthOptions): AuthState {
  const { redirectToLogin = false, loginPath = "/login" } = options ?? {};

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      console.log("AUTH START");
      console.time("auth");
      console.log("AUTH GET SESSION");

      const startedAt = Date.now();

      // Watchdog: avisa no console se getSession demorar mais de 5s,
      // mas NÃO interrompe nem marca como erro.
      const watchdog = setTimeout(() => {
        console.warn("AUTH TIMEOUT — getSession ainda pendente após 5000ms");
      }, 5_000);

      try {
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (!active) return;

        if (sessionError) {
          console.error("AUTH GET SESSION ERROR", sessionError);
          setError(sessionError.message);
          setSession(null);
        } else {
          console.log("AUTH SESSION RESULT", data.session);
          console.log("AUTH USER", data.session?.user?.id ?? null);
          setSession(data.session);
          setError(null);
        }
      } catch (err: any) {
        if (!active) return;
        console.error("AUTH GET SESSION ERROR", err);
        setError(err?.message ?? "Falha ao consultar sessão.");
        setSession(null);
      } finally {
        clearTimeout(watchdog);
        if (active) {
          setLoading(false);
          console.log("AUTH LOADING FALSE");
          console.log("AUTH ELAPSED MS", Date.now() - startedAt);
          console.timeEnd("auth");
        }
      }
    }

    // Revalida sessão ao retornar via bfcache (Safari iOS / WhatsApp)
    async function handlePageShow(e: PageTransitionEvent) {
      if (!e.persisted) return;
      console.log("AUTH START (pageshow)");
      console.time("auth");
      console.log("AUTH GET SESSION");

      const startedAt = Date.now();
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!active) return;
        if (sessionError) {
          console.error("AUTH GET SESSION ERROR", sessionError);
          setError(sessionError.message);
          setSession(null);
        } else {
          console.log("AUTH SESSION RESULT", data.session);
          console.log("AUTH USER", data.session?.user?.id ?? null);
          setSession(data.session);
          setError(null);
        }
      } catch (err: any) {
        if (!active) return;
        console.error("AUTH GET SESSION ERROR", err);
        setError(err?.message ?? "Falha ao consultar sessão.");
        setSession(null);
      } finally {
        if (active) {
          setLoading(false);
          console.log("AUTH LOADING FALSE");
          console.log("AUTH ELAPSED MS", Date.now() - startedAt);
          console.timeEnd("auth");
        }
      }
    }

    void bootstrap();
    window.addEventListener("pageshow", handlePageShow);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!active) return;
      console.log("AUTH EVENT", event);

      if (event === "SIGNED_OUT") {
        setSession(null);
        setError(null);
      } else if (newSession) {
        setSession(newSession);
        setError(null);
      }

      // loading já foi finalizado pelo bootstrap; garante finalização caso
      // onAuthStateChange chegue antes do bootstrap em edge cases.
      setLoading(false);
      console.log("AUTH LOADING FALSE (onAuthStateChange)");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  // Redirecionamento para login quando não autenticado.
  // Não redireciona enquanto loading ou se houver erro de auth.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!redirectToLogin) return;
    if (loading) return;
    if (error) return;
    if (session?.user) return;

    const currentPath = window.location.pathname;
    if (currentPath === loginPath) return;

    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.assign(`${loginPath}?redirect=${encodeURIComponent(current)}`);
  }, [loading, session, error, redirectToLogin, loginPath]);

  return { session, user: session?.user ?? null, loading, error };
}
