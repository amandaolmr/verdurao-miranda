/**
 * AuthContext — fonte única de verdade para autenticação em toda a aplicação.
 *
 * Problema anterior: cada componente que chamava useAuth() criava seu próprio
 * estado independente com uma chamada separada a getSession() e um listener
 * onAuthStateChange próprio. Isso causava race conditions e carregamentos
 * duplicados na restauração de sessão.
 *
 * Solução: AuthProvider monta UMA vez na raiz e compartilha o estado via
 * React Context. Todos os useAuth() lêem desse contexto único — zero chamadas
 * duplicadas, zero race conditions.
 *
 * Campos expostos:
 *  session     — sessão Supabase (null quando não autenticado)
 *  user        — atalho para session.user
 *  loading     — true apenas durante a resolução inicial (antes de initialized)
 *  initialized — torna-se true após a primeira resolução e NUNCA retorna a false
 *                Use isso, e não apenas loading, para evitar loops infinitos.
 *  error       — mensagem de erro se getSession falhar
 */
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** true enquanto a sessão ainda não foi resolvida na inicialização */
  loading: boolean;
  /**
   * Torna-se true após a primeira resolução de getSession().
   * Nunca volta a false — use isso para proteger páginas e evitar loops.
   */
  initialized: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  initialized: false,
  error: null,
});

/** TTL da sessão administrativa: 12 horas */
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const ADMIN_LOGIN_KEY = "admin_login_at";

/** Verifica se a sessão de admin expirou (>12h desde o login) */
function isAdminSessionExpired(): boolean {
  if (typeof window === "undefined") return false;
  const ts = localStorage.getItem(ADMIN_LOGIN_KEY);
  if (!ts) return false;
  return Date.now() - Number(ts) > ADMIN_SESSION_TTL_MS;
}

function isAdminPath(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.pathname.startsWith("/admin");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const initializedRef = useRef(false);

  /** Marca a autenticação como resolvida (executado uma única vez) */
  function markInitialized() {
    if (!initializedRef.current) {
      initializedRef.current = true;
      setInitialized(true);
    }
    setLoading(false);
    console.log("[Auth] INITIALIZED");
  }

  useEffect(() => {
    mountedRef.current = true;

    // Safety timer: força loading=false se getSession + onAuthStateChange não
    // responderem em 8s (ex: Safari iOS com initializePromise travada).
    const safetyTimer = setTimeout(() => {
      if (!mountedRef.current) return;
      console.warn("[Auth] Safety timer — forcing initialized after 8s");
      markInitialized();
    }, 8_000);

    async function bootstrap() {
      console.log("[Auth] bootstrap START");
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!mountedRef.current) return;

        if (sessionError) {
          console.error("[Auth] getSession error:", sessionError);
          setError(sessionError.message);
          setSession(null);
        } else {
          const s = data.session;

          // Verifica expiração da sessão de admin (>12h)
          if (s && isAdminPath() && isAdminSessionExpired()) {
            console.warn("[Auth] Admin session expired (>12h) — signing out");
            await supabase.auth.signOut();
            localStorage.removeItem(ADMIN_LOGIN_KEY);
            setSession(null);
            setError(null);
          } else {
            console.log("[Auth] session=", s?.user?.id ?? null);
            setSession(s);
            setError(null);
          }
        }
      } catch (err: any) {
        if (!mountedRef.current) return;
        console.error("[Auth] bootstrap error:", err);
        setError(err?.message ?? "Falha ao consultar sessão.");
        setSession(null);
      } finally {
        clearTimeout(safetyTimer);
        if (mountedRef.current) markInitialized();
      }
    }

    // Revalida sessão ao retornar via bfcache (Safari iOS / volta do WhatsApp)
    async function handlePageShow(e: PageTransitionEvent) {
      if (!e.persisted) return;
      console.log("[Auth] pageshow — revalidating session");
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!mountedRef.current) return;

        if (sessionError) {
          setError(sessionError.message);
          setSession(null);
        } else {
          const s = data.session;
          if (s && isAdminPath() && isAdminSessionExpired()) {
            await supabase.auth.signOut();
            localStorage.removeItem(ADMIN_LOGIN_KEY);
            setSession(null);
          } else {
            setSession(s);
            setError(null);
          }
        }
      } catch {
        // Silencioso — deixa a sessão atual intacta em caso de falha de rede
      }
    }

    void bootstrap();
    window.addEventListener("pageshow", handlePageShow);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mountedRef.current) return;
      console.log("[Auth] event=", event, "user=", newSession?.user?.id ?? null);

      if (event === "SIGNED_OUT") {
        setSession(null);
        setError(null);
        localStorage.removeItem(ADMIN_LOGIN_KEY);
      } else if (event === "SIGNED_IN" && newSession) {
        // Registra timestamp do login de admin para controle de TTL (12h)
        if (isAdminPath() && !localStorage.getItem(ADMIN_LOGIN_KEY)) {
          localStorage.setItem(ADMIN_LOGIN_KEY, String(Date.now()));
        }
        setSession(newSession);
        setError(null);
      } else if (newSession) {
        setSession(newSession);
        setError(null);
      }

      // Garante que initialized seja marcado mesmo se onAuthStateChange chegar
      // antes do bootstrap em edge cases.
      if (!initializedRef.current) markInitialized();
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
      window.removeEventListener("pageshow", handlePageShow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        initialized,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Hook interno para ler o contexto de auth. Use useAuth() nas páginas. */
export function useAuthContext(): AuthContextValue {
  return useContext(AuthContext);
}
