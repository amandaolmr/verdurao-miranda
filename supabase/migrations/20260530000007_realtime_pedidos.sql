-- Habilita Supabase Realtime para a tabela de pedidos
-- Necessário para notificações em tempo real no painel admin
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
