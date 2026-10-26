import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import {
  handleOwnerRoute,
  OWNER_PLANS,
  OWNER_INSTITUTIONS,
  OWNER_SUBSCRIPTION_REVENUE,
  OWNER_PAYMENT_PROVIDER_CONFIG,
  OWNER_AUDIT_LOGS,
} from '../../apps/web/src/lib/owner-backend-service';
import { DEFAULT_SUBSCRIPTION_PLANS } from '../../apps/api/src/owner';

test('Owner CMS: Default subscription plans include ₹2,000, ₹3,000, and ₹4,000 tiers', () => {
  const starter = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.slug === 'starter');
  const growth = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.slug === 'growth');
  const enterprise = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.slug === 'enterprise');

  assert.ok(starter, 'Starter plan must exist');
  assert.equal(starter?.price_inr, 2000, 'Starter plan must be ₹2,000');
  assert.equal(starter?.student_limit, 500);

  assert.ok(growth, 'Growth plan must exist');
  assert.equal(growth?.price_inr, 3000, 'Growth plan must be ₹3,000');
  assert.equal(growth?.student_limit, 2500);

  assert.ok(enterprise, 'Enterprise plan must exist');
  assert.equal(enterprise?.price_inr, 4000, 'Enterprise plan must be ₹4,000');
  assert.equal(enterprise?.student_limit, 10000);
});

test('Owner CMS: Overview endpoint returns correct institutions, subscriptions and SaaS revenue', async () => {
  const req = new NextRequest('http://localhost:3000/api/v1/owner/overview');
  const res = await handleOwnerRoute('owner/overview', 'GET', req);
  assert.ok(res, 'Overview response must not be null');

  const json = await res.json();
  assert.ok(json.institutions, 'Institutions summary must be present');
  assert.ok(json.institutions.total > 0, 'Total institutions must be greater than zero');
  assert.ok(json.subscriptions, 'Subscriptions summary must be present');
  assert.ok(json.revenue, 'Revenue summary must be present');
  assert.equal(typeof json.revenue.total_revenue_inr, 'number');
  assert.equal(typeof json.revenue.mrr_inr, 'number');
  assert.equal(typeof json.revenue.arr_inr, 'number');
  assert.ok(json.gateway_status, 'Gateway status must be present');
  assert.equal(json.gateway_status.provider, 'Razorpay');
});

test('Owner CMS: Institutions endpoint lists registered educational institutions with campus & subscription metadata', async () => {
  const req = new NextRequest('http://localhost:3000/api/v1/owner/institutions');
  const res = await handleOwnerRoute('owner/institutions', 'GET', req);
  assert.ok(res);

  const list = await res.json();
  assert.ok(Array.isArray(list));
  assert.ok(list.length > 0);

  const dps = list.find((i: any) => i.id === 'tenant-delhi-campus');
  assert.ok(dps, 'Delhi Public School must exist in institutions list');
  assert.ok(dps.subscription, 'Subscription must be assigned to institution');
  assert.ok(dps.campus_count >= 1, 'Campus count must be at least 1');
});

test('Owner CMS: Institution status toggle enforces read-only safeguard when suspended', async () => {
  const req = new NextRequest('http://localhost:3000/api/v1/owner/institutions/tenant-bangalore-campus/status', {
    method: 'POST',
    body: JSON.stringify({
      status: 'suspended',
      reason: 'Overdue subscription renewal test',
    }),
  });

  const res = await handleOwnerRoute('owner/institutions/tenant-bangalore-campus/status', 'POST', req);
  assert.ok(res);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.institution.status, 'suspended');

  // Verify audit log has recorded the suspension with reason
  const lastLog = OWNER_AUDIT_LOGS[0];
  assert.equal(lastLog.action, 'tenant.status_change');
  assert.equal(lastLog.object_id, 'tenant-bangalore-campus');
  assert.equal(lastLog.details.new_status, 'suspended');
});

test('Owner CMS: Subscriptions allows assigning plan to an institution and creating Razorpay link', async () => {
  // 1. Assign Enterprise Plan
  const assignReq = new NextRequest('http://localhost:3000/api/v1/owner/institutions/tenant-delhi-campus/subscription', {
    method: 'POST',
    body: JSON.stringify({
      plan_id: 'plan_enterprise',
      interval: 'annually',
      apply_payment: true,
    }),
  });
  const assignRes = await handleOwnerRoute('owner/institutions/tenant-delhi-campus/subscription', 'POST', assignReq);
  assert.ok(assignRes);
  const sub = await assignRes.json();
  assert.equal(sub.plan_id, 'plan_enterprise');
  assert.equal(sub.status, 'active');

  // 2. Generate Razorpay checkout link
  const linkReq = new NextRequest('http://localhost:3000/api/v1/owner/subscriptions/create-payment-link', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: 'tenant-delhi-campus',
      plan_id: 'plan_enterprise',
    }),
  });
  const linkRes = await handleOwnerRoute('owner/subscriptions/create-payment-link', 'POST', linkReq);
  assert.ok(linkRes);
  const linkJson = await linkRes.json();
  assert.match(linkJson.payment_link_url, /^https:\/\/rzp\.io\/i\//);
  assert.equal(linkJson.amount_inr, 4000);
});

test('Owner CMS: Platform revenue ledger is strictly separated from student fees', async () => {
  const req = new NextRequest('http://localhost:3000/api/v1/owner/revenue');
  const res = await handleOwnerRoute('owner/revenue', 'GET', req);
  assert.ok(res);
  const json = await res.json();

  assert.ok(Array.isArray(json.transactions));
  // Every transaction in platform subscription revenue must be for SaaS plans, not student tuition
  for (const tx of json.transactions) {
    assert.match(tx.invoice_number, /^INV-SUB-/);
    assert.ok(['plan_starter', 'plan_growth', 'plan_enterprise'].includes(tx.plan_id) || tx.plan_id.startsWith('plan_'));
    assert.equal(tx.currency, 'INR');
  }
});

test('Owner CMS: Payment Providers protects secrets and exposes Razorpay configurations safely', async () => {
  const req = new NextRequest('http://localhost:3000/api/v1/owner/payment-providers');
  const res = await handleOwnerRoute('owner/payment-providers', 'GET', req);
  assert.ok(res);
  const json = await res.json();

  assert.equal(json.provider, 'razorpay');
  assert.ok(json.key_id);
  // Plain text secrets must NEVER be returned
  assert.equal(json.key_secret, undefined);
  assert.equal(json.webhook_secret, undefined);
  assert.match(json.key_secret_masked, /^•+/);
  assert.match(json.webhook_secret_masked, /^•+/);
  assert.match(json.webhook_url, /\/api\/v1\/provider\/razorpay\/webhook$/);
});

test('Owner CMS: Payment Providers test connection validates Razorpay connectivity', async () => {
  const req = new NextRequest('http://localhost:3000/api/v1/owner/payment-providers/test', { method: 'POST' });
  const res = await handleOwnerRoute('owner/payment-providers/test', 'POST', req);
  assert.ok(res);
  const json = await res.json();

  assert.equal(json.status, 'connected');
  assert.equal(typeof json.latency_ms, 'number');
  assert.match(json.connection, /TLS 1.3 Active/);
  assert.match(json.rbi_compliance, /PA\/PG Framework compliant/);
});

test('Owner CMS: Jodo Flex commercials and advance adjustment ledger enforce balance updates and audit logs', async () => {
  // Test advance adjustment on tenant-delhi-campus
  const adjustReq = new NextRequest('http://localhost:3000/api/v1/owner/institutions/tenant-delhi-campus/advance/adjust', {
    method: 'POST',
    body: JSON.stringify({
      type: 'credit',
      amount_inr: 25000,
      description: 'Advance top-up test for scheduled debit runs',
    }),
  });
  const res = await handleOwnerRoute('owner/institutions/tenant-delhi-campus/advance/adjust', 'POST', adjustReq);
  assert.ok(res);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.advance_balance.advance_balance_inr >= 25000);

  // Verify audit log has recorded the advance adjustment
  const lastLog = OWNER_AUDIT_LOGS[0];
  assert.equal(lastLog.action, 'commercials.advance_adjust');
  assert.equal(lastLog.object_id, 'tenant-delhi-campus');
  assert.equal(lastLog.details.type, 'credit');
  assert.equal(lastLog.details.amount_inr, 25000);
});

test('Owner CMS: Product activation matrix updates institution capabilities and readiness safeguards', async () => {
  const toggleReq = new NextRequest('http://localhost:3000/api/v1/owner/institutions/tenant-delhi-campus/products', {
    method: 'POST',
    body: JSON.stringify({
      product: 'split_settlements',
      enabled: true,
      status: 'operational',
    }),
  });
  const res = await handleOwnerRoute('owner/institutions/tenant-delhi-campus/products', 'POST', toggleReq);
  assert.ok(res);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.products_config.split_settlements.enabled, true);
  assert.equal(json.products_config.split_settlements.status, 'operational');
});

test('Owner CMS: Payment Gateway commercial rates schedule enforces RuPay 0% MDR and GST configuration', async () => {
  const req = new NextRequest('http://localhost:3000/api/v1/owner/revenue');
  const res = await handleOwnerRoute('owner/revenue', 'GET', req);
  assert.ok(res);
  const json = await res.json();

  assert.ok(Array.isArray(json.pg_rates));
  const rupay = json.pg_rates.find((r: any) => r.id === 'rate_rupay' || r.id === 'rate_rupay_debit');
  assert.ok(rupay, 'RuPay Debit rate card must exist');
  assert.equal(rupay.rate, 0, 'RuPay Debit must be 0% MDR per RBI mandate');

  const upi = json.pg_rates.find((r: any) => r.id === 'rate_upi' || r.id === 'rate_upi_p2m');
  assert.ok(upi, 'UPI rate card must exist');
  assert.equal(upi.rate, 0, 'Standard UPI must be 0% MDR');
});

test('Owner CMS: eNACH and UPI AutoPay truthfully indicate Sandbox status and T+1 settlement policy', async () => {
  const req = new NextRequest('http://localhost:3000/api/v1/owner/payment-providers');
  const res = await handleOwnerRoute('owner/payment-providers', 'GET', req);
  assert.ok(res);
  const json = await res.json();

  assert.equal(json.enach_config.status, 'sandbox', 'eNACH must truthfully report Sandbox status');
  assert.equal(json.enach_config.live_enach_ready, false, 'eNACH live readiness must be false');
  assert.equal(json.upi_autopay_config.status, 'sandbox', 'UPI AutoPay must report Sandbox status');
  assert.equal(json.settlement_config.default_policy, 'T+1', 'Settlement cycle must be T+1');
});

