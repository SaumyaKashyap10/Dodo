-- Migration 045: Owner Institution Commercials, Sandbox AutoPay Mandates & Gateway Configs
-- Durable schema persistence for sandbox fee collection simulation & institution commercial models

CREATE TABLE IF NOT EXISTS institution_commercials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  commercial_model text NOT NULL CHECK (
    commercial_model IN (
      'fixed',
      'per_active_student',
      'per_enach_mandate',
      'per_autopay_mandate',
      'per_debit',
      'rev_share',
      'hybrid'
    )
  ),
  institution_rate_minor bigint NOT NULL DEFAULT 0,
  provider_cost_minor bigint NOT NULL DEFAULT 0,
  billing_frequency text NOT NULL DEFAULT 'monthly' CHECK (
    billing_frequency IN ('monthly', 'quarterly', 'annually')
  ),
  agreement_status text NOT NULL DEFAULT 'draft' CHECK (
    agreement_status IN ('active', 'review', 'draft', 'expired')
  ),
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS institution_commercials_tenant_idx ON institution_commercials(tenant_id);

-- Explicit Sandbox Mandates Storage (Isolated from Live Transactions)
CREATE TABLE IF NOT EXISTS sandbox_autopay_mandates (
  id text PRIMARY KEY,
  provider text NOT NULL DEFAULT 'sandbox_autopay',
  provider_reference text NOT NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  institution_id text NOT NULL,
  student_id text NOT NULL,
  student_name text NOT NULL,
  payer_name text NOT NULL,
  payer_vpa_or_account text NOT NULL,
  rail text NOT NULL CHECK (rail IN ('enach', 'upi_autopay', 'one_time_upi')),
  max_amount_inr numeric(12,2) NOT NULL,
  frequency text NOT NULL DEFAULT 'monthly' CHECK (
    frequency IN ('as_presented', 'monthly', 'quarterly', 'annually')
  ),
  status text NOT NULL CHECK (
    status IN ('pending_auth', 'active', 'paused', 'cancelled', 'expired', 'rejected')
  ),
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_sandbox boolean NOT NULL DEFAULT true,
  simulation_badge text NOT NULL DEFAULT 'SIMULATED (NO REAL MONEY MOVEMENT)',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sandbox_mandates_inst_idx ON sandbox_autopay_mandates(institution_id, status);

-- Explicit Sandbox Recurring Debits Storage
CREATE TABLE IF NOT EXISTS sandbox_autopay_debits (
  id text PRIMARY KEY,
  mandate_id text NOT NULL REFERENCES sandbox_autopay_mandates(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'sandbox_autopay',
  provider_reference text NOT NULL,
  amount_inr numeric(12,2) NOT NULL,
  status text NOT NULL CHECK (
    status IN ('queued', 'submitted', 'confirmed', 'failed', 'uncertain', 'cancelled')
  ),
  idempotency_key text NOT NULL UNIQUE,
  failure_code text,
  failure_reason text,
  settlement_status text NOT NULL DEFAULT 'settled_simulated' CHECK (
    settlement_status IN ('settled_simulated', 'pending_settlement', 'not_applicable')
  ),
  settlement_utr text,
  is_sandbox boolean NOT NULL DEFAULT true,
  simulation_badge text NOT NULL DEFAULT 'SIMULATED (NO REAL MONEY MOVEMENT)',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sandbox_debits_mandate_idx ON sandbox_autopay_debits(mandate_id);
CREATE INDEX IF NOT EXISTS sandbox_debits_idempotency_idx ON sandbox_autopay_debits(idempotency_key);

-- Payment Gateway Integration Configs & Safety Lock Metadata
CREATE TABLE IF NOT EXISTS payment_gateway_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'live')),
  key_id_masked text,
  webhook_endpoint text,
  webhook_verified boolean NOT NULL DEFAULT false,
  live_execution_locked boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
