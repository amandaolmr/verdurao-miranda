import { useEffect, useRef, useState } from "react";
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

const AUTH_WATCHDOG_MS = 5_000;

function readSessionFromStorage(): Session | null {
  if (typeof window === "undefined") return null;

  try {
    const projectRef = (import.meta.env.VITE_SUPABASE_URL as string)?.match(
      /https?:\/\/([^.]+)\./,
    )?.[1];
    if (!projectRef) return null;

    const raw = localStorage.getItem(`sb-${projectRef}-auth-token`);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as any;
    const candidate = Array.isArray(parsed)
      ? parsed[0]
      : (parsed?.currentSession ?? parsed?.session ?? parsed);

    if (!candidate?.access_token || !candidate?.user) return null;
    return candidate as Session;
  } catch {
    return null;
  }
}

async function getSessionWithDiagnostics(): Promise<{
  session: Session | null;
  error: string | null;
}> {
  console.log("AUTH GET SESSION");

  const startedAt = Date.now();
  const timeoutId = setTimeout(() => {
    console.warn("AUTH TIMEOUT", `getSession ainda pendente após ${AUTH_WATCHDOG_MS}ms`);
  }, AUTH_WATCHDOG_MS);
  console.time("auth");

  let session: Session | null = null;
  let error: string | null = null;

  try {
    const { data } = await supabase.auth.getSession();
    session = data.session;

    // Diagnóstico adicional para Safari iOS: detecta getUser pendente/erro sem bloquear UI.
    const getUserWatchdog = setTimeout(() => {
      console.warn("AUTH TIMEOUT", `getUser ainda pendente após ${AUTH_WATCHDOG_MS}ms`);
    }, AUTH_WATCHDOG_MS);
    try {
      await supabase.auth.getUser();
    } catch (userErr) {
      console.error("AUTH GET SESSION ERROR", userErr);
    } finally {
      clearTimeout(getUserWatchdog);
    }
  } catch (err: any) {
    console.error("AUTH GET SESSION ERROR", err);
    error = err?.message ?? "Falha ao consultar sessão.";
  } finally {
    clearTimeout(timeoutId);
    console.log("AUTH SESSION RESULT", session);
    console.log("AUTH USER", session?.user?.id ?? null);
    console.log("AUTH ELAPSED MS", Date.now() - startedAt);
    console.timeEnd("auth");
  }

  return { session, error };
}

/**
 * Hook centralizado de autenticação.
 *
 * Usa somente APIs oficiais do Supabase (getSession + onAuthStateChange),
 * com timeout de 5s para garantir que loading nunca fique infinito.
 */
export function useAuth(options?: UseAuthOptions): AuthState {
  const { redirectToLogin = false, loginPath = "/login" } = options ?? {};
  const [session, setSession] = useState<Session | null>(readSessionFromStorage);
  const [loading, setLoading] = useState(() => !readSessionFromStorage());
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

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
      const optimistic = readSessionFromStorage();
      if (optimistic?.user) {
        setSession(optimistic);
        setError(null);
        finishLoading();
      } else {
        setLoading(true);
      }

      setError(null);
      const initial = await getSessionWithDiagnostics();

      // Não transforma lentidão em erro fatal; só exibe erro se não houver sessão válida.
      const fallbackSession = optimistic ?? sessionRef.current;
      const nextSession = initial.session ?? fallbackSession ?? null;
      const nextError = nextSession ? null : initial.error;
      applySession(nextSession, nextError);
    };

    const handlePageShow = async () => {
      console.log("AUTH START");
      if (!sessionRef.current?.user) {
        setLoading(true);
      }
      setError(null);
      const fresh = await getSessionWithDiagnostics();
      const nextSession = fresh.session ?? sessionRef.current ?? null;
      const nextError = nextSession ? null : fresh.error;
      applySession(nextSession, nextError);
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
