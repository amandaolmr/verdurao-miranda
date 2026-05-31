-- Criar tabela de configurações da loja (registro único)
CREATE TABLE IF NOT EXISTS public.configuracoes_loja (
  id                    INTEGER PRIMARY KEY DEFAULT 1,
  nome_loja             TEXT NOT NULL DEFAULT 'Verdurão Miranda',
  descricao             TEXT,
  whatsapp              TEXT,
  telefone              TEXT,
  rua                   TEXT,
  numero                TEXT,
  bairro                TEXT,
  cidade                TEXT,
  horario_funcionamento TEXT,
  valor_minimo_pedido   NUMERIC(10,2) DEFAULT 0,
  logo_url              TEXT,
  banner_url            TEXT,
  atualizado_em         TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir apenas um registro
ALTER TABLE public.configuracoes_loja
  ADD CONSTRAINT configuracoes_loja_single_row CHECK (id = 1);

-- Inserir registro inicial com defaults
INSERT INTO public.configuracoes_loja (id, nome_loja, whatsapp)
VALUES (1, 'Verdurão Miranda', '5500999999999')
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS
ALTER TABLE public.configuracoes_loja ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa pode ler
CREATE POLICY "Config pública" ON public.configuracoes_loja
  FOR SELECT TO public USING (true);

-- Apenas admins podem atualizar
CREATE POLICY "Admin pode atualizar config" ON public.configuracoes_loja
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid())
  );
