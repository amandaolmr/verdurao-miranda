-- Garante que o cliente autenticado pode ver seus próprios pedidos.
-- Esta policy pode estar ausente em produção pois não foi incluída
-- nas migrations originais (só estava no init.sql manual).

-- SELECT: cliente vê seus próprios pedidos
DROP POLICY IF EXISTS "Usuários vêem seus pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Usuários vêem seus próprios pedidos" ON public.pedidos;
CREATE POLICY "Usuários vêem seus pedidos" ON public.pedidos
    FOR SELECT USING (auth.uid() = cliente_id);

-- SELECT: cliente vê os itens de seus pedidos
-- (necessário para o join *, itens_pedido(...) no frontend)
DROP POLICY IF EXISTS "Usuários vêem itens de seus pedidos" ON public.itens_pedido;
CREATE POLICY "Usuários vêem itens de seus pedidos" ON public.itens_pedido
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.pedidos p
            WHERE p.id = pedido_id
              AND p.cliente_id = auth.uid()
        )
    );

-- Garante que clientes autenticados e anônimos podem inserir pedidos
-- (necessário para o fluxo de checkout funcionar)
DROP POLICY IF EXISTS "Qualquer um pode criar pedido" ON public.pedidos;
DROP POLICY IF EXISTS "Qualquer um pode criar um pedido" ON public.pedidos;
CREATE POLICY "Qualquer um pode criar pedido" ON public.pedidos
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Qualquer um pode inserir itens" ON public.itens_pedido;
DROP POLICY IF EXISTS "Qualquer um pode inserir itens de pedido" ON public.itens_pedido;
CREATE POLICY "Qualquer um pode inserir itens" ON public.itens_pedido
    FOR INSERT WITH CHECK (true);

-- Garante o GRANT de SELECT para clientes autenticados
GRANT SELECT ON public.pedidos TO authenticated;
GRANT SELECT ON public.itens_pedido TO authenticated;
