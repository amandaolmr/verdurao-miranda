-- Adiciona campo "usuario" na tabela administrador
-- Permite login com usuario/senha em vez de email/senha

ALTER TABLE public.administrador
  ADD COLUMN IF NOT EXISTS usuario TEXT UNIQUE;

-- Preenche o usuario com a parte local do email (antes do @) para admins existentes
UPDATE public.administrador
  SET usuario = split_part(email, '@', 1)
  WHERE usuario IS NULL;

-- Função SECURITY DEFINER: chamável anonimamente, retorna o email correspondente
-- ao usuario informado — sem expor a tabela diretamente.
CREATE OR REPLACE FUNCTION public.get_admin_email(p_usuario TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email
  FROM public.administrador
  WHERE usuario = lower(trim(p_usuario))
  LIMIT 1;
  RETURN v_email; -- NULL se não encontrado
END;
$$;

-- Permite que usuários anônimos chamem a função (necessário para o login)
GRANT EXECUTE ON FUNCTION public.get_admin_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_admin_email(TEXT) TO authenticated;
