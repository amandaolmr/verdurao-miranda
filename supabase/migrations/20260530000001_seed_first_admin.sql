-- Execute este script no SQL Editor do Supabase/Lovable
-- Substitua os valores abaixo pelo e-mail e usuário do administrador

INSERT INTO public.administrador (id, email, usuario)
SELECT id, email, 'admin'   -- troque 'admin' pelo nome de usuário desejado
FROM auth.users
WHERE email = 'seu@email.com'  -- troque pelo e-mail real do administrador
ON CONFLICT (id) DO UPDATE SET usuario = EXCLUDED.usuario;
