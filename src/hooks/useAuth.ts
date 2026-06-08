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
  redirectToLogin?: boolean;
  loginPath?: string;
}

const GET_SESSION_TIMEOUT_MS = 5_000;

async function getSessionWithTimeout(): Promise<{ session: Session | null; error: string | null }> {
  console.log("AUTH GET SESSION");

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<{ timeout: true }>((resolve) => {
    timeoutId = setTimeout(() => resolve({ timeout: true }), GET_SESSION_TIMEOUT_MS);
  });

  try {
    const sessionPromise = supabase.auth
      .getSession()
      .then(({ data }) => ({ session: data.session }))
      .catch((err) => {
        throw err;
      });

    const result = await Promise.race([sessionPromise, timeoutPromise]);

    if ("timeout" in result) {
      console.log("AUTH SESSION RESULT", null);
      console.log("AUTH USER", null);
      return {
        session: null,
        error: "Tempo limite de autenticação atingido. Verifique sua conexão e tente novamente.",
      };
    }

    console.log("AUTH SESSION RESULT", result.session);
    console.log("AUTH USER", result.session?.user?.id ?? null);
    return { session: result.session, error: null };
  } catch (err: any) {
    const message = err?.message ?? "Falha ao consultar sessão.";
    console.log("AUTH SESSION RESULT", null);
    console.log("AUTH USER", null);
    console.error("AUTH GET SESSION ERROR", err);
    return { session: null, error: message };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Hook centralizado de autenticação.
 *
 * Usa somente APIs oficiais do Supabase (getSession + onAuthStateChange),
 * com timeout de 5s para garantir que loading nunca fique infinito.
 */
export function useAuth(options?: UseAuthOptions): AuthState {
  const { redirectToLogin = false, loginPath = "/login" } = options ?? {};
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const finishLoading = () => {
      if (!active) return;
      setLoading(false);
      console.log("AUTH LOADING FALSE");
    };

    const applySession = (nextSession: Session | null, nextError: string | null) => {
      if (!active) return;
      setSession(nextSession);
      setError(nextError);
      finishLoading();
    };

    const bootstrap = async () => {
      console.log("AUTH START");
      setLoading(true);
      setError(null);
      const initial = await getSessionWithTimeout();
      applySession(initial.session, initial.error);
    };

    const handlePageShow = async () => {
      console.log("AUTH START");
      setLoading(true);
      setError(null);
      const fresh = await getSessionWithTimeout();
      applySession(fresh.session, fresh.error);
    };

    void bootstrap();
    window.addEventListener("pageshow", handlePageShow);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!active) return;
      console.log("AUTH EVENT", event);
      if (event === "SIGNED_OUT") {
        setSession(null);
      } else {
        setSession(newSession);
      }
      if (newSession?.user) {
        setError(null);
      }
      finishLoading();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!redirectToLogin) return;
    if (loading) return;
    if (error) return;
    if (session?.user) return;

    const currentPath = window.location.pathname;
    if (currentPath === loginPath) return;

    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const target = `${loginPath}?redirect=${encodeURIComponent(current)}`;
    window.location.assign(target);
  }, [loading, session, error, redirectToLogin, loginPath]);

  return { session, user: session?.user ?? null, loading, error };
}
