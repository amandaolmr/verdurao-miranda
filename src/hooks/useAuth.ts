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
 * loading vira false.
 */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      // INITIAL_SESSION dispara uma vez ao montar, com a sessão restaurada
      // (ou null se não autenticado). Marca loading como false apenas aqui.
      if (event === "INITIAL_SESSION") {
        setSession(newSession);
        setLoading(false);
        return;
      }

      // Eventos subsequentes atualizam o estado normalmente
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        setSession(newSession);
      } else if (event === "SIGNED_OUT") {
        setSession(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}
