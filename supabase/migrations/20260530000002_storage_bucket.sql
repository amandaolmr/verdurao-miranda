-- Criar bucket público para imagens
INSERT INTO storage.buckets (id, name, public)
VALUES ('imagens', 'imagens', true)
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Imagens são públicas' AND tablename = 'objects') THEN
    CREATE POLICY "Imagens são públicas" ON storage.objects
      FOR SELECT TO public USING (bucket_id = 'imagens');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin pode fazer upload de imagens' AND tablename = 'objects') THEN
    CREATE POLICY "Admin pode fazer upload de imagens" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'imagens' AND
        EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin pode atualizar imagens' AND tablename = 'objects') THEN
    CREATE POLICY "Admin pode atualizar imagens" ON storage.objects
      FOR UPDATE TO authenticated USING (
        bucket_id = 'imagens' AND
        EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin pode deletar imagens' AND tablename = 'objects') THEN
    CREATE POLICY "Admin pode deletar imagens" ON storage.objects
      FOR DELETE TO authenticated USING (
        bucket_id = 'imagens' AND
        EXISTS (SELECT 1 FROM public.administrador WHERE id = auth.uid())
      );
  END IF;
END $$;
