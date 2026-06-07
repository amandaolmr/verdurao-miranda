import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

/**
 * Lê a sessão diretamente do localStorage de forma síncrona.
 *
 * Evita esperar por initializePromise (que pode travar no Safari/iOS).
 * Se encontrar uma sessão com refresh_token válido, retorna-a imediatamente.
 * O onAuthStateChange cuidará de atualizar com a sessão validada/renovada.
 */
function readSessionFromStorage(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const projectRef = (import.meta.env.VITE_SUPABASE_URL as string)?.match(
      /https?:\/\/([^.]+)\./,
    )?.[1];
    if (!projectRef) return null;
    const raw = localStorage.getItem(`sb-${projectRef}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Só retorna se tiver refresh_token — sessão sem ele não é renovável
    if (!parsed?.refresh_token) return null;
    return parsed as Session;
  } catch {
    return null;
  }
}

/**
 * Hook centralizado de autenticação.
 *
 * Lê a sessão imediatamente do localStorage (síncrono) para evitar flash
 * de "login required" durante navegação SPA. O onAuthStateChange atualiza
 * o estado quando o token é renovado ou o usuário faz login/logout.
 *
 * O safety timer de 10s previne tela de carregamento infinita no Safari/iOS
 * quando initializePromise trava por falta de rede.
 */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(readSessionFromStorage);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let resolved = false;

    // Safety timer: se INITIAL_SESSION não disparar em 10s (Safari/iOS sem rede),
    // força loading=false para não bloquear a UI indefinidamente.
    const safetyTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn("[Auth] INITIAL_SESSION não disparou em 10s — forçando loading=false");
        setLoading(false);
      }
    }, 10_000);

    // Ao retornar de um app externo via bfcache (iOS Safari), o INITIAL_SESSION
    // não dispara novamente — forçamos re-verificação.
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        supabase.auth
          .getSession()
          .then(({ data }) => {
            setSession(data.session);
            setLoading(false);
          })
          .catch(() => {
            /* noop */
          });
      }
    };
    window.addEventListener("pageshow", handlePageShow);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "INITIAL_SESSION") {
        resolved = true;
        clearTimeout(safetyTimer);
        setSession(newSession);
        setLoading(false);
        console.log("[Auth] INITIAL_SESSION", newSession?.user?.email ?? "não autenticado");
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        console.log("[Auth]", event, newSession?.user?.email ?? "");
        setSession(newSession);
      } else if (event === "SIGNED_OUT") {
        console.log("[Auth] SIGNED_OUT");
        setSession(null);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}
