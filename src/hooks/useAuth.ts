import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

interface UseAuthOptions {
  redirectToLogin?: boolean;
  loginPath?: string;
}

const GET_SESSION_TIMEOUT_MS = 5_000;

async function getSessionWithTimeout(): Promise<Session | null> {
  console.log("[AUTH] getSession start");

  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), GET_SESSION_TIMEOUT_MS);
  });

  try {
    const sessionPromise = supabase.auth
      .getSession()
      .then(({ data }) => data.session)
      .catch(() => null);

    const session = await Promise.race([sessionPromise, timeoutPromise]);
    console.log("[AUTH] getSession result", session);
    console.log("[AUTH] user", session?.user?.id);
    return session;
  } catch {
    console.log("[AUTH] getSession result", null);
    console.log("[AUTH] user", undefined);
    return null;
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

  useEffect(() => {
    let active = true;

    const applySession = (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    };

    const bootstrap = async () => {
      setLoading(true);
      const initialSession = await getSessionWithTimeout();
      applySession(initialSession);
    };

    const handlePageShow = async () => {
      const freshSession = await getSessionWithTimeout();
      applySession(freshSession);
    };

    void bootstrap();
    window.addEventListener("pageshow", handlePageShow);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        setSession(null);
      } else {
        setSession(newSession);
      }
      setLoading(false);
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
    if (session?.user) return;

    const currentPath = window.location.pathname;
    if (currentPath === loginPath) return;

    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const target = `${loginPath}?redirect=${encodeURIComponent(current)}`;
    window.location.assign(target);
  }, [loading, session, redirectToLogin, loginPath]);

  return { session, user: session?.user ?? null, loading };
}
