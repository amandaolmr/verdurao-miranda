-- ──────────────────────────────────────────────────────────────────────────────
-- Mercado Pago transparent checkout fields on the pedidos table
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS status_pagamento  TEXT,
  ADD COLUMN IF NOT EXISTS metodo_pagamento  TEXT,
  ADD COLUMN IF NOT EXISTS id_transacao_mercadopago TEXT,
  ADD COLUMN IF NOT EXISTS data_pagamento    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valor_pago        NUMERIC(10, 2);

-- Fast lookup for webhook notifications (MP sends payment ID → find order)
CREATE INDEX IF NOT EXISTS idx_pedidos_mp_transacao
  ON pedidos (id_transacao_mercadopago)
  WHERE id_transacao_mercadopago IS NOT NULL;

COMMENT ON COLUMN pedidos.status_pagamento IS
  'aprovado | pendente | recusado | cancelado | NULL (pagamento na entrega)';
COMMENT ON COLUMN pedidos.id_transacao_mercadopago IS
  'Mercado Pago payment ID returned by POST /v1/payments';
