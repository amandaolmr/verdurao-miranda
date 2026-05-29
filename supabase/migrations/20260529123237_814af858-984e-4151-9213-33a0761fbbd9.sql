-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: categorias
CREATE TABLE public.categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT SELECT ON public.categorias TO anon, authenticated;
GRANT ALL ON public.categorias TO service_role;

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categorias são visíveis para todos" ON public.categorias
    FOR SELECT USING (true);

-- Table: bairros
CREATE TABLE public.bairros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    taxa_entrega DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT SELECT ON public.bairros TO anon, authenticated;
GRANT ALL ON public.bairros TO service_role;

ALTER TABLE public.bairros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bairros são visíveis para todos" ON public.bairros
    FOR SELECT USING (true);

-- Table: produtos
CREATE TABLE public.produtos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    categoria_id UUID REFERENCES public.categorias(id),
    nome TEXT NOT NULL,
    descricao TEXT,
    preco DECIMAL(10,2) NOT NULL,
    unidade_venda TEXT NOT NULL, -- Kg, Grama, Unidade, Maço, Bandeja
    estoque DECIMAL(10,2) NOT NULL DEFAULT 0,
    imagem_url TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT SELECT ON public.produtos TO anon, authenticated;
GRANT ALL ON public.produtos TO service_role;

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Produtos são visíveis para todos" ON public.produtos
    FOR SELECT USING (ativo = true);

-- Table: clientes (Profile)
CREATE TABLE public.clientes (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT,
    email TEXT,
    telefone TEXT,
    avatar_url TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT SELECT, UPDATE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seu próprio perfil" ON public.clientes
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON public.clientes
    FOR UPDATE USING (auth.uid() = id);

-- Table: enderecos_cliente
CREATE TABLE public.enderecos_cliente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    bairro_id UUID REFERENCES public.bairros(id),
    rua TEXT NOT NULL,
    numero TEXT NOT NULL,
    complemento TEXT,
    referencia TEXT,
    principal BOOLEAN DEFAULT false,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.enderecos_cliente TO authenticated;
GRANT ALL ON public.enderecos_cliente TO service_role;

ALTER TABLE public.enderecos_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários gerenciam seus próprios endereços" ON public.enderecos_cliente
    FOR ALL USING (auth.uid() = cliente_id);

-- Table: pedidos
CREATE TABLE public.pedidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES public.clientes(id), -- Nullable for guests
    nome_cliente TEXT NOT NULL,
    telefone TEXT NOT NULL,
    bairro_id UUID REFERENCES public.bairros(id),
    rua TEXT NOT NULL,
    numero TEXT NOT NULL,
    complemento TEXT,
    referencia TEXT,
    forma_pagamento TEXT NOT NULL, -- PIX, Cartão, Dinheiro
    subtotal DECIMAL(10,2) NOT NULL,
    taxa_entrega DECIMAL(10,2) NOT NULL,
    valor_total DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'Novo Pedido', -- Novo Pedido, Separando, Saiu para Entrega, Entregue, Cancelado
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT SELECT, INSERT ON public.pedidos TO anon, authenticated;
GRANT ALL ON public.pedidos TO service_role;

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários vêem seus próprios pedidos" ON public.pedidos
    FOR SELECT USING (auth.uid() = cliente_id);

CREATE POLICY "Qualquer um pode criar um pedido" ON public.pedidos
    FOR INSERT WITH CHECK (true);

-- Table: itens_pedido
CREATE TABLE public.itens_pedido (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pedido_id UUID REFERENCES public.pedidos(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES public.produtos(id),
    quantidade DECIMAL(10,2) NOT NULL,
    valor_unitario DECIMAL(10,2) NOT NULL,
    valor_total DECIMAL(10,2) NOT NULL
);

GRANT SELECT, INSERT ON public.itens_pedido TO anon, authenticated;
GRANT ALL ON public.itens_pedido TO service_role;

ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários vêem itens de seus pedidos" ON public.itens_pedido
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id AND (p.cliente_id = auth.uid() OR auth.uid() IS NULL)));

CREATE POLICY "Qualquer um pode inserir itens de pedido" ON public.itens_pedido
    FOR INSERT WITH CHECK (true);

-- Table: administrador
CREATE TABLE public.administrador (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT SELECT ON public.administrador TO authenticated;
GRANT ALL ON public.administrador TO service_role;

ALTER TABLE public.administrador ENABLE ROW LEVEL SECURITY;

-- No public policies for admin table, only internal/service role access
