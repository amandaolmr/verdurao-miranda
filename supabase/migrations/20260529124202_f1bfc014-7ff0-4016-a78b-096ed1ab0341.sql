ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS imagem_url TEXT;

-- Seed categories with names that match the user request
DELETE FROM public.categorias;

INSERT INTO public.categorias (id, nome, ativo, imagem_url) VALUES
(gen_random_uuid(), 'Frutas', true, 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&q=80&w=400'),
(gen_random_uuid(), 'Verduras', true, 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80&w=400'),
(gen_random_uuid(), 'Legumes', true, 'https://images.unsplash.com/photo-1597362868470-3555d97a64d0?auto=format&fit=crop&q=80&w=400'),
(gen_random_uuid(), 'Temperos', true, 'https://images.unsplash.com/photo-1594900115043-4523c94d8692?auto=format&fit=crop&q=80&w=400'),
(gen_random_uuid(), 'Ovos', true, 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&q=80&w=400'),
(gen_random_uuid(), 'Hortaliças', true, 'https://images.unsplash.com/photo-1518843875459-f738682238a6?auto=format&fit=crop&q=80&w=400'),
(gen_random_uuid(), 'Cestas Prontas', true, 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400');

-- Seed products for testing the filter
INSERT INTO public.produtos (nome, preco, unidade_venda, descricao, categoria_id, ativo, imagem_url)
SELECT 'Tomate Saladete', 7.99, 'Kg', 'Tomates frescos e selecionados.', id, true, 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=400'
FROM public.categorias WHERE nome = 'Frutas' LIMIT 1;

INSERT INTO public.produtos (nome, preco, unidade_venda, descricao, categoria_id, ativo, imagem_url)
SELECT 'Banana Prata', 5.49, 'Kg', 'Bananas docinhas.', id, true, 'https://images.unsplash.com/photo-1571771894821-ad9b5886d24b?auto=format&fit=crop&q=80&w=400'
FROM public.categorias WHERE nome = 'Frutas' LIMIT 1;

INSERT INTO public.produtos (nome, preco, unidade_venda, descricao, categoria_id, ativo, imagem_url)
SELECT 'Alface Crespa', 3.50, 'Unidade', 'Alface crocante.', id, true, 'https://images.unsplash.com/photo-1622206141540-581f340f5b1c?auto=format&fit=crop&q=80&w=400'
FROM public.categorias WHERE nome = 'Verduras' LIMIT 1;

INSERT INTO public.produtos (nome, preco, unidade_venda, descricao, categoria_id, ativo, imagem_url)
SELECT 'Cenoura', 4.80, 'Kg', 'Cenouras crocantes.', id, true, 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&q=80&w=400'
FROM public.categorias WHERE nome = 'Legumes' LIMIT 1;

INSERT INTO public.produtos (nome, preco, unidade_venda, descricao, categoria_id, ativo, imagem_url)
SELECT 'Bandeja de Ovos', 18.00, 'Bandeja', '30 ovos grandes.', id, true, 'https://images.unsplash.com/photo-1516147746102-056a9f932707?auto=format&fit=crop&q=80&w=400'
FROM public.categorias WHERE nome = 'Ovos' LIMIT 1;
