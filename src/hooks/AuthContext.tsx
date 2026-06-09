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
    console.log("[Auth] auth ready");
  }

  useEffect(() => {
    mountedRef.current = true;
    console.log("[Auth] app mounted");

    // Safety timer: INITIAL_SESSION deve disparar em < 100ms (leitura de
    // localStorage). 3s cobre casos extremos — SSR, localStorage lento,
    // estado quebrado. NÃO chama getSession() para não travar na rede.
    const safetyTimer = setTimeout(() => {
      if (initializedRef.current || !mountedRef.current) return;
      console.warn("[Auth] Safety timer — forcing initialized after 3s");
      markInitialized();
    }, 3_000);

    // ─────────────────────────────────────────────────────────────────────────
    // PADRÃO CORRETO: onAuthStateChange registrado PRIMEIRO.
    //
    // INITIAL_SESSION dispara imediatamente com a sessão do localStorage —
    // SEM chamada de rede. Isso garante initialized=true em < 100ms.
    //
    // Quando o access_token está expirado, o Supabase o renova em background
    // via autoRefreshToken e dispara TOKEN_REFRESHED — a sessão é atualizada
    // sem bloquear o carregamento inicial.
    //
    // POR QUÊ REMOVEMOS getSession() DO BOOTSTRAP:
    // getSession() aguarda initializePromise internamente. Se o token está
    // expirado, faz chamada de rede ao /auth/v1/token. No Supabase free tier,
    // essa chamada pode levar 8–30s (cold start). O safety timer disparava
    // com session=null, o app redirecionava para /login, e só depois a sessão
    // válida chegava — tarde demais.
    // ─────────────────────────────────────────────────────────────────────────
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mountedRef.current) return;
      console.log("[Auth] event=", event, "user=", newSession?.user?.id ?? null);

      if (event === "INITIAL_SESSION") {
        // Sessão lida do localStorage — sem rede, instantâneo
        const s = newSession;
        if (s && isAdminPath() && isAdminSessionExpired()) {
          console.warn("[Auth] Admin session expired (>12h) — signing out");
          void supabase.auth.signOut();
          localStorage.removeItem(ADMIN_LOGIN_KEY);
          setSession(null);
        } else {
          console.log("[Auth] session loaded — user=", s?.user?.id ?? "null");
          setSession(s);
          setError(null);
        }
        clearTimeout(safetyTimer);
        markInitialized();
      } else if (event === "TOKEN_REFRESHED") {
        // Token renovado em background pelo autoRefreshToken — atualiza sessão
        console.log("[Auth] token refreshed — user=", newSession?.user?.id ?? null);
        setSession(newSession);
        setError(null);
      } else if (event === "SIGNED_IN") {
        // Login bem-sucedido (formulário ou OAuth)
        console.log("[Auth] user loaded — user=", newSession?.user?.id ?? null);
        if (newSession && isAdminPath() && !localStorage.getItem(ADMIN_LOGIN_KEY)) {
          localStorage.setItem(ADMIN_LOGIN_KEY, String(Date.now()));
        }
        setSession(newSession);
        setError(null);
        if (!initializedRef.current) markInitialized();
      } else if (event === "SIGNED_OUT") {
        console.log("[Auth] signed out");
        setSession(null);
        setError(null);
        localStorage.removeItem(ADMIN_LOGIN_KEY);
        if (!initializedRef.current) markInitialized();
      } else if (newSession) {
        setSession(newSession);
        setError(null);
      }
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
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
