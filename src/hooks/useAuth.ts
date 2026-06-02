import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

/**
 * Hook centralizado de autenticação.
 *
 * Usa onAuthStateChange (evento INITIAL_SESSION) para restaurar sessão
 * de forma confiável após reload, mesmo quando o refresh token do Google
 * precisa de uma chamada de rede para ser validado.
 *
 * Nunca trava a aplicação: após a resolução (seja com sessão ou sem),
 * loading vira false. Timeout de segurança de 5s garante que loading
 * nunca persiste indefinidamente.
 */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let resolved = false;

    console.log("[Auth] LOADING START");

    // Timeout de segurança: se INITIAL_SESSION não disparar em 10s,
    // força loading=false para evitar tela de carregamento infinita.
    const safetyTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn("[Auth] INITIAL_SESSION não disparou em 10s — forçando loading=false");
        console.log("[Auth] LOADING END (timeout)");
        setLoading(false);
      }
    }, 10_000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      // INITIAL_SESSION dispara uma vez ao montar, com a sessão restaurada
      // (ou null se não autenticado). Marca loading como false apenas aqui.
      if (event === "INITIAL_SESSION") {
        resolved = true;
        clearTimeout(safetyTimer);
        setSession(newSession);
        setLoading(false);
        console.log("[Auth] SESSION", newSession);
        console.log("[Auth] USER", newSession?.user ?? null);
        if (newSession) {
          console.log("[Auth] Sessão encontrada para:", newSession.user.email);
        } else {
          console.log("[Auth] Sessão não encontrada (usuário não autenticado)");
        }
        console.log("[Auth] LOADING END");
        return;
      }

      // Eventos subsequentes atualizam o estado normalmente
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        console.log("[Auth]", event, newSession?.user?.email ?? "");
        console.log("[Auth] SESSION", newSession);
        console.log("[Auth] USER", newSession?.user ?? null);
        setSession(newSession);
      } else if (event === "SIGNED_OUT") {
        console.log("[Auth] SIGNED_OUT");
        setSession(null);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}
