import fs from 'node:fs';
import path from 'node:path';

export type PayerPortalData = {
  collectionMode: string;
  providerConnected: boolean;
  autopayProviderConnected: boolean;
  payer: {
    id: string;
    displayName: string;
    accountReference: string;
    email?: string;
    phone?: string;
    studentName?: string;
  };
  schedule: {
    id: string;
    status: string;
  };
  summary: {
    net_payable_minor: string | number;
    paid_minor: string | number;
    outstanding_minor: string | number;
  };
  paymentPolicy?: {
    mode: string;
    allowCustomAmount: boolean;
    allowComponentSelection: boolean;
    minAmountMinor?: number;
    componentSelectionBlockedReason?: string;
  };
  installments: Array<{
    id: string;
    sequence: number;
    due_date: string;
    amount_minor: number;
    paid_amount_minor: number;
    remaining_minor: number;
    status: string;
  }>;
  components?: Array<{
    code: string;
    label: string;
    remainingMinor: number;
  }>;
  payments: Array<{
    id: string;
    amount_minor: number;
    recorded_at: string;
    receipt_number?: string;
    status: string;
  }>;
  refunds?: Array<{
    id: string;
    amount_minor: number;
    reason: string;
    created_at: string;
  }>;
  mandates?: Array<{
    id: string;
    status: string;
    rail: string;
    umrn?: string;
    bank_name?: string;
    account_mask?: string;
    created_at?: string;
  }>;
};

function getStorageFilePath(filename: string): string | null {
  try {
    const dataDir = path.resolve(process.cwd(), '.data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, filename);
  } catch {
    return null;
  }
}

function loadJsonFromDisk<T>(filename: string): T | null {
  try {
    const filePath = getStorageFilePath(filename);
    if (filePath && fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    }
  } catch {}
  return null;
}

function saveJsonToDisk<T>(filename: string, data: T): void {
  try {
    const filePath = getStorageFilePath(filename);
    if (filePath) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }
  } catch {}
}

export const STUDENT_PROFILES: Record<
  string,
  {
    studentName: string;
    displayName: string;
    accountReference: string;
    email: string;
    phone: string;
    netPayableMinor: number;
    paidMinor: number;
    outstandingMinor: number;
    groupName: string;
  }
> = {
  'DPS-2026-089': {
    studentName: 'V Rakesh',
    displayName: 'Rajesh Sharma',
    accountReference: 'DPS-2026-089',
    email: 'rajesh.sharma@example.com',
    phone: '+91 98765 43210',
    netPayableMinor: 12000000,
    paidMinor: 4000000,
    outstandingMinor: 8000000,
    groupName: 'Grade 11-A',
  },
  'DPS-2026-104': {
    studentName: 'Diya Patel',
    displayName: 'Suresh Patel',
    accountReference: 'DPS-2026-104',
    email: 'suresh.patel@example.com',
    phone: '+91 98765 43211',
    netPayableMinor: 11000000,
    paidMinor: 7500000,
    outstandingMinor: 3500000,
    groupName: 'Grade 8-B',
  },
  'DPS-2026-141': {
    studentName: 'Rohan Mehta',
    displayName: 'Vikram Mehta',
    accountReference: 'DPS-2026-141',
    email: 'vikram.mehta@example.com',
    phone: '+91 98765 43212',
    netPayableMinor: 14500000,
    paidMinor: 5000000,
    outstandingMinor: 9500000,
    groupName: 'Grade 12-Science',
  },
  'DPS-2026-055': {
    studentName: 'Kavya Reddy',
    displayName: 'Venkat Reddy',
    accountReference: 'DPS-2026-055',
    email: 'venkat.reddy@example.com',
    phone: '+91 98765 43213',
    netPayableMinor: 14000000,
    paidMinor: 7000000,
    outstandingMinor: 7000000,
    groupName: 'Grade 5-B',
  },
  'DPS-2026-062': {
    studentName: 'Ananya Gupta',
    displayName: 'Pooja Gupta',
    accountReference: 'DPS-2026-062',
    email: 'pooja.gupta@example.com',
    phone: '+91 98765 43214',
    netPayableMinor: 12500000,
    paidMinor: 6000000,
    outstandingMinor: 6500000,
    groupName: 'Grade 9-A',
  },
  'DPS-2026-077': {
    studentName: 'Vivaan Malhotra',
    displayName: 'Karan Malhotra',
    accountReference: 'DPS-2026-077',
    email: 'karan.malhotra@example.com',
    phone: '+91 98765 43215',
    netPayableMinor: 16000000,
    paidMinor: 8000000,
    outstandingMinor: 8000000,
    groupName: 'Grade 7-A',
  },
  'DPS-2026-092': {
    studentName: 'Ishan Verma',
    displayName: 'Sunita Verma',
    accountReference: 'DPS-2026-092',
    email: 'sunita.verma@example.com',
    phone: '+91 98765 43216',
    netPayableMinor: 13500000,
    paidMinor: 3500000,
    outstandingMinor: 10000000,
    groupName: 'Grade 11-Commerce',
  },
  'DPS-2026-118': {
    studentName: 'Tara Nair',
    displayName: 'Madhavan Nair',
    accountReference: 'DPS-2026-118',
    email: 'madhavan.nair@example.com',
    phone: '+91 98765 43217',
    netPayableMinor: 12800000,
    paidMinor: 6400000,
    outstandingMinor: 6400000,
    groupName: 'Grade 6-C',
  },
  'DPS-2026-133': {
    studentName: 'Aditya Joshi',
    displayName: 'Sanjay Joshi',
    accountReference: 'DPS-2026-133',
    email: 'sanjay.joshi@example.com',
    phone: '+91 98765 43218',
    netPayableMinor: 11200000,
    paidMinor: 5600000,
    outstandingMinor: 5600000,
    groupName: 'Grade 10-B',
  },
  'DPS-2026-150': {
    studentName: 'Meera Singhania',
    displayName: 'Alok Singhania',
    accountReference: 'DPS-2026-150',
    email: 'alok.singhania@example.com',
    phone: '+91 98765 43219',
    netPayableMinor: 15000000,
    paidMinor: 7500000,
    outstandingMinor: 7500000,
    groupName: 'Grade 12-Commerce',
  },
  'DPS-2026-160': {
    studentName: 'Saumya',
    displayName: 'Sanjay Kumar',
    accountReference: 'DPS-2026-160',
    email: 'sanjay.kumar@example.com',
    phone: '+91 98765 43220',
    netPayableMinor: 12000000,
    paidMinor: 0,
    outstandingMinor: 12000000,
    groupName: 'Grade 11-A',
  },
};

export type SecurePayerTokenRecord = {
  token: string;
  studentId: string;
  studentName: string;
  guardianName: string;
  accountReference: string;
  email?: string;
  phone?: string;
  netPayableMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  expiresAt: number;
  paymentMode?: string;
  allowCustomAmount?: boolean;
  allowComponentSelection?: boolean;
  minAmountMinor?: number;
};

// Pre-seeded secure tokens so existing active session links resolve immediately to the correct student & guardian
const PRESEEDED_SECURE_TOKENS: Record<string, SecurePayerTokenRecord> = {
  'sec-tok-caa105a16184c1253b6f3f1b3537dc6e': {
    token: 'sec-tok-caa105a16184c1253b6f3f1b3537dc6e',
    studentId: 'stu-12',
    studentName: 'Saumya',
    guardianName: 'Sanjay Kumar',
    accountReference: 'DPS-2026-160',
    email: 'sanjay.kumar@example.com',
    phone: '+91 98765 43220',
    netPayableMinor: 12000000,
    paidMinor: 0,
    outstandingMinor: 12000000,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    paymentMode: 'flexible',
    allowCustomAmount: true,
    allowComponentSelection: true,
    minAmountMinor: 100000,
  },
  'sec-tok-f95e4c63ddfd0aa5fefbbde9eb4399fc': {
    token: 'sec-tok-f95e4c63ddfd0aa5fefbbde9eb4399fc',
    studentId: 'stu-1',
    studentName: 'V Rakesh',
    guardianName: 'Rajesh Sharma',
    accountReference: 'DPS-2026-089',
    email: 'rajesh.sharma@example.com',
    phone: '+91 98765 43210',
    netPayableMinor: 12000000,
    paidMinor: 4000000,
    outstandingMinor: 8000000,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    paymentMode: 'flexible',
    allowCustomAmount: true,
    allowComponentSelection: true,
    minAmountMinor: 100000,
  },
};

const globalPayerStore = globalThis as unknown as {
  __DODO_GLOBAL_PAYER_STORE__?: Record<string, PayerPortalData>;
  __DODO_SECURE_PAYER_TOKENS__?: Record<string, SecurePayerTokenRecord>;
};

function initPayerStore(): Record<string, PayerPortalData> {
  if (
    globalPayerStore.__DODO_GLOBAL_PAYER_STORE__ &&
    typeof globalPayerStore.__DODO_GLOBAL_PAYER_STORE__ === 'object'
  ) {
    return globalPayerStore.__DODO_GLOBAL_PAYER_STORE__;
  }
  const fromDisk = loadJsonFromDisk<Record<string, PayerPortalData>>('payer-store.json');
  const store = fromDisk || {};
  globalPayerStore.__DODO_GLOBAL_PAYER_STORE__ = store;
  return store;
}

function initTokenRegistry(): Record<string, SecurePayerTokenRecord> {
  if (
    globalPayerStore.__DODO_SECURE_PAYER_TOKENS__ &&
    typeof globalPayerStore.__DODO_SECURE_PAYER_TOKENS__ === 'object'
  ) {
    return globalPayerStore.__DODO_SECURE_PAYER_TOKENS__;
  }
  const fromDisk = loadJsonFromDisk<Record<string, SecurePayerTokenRecord>>('secure-tokens.json');
  const store: Record<string, SecurePayerTokenRecord> = fromDisk || {};

  for (const [tok, rec] of Object.entries(PRESEEDED_SECURE_TOKENS)) {
    if (!store[tok]) {
      store[tok] = rec;
    }
  }

  globalPayerStore.__DODO_SECURE_PAYER_TOKENS__ = store;
  saveJsonToDisk('secure-tokens.json', store);
  return store;
}

export function registerSecurePayerToken(token: string, record: SecurePayerTokenRecord): void {
  const key = (token || '').trim();
  if (!key) return;
  const store = initTokenRegistry();
  store[key] = record;
  saveJsonToDisk('secure-tokens.json', store);

  // If there was previously cached portal data for this key, invalidate it so fresh data is computed
  const pStore = initPayerStore();
  if (pStore[key]) {
    delete pStore[key];
    saveJsonToDisk('payer-store.json', pStore);
  }
}

export function getRegisteredSecureToken(token: string): SecurePayerTokenRecord | null {
  const key = (token || '').trim();
  if (!key) return null;
  const store = initTokenRegistry();
  let rec = store[key];
  if (!rec) {
    const fromDisk = loadJsonFromDisk<Record<string, SecurePayerTokenRecord>>('secure-tokens.json');
    if (fromDisk && fromDisk[key]) {
      store[key] = fromDisk[key]!;
      rec = store[key];
    }
  }
  if (!rec) return null;
  if (rec.expiresAt && Date.now() > rec.expiresAt) {
    return null; // Expired
  }
  return rec;
}

function createPayerDataFromProfile(
  profile: {
    studentName: string;
    displayName: string;
    accountReference: string;
    email: string;
    phone: string;
    netPayableMinor: number;
    paidMinor: number;
    outstandingMinor: number;
    groupName?: string;
  },
  token: string,
  policy?: {
    mode?: string;
    allowCustomAmount?: boolean;
    allowComponentSelection?: boolean;
    minAmountMinor?: number;
  },
): PayerPortalData {
  const netMinor = profile.netPayableMinor;
  const paidMinor = profile.paidMinor;
  const outMinor = Math.max(0, netMinor - paidMinor);

  const inst1Amount = Math.round(netMinor / 3);
  const inst2Amount = Math.round(netMinor / 3);
  const inst3Amount = netMinor - inst1Amount - inst2Amount;

  const inst1Paid = Math.min(paidMinor, inst1Amount);
  const inst2Paid = Math.min(Math.max(0, paidMinor - inst1Amount), inst2Amount);
  const inst3Paid = Math.min(Math.max(0, paidMinor - inst1Amount - inst2Amount), inst3Amount);

  return {
    collectionMode: 'sandbox',
    providerConnected: true,
    autopayProviderConnected: true,
    payer: {
      id: 'pyr-' + profile.accountReference.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      displayName: profile.displayName,
      studentName: profile.studentName,
      accountReference: profile.accountReference,
      email: profile.email,
      phone: profile.phone,
    },
    schedule: {
      id: 'sch-' + profile.accountReference.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      status: 'active',
    },
    summary: {
      net_payable_minor: String(netMinor),
      paid_minor: String(paidMinor),
      outstanding_minor: String(outMinor),
    },
    paymentPolicy: {
      mode: policy?.mode || 'flexible',
      allowCustomAmount: policy?.allowCustomAmount ?? true,
      allowComponentSelection: policy?.allowComponentSelection ?? true,
      minAmountMinor: policy?.minAmountMinor || 100000,
    },
    installments: [
      {
        id: 'inst-1',
        sequence: 1,
        due_date: '2026-07-10',
        amount_minor: inst1Amount,
        paid_amount_minor: inst1Paid,
        remaining_minor: Math.max(0, inst1Amount - inst1Paid),
        status: inst1Paid >= inst1Amount ? 'paid' : inst1Paid > 0 ? 'part_paid' : 'pending',
      },
      {
        id: 'inst-2',
        sequence: 2,
        due_date: '2026-10-25',
        amount_minor: inst2Amount,
        paid_amount_minor: inst2Paid,
        remaining_minor: Math.max(0, inst2Amount - inst2Paid),
        status: inst2Paid >= inst2Amount ? 'paid' : inst2Paid > 0 ? 'part_paid' : 'pending',
      },
      {
        id: 'inst-3',
        sequence: 3,
        due_date: '2027-01-15',
        amount_minor: inst3Amount,
        paid_amount_minor: inst3Paid,
        remaining_minor: Math.max(0, inst3Amount - inst3Paid),
        status: inst3Paid >= inst3Amount ? 'paid' : inst3Paid > 0 ? 'part_paid' : 'pending',
      },
    ],
    components: [
      { code: 'TUIT', label: 'Tuition fee', remainingMinor: Math.round(outMinor * 0.65) },
      { code: 'DEV', label: 'Development fee', remainingMinor: Math.round(outMinor * 0.25) },
      {
        code: 'ACT',
        label: 'Activity & lab fee',
        remainingMinor: outMinor - Math.round(outMinor * 0.65) - Math.round(outMinor * 0.25),
      },
    ],
    payments:
      paidMinor > 0
        ? [
            {
              id: 'pay-1',
              amount_minor: paidMinor,
              recorded_at: '2026-07-08T10:30:00Z',
              receipt_number: `${profile.accountReference}-REC-001`,
              status: 'settled',
            },
          ]
        : [],
    refunds: [],
    mandates: [
      {
        id: 'mndt-1',
        status: 'active',
        rail: 'enach',
        umrn: 'UMRN-NACH-' + profile.accountReference.replace(/[^a-zA-Z0-9]/g, ''),
        bank_name: 'HDFC Bank',
        account_mask: '•••• 1244',
        created_at: '2026-10-23T07:48:28Z',
      },
    ],
  };
}

export function resetDemoPayerData(token?: string) {
  const pStore = initPayerStore();
  if (token) {
    delete pStore[token];
  } else {
    for (const k of Object.keys(pStore)) {
      delete pStore[k];
    }
  }
  saveJsonToDisk('payer-store.json', pStore);
}

export function getDemoPayerData(token: string): PayerPortalData | null {
  const key = (token || '').trim();
  if (!key) return null;

  const pStore = initPayerStore();

  // 1. Return in-memory active state if already loaded for this token
  if (pStore[key]) {
    return pStore[key]!;
  }

  // 2. Check dynamically generated secure tokens
  const registered = getRegisteredSecureToken(key);
  if (registered) {
    const data = createPayerDataFromProfile(
      {
        studentName: registered.studentName,
        displayName: registered.guardianName,
        accountReference: registered.accountReference,
        email: registered.email || 'guardian@example.com',
        phone: registered.phone || '+91 98765 43210',
        netPayableMinor: registered.netPayableMinor,
        paidMinor: registered.paidMinor,
        outstandingMinor: registered.outstandingMinor,
        groupName: 'Grade 11-A',
      },
      key,
      {
        mode: registered.paymentMode || 'flexible',
        allowCustomAmount: registered.allowCustomAmount ?? true,
        allowComponentSelection: registered.allowComponentSelection ?? true,
        minAmountMinor: registered.minAmountMinor || 100000,
      },
    );
    pStore[key] = data;
    saveJsonToDisk('payer-store.json', pStore);
    return data;
  }

  // 3. Known explicit demo tokens (preserve backwards compatibility for original fixtures)
  if (key === 'demo-access-token-12345' || key === 'access-DPS-2026-089') {
    const profile = STUDENT_PROFILES['DPS-2026-089'];
    if (profile) {
      const data = createPayerDataFromProfile(profile, key);
      pStore[key] = data;
      saveJsonToDisk('payer-store.json', pStore);
      return data;
    }
  }

  // 4. Access tokens with explicit reference e.g. access-DPS-2026-104, access-DPS-2026-160
  if (key.startsWith('access-') || key.startsWith('token-')) {
    const cleanRef = key.replace(/^(access-|token-)/i, '').trim().toUpperCase();
    const profile = Object.values(STUDENT_PROFILES).find(
      (p) => p.accountReference.toUpperCase() === cleanRef,
    );
    if (profile) {
      const data = createPayerDataFromProfile(profile, key);
      pStore[key] = data;
      saveJsonToDisk('payer-store.json', pStore);
      return data;
    }

    const globalRoster = (globalThis as any).__DODO_STUDENT_ROSTER__ as Array<any> | undefined;
    if (Array.isArray(globalRoster)) {
      const rosterStudent = globalRoster.find(
        (s) =>
          s.student_reference?.toUpperCase() === cleanRef ||
          s.id?.toUpperCase() === cleanRef ||
          s.enrollment_id?.toUpperCase() === cleanRef,
      );
      if (rosterStudent) {
        const netMinor = Number(rosterStudent.net_payable_minor || 12000000);
        const paidMinor = Number(rosterStudent.paid_minor || 0);
        const data = createPayerDataFromProfile(
          {
            studentName: rosterStudent.full_name,
            displayName: rosterStudent.guardian_name || 'Assigned Guardian',
            accountReference: rosterStudent.student_reference,
            email: rosterStudent.guardian_email || 'guardian@example.com',
            phone: rosterStudent.guardian_phone || '+91 98765 43210',
            netPayableMinor: netMinor,
            paidMinor,
            outstandingMinor: Math.max(0, netMinor - paidMinor),
            groupName: rosterStudent.group_name || 'Grade 11-A',
          },
          key,
        );
        pStore[key] = data;
        saveJsonToDisk('payer-store.json', pStore);
        return data;
      }
    }
  }

  // 5. Invalid, expired or unknown tokens must NOT fall back to another student's account
  return null;
}

export function applyPayerPayment(
  token: string,
  installmentSequenceOrId: number | string,
  amountMinor: number,
  feeHeadAllocations?: Record<string, number>,
  idempotencyKey?: string,
  receiptNumber?: string,
): PayerPortalData {
  const pStore = initPayerStore();
  const data = getDemoPayerData(token);
  if (!data || !amountMinor || amountMinor <= 0) return data as any;

  // Check idempotency if key provided
  if (
    idempotencyKey &&
    data.payments.some(
      (p) => p.id === idempotencyKey || (p as any).provider_reference === idempotencyKey,
    )
  ) {
    return data;
  }

  // 1. Find matching installment or oldest pending installment
  let inst = data.installments.find(
    (i) => i.id === String(installmentSequenceOrId) || String(i.sequence) === String(installmentSequenceOrId),
  );
  if (!inst) {
    inst = data.installments.find((i) => i.status !== 'paid' && Number(i.remaining_minor) > 0);
  }
  if (!inst) {
    inst = data.installments[data.installments.length - 1];
  }

  // 2. Adjust target installment
  if (inst) {
    const applyToInst = Math.min(amountMinor, inst.remaining_minor);
    inst.paid_amount_minor += applyToInst;
    inst.remaining_minor = Math.max(0, inst.amount_minor - inst.paid_amount_minor);
    if (inst.remaining_minor === 0) {
      inst.status = 'paid';
    } else if (inst.paid_amount_minor > 0) {
      inst.status = 'part_paid';
    }

    const unallocated = amountMinor - applyToInst;
    if (unallocated > 0) {
      for (const nextInst of data.installments) {
        if (nextInst.id === inst.id || nextInst.status === 'paid' || nextInst.remaining_minor <= 0) continue;
        const extra = Math.min(unallocated, nextInst.remaining_minor);
        nextInst.paid_amount_minor += extra;
        nextInst.remaining_minor = Math.max(0, nextInst.amount_minor - nextInst.paid_amount_minor);
        if (nextInst.remaining_minor === 0) nextInst.status = 'paid';
        else if (nextInst.paid_amount_minor > 0) nextInst.status = 'part_paid';
        break;
      }
    }
  }

  // 3. Adjust summary totals
  const currentPaid = Number(data.summary.paid_minor) || 0;
  const currentNet = Number(data.summary.net_payable_minor) || 12000000;
  const newPaid = currentPaid + amountMinor;
  const newOutstanding = Math.max(0, currentNet - newPaid);
  const newExcess = Math.max(0, newPaid - currentNet);
  data.summary.paid_minor = String(newPaid);
  data.summary.outstanding_minor = String(newOutstanding);
  (data.summary as any).excess_minor = String(newExcess);
  (data.summary as any).is_overpaid = newExcess > 0;

  // 4. Adjust fee head components if provided
  if (feeHeadAllocations && data.components) {
    for (const comp of data.components) {
      const allocated = feeHeadAllocations[comp.code];
      if (allocated && allocated > 0) {
        comp.remainingMinor = Math.max(0, comp.remainingMinor - allocated);
      }
    }
  }

  // 5. Add payment record to history
  const rcpNumber = receiptNumber || `DPS-REC-2026-${Math.floor(10000 + Math.random() * 90000)}`;
  data.payments.unshift({
    id: idempotencyKey || 'pay-' + Math.floor(1000 + Math.random() * 9000),
    amount_minor: amountMinor,
    recorded_at: new Date().toISOString(),
    receipt_number: rcpNumber,
    status: 'settled',
    ...({ provider_reference: idempotencyKey } as any),
  });

  pStore[token] = data;
  saveJsonToDisk('payer-store.json', pStore);

  return data;
}
