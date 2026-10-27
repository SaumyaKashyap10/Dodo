/**
 * Student Financial Ledger & Payment Synchronization Service
 * Source of truth for student fee accounts, payments, installments, and receipts.
 */

export type StudentAccount = {
  id: string;
  enrollmentId: string;
  studentReference: string;
  fullName: string;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
  institute: string;
  course: string;
  grade: string;
  academicYear: string;
  netPayableMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  excessMinor?: number;
  isOverpaid?: boolean;
  discountsMinor?: number;
  totalAssignedFeeMinor?: number;
  enachStatus: string;
};

export type FeeSummary = {
  totalAssignedFeeMinor: number;
  discountsMinor: number;
  netPayableMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  excessMinor: number;
  isOverpaid: boolean;
};

export function calculateFeeSummary(
  netPayableMinor: number,
  paidMinor: number,
  discountsMinor: number = 0,
  totalAssignedMinor?: number,
): FeeSummary {
  const net = Math.max(0, Number(netPayableMinor || 0));
  const paid = Math.max(0, Number(paidMinor || 0));
  const outstanding = Math.max(0, net - paid);
  const excess = Math.max(0, paid - net);
  const total = totalAssignedMinor ?? (net + discountsMinor);

  return {
    totalAssignedFeeMinor: total,
    discountsMinor,
    netPayableMinor: net,
    paidMinor: paid,
    outstandingMinor: outstanding,
    excessMinor: excess,
    isOverpaid: excess > 0,
  };
};

export type StudentInstallment = {
  id: string;
  sequence: number;
  dueDate: string;
  amountMinor: number;
  paidAmountMinor: number;
  remainingMinor: number;
  status: 'pending' | 'part_paid' | 'paid';
};

export type StudentTransaction = {
  id: string;
  transactionId: string;
  amountMinor: number;
  recordedAt: string;
  status: 'confirmed' | 'failed' | 'pending';
  receiptNumber: string;
  mode: string;
  installmentId?: string;
};

export type StudentReceipt = {
  receiptNumber: string;
  transactionId: string;
  amountMinor: number;
  remainingMinor: number;
  issuedAt: string;
  studentName: string;
  accountReference: string;
  paymentMode: string;
};

// Initial default student accounts
const INITIAL_ACCOUNTS: Record<string, StudentAccount> = {
  'stu-12': {
    id: 'stu-12',
    enrollmentId: 'stu001',
    studentReference: 'DPS-2026-160',
    fullName: 'Saumya',
    guardianName: 'Sanjay Kumar',
    guardianEmail: 'sanjay.kumar@example.com',
    guardianPhone: '+91 98765 43220',
    institute: 'Delhi Public School (Demo)',
    course: 'CBSE Senior Secondary',
    grade: 'Grade 11',
    academicYear: '2026-2027',
    netPayableMinor: 12000000,
    paidMinor: 0,
    outstandingMinor: 12000000,
    enachStatus: 'active',
  },
  'stu-1': {
    id: 'stu-1',
    enrollmentId: 'stu-089',
    studentReference: 'DPS-2026-089',
    fullName: 'V Rakesh',
    guardianName: 'Rajesh Sharma',
    guardianEmail: 'rajesh.sharma@example.com',
    guardianPhone: '+91 98765 43210',
    institute: 'Delhi Public School, R.K. Puram',
    course: 'Senior Secondary Science',
    grade: 'Grade 11-A',
    academicYear: '2026-2027',
    netPayableMinor: 12000000,
    paidMinor: 4000000,
    outstandingMinor: 8000000,
    enachStatus: 'active',
  },
  'stu-2': {
    id: 'stu-2',
    enrollmentId: 'stu-104',
    studentReference: 'DPS-2026-104',
    fullName: 'Diya Patel',
    guardianName: 'Suresh Patel',
    guardianEmail: 'suresh.patel@example.com',
    guardianPhone: '+91 98765 43211',
    institute: 'Delhi Public School (Demo)',
    course: 'CBSE Middle School',
    grade: 'Grade 8-B',
    academicYear: '2026-2027',
    netPayableMinor: 11000000,
    paidMinor: 7500000,
    outstandingMinor: 3500000,
    enachStatus: 'active',
  },
  'stu-3': {
    id: 'stu-3',
    enrollmentId: 'stu-141',
    studentReference: 'DPS-2026-141',
    fullName: 'Rohan Mehta',
    guardianName: 'Vikram Mehta',
    guardianEmail: 'vikram.mehta@example.com',
    guardianPhone: '+91 98765 43212',
    institute: 'Delhi Public School (Demo)',
    course: 'CBSE Senior Secondary',
    grade: 'Grade 12-Science',
    academicYear: '2026-2027',
    netPayableMinor: 14500000,
    paidMinor: 5000000,
    outstandingMinor: 9500000,
    enachStatus: 'pending',
  },
  'stu-4': {
    id: 'stu-4',
    enrollmentId: 'stu-055',
    studentReference: 'DPS-2026-055',
    fullName: 'Kavya Reddy',
    guardianName: 'Venkat Reddy',
    guardianEmail: 'venkat.reddy@example.com',
    guardianPhone: '+91 98765 43213',
    institute: 'Delhi Public School (Demo)',
    course: 'Primary Foundation',
    grade: 'Grade 5-B',
    academicYear: '2026-2027',
    netPayableMinor: 14000000,
    paidMinor: 7000000,
    outstandingMinor: 7000000,
    enachStatus: 'active',
  },
  'stu-5': {
    id: 'stu-5',
    enrollmentId: 'stu-062',
    studentReference: 'DPS-2026-062',
    fullName: 'Ananya Gupta',
    guardianName: 'Pooja Gupta',
    guardianEmail: 'pooja.gupta@example.com',
    guardianPhone: '+91 98765 43214',
    institute: 'Delhi Public School (Demo)',
    course: 'CBSE Secondary',
    grade: 'Grade 9-A',
    academicYear: '2026-2027',
    netPayableMinor: 12500000,
    paidMinor: 6000000,
    outstandingMinor: 6500000,
    enachStatus: 'active',
  },
  'stu-6': {
    id: 'stu-6',
    enrollmentId: 'stu-077',
    studentReference: 'DPS-2026-077',
    fullName: 'Vivaan Malhotra',
    guardianName: 'Karan Malhotra',
    guardianEmail: 'karan.malhotra@example.com',
    guardianPhone: '+91 98765 43215',
    institute: 'Delhi Public School (Demo)',
    course: 'Middle School',
    grade: 'Grade 7-A',
    academicYear: '2026-2027',
    netPayableMinor: 16000000,
    paidMinor: 8000000,
    outstandingMinor: 8000000,
    enachStatus: 'active',
  },
  'stu-7': {
    id: 'stu-7',
    enrollmentId: 'stu-092',
    studentReference: 'DPS-2026-092',
    fullName: 'Ishan Verma',
    guardianName: 'Sunita Verma',
    guardianEmail: 'sunita.verma@example.com',
    guardianPhone: '+91 98765 43216',
    institute: 'Delhi Public School (Demo)',
    course: 'CBSE Senior Secondary',
    grade: 'Grade 11-Commerce',
    academicYear: '2026-2027',
    netPayableMinor: 13500000,
    paidMinor: 3500000,
    outstandingMinor: 10000000,
    enachStatus: 'pending',
  },
  'stu-8': {
    id: 'stu-8',
    enrollmentId: 'stu-118',
    studentReference: 'DPS-2026-118',
    fullName: 'Tara Nair',
    guardianName: 'Madhavan Nair',
    guardianEmail: 'madhavan.nair@example.com',
    guardianPhone: '+91 98765 43217',
    institute: 'Delhi Public School (Demo)',
    course: 'CBSE Middle School',
    grade: 'Grade 6-C',
    academicYear: '2026-2027',
    netPayableMinor: 12800000,
    paidMinor: 6400000,
    outstandingMinor: 6400000,
    enachStatus: 'active',
  },
  'stu-9': {
    id: 'stu-9',
    enrollmentId: 'stu-133',
    studentReference: 'DPS-2026-133',
    fullName: 'Aditya Joshi',
    guardianName: 'Sanjay Joshi',
    guardianEmail: 'sanjay.joshi@example.com',
    guardianPhone: '+91 98765 43218',
    institute: 'Delhi Public School (Demo)',
    course: 'CBSE Secondary',
    grade: 'Grade 10-B',
    academicYear: '2026-2027',
    netPayableMinor: 11200000,
    paidMinor: 2800000,
    outstandingMinor: 8400000,
    enachStatus: 'failed',
  },
  'stu-10': {
    id: 'stu-10',
    enrollmentId: 'stu-150',
    studentReference: 'DPS-2026-150',
    fullName: 'Meera Singhania',
    guardianName: 'Alok Singhania',
    guardianEmail: 'alok.singhania@example.com',
    guardianPhone: '+91 98765 43219',
    institute: 'Delhi Public School (Demo)',
    course: 'CBSE Senior Secondary',
    grade: 'Grade 12-Arts',
    academicYear: '2026-2027',
    netPayableMinor: 15000000,
    paidMinor: 4500000,
    outstandingMinor: 10500000,
    enachStatus: 'cancelled',
  },
};

// Global in-memory persistent stores so state survives Fast Refresh and module re-evaluations
const globalLedger = globalThis as unknown as {
  __DODO_ACCOUNT_STORE__?: Record<string, StudentAccount>;
  __DODO_TRANSACTION_STORE__?: Record<string, StudentTransaction[]>;
  __DODO_RECEIPT_STORE__?: Record<string, StudentReceipt[]>;
};

if (!globalLedger.__DODO_ACCOUNT_STORE__) {
  globalLedger.__DODO_ACCOUNT_STORE__ = JSON.parse(JSON.stringify(INITIAL_ACCOUNTS));
}
if (!globalLedger.__DODO_TRANSACTION_STORE__) {
  globalLedger.__DODO_TRANSACTION_STORE__ = {};
}
if (!globalLedger.__DODO_RECEIPT_STORE__) {
  globalLedger.__DODO_RECEIPT_STORE__ = {};
}

let ACCOUNT_STORE: Record<string, StudentAccount> = globalLedger.__DODO_ACCOUNT_STORE__!;
let TRANSACTION_STORE: Record<string, StudentTransaction[]> = globalLedger.__DODO_TRANSACTION_STORE__!;
let RECEIPT_STORE: Record<string, StudentReceipt[]> = globalLedger.__DODO_RECEIPT_STORE__!;

export function resetStudentLedger() {
  ACCOUNT_STORE = JSON.parse(JSON.stringify(INITIAL_ACCOUNTS));
  TRANSACTION_STORE = {};
  RECEIPT_STORE = {};
  globalLedger.__DODO_ACCOUNT_STORE__ = ACCOUNT_STORE;
  globalLedger.__DODO_TRANSACTION_STORE__ = TRANSACTION_STORE;
  globalLedger.__DODO_RECEIPT_STORE__ = RECEIPT_STORE;
}

export function saveStudentAccount(account: StudentAccount): StudentAccount {
  account.studentReference = account.studentReference || (account as any).accountReference || account.id;
  account.fullName = account.fullName || (account as any).studentName || 'Student';
  account.guardianName = account.guardianName || (account as any).payerName || 'Guardian';
  const summary = calculateFeeSummary(account.netPayableMinor, account.paidMinor, account.discountsMinor, account.totalAssignedFeeMinor);
  account.outstandingMinor = summary.outstandingMinor;
  account.excessMinor = summary.excessMinor;
  account.isOverpaid = summary.isOverpaid;

  ACCOUNT_STORE[account.id] = account;
  if (globalLedger.__DODO_ACCOUNT_STORE__) {
    globalLedger.__DODO_ACCOUNT_STORE__[account.id] = account;
  }
  return account;
}

export function getAllStudentAccounts(): Record<string, StudentAccount> {
  return ACCOUNT_STORE;
}

export function findStudentAccount(query: string): StudentAccount | null {
  const q = (query || '').trim().toLowerCase();
  if (!q) return null;
  const acc = Object.values(ACCOUNT_STORE).find(
    (s) =>
      s.id.toLowerCase() === q ||
      s.studentReference.toLowerCase() === q ||
      (s.enrollmentId && s.enrollmentId.toLowerCase() === q) ||
      s.fullName.toLowerCase() === q,
  );
  if (acc) {
    const summary = calculateFeeSummary(acc.netPayableMinor, acc.paidMinor, acc.discountsMinor, acc.totalAssignedFeeMinor);
    acc.outstandingMinor = summary.outstandingMinor;
    acc.excessMinor = summary.excessMinor;
    acc.isOverpaid = summary.isOverpaid;
    return acc;
  }
  return null;
}

export function getStudentInstallments(studentOrId: StudentAccount | string): StudentInstallment[] {
  const student = typeof studentOrId === 'string' ? findStudentAccount(studentOrId) : studentOrId;
  const netMinor = student ? student.netPayableMinor : 12000000;
  const paidMinor = student ? student.paidMinor : 4000000;

  const inst1Amount = Math.round(netMinor / 3);
  const inst2Amount = Math.round(netMinor / 3);
  const inst3Amount = netMinor - inst1Amount - inst2Amount;

  const inst1Paid = Math.min(paidMinor, inst1Amount);
  const inst2Paid = Math.min(Math.max(0, paidMinor - inst1Amount), inst2Amount);
  const inst3Paid = Math.min(Math.max(0, paidMinor - inst1Amount - inst2Amount), inst3Amount);

  return [
    {
      id: 'inst-1',
      sequence: 1,
      dueDate: '2026-07-10',
      amountMinor: inst1Amount,
      paidAmountMinor: inst1Paid,
      remainingMinor: Math.max(0, inst1Amount - inst1Paid),
      status: inst1Paid >= inst1Amount ? 'paid' : inst1Paid > 0 ? 'part_paid' : 'pending',
    },
    {
      id: 'inst-2',
      sequence: 2,
      dueDate: '2026-10-25',
      amountMinor: inst2Amount,
      paidAmountMinor: inst2Paid,
      remainingMinor: Math.max(0, inst2Amount - inst2Paid),
      status: inst2Paid >= inst2Amount ? 'paid' : inst2Paid > 0 ? 'part_paid' : 'pending',
    },
    {
      id: 'inst-3',
      sequence: 3,
      dueDate: '2027-01-15',
      amountMinor: inst3Amount,
      paidAmountMinor: inst3Paid,
      remainingMinor: Math.max(0, inst3Amount - inst3Paid),
      status: inst3Paid >= inst3Amount ? 'paid' : inst3Paid > 0 ? 'part_paid' : 'pending',
    },
  ];
}

export function getStudentTransactions(studentId: string): StudentTransaction[] {
  return TRANSACTION_STORE[studentId] || [];
}

export function getStudentReceipts(studentId: string): StudentReceipt[] {
  return RECEIPT_STORE[studentId] || [];
}

export function findReceiptByNumber(receiptNumber: string): StudentReceipt | null {
  const rNum = (receiptNumber || '').trim().toLowerCase();
  for (const list of Object.values(RECEIPT_STORE)) {
    const found = list.find((r) => r.receiptNumber.toLowerCase() === rNum);
    if (found) return found;
  }
  return null;
}

export type RecordPaymentParams = {
  studentQuery: string;
  amountMinor: number;
  transactionId?: string;
  receiptNumber?: string;
  paymentMode?: string;
  installmentId?: string;
  outcome?: 'successful' | 'failed' | 'pending';
  allowExcess?: boolean;
  authorizationReason?: string;
};

export type RecordPaymentResult = {
  success: boolean;
  isDuplicate?: boolean;
  message: string;
  account?: StudentAccount;
  transaction?: StudentTransaction;
  receipt?: StudentReceipt;
  outstandingMinor?: number;
  excessMinor?: number;
  isOverpaid?: boolean;
};

export function recordStudentPayment(params: RecordPaymentParams): RecordPaymentResult {
  const student = findStudentAccount(params.studentQuery);
  if (!student) {
    return { success: false, message: 'Student account not found' };
  }

  // Failed or pending attempts do not mutate verified ledger
  if (params.outcome === 'failed') {
    return {
      success: false,
      message: 'Payment simulation failed as requested (insufficient funds simulation).',
      account: student,
      outstandingMinor: student.outstandingMinor,
      excessMinor: student.excessMinor || 0,
      isOverpaid: (student.excessMinor || 0) > 0,
    };
  }
  if (params.outcome && params.outcome !== 'successful') {
    return {
      success: false,
      message: `Payment status is ${params.outcome}; payment not confirmed.`,
      account: student,
      outstandingMinor: student.outstandingMinor,
      excessMinor: student.excessMinor || 0,
      isOverpaid: (student.excessMinor || 0) > 0,
    };
  }

  const txnId =
    params.transactionId?.trim() ||
    `TXN-SANDBOX-${student.studentReference}-${Date.now().toString().slice(-6)}`;

  // Idempotency check: prevent duplicate payments with identical transaction ID
  if (!TRANSACTION_STORE[student.id]) TRANSACTION_STORE[student.id] = [];
  const existingTx = TRANSACTION_STORE[student.id]!.find((t) => t.transactionId === txnId);
  if (existingTx) {
    const existingReceipt = (RECEIPT_STORE[student.id] || []).find((r) => r.transactionId === txnId);
    return {
      success: true,
      isDuplicate: true,
      message: 'Payment already processed and verified (idempotent)',
      account: student,
      transaction: existingTx,
      receipt: existingReceipt,
      outstandingMinor: student.outstandingMinor,
      excessMinor: student.excessMinor || 0,
      isOverpaid: (student.excessMinor || 0) > 0,
    };
  }

  const amountMinor = Number(params.amountMinor || 0);
  if (amountMinor <= 0) {
    return { success: false, message: 'Invalid payment amount' };
  }

  const currentPaid = Number(student.paidMinor || 0);
  const netPayable = Number(student.netPayableMinor || 0);
  const currentOutstanding = Math.max(0, netPayable - currentPaid);
  const existingExcess = Math.max(0, currentPaid - netPayable);

  // 1. Prevent further ordinary payments if student already has an unreconciled excess payment
  if (existingExcess > 0 && !params.allowExcess) {
    return {
      success: false,
      message: `Student account has an unreconciled excess payment of ₹${(existingExcess / 100).toLocaleString('en-IN')}. Further ordinary payments are blocked until reconciled or explicitly authorized.`,
      account: student,
      outstandingMinor: 0,
      excessMinor: existingExcess,
      isOverpaid: true,
    };
  }

  // 2. Prevent accidental overpayments: validate entered amount against actual outstanding balance
  if (amountMinor > currentOutstanding && !params.allowExcess) {
    const potentialExcess = amountMinor - currentOutstanding;
    return {
      success: false,
      message: `Payment amount of ₹${(amountMinor / 100).toLocaleString('en-IN')} exceeds the outstanding balance of ₹${(currentOutstanding / 100).toLocaleString('en-IN')} by ₹${(potentialExcess / 100).toLocaleString('en-IN')}. Overpayments require explicit authorization.`,
      account: student,
      outstandingMinor: currentOutstanding,
      excessMinor: potentialExcess,
      isOverpaid: false,
    };
  }

  // 3. Update verified ledger balances
  const newPaid = currentPaid + amountMinor;
  student.paidMinor = newPaid;
  const summary = calculateFeeSummary(netPayable, newPaid, student.discountsMinor, student.totalAssignedFeeMinor);
  student.outstandingMinor = summary.outstandingMinor;
  student.excessMinor = summary.excessMinor;

  const refStr = student.studentReference || (student as any).accountReference || student.id || 'REF';
  const receiptNumber =
    params.receiptNumber?.trim() ||
    `DPS-REC-2026-${refStr.replace(/[^0-9]/g, '')}-${String(100 + (TRANSACTION_STORE[student.id]?.length || 0) + 1)}`;
  const nowIso = new Date().toISOString();
  const mode = params.paymentMode || 'eNACH Auto-Debit';

  const transaction: StudentTransaction = {
    id: 'pay-' + txnId,
    transactionId: txnId,
    amountMinor,
    recordedAt: nowIso,
    status: 'confirmed',
    receiptNumber,
    mode,
    installmentId: params.installmentId || 'inst-1',
  };
  TRANSACTION_STORE[student.id]!.unshift(transaction);

  if (!RECEIPT_STORE[student.id]) RECEIPT_STORE[student.id] = [];
  const receipt: StudentReceipt = {
    receiptNumber,
    transactionId: txnId,
    amountMinor,
    remainingMinor: student.outstandingMinor,
    issuedAt: nowIso,
    studentName: student.fullName,
    accountReference: student.studentReference,
    paymentMode: mode,
  };
  RECEIPT_STORE[student.id]!.unshift(receipt);

  saveStudentAccount(student);

  return {
    success: true,
    isDuplicate: false,
    message: summary.isOverpaid
      ? `Payment confirmed with excess credit balance of ₹${(summary.excessMinor / 100).toLocaleString('en-IN')}`
      : 'Payment confirmed and verified on ledger',
    account: student,
    transaction,
    receipt,
    outstandingMinor: student.outstandingMinor,
    excessMinor: student.excessMinor,
    isOverpaid: summary.isOverpaid,
  };
}

export type ReconcileExcessParams = {
  studentQuery: string;
  action: 'refund' | 'credit_carry_forward' | 'fee_adjustment';
  amountMinor?: number;
  reason?: string;
};

export type ReconcileExcessResult = {
  success: boolean;
  message: string;
  account?: StudentAccount;
  reconciledAmountMinor?: number;
};

export function reconcileStudentExcess(params: ReconcileExcessParams): ReconcileExcessResult {
  const student = findStudentAccount(params.studentQuery);
  if (!student) {
    return { success: false, message: 'Student account not found' };
  }

  const net = Number(student.netPayableMinor || 0);
  const paid = Number(student.paidMinor || 0);
  const currentExcess = Math.max(0, paid - net);

  if (currentExcess <= 0) {
    return { success: false, message: 'Student account has no excess payment to reconcile' };
  }

  const reconcileAmount = params.amountMinor ? Math.min(params.amountMinor, currentExcess) : currentExcess;
  const nowIso = new Date().toISOString();

  if (params.action === 'refund') {
    const refStr = student.studentReference || (student as any).accountReference || student.id || 'REF';
    const refundTxnId = `REFUND-${refStr}-${Date.now().toString().slice(-6)}`;
    const refundTx: StudentTransaction = {
      id: 'refund-' + refundTxnId,
      transactionId: refundTxnId,
      amountMinor: reconcileAmount,
      recordedAt: nowIso,
      status: 'confirmed',
      receiptNumber: `DPS-REF-${refStr.replace(/[^0-9]/g, '')}-${Date.now().toString().slice(-4)}`,
      mode: 'REFUND',
    };
    if (!TRANSACTION_STORE[student.id]) TRANSACTION_STORE[student.id] = [];
    TRANSACTION_STORE[student.id]!.unshift(refundTx);

    // Verified collections are reduced by the refunded excess
    student.paidMinor = paid - reconcileAmount;
    student.outstandingMinor = Math.max(0, net - student.paidMinor);
    student.excessMinor = Math.max(0, student.paidMinor - net);
    saveStudentAccount(student);

    return {
      success: true,
      message: `Excess payment of ₹${(reconcileAmount / 100).toLocaleString('en-IN')} successfully refunded and reconciled.`,
      account: student,
      reconciledAmountMinor: reconcileAmount,
    };
  }

  if (params.action === 'credit_carry_forward') {
    // Excess is transferred as advance credit towards subsequent terms/year
    student.paidMinor = paid - reconcileAmount;
    student.outstandingMinor = Math.max(0, net - student.paidMinor);
    student.excessMinor = Math.max(0, student.paidMinor - net);
    saveStudentAccount(student);

    return {
      success: true,
      message: `Excess payment of ₹${(reconcileAmount / 100).toLocaleString('en-IN')} carried forward as unapplied credit balance for upcoming academic terms.`,
      account: student,
      reconciledAmountMinor: reconcileAmount,
    };
  }

  if (params.action === 'fee_adjustment') {
    // Net payable is adjusted to absorb verified payments
    student.netPayableMinor = net + reconcileAmount;
    student.outstandingMinor = 0;
    student.excessMinor = 0;
    saveStudentAccount(student);

    return {
      success: true,
      message: `Fee adjustment applied. Net payable updated to ₹${(student.netPayableMinor / 100).toLocaleString('en-IN')}, fully absorbing the excess payment.`,
      account: student,
      reconciledAmountMinor: reconcileAmount,
    };
  }

  return { success: false, message: 'Invalid reconciliation action' };
}
