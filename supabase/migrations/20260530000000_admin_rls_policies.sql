-- Grant write permissions to authenticated users (filtered by RLS policies below)
GRANT INSERT, UPDATE, DELETE ON public.categorias TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.bairros TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
GRANT UPDATE ON public.pedidos TO authenticated;

-- Categorias: admin can insert, update, delete
CREATE POLICY "Administradores podem gerenciar categorias" ON public.categorias
    FOR ALL USING (EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()));

-- Bairros: admin can insert, update, delete
CREATE POLICY "Administradores podem gerenciar bairros" ON public.bairros
    FOR ALL USING (EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()));

-- Produtos: admin can see all (including inactive) and manage
DROP POLICY IF EXISTS "Produtos são visíveis para todos" ON public.produtos;

CREATE POLICY "Produtos são visíveis para todos" ON public.produtos
    FOR SELECT USING (ativo = true OR EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()));

CREATE POLICY "Administradores podem gerenciar produtos" ON public.produtos
    FOR ALL USING (EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()));

-- Pedidos: admin can see and update all
CREATE POLICY "Administradores podem ver todos os pedidos" ON public.pedidos
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()));

CREATE POLICY "Administradores podem atualizar pedidos" ON public.pedidos
    FOR UPDATE USING (EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid()));
