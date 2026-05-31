-- Tabela de perfil do cliente
-- A tabela já existe na migration inicial; garantir colunas e permissões corretas
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS telefone TEXT;

-- Garantir permissão de INSERT para usuários autenticados
GRANT INSERT ON public.clientes TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clientes' AND policyname = 'Cliente lê seu perfil') THEN
    CREATE POLICY "Cliente lê seu perfil" ON public.clientes FOR SELECT TO authenticated USING (id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clientes' AND policyname = 'Cliente cria seu perfil') THEN
    CREATE POLICY "Cliente cria seu perfil" ON public.clientes FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clientes' AND policyname = 'Cliente atualiza seu perfil') THEN
    CREATE POLICY "Cliente atualiza seu perfil" ON public.clientes FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- Tabela de endereços do cliente
CREATE TABLE IF NOT EXISTS public.enderecos_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  rua TEXT NOT NULL,
  numero TEXT NOT NULL,
  complemento TEXT,
  referencia TEXT,
  bairro_id UUID REFERENCES public.bairros(id),
  principal BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.enderecos_cliente ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'enderecos_cliente' AND policyname = 'Cliente lê seus endereços') THEN
    CREATE POLICY "Cliente lê seus endereços" ON public.enderecos_cliente FOR SELECT TO authenticated USING (cliente_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'enderecos_cliente' AND policyname = 'Cliente cria endereços') THEN
    CREATE POLICY "Cliente cria endereços" ON public.enderecos_cliente FOR INSERT TO authenticated WITH CHECK (cliente_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'enderecos_cliente' AND policyname = 'Cliente atualiza endereços') THEN
    CREATE POLICY "Cliente atualiza endereços" ON public.enderecos_cliente FOR UPDATE TO authenticated USING (cliente_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'enderecos_cliente' AND policyname = 'Cliente exclui endereços') THEN
    CREATE POLICY "Cliente exclui endereços" ON public.enderecos_cliente FOR DELETE TO authenticated USING (cliente_id = auth.uid());
  END IF;
END $$;
