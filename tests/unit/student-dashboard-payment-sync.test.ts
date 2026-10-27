import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST, GET } from '../../apps/web/src/app/api/v1/[...route]/route';
import {
  findStudentAccount,
  getStudentInstallments,
  getStudentTransactions,
  getStudentReceipts,
  findReceiptByNumber,
  recordStudentPayment,
  resetStudentLedger,
} from '../../apps/web/src/lib/student-ledger';
import {
  resetDemoPayerData,
  registerSecurePayerToken,
  getDemoPayerData,
  applyPayerPayment,
  STUDENT_PROFILES,
} from '../../apps/web/src/lib/payer-store';

test('Scenario 1 & 2: A confirmed ₹40,000 payment updates Total Paid to ₹40,000 and Outstanding to ₹80,000', () => {
  resetStudentLedger();
  const initialStudent = findStudentAccount('stu-12');
  assert.ok(initialStudent, 'Student stu-12 (Saumya) should exist');
  assert.equal(initialStudent.fullName, 'Saumya');
  assert.equal(initialStudent.guardianName, 'Sanjay Kumar');
  assert.equal(initialStudent.studentReference, 'DPS-2026-160');
  assert.equal(initialStudent.academicYear, '2026-2027');
  assert.equal(initialStudent.netPayableMinor, 12000000, 'Initial net payable should be ₹1,20,000');
  assert.equal(initialStudent.paidMinor, 0, 'Initial paid should be ₹0');
  assert.equal(initialStudent.outstandingMinor, 12000000, 'Initial outstanding should be ₹1,20,000');

  // Record ₹40,000 payment
  const result = recordStudentPayment({
    studentQuery: 'stu-12',
    amountMinor: 4000000,
    transactionId: 'TXN-TEST-40K-1',
    paymentMode: 'eNACH Auto-Debit (Sandbox)',
    outcome: 'successful',
  });

  assert.equal(result.success, true);
  assert.equal(result.isDuplicate, false);
  assert.ok(result.account);
  assert.equal(result.account.paidMinor, 4000000, 'Total Paid must update to ₹40,000 (4000000 minor)');
  assert.equal(result.account.outstandingMinor, 8000000, 'Outstanding Balance must update to ₹80,000 (8000000 minor)');
  assert.equal(result.outstandingMinor, 8000000);

  // Collection progress calculation
  const progressPercent = (result.account.paidMinor / result.account.netPayableMinor) * 100;
  assert.equal(progressPercent.toFixed(2), '33.33', 'Collection Progress must be 33.33%');
});

test('Scenario 3: The correct installment reflects payment allocation (Installment #1 paid, Installment #2 upcoming)', () => {
  resetStudentLedger();
  recordStudentPayment({
    studentQuery: 'stu-12',
    amountMinor: 4000000,
    transactionId: 'TXN-TEST-ALLOC-1',
    outcome: 'successful',
  });

  const student = findStudentAccount('stu-12');
  assert.ok(student);
  const installments = getStudentInstallments(student);

  assert.equal(installments.length, 3, 'Should have 3 installments');

  // Installment 1: ₹40,000, fully paid, remaining 0
  const inst1 = installments[0];
  assert.equal(inst1.sequence, 1);
  assert.equal(inst1.amountMinor, 4000000);
  assert.equal(inst1.paidAmountMinor, 4000000);
  assert.equal(inst1.remainingMinor, 0);
  assert.equal(inst1.status, 'paid');

  // Installment 2: ₹40,000, 0 paid, remaining ₹40,000, pending
  const inst2 = installments[1];
  assert.equal(inst2.sequence, 2);
  assert.equal(inst2.amountMinor, 4000000);
  assert.equal(inst2.paidAmountMinor, 0);
  assert.equal(inst2.remainingMinor, 4000000);
  assert.equal(inst2.status, 'pending');

  // Installment 3: ₹40,000, 0 paid, remaining ₹40,000, pending
  const inst3 = installments[2];
  assert.equal(inst3.sequence, 3);
  assert.equal(inst3.amountMinor, 4000000);
  assert.equal(inst3.paidAmountMinor, 0);
  assert.equal(inst3.remainingMinor, 4000000);
  assert.equal(inst3.status, 'pending');
});

test('Scenario 4: Receipt and Transactions show matching reference, amount, and ₹80,000 remaining balance', () => {
  resetStudentLedger();
  const txId = 'TXN-SAUMYA-REF-001';
  const customRecNum = 'DPS-REC-2026-160-01';

  const res = recordStudentPayment({
    studentQuery: 'DPS-2026-160',
    amountMinor: 4000000,
    transactionId: txId,
    receiptNumber: customRecNum,
    paymentMode: 'eNACH Auto-Debit',
    outcome: 'successful',
  });

  assert.ok(res.transaction);
  assert.ok(res.receipt);

  // Check transaction details
  assert.equal(res.transaction.transactionId, txId);
  assert.equal(res.transaction.amountMinor, 4000000);
  assert.equal(res.transaction.status, 'confirmed');
  assert.equal(res.transaction.receiptNumber, customRecNum);

  // Check receipt details
  assert.equal(res.receipt.receiptNumber, customRecNum);
  assert.equal(res.receipt.transactionId, txId);
  assert.equal(res.receipt.amountMinor, 4000000);
  assert.equal(res.receipt.remainingMinor, 8000000, 'Receipt remaining balance must be ₹80,000 (not ₹40,000)');

  // Verify retrieval via queries
  const txList = getStudentTransactions('stu-12');
  assert.equal(txList.length, 1);
  assert.equal(txList[0].transactionId, txId);
  assert.equal(txList[0].amountMinor, 4000000);

  const receiptList = getStudentReceipts('stu-12');
  assert.equal(receiptList.length, 1);
  assert.equal(receiptList[0].receiptNumber, customRecNum);
  assert.equal(receiptList[0].remainingMinor, 8000000);

  const foundReceipt = findReceiptByNumber(customRecNum);
  assert.ok(foundReceipt);
  assert.equal(foundReceipt.transactionId, txId);
  assert.equal(foundReceipt.remainingMinor, 8000000);
});

test('Scenario 5: Reloading dashboard / re-fetching preserves correct totals from the ledger', () => {
  resetStudentLedger();
  recordStudentPayment({
    studentQuery: 'stu001', // via enrollment ID
    amountMinor: 4000000,
    transactionId: 'TXN-RELOAD-TEST',
    outcome: 'successful',
  });

  // Simulate multiple independent queries (page reloads / re-logins)
  for (let i = 0; i < 5; i++) {
    const student = findStudentAccount('stu-12');
    assert.ok(student);
    assert.equal(student.netPayableMinor, 12000000);
    assert.equal(student.paidMinor, 4000000);
    assert.equal(student.outstandingMinor, 8000000);

    const txs = getStudentTransactions('stu-12');
    assert.equal(txs.length, 1);
    assert.equal(txs[0].transactionId, 'TXN-RELOAD-TEST');

    const receipts = getStudentReceipts('stu-12');
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].remainingMinor, 8000000);
  }
});

test('Scenario 6: Repeating the payment callback does not double-count the transaction (idempotency)', () => {
  resetStudentLedger();
  const txId = 'TXN-IDEMPOTENT-SAUMYA';

  // First callback
  const firstAttempt = recordStudentPayment({
    studentQuery: 'stu-12',
    amountMinor: 4000000,
    transactionId: txId,
    outcome: 'successful',
  });
  assert.equal(firstAttempt.success, true);
  assert.equal(firstAttempt.isDuplicate, false);
  assert.equal(firstAttempt.account?.paidMinor, 4000000);
  assert.equal(firstAttempt.account?.outstandingMinor, 8000000);

  // Duplicate callback with identical transaction ID
  const duplicateAttempt = recordStudentPayment({
    studentQuery: 'stu-12',
    amountMinor: 4000000,
    transactionId: txId,
    outcome: 'successful',
  });
  assert.equal(duplicateAttempt.success, true);
  assert.equal(duplicateAttempt.isDuplicate, true, 'Duplicate call must be recognized as duplicate');
  assert.equal(duplicateAttempt.account?.paidMinor, 4000000, 'Paid minor must not double-count');
  assert.equal(duplicateAttempt.account?.outstandingMinor, 8000000, 'Outstanding minor must remain ₹80,000');

  // Verify transactions and receipts count
  const txs = getStudentTransactions('stu-12');
  assert.equal(txs.length, 1, 'Only one transaction should be persisted');

  const receipts = getStudentReceipts('stu-12');
  assert.equal(receipts.length, 1, 'Only one receipt should be persisted');
});

test('Scenario 7: Failed or pending payments do not affect the confirmed paid amount', () => {
  resetStudentLedger();

  // First confirm ₹40,000
  recordStudentPayment({
    studentQuery: 'stu-12',
    amountMinor: 4000000,
    transactionId: 'TXN-CONFIRMED-1',
    outcome: 'successful',
  });

  // Attempt a failed payment
  const failedAttempt = recordStudentPayment({
    studentQuery: 'stu-12',
    amountMinor: 4000000,
    transactionId: 'TXN-FAILED-2',
    outcome: 'failed',
  });
  assert.equal(failedAttempt.success, false);

  const studentAfterFailed = findStudentAccount('stu-12');
  assert.equal(studentAfterFailed?.paidMinor, 4000000, 'Paid minor must remain 4000000 after failed attempt');
  assert.equal(studentAfterFailed?.outstandingMinor, 8000000, 'Outstanding minor must remain 8000000');

  // Attempt a pending payment
  const pendingAttempt = recordStudentPayment({
    studentQuery: 'stu-12',
    amountMinor: 4000000,
    transactionId: 'TXN-PENDING-3',
    outcome: 'pending',
  });
  assert.equal(pendingAttempt.success, false);

  const studentAfterPending = findStudentAccount('stu-12');
  assert.equal(studentAfterPending?.paidMinor, 4000000, 'Paid minor must remain 4000000 after pending attempt');
  assert.equal(studentAfterPending?.outstandingMinor, 8000000, 'Outstanding minor must remain 8000000');
});

test('Scenario 8: Other students fee accounts remain completely unchanged', () => {
  resetStudentLedger();

  const student1Before = { ...findStudentAccount('stu-1')! };
  const student2Before = { ...findStudentAccount('stu-2')! };

  // Apply payment to Saumya (stu-12)
  recordStudentPayment({
    studentQuery: 'stu-12',
    amountMinor: 4000000,
    transactionId: 'TXN-SAUMYA-ONLY',
    outcome: 'successful',
  });

  const student1After = findStudentAccount('stu-1')!;
  const student2After = findStudentAccount('stu-2')!;

  // V Rakesh (stu-1) remains unaffected
  assert.equal(student1After.paidMinor, student1Before.paidMinor);
  assert.equal(student1After.outstandingMinor, student1Before.outstandingMinor);
  assert.equal(student1After.netPayableMinor, student1Before.netPayableMinor);
  assert.equal(student1After.fullName, 'V Rakesh');

  // Diya Patel (stu-2) remains unaffected
  assert.equal(student2After.paidMinor, student2Before.paidMinor);
  assert.equal(student2After.outstandingMinor, student2Before.outstandingMinor);
  assert.equal(student2After.netPayableMinor, student2Before.netPayableMinor);
  assert.equal(student2After.fullName, 'Diya Patel');
});

test('Scenario 9: Payer store DPS-2026-160 synchronization', () => {
  resetDemoPayerData();
  const token = 'sec-tok-sync-test';
  registerSecurePayerToken(token, {
    token,
    studentId: 'stu-12',
    studentName: 'Saumya',
    guardianName: 'Sanjay Kumar',
    accountReference: 'DPS-2026-160',
    netPayableMinor: 12000000,
    paidMinor: 0,
    outstandingMinor: 12000000,
    expiresAt: Date.now() + 86400000,
  });

  const payerData = getDemoPayerData(token);
  assert.ok(payerData);
  assert.equal(payerData.summary.net_payable_minor, '12000000');
  assert.equal(payerData.summary.paid_minor, '0');
  assert.equal(payerData.summary.outstanding_minor, '12000000');

  // Apply ₹40,000 payment on payer portal
  const updated = applyPayerPayment(token, 1, 4000000, undefined, 'TXN-PAYER-40K');
  assert.ok(updated);
  assert.equal(updated.summary.net_payable_minor, '12000000');
  assert.equal(updated.summary.paid_minor, '4000000');
  assert.equal(updated.summary.outstanding_minor, '8000000');
  assert.equal(updated.payer.studentName, 'Saumya');
  assert.equal(updated.payer.displayName, 'Sanjay Kumar');
});

test('Scenario 10: Next.js API Routes End-to-End Simulation (/api/v1/portal/login -> simulate-debit -> me -> receipt)', async () => {
  resetStudentLedger();
  // 1. Portal Login as Saumya
  const loginReq = new NextRequest('http://localhost:3000/api/v1/portal/login', {
    method: 'POST',
    body: JSON.stringify({
      studentReference: 'stu-12',
      identifier: 'DPS-2026-160',
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  const loginRes = await POST(loginReq, { params: Promise.resolve({ route: ['portal', 'login'] }) });
  const loginJson = await loginRes.json();
  assert.equal(loginJson.ok, true);
  const token = loginJson.token;
  assert.ok(token);

  // 2. Fetch /portal/me before payment
  const meBeforeReq = new NextRequest('http://localhost:3000/api/v1/portal/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const meBeforeRes = await GET(meBeforeReq, { params: Promise.resolve({ route: ['portal', 'me'] }) });
  const meBeforeJson = await meBeforeRes.json();
  assert.equal(meBeforeJson.student.fullName, 'Saumya');
  assert.equal(meBeforeJson.summary.netPayableMinor, 12000000);
  assert.equal(meBeforeJson.summary.paidMinor, 0);
  assert.equal(meBeforeJson.summary.outstandingMinor, 12000000);

  // 3. Simulate ₹40,000 debit
  const txRef = 'TXN-API-ROUTE-40K-E2E';
  const debitReq = new NextRequest('http://localhost:3000/api/v1/portal/enach/simulate-debit', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mandateId: meBeforeJson.enach?.mandateId || 'mndt-sandbox-stu-12',
      amountMinor: 4000000, // ₹40,000
      transactionId: txRef,
      outcome: 'successful',
    }),
  });
  const debitRes = await POST(debitReq, { params: Promise.resolve({ route: ['portal', 'enach', 'simulate-debit'] }) });
  const debitJson = await debitRes.json();
  assert.equal(debitJson.ok, true);
  assert.equal(debitJson.paymentComplete.amountMinor, 4000000);
  assert.equal(debitJson.paymentComplete.outstandingMinor, 8000000);
  assert.ok(debitJson.paymentComplete.receiptNumber);

  // 4. Fetch /portal/me after payment
  const meAfterReq = new NextRequest('http://localhost:3000/api/v1/portal/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const meAfterRes = await GET(meAfterReq, { params: Promise.resolve({ route: ['portal', 'me'] }) });
  const meAfterJson = await meAfterRes.json();
  assert.equal(meAfterJson.summary.paidMinor, 4000000, 'Portal/me must return paidMinor 4000000');
  assert.equal(meAfterJson.summary.outstandingMinor, 8000000, 'Portal/me must return outstandingMinor 8000000');
  assert.equal(meAfterJson.installments[0].status, 'paid');
  assert.equal(meAfterJson.installments[0].remainingMinor, 0);
  assert.equal(meAfterJson.installments[1].status, 'pending');
  assert.equal(meAfterJson.installments[1].remainingMinor, 4000000);
  assert.ok(meAfterJson.transactions.length >= 1);
  assert.equal(meAfterJson.transactions[0].transactionId, txRef);

  // 5. Fetch Receipt
  const receiptNumber = debitJson.paymentComplete.receiptNumber;
  const recReq = new NextRequest(`http://localhost:3000/api/v1/portal/receipts/${receiptNumber}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const recRes = await GET(recReq, { params: Promise.resolve({ route: ['portal', 'receipts', receiptNumber] }) });
  const recJson = await recRes.json();
  assert.equal(recJson.amount_minor, 4000000);
  assert.equal(recJson.remaining_minor, 8000000, 'Receipt remaining balance must be ₹80,000');
  assert.equal(recJson.snapshot.remainingMinor, 8000000);

  // 6. Test Idempotency with repeated debit call
  const repeatDebitReq = new NextRequest('http://localhost:3000/api/v1/portal/enach/simulate-debit', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mandateId: meBeforeJson.enach?.mandateId || 'mndt-sandbox-stu-12',
      amountMinor: 4000000,
      transactionId: txRef,
      outcome: 'successful',
    }),
  });
  const repeatDebitRes = await POST(repeatDebitReq, { params: Promise.resolve({ route: ['portal', 'enach', 'simulate-debit'] }) });
  const repeatDebitJson = await repeatDebitRes.json();
  assert.equal(repeatDebitJson.ok, true);
  assert.ok(repeatDebitJson.message.includes('idempotent'));
  assert.equal(repeatDebitJson.paymentComplete.outstandingMinor, 8000000);

  // Check portal/me is not double counted
  const meAfterRepeatRes = await GET(meAfterReq, { params: Promise.resolve({ route: ['portal', 'me'] }) });
  const meAfterRepeatJson = await meAfterRepeatRes.json();
  assert.equal(meAfterRepeatJson.summary.paidMinor, 4000000, 'Must not double count');
  assert.equal(meAfterRepeatJson.summary.outstandingMinor, 8000000);

  // 7. Test failed debit does not mutate balances
  const failDebitReq = new NextRequest('http://localhost:3000/api/v1/portal/enach/simulate-debit', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mandateId: meBeforeJson.enach?.mandateId || 'mndt-sandbox-stu-12',
      amountMinor: 4000000,
      outcome: 'failed',
    }),
  });
  const failDebitRes = await POST(failDebitReq, { params: Promise.resolve({ route: ['portal', 'enach', 'simulate-debit'] }) });
  const failDebitJson = await failDebitRes.json();
  assert.ok(failDebitJson.message.includes('failed as requested'));

  const meAfterFailRes = await GET(meAfterReq, { params: Promise.resolve({ route: ['portal', 'me'] }) });
  const meAfterFailJson = await meAfterFailRes.json();
  assert.equal(meAfterFailJson.summary.paidMinor, 4000000, 'Must not change on failed payment');
  assert.equal(meAfterFailJson.summary.outstandingMinor, 8000000);
});

