import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerSecurePayerToken,
  getRegisteredSecureToken,
  getDemoPayerData,
  applyPayerPayment,
  resetDemoPayerData,
  STUDENT_PROFILES,
} from '../../apps/web/src/lib/payer-store';

test('Scenario 1 & 2: Saumya profile resolves to Saumya and Sanjay Kumar with correct fee schedule', () => {
  resetDemoPayerData();
  const token = 'sec-tok-saumya-test-123';
  registerSecurePayerToken(token, {
    token,
    studentId: 'stu-12',
    studentName: 'Saumya',
    guardianName: 'Sanjay Kumar',
    accountReference: 'DPS-2026-160',
    email: 'sanjay.kumar@example.com',
    phone: '+91 98765 43220',
    netPayableMinor: 13500000,
    paidMinor: 4500000,
    outstandingMinor: 9000000,
    expiresAt: Date.now() + 86400000,
  });

  const payerData = getDemoPayerData(token);
  assert.ok(payerData !== null, 'Payer data should be found for registered token');
  assert.equal(payerData.payer.studentName, 'Saumya');
  assert.equal(payerData.payer.displayName, 'Sanjay Kumar');
  assert.equal(payerData.payer.accountReference, 'DPS-2026-160');
  assert.equal(payerData.summary.net_payable_minor, '13500000');
  assert.equal(payerData.summary.paid_minor, '4500000');
  assert.equal(payerData.summary.outstanding_minor, '9000000');
  assert.equal(payerData.installments.length, 3);
});

test('Scenario 3: Links for different students remain completely isolated', () => {
  resetDemoPayerData();
  const saumyaToken = 'sec-tok-saumya-iso';
  registerSecurePayerToken(saumyaToken, {
    token: saumyaToken,
    studentId: 'stu-12',
    studentName: 'Saumya',
    guardianName: 'Sanjay Kumar',
    accountReference: 'DPS-2026-160',
    netPayableMinor: 13500000,
    paidMinor: 4500000,
    outstandingMinor: 9000000,
    expiresAt: Date.now() + 86400000,
  });

  const diyaToken = 'sec-tok-diya-iso';
  registerSecurePayerToken(diyaToken, {
    token: diyaToken,
    studentId: 'stu-2',
    studentName: 'Diya Patel',
    guardianName: 'Suresh Patel',
    accountReference: 'DPS-2026-104',
    netPayableMinor: 11000000,
    paidMinor: 7500000,
    outstandingMinor: 3500000,
    expiresAt: Date.now() + 86400000,
  });

  const saumyaData = getDemoPayerData(saumyaToken);
  const diyaData = getDemoPayerData(diyaToken);

  assert.ok(saumyaData && diyaData);
  assert.equal(saumyaData.payer.studentName, 'Saumya');
  assert.equal(saumyaData.payer.displayName, 'Sanjay Kumar');
  assert.equal(saumyaData.payer.accountReference, 'DPS-2026-160');

  assert.equal(diyaData.payer.studentName, 'Diya Patel');
  assert.equal(diyaData.payer.displayName, 'Suresh Patel');
  assert.equal(diyaData.payer.accountReference, 'DPS-2026-104');
});

test('Scenario 4: Old demo link for DPS-2026-089 resolves correctly and is not overwritten', () => {
  resetDemoPayerData();
  const oldDemoData = getDemoPayerData('demo-access-token-12345');
  assert.ok(oldDemoData !== null);
  assert.equal(oldDemoData.payer.studentName, 'V Rakesh');
  assert.equal(oldDemoData.payer.displayName, 'Rajesh Sharma');
  assert.equal(oldDemoData.payer.accountReference, 'DPS-2026-089');
  assert.equal(oldDemoData.summary.net_payable_minor, '12000000');

  const directRefData = getDemoPayerData('access-DPS-2026-089');
  assert.ok(directRefData !== null);
  assert.equal(directRefData.payer.studentName, 'V Rakesh');
  assert.equal(directRefData.payer.displayName, 'Rajesh Sharma');
});

test('Scenario 5: Invalid, unknown, or expired tokens return null without falling back to DPS-2026-089', () => {
  resetDemoPayerData();
  assert.equal(getDemoPayerData(''), null);
  assert.equal(getDemoPayerData('invalid-unknown-token-xyz'), null);
  assert.equal(getDemoPayerData('sec-tok-does-not-exist'), null);
  assert.equal(getDemoPayerData('access-unknown-ref-999'), null);

  // Expired token test
  const expiredToken = 'sec-tok-expired-123';
  registerSecurePayerToken(expiredToken, {
    token: expiredToken,
    studentId: 'stu-12',
    studentName: 'Saumya',
    guardianName: 'Sanjay Kumar',
    accountReference: 'DPS-2026-160',
    netPayableMinor: 13500000,
    paidMinor: 4500000,
    outstandingMinor: 9000000,
    expiresAt: Date.now() - 5000, // already expired
  });

  assert.equal(getRegisteredSecureToken(expiredToken), null, 'Expired token must return null');
  assert.equal(getDemoPayerData(expiredToken), null, 'Expired token must not load any account');
});

test('Scenario 6: Direct payment, payment history, and balance updates work on secure fee account', () => {
  resetDemoPayerData();
  const token = 'sec-tok-saumya-payment';
  registerSecurePayerToken(token, {
    token,
    studentId: 'stu-12',
    studentName: 'Saumya',
    guardianName: 'Sanjay Kumar',
    accountReference: 'DPS-2026-160',
    netPayableMinor: 13500000,
    paidMinor: 4500000,
    outstandingMinor: 9000000,
    expiresAt: Date.now() + 86400000,
  });

  const updatedData = applyPayerPayment(token, 2, 4500000, undefined, 'pay-saumya-test-1');
  assert.ok(updatedData !== null);
  assert.equal(updatedData.summary.paid_minor, '9000000');
  assert.equal(updatedData.summary.outstanding_minor, '4500000');
  assert.ok(updatedData.payments.length >= 2);
  assert.equal(updatedData.payer.studentName, 'Saumya');
  assert.equal(updatedData.payer.displayName, 'Sanjay Kumar');
});

test('Scenario 7: User screenshot token sec-tok-caa105a16184c1253b6f3f1b3537dc6e resolves to Saumya and Sanjay Kumar', () => {
  resetDemoPayerData();
  const token = 'sec-tok-caa105a16184c1253b6f3f1b3537dc6e';
  const data = getDemoPayerData(token);
  assert.ok(data !== null, 'Token from user screenshot must resolve successfully');
  assert.equal(data.payer.studentName, 'Saumya');
  assert.equal(data.payer.displayName, 'Sanjay Kumar');
  assert.equal(data.payer.accountReference, 'DPS-2026-160');
  assert.equal(data.summary.net_payable_minor, '12000000');
  assert.equal(data.summary.outstanding_minor, '12000000');
});

test('Scenario 8: Dynamically registered tokens survive global memory reset via disk persistence', () => {
  const dynamicToken = 'sec-tok-persist-test-' + Date.now();
  registerSecurePayerToken(dynamicToken, {
    token: dynamicToken,
    studentId: 'stu-12',
    studentName: 'Saumya',
    guardianName: 'Sanjay Kumar',
    accountReference: 'DPS-2026-160',
    email: 'sanjay.kumar@example.com',
    phone: '+91 98765 43220',
    netPayableMinor: 12000000,
    paidMinor: 0,
    outstandingMinor: 12000000,
    expiresAt: Date.now() + 86400000,
  });

  // Simulate server reload / separate webpack chunk by clearing in-memory globalStore
  delete (globalThis as any).__DODO_SECURE_PAYER_TOKENS__;
  delete (globalThis as any).__DODO_GLOBAL_PAYER_STORE__;

  // Verify that it still resolves from disk storage
  const resolved = getRegisteredSecureToken(dynamicToken);
  assert.ok(resolved !== null, 'Token should be recovered from persistent disk storage');
  assert.equal(resolved.studentName, 'Saumya');
  assert.equal(resolved.guardianName, 'Sanjay Kumar');
  assert.equal(resolved.accountReference, 'DPS-2026-160');

  const payerData = getDemoPayerData(dynamicToken);
  assert.ok(payerData !== null);
  assert.equal(payerData.payer.studentName, 'Saumya');
  assert.equal(payerData.payer.displayName, 'Sanjay Kumar');
});
