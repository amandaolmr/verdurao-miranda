-- Execute este script no SQL Editor do Supabase/Lovable
-- Substitua 'seu@email.com' pelo e-mail do administrador

INSERT INTO public.administrador (id, email)
SELECT id, email
FROM auth.users
WHERE email = 'seu@email.com'
ON CONFLICT (id) DO NOTHING;
