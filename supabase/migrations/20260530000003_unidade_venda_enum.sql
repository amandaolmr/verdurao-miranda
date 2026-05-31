-- Normalizar valores existentes para o padrão KG/G/UN/DZ/MACO/BANDEJA
UPDATE public.produtos SET unidade_venda = 'KG'
  WHERE LOWER(unidade_venda) IN ('kg', 'kilo', 'quilograma', 'quilogramas');

UPDATE public.produtos SET unidade_venda = 'G'
  WHERE LOWER(unidade_venda) IN ('g', 'grama', 'gramas');

UPDATE public.produtos SET unidade_venda = 'UN'
  WHERE LOWER(unidade_venda) IN ('un', 'unidade', 'unidades', 'uni');

UPDATE public.produtos SET unidade_venda = 'DZ'
  WHERE LOWER(unidade_venda) IN ('dz', 'duzia', 'duzias', 'dúzia', 'dúzias');

UPDATE public.produtos SET unidade_venda = 'MACO'
  WHERE LOWER(unidade_venda) IN ('maco', 'macos', 'maço', 'maços');

UPDATE public.produtos SET unidade_venda = 'BANDEJA'
  WHERE LOWER(unidade_venda) IN ('bandeja', 'bandejas');

-- Qualquer valor ainda inválido → UN (padrão seguro)
UPDATE public.produtos
  SET unidade_venda = 'UN'
  WHERE unidade_venda NOT IN ('KG', 'G', 'UN', 'DZ', 'MACO', 'BANDEJA');

-- Definir padrão e adicionar restrição de valores permitidos
ALTER TABLE public.produtos
  ALTER COLUMN unidade_venda SET DEFAULT 'UN';

ALTER TABLE public.produtos
  DROP CONSTRAINT IF EXISTS check_unidade_venda;

ALTER TABLE public.produtos
  ADD CONSTRAINT check_unidade_venda
  CHECK (unidade_venda IN ('KG', 'G', 'UN', 'DZ', 'MACO', 'BANDEJA'));
