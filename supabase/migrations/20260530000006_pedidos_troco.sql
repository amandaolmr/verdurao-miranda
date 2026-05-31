-- Adiciona colunas de troco e tipo de recebimento na tabela pedidos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS precisa_troco BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valor_troco NUMERIC(10, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tipo_recebimento TEXT NOT NULL DEFAULT 'ENTREGA';

-- Torna rua e numero opcionais para pedidos de retirada
ALTER TABLE public.pedidos
  ALTER COLUMN rua DROP NOT NULL,
  ALTER COLUMN numero DROP NOT NULL;

-- Permite quantidade fracionada por produto
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS permite_fracionamento BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quantidade_minima NUMERIC(10, 3) DEFAULT NULL;

-- Aumenta precisão decimal da quantidade dos itens do pedido para suportar frações
ALTER TABLE public.itens_pedido
  ALTER COLUMN quantidade TYPE NUMERIC(10, 3) USING quantidade::NUMERIC(10, 3);
