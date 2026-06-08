-- =============================================================================
-- ÍNDICES DE PERFORMANCE — Tela "Meus Pedidos"
-- =============================================================================
--
-- PROBLEMA: queries na tela de pedidos ultrapassavam 20s em produção.
--
-- CAUSA RAIZ: ausência de índices nas colunas usadas em WHERE, ORDER BY e JOINs.
--   Sem índices, PostgreSQL faz sequential scan da tabela inteira para:
--     1. SELECT ... FROM pedidos WHERE cliente_id = $1 ORDER BY criado_em DESC
--     2. RLS policy: auth.uid() = cliente_id  (avaliada linha a linha)
--     3. SELECT ... FROM itens_pedido WHERE pedido_id = $1
--     4. RLS de itens_pedido: EXISTS (SELECT 1 FROM pedidos WHERE id = pedido_id AND cliente_id = auth.uid())
--        — sem índice em pedido_id, esse EXISTS roda como N+1 scan
--     5. JOIN itens_pedido → produtos via produto_id
--
-- SOLUÇÃO: índices nas 4 colunas críticas + ANALYZE para atualizar estatísticas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. pedidos(cliente_id)
--    Acelera: WHERE cliente_id = $1 e a RLS "auth.uid() = cliente_id"
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_id
    ON public.pedidos(cliente_id);

-- -----------------------------------------------------------------------------
-- 2. pedidos(cliente_id, criado_em DESC)  — índice composto
--    Acelera: WHERE cliente_id = $1 ORDER BY criado_em DESC
--    PostgreSQL pode satisfazer a query inteira por index scan, sem filesort.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_criado_em
    ON public.pedidos(cliente_id, criado_em DESC);

-- -----------------------------------------------------------------------------
-- 3. itens_pedido(pedido_id)
--    Acelera: WHERE pedido_id = $1 e o EXISTS subquery da RLS:
--      EXISTS (SELECT 1 FROM pedidos WHERE id = pedido_id AND cliente_id = auth.uid())
--    Sem este índice, a RLS avalia um full scan de itens_pedido por pedido.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_itens_pedido_pedido_id
    ON public.itens_pedido(pedido_id);

-- -----------------------------------------------------------------------------
-- 4. itens_pedido(produto_id)
--    Acelera: JOIN implícito SELECT *, produtos(...) FROM itens_pedido
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_itens_pedido_produto_id
    ON public.itens_pedido(produto_id);

-- -----------------------------------------------------------------------------
-- Atualiza estatísticas do planner para que os índices sejam usados imediatamente
-- -----------------------------------------------------------------------------
ANALYZE public.pedidos;
ANALYZE public.itens_pedido;
ANALYZE public.produtos;
