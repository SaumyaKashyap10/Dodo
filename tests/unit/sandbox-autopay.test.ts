import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SandboxAutoPayProvider,
  RazorpayAutoPayAdapter,
  PaymentProviderRegistry,
} from '../../packages/core/src/autopay-provider';
import { createHmac } from 'node:crypto';

test('Sandbox AutoPay: Mandate registration creates simulated mandate with explicit badge', async () => {
  const provider = new SandboxAutoPayProvider();

  const regResult = await provider.initiateMandateRegistration({
    institution_id: 'inst_dps_rkpuram',
    student_id: 'std_test_001',
    student_name: 'Priya Verma',
    payer_name: 'Suresh Verma',
    payer_phone: '+919876543210',
    payer_vpa_or_account: 'verma.suresh@okaxis',
    rail: 'upi_autopay',
    max_amount_inr: 45000,
    frequency: 'monthly',
    start_date: '2026-05-01',
    end_date: '2027-04-30',
  });

  assert.ok(regResult.mandate);
  assert.ok(regResult.mandate.mandate_id.startsWith('snb_mnd_'));
  assert.equal(regResult.mandate.is_sandbox, true, 'Mandate must be flagged is_sandbox: true');
  assert.equal(
    regResult.mandate.simulation_badge,
    'SIMULATED (NO REAL MONEY MOVEMENT)',
    'Must bear simulation notice badge',
  );
  assert.equal(regResult.mandate.status, 'active');
  assert.equal(regResult.mandate.rail, 'upi_autopay');
  assert.equal(regResult.mandate.max_amount_inr, 45000);
});

test('Sandbox AutoPay: Mandate lifecycle allows query and explicit cancellation', async () => {
  const provider = new SandboxAutoPayProvider();

  const reg = await provider.initiateMandateRegistration({
    institution_id: 'inst_modern_school',
    student_id: 'std_test_002',
    student_name: 'Kabir Das',
    payer_name: 'Ramesh Das',
    payer_phone: '+919876543211',
    payer_vpa_or_account: '9876543210@paytm',
    rail: 'upi_autopay',
    max_amount_inr: 30000,
    frequency: 'quarterly',
    start_date: '2026-06-01',
    end_date: '2027-05-31',
  });

  const fetched = await provider.getMandateStatus(reg.mandate.mandate_id);
  assert.equal(fetched.mandate_id, reg.mandate.mandate_id);
  assert.equal(fetched.status, 'active');

  const cancelled = await provider.cancelMandate(reg.mandate.mandate_id, 'Parent requested cancel');
  assert.equal(cancelled.status, 'cancelled');

  const postCancel = await provider.getMandateStatus(reg.mandate.mandate_id);
  assert.equal(postCancel.status, 'cancelled');
});

test('Sandbox AutoPay: Debit initiation rejects execution against cancelled mandate', async () => {
  const provider = new SandboxAutoPayProvider();

  const reg = await provider.initiateMandateRegistration({
    institution_id: 'inst_test_cancel',
    student_id: 'std_cancel_1',
    student_name: 'Ananya Roy',
    payer_name: 'Deb Roy',
    payer_phone: '+919876543212',
    payer_vpa_or_account: 'debroy@okhdfcbank',
    rail: 'enach',
    max_amount_inr: 20000,
    frequency: 'monthly',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
  });

  await provider.cancelMandate(reg.mandate.mandate_id, 'Withdrawal');

  await assert.rejects(
    async () => {
      await provider.initiateRecurringDebit({
        mandate_id: reg.mandate.mandate_id,
        amount_inr: 5000,
        description: 'Tuition Fee Debit',
        idempotency_key: `idemp_cancelled_${Date.now()}`,
      });
    },
    /Cannot initiate debit on mandate with status 'cancelled'/,
  );
});

test('Sandbox AutoPay: Debit amount exceeding registered mandate limit is rejected', async () => {
  const provider = new SandboxAutoPayProvider();

  const reg = await provider.initiateMandateRegistration({
    institution_id: 'inst_limit_test',
    student_id: 'std_limit_1',
    student_name: 'Rohan Joshi',
    payer_name: 'Vikram Joshi',
    payer_phone: '+919876543213',
    payer_vpa_or_account: 'joshi@icici',
    rail: 'upi_autopay',
    max_amount_inr: 15000,
    frequency: 'monthly',
    start_date: '2026-04-01',
    end_date: '2027-03-31',
  });

  await assert.rejects(
    async () => {
      await provider.initiateRecurringDebit({
        mandate_id: reg.mandate.mandate_id,
        amount_inr: 25000, // Exceeds 15,000 INR
        description: 'Excess Debit Attempt',
        idempotency_key: `idemp_excess_${Date.now()}`,
      });
    },
    /exceeds registered mandate limit/,
  );
});

test('Sandbox AutoPay: Idempotency check prevents duplicate debit requests', async () => {
  const provider = new SandboxAutoPayProvider();

  const reg = await provider.initiateMandateRegistration({
    institution_id: 'inst_idemp_test',
    student_id: 'std_idemp_1',
    student_name: 'Meera Sen',
    payer_name: 'Alok Sen',
    payer_phone: '+919876543214',
    payer_vpa_or_account: 'aloksen@sbi',
    rail: 'upi_autopay',
    max_amount_inr: 30000,
    frequency: 'monthly',
    start_date: '2026-04-01',
    end_date: '2027-03-31',
  });

  const idemKey = `idemp_unique_key_${Date.now()}`;

  const debit1 = await provider.initiateRecurringDebit({
    mandate_id: reg.mandate.mandate_id,
    amount_inr: 8000,
    description: 'Q1 Tuition Installment',
    idempotency_key: idemKey,
  });
  assert.equal(debit1.status, 'confirmed');
  assert.equal(debit1.is_sandbox, true);

  // Second debit with the identical key must throw
  await assert.rejects(
    async () => {
      await provider.initiateRecurringDebit({
        mandate_id: reg.mandate.mandate_id,
        amount_inr: 8000,
        description: 'Q1 Tuition Installment Re-attempt',
        idempotency_key: idemKey,
      });
    },
    /Duplicate debit request: Idempotency key '.*' already processed/,
  );
});

test('Sandbox AutoPay: Simulates deterministic failure outcomes (NPCI failure codes)', async () => {
  const provider = new SandboxAutoPayProvider();

  const reg = await provider.initiateMandateRegistration({
    institution_id: 'inst_fail_test',
    student_id: 'std_fail_1',
    student_name: 'Dev Malik',
    payer_name: 'Sunil Malik',
    payer_phone: '+919876543215',
    payer_vpa_or_account: 'sunilmalik@kotak',
    rail: 'enach',
    max_amount_inr: 50000,
    frequency: 'monthly',
    start_date: '2026-04-01',
    end_date: '2027-03-31',
  });

  // Test Insufficient Funds
  const debitInsufficient = await provider.initiateRecurringDebit({
    mandate_id: reg.mandate.mandate_id,
    amount_inr: 10000,
    description: 'Debit Run with Insufficient Funds',
    idempotency_key: `fail_key_1_${Date.now()}`,
    simulated_outcome: 'failure:INSUFFICIENT_FUNDS',
  });
  assert.equal(debitInsufficient.status, 'failed');
  assert.equal(debitInsufficient.failure_code, 'INSUFFICIENT_FUNDS');
  assert.match(debitInsufficient.failure_reason || '', /insufficient balance/i);
  assert.equal(debitInsufficient.settlement_status, 'not_applicable');

  // Test Bank Server Down
  const debitBankDown = await provider.initiateRecurringDebit({
    mandate_id: reg.mandate.mandate_id,
    amount_inr: 10000,
    description: 'Debit Run with Bank CBS Timeout',
    idempotency_key: `fail_key_2_${Date.now()}`,
    simulated_outcome: 'failure:BANK_SERVER_DOWN',
  });
  assert.equal(debitBankDown.status, 'failed');
  assert.equal(debitBankDown.failure_code, 'BANK_SERVER_DOWN');
  assert.match(debitBankDown.failure_reason || '', /timeout/i);
});

test('Sandbox AutoPay: HMAC-SHA256 webhook signature verification processes simulated events', async () => {
  const provider = new SandboxAutoPayProvider();
  const secret = process.env.PAYMENT_WEBHOOK_SECRET || 'sandbox_test_secret_2026';

  const payload = JSON.stringify({
    event: 'subscription.charged',
    payload: {
      payment: {
        entity: {
          id: 'pay_sim_0099',
          amount: 1500000,
          status: 'captured',
        },
      },
    },
  });

  const signature = createHmac('sha256', secret).update(payload).digest('hex');

  const result = await provider.verifyAndProcessWebhook(payload, signature, {});
  assert.equal(result.verified, true);
  assert.equal(result.event_type, 'subscription.charged');
  assert.equal(result.entity_id, 'pay_sim_0099');
  assert.equal(result.status, 'processed');
});

test('Sandbox AutoPay: Batch settlement reconciliation calculates correct ledger totals', async () => {
  const provider = new SandboxAutoPayProvider();

  const reg = await provider.initiateMandateRegistration({
    institution_id: 'inst_recon_test',
    student_id: 'std_recon_1',
    student_name: 'Tanya Roy',
    payer_name: 'Subhash Roy',
    payer_phone: '+919876543216',
    payer_vpa_or_account: 'subhashroy@axisbank',
    rail: 'upi_autopay',
    max_amount_inr: 40000,
    frequency: 'monthly',
    start_date: '2026-04-01',
    end_date: '2027-03-31',
  });

  // Successful debit
  await provider.initiateRecurringDebit({
    mandate_id: reg.mandate.mandate_id,
    amount_inr: 12000,
    description: 'Tuition Installment 1',
    idempotency_key: `recon_debit_1_${Date.now()}`,
    simulated_outcome: 'success',
  });

  // Failed debit
  await provider.initiateRecurringDebit({
    mandate_id: reg.mandate.mandate_id,
    amount_inr: 8000,
    description: 'Tuition Installment 2',
    idempotency_key: `recon_debit_2_${Date.now()}`,
    simulated_outcome: 'failure:LIMIT_EXCEEDED',
  });

  const reconBatch = await provider.reconcileBatch('BAT_RECON_001', '2026-10-27');
  assert.equal(reconBatch.is_sandbox, true);
  assert.equal(reconBatch.successful_count, 1);
  assert.equal(reconBatch.failed_count, 1);
  assert.equal(reconBatch.total_amount_inr, 12000);
});

test('Razorpay Live Adapter: Hard safety lock throws when live operations are attempted in Sandbox', async () => {
  const liveAdapter = new RazorpayAutoPayAdapter();

  await assert.rejects(
    async () => {
      await liveAdapter.initiateMandateRegistration({
        institution_id: 'inst_live_test',
        student_id: 'std_live_1',
        student_name: 'Live Student',
        payer_name: 'Live Payer',
        payer_phone: '+919876543210',
        payer_vpa_or_account: 'live@hdfc',
        rail: 'upi_autopay',
        max_amount_inr: 50000,
        frequency: 'monthly',
        start_date: '2026-04-01',
        end_date: '2027-03-31',
      });
    },
    /locked|prohibited|unconfigured/i,
  );
});

test('Payment Provider Registry: Correctly falls back to Sandbox provider and displays onboarding checklist', () => {
  const provider = PaymentProviderRegistry.getProvider();
  assert.equal(provider.isSandbox, true);
  assert.equal(provider.providerId, 'sandbox_autopay');

  const status = PaymentProviderRegistry.getConfigurationStatus();
  assert.equal(status.is_sandbox, true);
  assert.equal(status.live_execution_locked, true);
  assert.ok(Array.isArray(status.checklist));
  assert.equal(status.checklist.length, 6);
});

test('Sandbox AutoPay: Distinct mandate registration for eNACH bank rail preserves eNACH identity', async () => {
  const provider = new SandboxAutoPayProvider();

  const regResult = await provider.initiateMandateRegistration({
    institution_id: 'inst_dps_bank',
    student_id: 'std_enach_001',
    student_name: 'Aditya Birla',
    payer_name: 'Kumar Birla',
    payer_phone: '+919876543299',
    payer_vpa_or_account: '50100492104321',
    rail: 'enach',
    max_amount_inr: 75000,
    frequency: 'quarterly',
    start_date: '2026-06-01',
    end_date: '2027-05-31',
  });

  assert.ok(regResult.mandate);
  assert.equal(regResult.mandate.rail, 'enach');
  assert.equal(regResult.mandate.is_sandbox, true);
  assert.equal(regResult.mandate.status, 'active');
  assert.equal(regResult.mandate.payer_vpa_or_account, '50100492104321');
  assert.equal(regResult.mandate.max_amount_inr, 75000);
});
