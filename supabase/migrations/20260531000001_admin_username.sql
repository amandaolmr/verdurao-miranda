-- Adiciona campo "usuario" na tabela administrador
-- Permite login com usuario/senha em vez de email/senha

ALTER TABLE public.administrador
  ADD COLUMN IF NOT EXISTS usuario TEXT UNIQUE;

-- Preenche o usuario com a parte local do email (antes do @) para admins existentes
UPDATE public.administrador
  SET usuario = split_part(email, '@', 1)
  WHERE usuario IS NULL;

-- Função SECURITY DEFINER: chamável anonimamente, retorna o email correspondente
-- ao usuario OU email informado — sem expor a tabela diretamente.
CREATE OR REPLACE FUNCTION public.get_admin_email(p_usuario TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF position('@' IN p_usuario) > 0 THEN
    -- Entrada é um e-mail: busca diretamente pelo email
    SELECT email INTO v_email
    FROM public.administrador
    WHERE email = lower(trim(p_usuario))
    LIMIT 1;
  ELSE
    -- Entrada é um nome de usuário: busca pela coluna usuario
    SELECT email INTO v_email
    FROM public.administrador
    WHERE usuario = lower(trim(p_usuario))
    LIMIT 1;
  END IF;
  RETURN v_email; -- NULL se não encontrado
END;
$$;

-- Permite que usuários anônimos chamem a função (necessário para o login)
GRANT EXECUTE ON FUNCTION public.get_admin_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_admin_email(TEXT) TO authenticated;
