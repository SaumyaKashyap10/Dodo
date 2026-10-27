import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFeeSummary,
  saveStudentAccount,
  findStudentAccount,
  recordStudentPayment,
  reconcileStudentExcess,
  resetStudentLedger,
} from '../../apps/web/src/lib/student-ledger';
import {
  syncBalances,
  findRosterStudent,
} from '../../apps/web/src/lib/student-roster';
import { applyPayerPayment, registerSecurePayerToken } from '../../apps/web/src/lib/payer-store';

test('1. Fee Summary Calculations (Formulas & Invariants)', () => {
  // Case A: Partial payment with discounts
  const summaryA = calculateFeeSummary(10000000, 4000000, 1000000, 11000000);
  assert.equal(summaryA.totalAssignedFeeMinor, 11000000);
  assert.equal(summaryA.discountsMinor, 1000000);
  assert.equal(summaryA.netPayableMinor, 10000000);
  assert.equal(summaryA.paidMinor, 4000000);
  assert.equal(summaryA.outstandingMinor, 6000000);
  assert.equal(summaryA.excessMinor, 0);
  assert.equal(summaryA.isOverpaid, false);

  // Case B: Fully paid
  const summaryB = calculateFeeSummary(10000000, 10000000);
  assert.equal(summaryB.outstandingMinor, 0);
  assert.equal(summaryB.excessMinor, 0);
  assert.equal(summaryB.isOverpaid, false);

  // Case C: Overpaid
  const summaryC = calculateFeeSummary(11000000, 15500000);
  assert.equal(summaryC.netPayableMinor, 11000000);
  assert.equal(summaryC.paidMinor, 15500000);
  assert.equal(summaryC.outstandingMinor, 0);
  assert.equal(summaryC.excessMinor, 4500000);
  assert.equal(summaryC.isOverpaid, true);
});

test('2. Acceptance Requirement: Net ₹1,10,000, Paid ₹1,55,000 -> Outstanding ₹0, Excess ₹45,000 and Discrepancy Flagged', () => {
  resetStudentLedger();

  // Create student with Net Payable 1,10,000 (11000000 minor) and initial paid 0
  const studentId = 'stu-acceptance-1';
  saveStudentAccount({
    id: studentId,
    accountReference: 'DPS-2026-TEST',
    studentName: 'Acceptance Candidate',
    payerName: 'Parent One',
    email: 'parent@example.com',
    phone: '+91 99999 88888',
    netPayableMinor: 11000000,
    paidMinor: 0,
    totalAssignedFeeMinor: 11000000,
    discountsMinor: 0,
  });

  // Pay 1,55,000 with explicit overpayment authorization
  const payResult = recordStudentPayment({
    studentQuery: studentId,
    amountMinor: 15500000,
    transactionId: 'TXN-ACCEPTANCE-1',
    paymentMode: 'DIRECT',
    outcome: 'successful',
    allowExcess: true,
    authorizationReason: 'Parent prepaid advance academic term fee',
  });

  assert.equal(payResult.success, true);
  assert.equal(payResult.account?.paidMinor, 15500000);
  assert.equal(payResult.account?.outstandingMinor, 0);
  assert.equal(payResult.account?.excessMinor, 4500000);
  assert.equal(payResult.isOverpaid, true);

  // Verify stored ledger record matches
  const stored = findStudentAccount(studentId);
  assert.ok(stored);
  assert.equal(stored.netPayableMinor, 11000000);
  assert.equal(stored.paidMinor, 15500000);
  assert.equal(stored.outstandingMinor, 0);
  assert.equal(stored.excessMinor, 4500000);
  assert.equal(stored.isOverpaid, true);

  // Attempt further ordinary payment without explicit authorization -> MUST FAIL
  const blockedPay = recordStudentPayment({
    studentQuery: studentId,
    amountMinor: 1000000,
    transactionId: 'TXN-BLOCKED-2',
    allowExcess: false,
  });
  assert.equal(blockedPay.success, false);
  assert.equal(blockedPay.isOverpaid, true);
  assert.match(blockedPay.message, /unreconciled excess payment/i);
});

test('3. Accidental Overpayment Prevention: Rejection by Default & Authorized Override', () => {
  resetStudentLedger();

  const studentId = 'stu-overpay-prevention';
  saveStudentAccount({
    id: studentId,
    accountReference: 'DPS-2026-PREVENT',
    studentName: 'Prevent Overpayment Student',
    payerName: 'Parent Guard',
    netPayableMinor: 5000000, // 50,000
    paidMinor: 3000000,       // 30,000 (20,000 outstanding)
  });

  // Attempt payment of 25,000 (exceeds 20,000 outstanding by 5,000) without allowExcess
  const rejected = recordStudentPayment({
    studentQuery: studentId,
    amountMinor: 2500000,
    transactionId: 'TXN-REJECTED-1',
    allowExcess: false,
  });

  assert.equal(rejected.success, false);
  assert.equal(rejected.isOverpaid, false);
  assert.match(rejected.message, /exceeds the outstanding balance/i);

  // Account remains untouched
  const unchanged = findStudentAccount(studentId);
  assert.equal(unchanged?.paidMinor, 3000000);
  assert.equal(unchanged?.outstandingMinor, 2000000);
  assert.equal(unchanged?.excessMinor, 0);

  // Now submit with explicit authorized workflow allowExcess: true
  const authorized = recordStudentPayment({
    studentQuery: studentId,
    amountMinor: 2500000,
    transactionId: 'TXN-AUTHORIZED-1',
    allowExcess: true,
    authorizationReason: 'Bursar approval for term advance',
  });

  assert.equal(authorized.success, true);
  assert.equal(authorized.account?.paidMinor, 5500000);
  assert.equal(authorized.account?.outstandingMinor, 0);
  assert.equal(authorized.account?.excessMinor, 500000);
  assert.equal(authorized.isOverpaid, true);
});

test('4. Existing Overpayment Reconciliation (Refund, Credit Carry Forward, Fee Adjustment)', () => {
  resetStudentLedger();

  // Scenario A: Refund
  const studentA = 'stu-reconcile-refund';
  saveStudentAccount({
    id: studentA,
    accountReference: 'DPS-REFUND-1',
    studentName: 'Refund Student',
    payerName: 'Parent A',
    netPayableMinor: 10000000,
    paidMinor: 13000000, // 30,000 excess
  });

  const refundResult = reconcileStudentExcess({
    studentQuery: studentA,
    action: 'refund',
    amountMinor: 3000000,
    notes: 'Refund excess via NEFT to primary parent bank account',
  });
  assert.equal(refundResult.success, true);
  assert.equal(refundResult.account?.excessMinor, 0);
  assert.equal(refundResult.account?.paidMinor, 10000000);
  assert.equal(refundResult.account?.outstandingMinor, 0);

  // Scenario B: Credit Carry Forward
  const studentB = 'stu-reconcile-carry';
  saveStudentAccount({
    id: studentB,
    accountReference: 'DPS-CARRY-1',
    studentName: 'Carry Forward Student',
    payerName: 'Parent B',
    netPayableMinor: 10000000,
    paidMinor: 14000000, // 40,000 excess
  });

  const carryResult = reconcileStudentExcess({
    studentQuery: studentB,
    action: 'credit_carry_forward',
    amountMinor: 4000000,
    notes: 'Carry forward 40,000 as unapplied credit for AY 2027-28',
  });
  assert.equal(carryResult.success, true);
  assert.equal(carryResult.account?.excessMinor, 0);
  assert.equal(carryResult.account?.paidMinor, 10000000);

  // Scenario C: Fee Adjustment (absorbs excess into revised fee schedule)
  const studentC = 'stu-reconcile-adj';
  saveStudentAccount({
    id: studentC,
    accountReference: 'DPS-ADJ-1',
    studentName: 'Adjust Student',
    payerName: 'Parent C',
    netPayableMinor: 10000000,
    paidMinor: 12000000, // 20,000 excess
  });

  const adjResult = reconcileStudentExcess({
    studentQuery: studentC,
    action: 'fee_adjustment',
    amountMinor: 2000000,
    notes: 'Absorb extra payment into elective laboratory fee schedule',
  });
  assert.equal(adjResult.success, true);
  assert.equal(adjResult.account?.excessMinor, 0);
  assert.equal(adjResult.account?.netPayableMinor, 12000000);
  assert.equal(adjResult.account?.paidMinor, 12000000);
  assert.equal(adjResult.account?.outstandingMinor, 0);
});

test('5. Multi-channel consistency: Payer Store synchronization', () => {
  const token = 'test-token-overpay-' + Date.now();
  registerSecurePayerToken(token, {
    token,
    studentId: 'stu-payer-test',
    studentName: 'Payer Portal Student',
    guardianName: 'Guardian Portal',
    accountReference: 'DPS-PAYER-01',
    netPayableMinor: 10000000, // 1,00,000
    paidMinor: 6000000,        // 60,000 (40,000 outstanding)
    outstandingMinor: 4000000,
  });

  // Make a payment of 40,000
  const afterPay = applyPayerPayment(token, 1, 4000000);
  assert.equal(Number(afterPay.summary.paid_minor), 10000000);
  assert.equal(Number(afterPay.summary.outstanding_minor), 0);
  assert.equal(Number((afterPay.summary as any).excess_minor || 0), 0);

  // Make an additional payment with excess of 15,000
  const afterOverpay = applyPayerPayment(token, 1, 1500000);
  assert.equal(Number(afterOverpay.summary.paid_minor), 11500000);
  assert.equal(Number(afterOverpay.summary.outstanding_minor), 0);
  assert.equal(Number((afterOverpay.summary as any).excess_minor), 1500000);
  assert.equal(Boolean((afterOverpay.summary as any).is_overpaid), true);
});

test('6. Student Roster sync preserves excess_minor and is_overpaid', () => {
  const stu = findRosterStudent('stu-1');
  if (stu) {
    saveStudentAccount({
      id: stu.id,
      accountReference: stu.student_reference,
      studentName: stu.full_name,
      payerName: stu.guardian_name || 'Guardian',
      netPayableMinor: 11000000,
      paidMinor: 15500000,
    });
    const synced = syncBalances(stu);
    assert.equal(synced.paid_minor, '15500000');
    assert.equal(synced.outstanding_minor, '0');
    assert.equal(synced.excess_minor, '4500000');
    assert.equal(synced.is_overpaid, true);
  }
});
