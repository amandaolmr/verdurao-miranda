CREATE POLICY "Administradores podem ver seus próprios registros" ON public.administrador
    FOR SELECT USING (auth.uid() = id);
