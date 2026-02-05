-- CreateTable
CREATE TABLE IF NOT EXISTS tool_billing (
  pk UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_key TEXT NOT NULL,
  method_name TEXT NOT NULL,
  billing_rules JSONB NOT NULL,
  token_pricing JSONB,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tool_billing_unique_method UNIQUE (inventory_key, method_name)
);

-- CreateIndex
CREATE INDEX idx_tool_billing_lookup
  ON tool_billing (inventory_key, method_name)
  WHERE enabled = true;

-- Comments
COMMENT ON TABLE tool_billing IS 'Dynamic billing configuration for tool methods with field-level pricing rules';
COMMENT ON COLUMN tool_billing.inventory_key IS 'Inventory key (e.g., nano_banana_pro, fal_image)';
COMMENT ON COLUMN tool_billing.method_name IS 'Method name (e.g., generate, text_to_image)';
COMMENT ON COLUMN tool_billing.billing_rules IS 'Array of AdditiveBillingRule or MultiplierBillingRule (JSONB)';
COMMENT ON COLUMN tool_billing.token_pricing IS 'Optional USD pricing for token-based billing: { "inputPer1MUsd": number, "outputPer1MUsd": number }';
COMMENT ON COLUMN tool_billing.enabled IS 'Whether this billing config is active';
