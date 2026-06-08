/**
 * useAuth — wrapper fino sobre AuthContext.
 *
 * O estado de autenticação é resolvido UMA única vez no AuthProvider (raiz),
 * sem chamadas duplicadas a getSession() ou listeners paralelos.
 *
 * Campos adicionados vs. versão anterior:
 *  initialized — true após a primeira resolução; nunca volta a false.
 *                Use junto com loading para evitar loops infinitos.
 */
import { useEffect } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useAuthContext } from "./AuthContext";

export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** true após a primeira resolução de autenticação; nunca retorna a false */
  initialized: boolean;
  error: string | null;
}

interface UseAuthOptions {
  /** Se true, redireciona para loginPath quando auth resolvido e sem sessão. */
  redirectToLogin?: boolean;
  loginPath?: string;
}

/**
 * Hook de autenticação — lê do AuthContext global (fonte única de verdade).
 *
 * Não cria estado próprio nem chama getSession() diretamente.
 * Todo o estado é compartilhado via AuthProvider montado na raiz da app.
 */
export function useAuth(options?: UseAuthOptions): AuthState {
  const { redirectToLogin = false, loginPath = "/login" } = options ?? {};
  const auth = useAuthContext();

  // Redireciona para login quando auth resolvido e sem sessão.
  // Usa `initialized` (e não apenas `loading`) para não redirecionar antes
  // de a primeira resolução terminar — evita loop em retorno de app externo.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!redirectToLogin) return;
    if (!auth.initialized || auth.loading) return;
    if (auth.error) return;
    if (auth.session?.user) return;

    const currentPath = window.location.pathname;
    if (currentPath === loginPath) return;

    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.assign(`${loginPath}?redirect=${encodeURIComponent(current)}`);
  }, [auth.initialized, auth.loading, auth.session, auth.error, redirectToLogin, loginPath]);

  return auth;
}
