import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ConfigLoja {
  id: number;
  nome_loja: string;
  descricao: string | null;
  whatsapp: string | null;
  telefone: string | null;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  horario_funcionamento: string | null;
  valor_minimo_pedido: number | null;
  logo_url: string | null;
  banner_url: string | null;
  atualizado_em: string | null;
}

export function useConfig() {
  const [config, setConfig] = useState<ConfigLoja | null>(null);

  useEffect(() => {
    supabase
      .from("configuracoes_loja")
      .select("*")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data) setConfig(data as ConfigLoja);
      });
  }, []);

  return config;
}
