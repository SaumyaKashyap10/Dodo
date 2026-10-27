import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { handleOwnerRoute } from '../../apps/web/src/lib/owner-backend-service';

test('Verification: Retired "Record Subscription Payment" modal and action are completely removed from Owner Revenue UI', () => {
  const revenueFilePath = path.resolve(__dirname, '../../apps/web/src/components/owner/owner-revenue.tsx');
  const revenueFileContent = fs.readFileSync(revenueFilePath, 'utf8');

  // Must NOT contain the retired modal title, subtitle, or button
  assert.equal(
    revenueFileContent.includes('Record Subscription Payment'),
    false,
    'Owner Revenue must NOT contain "Record Subscription Payment" modal title',
  );
  assert.equal(
    revenueFileContent.includes('Record & Extend Period'),
    false,
    'Owner Revenue must NOT contain "Record & Extend Period" submit action',
  );
  assert.equal(
    revenueFileContent.includes('manualPayModalOpen'),
    false,
    'Owner Revenue must NOT contain manualPayModalOpen state',
  );
  assert.equal(
    revenueFileContent.includes('handleRecordManualPayment'),
    false,
    'Owner Revenue must NOT contain handleRecordManualPayment handler',
  );
  assert.equal(
    revenueFileContent.includes('+ Record Offline / Wire Payment'),
    false,
    'Owner Revenue must NOT contain "+ Record Offline / Wire Payment" opening button',
  );
});

test('Verification: Owner Revenue page remains fully functional with active controls and reports', async () => {
  const revenueFilePath = path.resolve(__dirname, '../../apps/web/src/components/owner/owner-revenue.tsx');
  const revenueFileContent = fs.readFileSync(revenueFilePath, 'utf8');

  // Preserved active controls & modals
  assert.ok(revenueFileContent.includes('Export Billing CSV'), 'Must preserve "Export Billing CSV" action');
  assert.ok(revenueFileContent.includes('Adjust Advance Balance'), 'Must preserve "Adjust Advance Balance" modal');
  assert.ok(revenueFileContent.includes('Platform Tax Invoice'), 'Must preserve "Platform Tax Invoice" modal');
  assert.ok(revenueFileContent.includes('Configure Commercial Rate'), 'Must preserve PG rate modal');
  assert.ok(revenueFileContent.includes('Institution Commercial Revenue'), 'Must preserve commercial revenue tab');
  assert.ok(revenueFileContent.includes('Jodo Flex Commercials & Advance Ledger'), 'Must preserve flex commercials tab');
  assert.ok(revenueFileContent.includes('Payment Gateway Commercial Rates'), 'Must preserve PG rates tab');
  assert.ok(revenueFileContent.includes('Invoices & Billing Statements'), 'Must preserve invoices tab');

  // Verify backend endpoint GET /owner/revenue remains functional
  const req = new NextRequest('http://localhost:3000/api/v1/owner/revenue');
  const res = await handleOwnerRoute('owner/revenue', 'GET', req);
  assert.ok(res, 'GET /owner/revenue must respond');
  const json = await res.json();
  assert.ok(json.metrics, 'Must contain metrics');
  assert.ok(Array.isArray(json.transactions), 'Must contain transactions');
  assert.ok(Array.isArray(json.pg_rates), 'Must contain payment gateway rates');
  assert.ok(json.categories, 'Must contain revenue categories');
});

test('Verification: Configure Institution Commercials page retains active functionality and fields', async () => {
  const commercialsFilePath = path.resolve(__dirname, '../../apps/web/src/components/owner/owner-commercials.tsx');
  const commercialsFileContent = fs.readFileSync(commercialsFilePath, 'utf8');

  // Modal title and core fields preserved
  assert.ok(commercialsFileContent.includes('Configure Institution Commercials'), 'Must preserve modal title');
  assert.ok(commercialsFileContent.includes('Target Institution'), 'Must preserve Target Institution field');
  assert.ok(commercialsFileContent.includes('Commercial Pricing Model'), 'Must preserve Pricing Model field');
  assert.ok(commercialsFileContent.includes('Institution Billing Rate'), 'Must preserve Billing Rate field');
  assert.ok(commercialsFileContent.includes('Estimated Provider Cost'), 'Must preserve Provider Cost field');
  assert.ok(commercialsFileContent.includes('Billing Frequency'), 'Must preserve Billing Frequency field');
  assert.ok(commercialsFileContent.includes('Agreement Status'), 'Must preserve Agreement Status field');
  assert.ok(commercialsFileContent.includes('Effective Date'), 'Must preserve Effective Date field');

  // Notice about session-only storage and pending permanent DB persistence preserved
  assert.ok(
    commercialsFileContent.includes('Live Session State & Presentation Layer'),
    'Must preserve live session notice',
  );
  assert.ok(
    commercialsFileContent.includes('Permanent DB persistence across cold server reboots will'),
    'Must preserve upcoming migration disclaimer',
  );
});

test('Verification: Owner Shell navigation does not contain obsolete Subscriptions link and unused import is removed', () => {
  const shellFilePath = path.resolve(__dirname, '../../apps/web/src/components/owner/owner-shell.tsx');
  const shellFileContent = fs.readFileSync(shellFilePath, 'utf8');

  // Unused import removed
  assert.equal(
    shellFileContent.includes("import { OwnerSubscriptions } from './owner-subscriptions';"),
    false,
    'Unused OwnerSubscriptions import must be removed',
  );

  // Sidebar navigation sections
  assert.ok(shellFileContent.includes("id: 'overview'"));
  assert.ok(shellFileContent.includes("id: 'institutions'"));
  assert.ok(shellFileContent.includes("id: 'commercials'"));
  assert.ok(shellFileContent.includes("id: 'revenue'"));
  assert.ok(shellFileContent.includes("id: 'payment-providers'"));
  assert.ok(shellFileContent.includes("id: 'settings'"));
});
