-- =============================================================
-- VERDURÃO MIRANDA — Script de inicialização do banco de dados
-- Execute este arquivo completo no SQL Editor do Supabase
-- (Dashboard → SQL Editor → New Query → Cole tudo → Run)
-- =============================================================


-- ─────────────────────────────────────────────
-- 1. EXTENSÕES
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ─────────────────────────────────────────────
-- 2. TABELAS PRINCIPAIS
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    imagem_url TEXT,
    ordem INTEGER,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);
ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS ordem INTEGER;

CREATE TABLE IF NOT EXISTS public.bairros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    taxa_entrega DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.produtos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    categoria_id UUID REFERENCES public.categorias(id),
    nome TEXT NOT NULL,
    descricao TEXT,
    preco DECIMAL(10,2) NOT NULL,
    unidade_venda TEXT NOT NULL DEFAULT 'UN',
    estoque DECIMAL(10,2) NOT NULL DEFAULT 0,
    imagem_url TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    permite_fracionamento BOOLEAN NOT NULL DEFAULT false,
    quantidade_minima NUMERIC(10,3) DEFAULT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);
ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS check_unidade_venda;
ALTER TABLE public.produtos ADD CONSTRAINT check_unidade_venda CHECK (unidade_venda IN ('KG','G','UN','DZ','MACO','BANDEJA'));
ALTER TABLE public.produtos ALTER COLUMN unidade_venda SET DEFAULT 'UN';
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS permite_fracionamento BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS quantidade_minima NUMERIC(10,3) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT,
    email TEXT,
    telefone TEXT,
    avatar_url TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS telefone TEXT;

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

CREATE TABLE IF NOT EXISTS public.administrador (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    usuario TEXT UNIQUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);
ALTER TABLE public.administrador ADD COLUMN IF NOT EXISTS usuario TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS public.pedidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES public.clientes(id),
    nome_cliente TEXT NOT NULL,
    telefone TEXT NOT NULL,
    bairro_id UUID REFERENCES public.bairros(id),
    rua TEXT,
    numero TEXT,
    complemento TEXT,
    referencia TEXT,
    forma_pagamento TEXT NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    taxa_entrega DECIMAL(10,2) NOT NULL,
    valor_total DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'Novo Pedido',
    precisa_troco BOOLEAN DEFAULT NULL,
    valor_troco NUMERIC(10,2) DEFAULT NULL,
    tipo_recebimento TEXT NOT NULL DEFAULT 'ENTREGA',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS precisa_troco BOOLEAN DEFAULT NULL;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS valor_troco NUMERIC(10,2) DEFAULT NULL;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS tipo_recebimento TEXT NOT NULL DEFAULT 'ENTREGA';
ALTER TABLE public.pedidos ALTER COLUMN rua DROP NOT NULL;
ALTER TABLE public.pedidos ALTER COLUMN numero DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.itens_pedido (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pedido_id UUID REFERENCES public.pedidos(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES public.produtos(id),
    quantidade NUMERIC(10,3) NOT NULL,
    valor_unitario DECIMAL(10,2) NOT NULL,
    valor_total DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.configuracoes_loja (
    id INTEGER PRIMARY KEY DEFAULT 1,
    nome_loja TEXT NOT NULL DEFAULT 'Verdurão Miranda',
    descricao TEXT,
    whatsapp TEXT,
    telefone TEXT,
    rua TEXT,
    numero TEXT,
    bairro TEXT,
    cidade TEXT,
    horario_funcionamento TEXT,
    valor_minimo_pedido NUMERIC(10,2) DEFAULT 0,
    logo_url TEXT,
    banner_url TEXT,
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.configuracoes_loja DROP CONSTRAINT IF EXISTS configuracoes_loja_single_row;
ALTER TABLE public.configuracoes_loja ADD CONSTRAINT configuracoes_loja_single_row CHECK (id = 1);

INSERT INTO public.configuracoes_loja (id, nome_loja, whatsapp)
VALUES (1, 'Verdurão Miranda', '')
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────
-- 3. PERMISSÕES (GRANT)
-- ─────────────────────────────────────────────
GRANT SELECT ON public.categorias TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categorias TO authenticated;
GRANT ALL ON public.categorias TO service_role;

GRANT SELECT ON public.bairros TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.bairros TO authenticated;
GRANT ALL ON public.bairros TO service_role;

GRANT SELECT ON public.produtos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
GRANT ALL ON public.produtos TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.enderecos_cliente TO authenticated;
GRANT ALL ON public.enderecos_cliente TO service_role;

GRANT SELECT ON public.administrador TO authenticated;
GRANT ALL ON public.administrador TO service_role;

GRANT SELECT, INSERT ON public.pedidos TO anon, authenticated;
GRANT UPDATE ON public.pedidos TO authenticated;
GRANT ALL ON public.pedidos TO service_role;

GRANT SELECT, INSERT ON public.itens_pedido TO anon, authenticated;
GRANT ALL ON public.itens_pedido TO service_role;

GRANT SELECT ON public.configuracoes_loja TO public;
GRANT UPDATE ON public.configuracoes_loja TO authenticated;
GRANT ALL ON public.configuracoes_loja TO service_role;


-- ─────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bairros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enderecos_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_loja ENABLE ROW LEVEL SECURITY;

-- Categorias
DROP POLICY IF EXISTS "Categorias visíveis para todos" ON public.categorias;
DROP POLICY IF EXISTS "Categorias são visíveis para todos" ON public.categorias;
DROP POLICY IF EXISTS "Admin gerencia categorias" ON public.categorias;
DROP POLICY IF EXISTS "Administradores podem gerenciar categorias" ON public.categorias;
CREATE POLICY "Categorias visíveis para todos" ON public.categorias FOR SELECT USING (true);
CREATE POLICY "Admin gerencia categorias" ON public.categorias FOR ALL
    USING (EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()));

-- Bairros
DROP POLICY IF EXISTS "Bairros visíveis para todos" ON public.bairros;
DROP POLICY IF EXISTS "Bairros são visíveis para todos" ON public.bairros;
DROP POLICY IF EXISTS "Admin gerencia bairros" ON public.bairros;
DROP POLICY IF EXISTS "Administradores podem gerenciar bairros" ON public.bairros;
CREATE POLICY "Bairros visíveis para todos" ON public.bairros FOR SELECT USING (true);
CREATE POLICY "Admin gerencia bairros" ON public.bairros FOR ALL
    USING (EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()));

-- Produtos
DROP POLICY IF EXISTS "Produtos visíveis para todos" ON public.produtos;
DROP POLICY IF EXISTS "Produtos são visíveis para todos" ON public.produtos;
DROP POLICY IF EXISTS "Admin gerencia produtos" ON public.produtos;
DROP POLICY IF EXISTS "Administradores podem gerenciar produtos" ON public.produtos;
CREATE POLICY "Produtos visíveis para todos" ON public.produtos FOR SELECT
    USING (ativo = true OR EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()));
CREATE POLICY "Admin gerencia produtos" ON public.produtos FOR ALL
    USING (EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()));

-- Clientes
DROP POLICY IF EXISTS "Cliente lê seu perfil" ON public.clientes;
DROP POLICY IF EXISTS "Cliente cria seu perfil" ON public.clientes;
DROP POLICY IF EXISTS "Cliente atualiza seu perfil" ON public.clientes;
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.clientes;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.clientes;
CREATE POLICY "Cliente lê seu perfil" ON public.clientes FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Cliente cria seu perfil" ON public.clientes FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Cliente atualiza seu perfil" ON public.clientes FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Endereços do cliente
DROP POLICY IF EXISTS "Cliente lê seus endereços" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "Cliente cria endereços" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "Cliente atualiza endereços" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "Cliente exclui endereços" ON public.enderecos_cliente;
DROP POLICY IF EXISTS "Usuários gerenciam seus próprios endereços" ON public.enderecos_cliente;
CREATE POLICY "Cliente lê seus endereços" ON public.enderecos_cliente FOR SELECT TO authenticated USING (cliente_id = auth.uid());
CREATE POLICY "Cliente cria endereços" ON public.enderecos_cliente FOR INSERT TO authenticated WITH CHECK (cliente_id = auth.uid());
CREATE POLICY "Cliente atualiza endereços" ON public.enderecos_cliente FOR UPDATE TO authenticated USING (cliente_id = auth.uid());
CREATE POLICY "Cliente exclui endereços" ON public.enderecos_cliente FOR DELETE TO authenticated USING (cliente_id = auth.uid());

-- Administrador
DROP POLICY IF EXISTS "Admin vê seu próprio registro" ON public.administrador;
DROP POLICY IF EXISTS "Administradores podem ver seus próprios registros" ON public.administrador;
CREATE POLICY "Admin vê seu próprio registro" ON public.administrador FOR SELECT USING (auth.uid() = id);

-- Pedidos
DROP POLICY IF EXISTS "Usuários vêem seus pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Qualquer um pode criar pedido" ON public.pedidos;
DROP POLICY IF EXISTS "Admin vê todos os pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Admin atualiza pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Usuários vêem seus próprios pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Qualquer um pode criar um pedido" ON public.pedidos;
DROP POLICY IF EXISTS "Administradores podem ver todos os pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Administradores podem atualizar pedidos" ON public.pedidos;
CREATE POLICY "Usuários vêem seus pedidos" ON public.pedidos FOR SELECT USING (auth.uid() = cliente_id);
CREATE POLICY "Qualquer um pode criar pedido" ON public.pedidos FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin vê todos os pedidos" ON public.pedidos FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()));
CREATE POLICY "Admin atualiza pedidos" ON public.pedidos FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()));

-- Itens do pedido
DROP POLICY IF EXISTS "Usuários vêem itens de seus pedidos" ON public.itens_pedido;
DROP POLICY IF EXISTS "Qualquer um pode inserir itens" ON public.itens_pedido;
DROP POLICY IF EXISTS "Qualquer um pode inserir itens de pedido" ON public.itens_pedido;
CREATE POLICY "Usuários vêem itens de seus pedidos" ON public.itens_pedido FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id AND (p.cliente_id = auth.uid() OR auth.uid() IS NULL)));
CREATE POLICY "Qualquer um pode inserir itens" ON public.itens_pedido FOR INSERT WITH CHECK (true);

-- Configurações da loja
DROP POLICY IF EXISTS "Config pública" ON public.configuracoes_loja;
DROP POLICY IF EXISTS "Admin atualiza config" ON public.configuracoes_loja;
CREATE POLICY "Config pública" ON public.configuracoes_loja FOR SELECT TO public USING (true);
CREATE POLICY "Admin atualiza config" ON public.configuracoes_loja FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()));


-- ─────────────────────────────────────────────
-- 5. STORAGE BUCKET (imagens)
-- ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('imagens', 'imagens', true)
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Imagens são públicas' AND tablename = 'objects') THEN
    CREATE POLICY "Imagens são públicas" ON storage.objects FOR SELECT TO public USING (bucket_id = 'imagens');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin faz upload de imagens' AND tablename = 'objects') THEN
    CREATE POLICY "Admin faz upload de imagens" ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'imagens' AND EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin atualiza imagens' AND tablename = 'objects') THEN
    CREATE POLICY "Admin atualiza imagens" ON storage.objects FOR UPDATE TO authenticated
        USING (bucket_id = 'imagens' AND EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin deleta imagens' AND tablename = 'objects') THEN
    CREATE POLICY "Admin deleta imagens" ON storage.objects FOR DELETE TO authenticated
        USING (bucket_id = 'imagens' AND EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()));
  END IF;
END $$;


-- ─────────────────────────────────────────────
-- 6. FUNÇÃO get_admin_email (login por usuário)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_email(p_usuario TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF position('@' IN p_usuario) > 0 THEN
    SELECT email INTO v_email FROM public.administrador
    WHERE email = lower(trim(p_usuario)) LIMIT 1;
  ELSE
    SELECT email INTO v_email FROM public.administrador
    WHERE usuario = lower(trim(p_usuario)) LIMIT 1;
  END IF;
  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_admin_email(TEXT) TO authenticated;


-- ─────────────────────────────────────────────
-- 7. REALTIME (notificações ao vivo de pedidos)
-- ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'pedidos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
  END IF;
END $$;


-- =============================================================
-- APÓS rodar este script, execute o passo abaixo separadamente:
--
-- PASSO A: Crie o usuário admin em:
--   Dashboard → Authentication → Users → Add user
--   (informe o e-mail e senha do administrador)
--
-- PASSO B: Execute este INSERT (troque pelo e-mail real):
--
--   INSERT INTO public.administrador (id, email, usuario)
--   SELECT id, email, 'admin'
--   FROM auth.users
--   WHERE email = 'seu@email.com'
--   ON CONFLICT (id) DO UPDATE SET usuario = EXCLUDED.usuario;
--
-- PASSO C: Atualize o arquivo .env com as novas chaves do projeto.
-- =============================================================
