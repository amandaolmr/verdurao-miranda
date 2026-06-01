-- Adiciona coluna de ordenação às categorias
ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS ordem INTEGER;

-- Inicializa a ordem baseada na criação para as categorias existentes
UPDATE public.categorias
SET ordem = sub.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY criado_em, nome) AS row_num
  FROM public.categorias
  WHERE ordem IS NULL
) sub
WHERE public.categorias.id = sub.id;
