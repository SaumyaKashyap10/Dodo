import fs from 'node:fs';
import path from 'node:path';
import {
  findStudentAccount,
  saveStudentAccount,
  type StudentAccount,
} from './student-ledger';
import { STUDENT_PROFILES } from './payer-store';

export type StudentRosterItem = {
  id: string;
  enrollment_id?: string;
  full_name: string;
  student_reference: string;
  status: string;
  institute: string;
  group_name?: string;
  course?: string;
  grade?: string;
  academic_year?: string;
  campus?: string;
  email?: string;
  phone?: string;
  guardian_name?: string;
  guardian_email?: string;
  guardian_phone?: string;
  enach_status?: string;
  net_payable_minor: string;
  paid_minor: string;
  outstanding_minor: string;
  excess_minor?: string;
  discounts_minor?: string;
  total_assigned_fee_minor?: string;
  is_overpaid?: boolean;
};

export const BASELINE_STUDENTS: StudentRosterItem[] = [
  {
    id: 'stu-1',
    full_name: 'V Rakesh',
    student_reference: 'DPS-2026-089',
    status: 'enrolled',
    institute: 'Delhi Public School, R.K. Puram',
    group_name: 'Grade 11-A',
    course: 'Senior Secondary Science',
    grade: '11',
    academic_year: '2026-27',
    campus: 'Delhi Main Campus',
    email: 'rakesh.student@example.com',
    phone: '+91 98765 00000',
    guardian_name: 'Rajesh Sharma',
    guardian_email: 'rajesh.sharma@example.com',
    guardian_phone: '+91 98765 43210',
    enach_status: 'active',
    net_payable_minor: '12000000',
    paid_minor: '4000000',
    outstanding_minor: '8000000',
  },
  {
    id: 'stu-2',
    full_name: 'Diya Patel',
    student_reference: 'DPS-2026-104',
    status: 'enrolled',
    institute: 'Delhi Public School (Demo)',
    group_name: 'Grade 8-B',
    course: 'CBSE Middle School',
    grade: '8',
    academic_year: '2026-27',
    campus: 'Delhi Main Campus',
    email: 'diya.student@example.com',
    phone: '+91 98765 00002',
    guardian_name: 'Suresh Patel',
    guardian_email: 'suresh.patel@example.com',
    guardian_phone: '+91 98765 43211',
    enach_status: 'active',
    net_payable_minor: '11000000',
    paid_minor: '7500000',
    outstanding_minor: '3500000',
  },
  {
    id: 'stu-3',
    full_name: 'Rohan Mehta',
    student_reference: 'DPS-2026-141',
    status: 'enrolled',
    institute: 'Delhi Public School (Demo)',
    group_name: 'Grade 12-Science',
    course: 'CBSE Senior Secondary',
    grade: '12',
    academic_year: '2026-27',
    campus: 'Delhi Main Campus',
    email: 'rohan.student@example.com',
    phone: '+91 98765 00003',
    guardian_name: 'Vikram Mehta',
    guardian_email: 'vikram.mehta@example.com',
    guardian_phone: '+91 98765 43212',
    enach_status: 'pending',
    net_payable_minor: '14500000',
    paid_minor: '5000000',
    outstanding_minor: '9500000',
  },
  {
    id: 'stu-4',
    full_name: 'Kavya Reddy',
    student_reference: 'DPS-2026-055',
    status: 'enrolled',
    institute: 'Delhi Public School (Demo)',
    group_name: 'Grade 5-B',
    course: 'Primary Foundation',
    grade: '5',
    academic_year: '2026-27',
    campus: 'Delhi South Campus',
    email: 'kavya.student@example.com',
    phone: '+91 98765 00004',
    guardian_name: 'Venkat Reddy',
    guardian_email: 'venkat.reddy@example.com',
    guardian_phone: '+91 98765 43213',
    enach_status: 'active',
    net_payable_minor: '14000000',
    paid_minor: '7000000',
    outstanding_minor: '7000000',
  },
  {
    id: 'stu-5',
    full_name: 'Ananya Gupta',
    student_reference: 'DPS-2026-062',
    status: 'enrolled',
    institute: 'Delhi Public School (Demo)',
    group_name: 'Grade 9-A',
    course: 'CBSE Secondary',
    grade: '9',
    academic_year: '2026-27',
    campus: 'Delhi Main Campus',
    email: 'ananya.student@example.com',
    phone: '+91 98765 00005',
    guardian_name: 'Pooja Gupta',
    guardian_email: 'pooja.gupta@example.com',
    guardian_phone: '+91 98765 43214',
    enach_status: 'active',
    net_payable_minor: '12500000',
    paid_minor: '6000000',
    outstanding_minor: '6500000',
  },
  {
    id: 'stu-6',
    full_name: 'Vivaan Malhotra',
    student_reference: 'DPS-2026-077',
    status: 'enrolled',
    institute: 'Delhi Public School (Demo)',
    group_name: 'Grade 7-A',
    course: 'Middle School',
    grade: '7',
    academic_year: '2026-27',
    campus: 'Delhi Main Campus',
    email: 'vivaan.student@example.com',
    phone: '+91 98765 00006',
    guardian_name: 'Karan Malhotra',
    guardian_email: 'karan.malhotra@example.com',
    guardian_phone: '+91 98765 43215',
    enach_status: 'active',
    net_payable_minor: '16000000',
    paid_minor: '8000000',
    outstanding_minor: '8000000',
  },
  {
    id: 'stu-7',
    full_name: 'Ishan Verma',
    student_reference: 'DPS-2026-092',
    status: 'enrolled',
    institute: 'Delhi Public School (Demo)',
    group_name: 'Grade 11-Commerce',
    course: 'CBSE Senior Secondary',
    grade: '11',
    academic_year: '2026-27',
    campus: 'Delhi South Campus',
    email: 'ishan.student@example.com',
    phone: '+91 98765 00007',
    guardian_name: 'Sunita Verma',
    guardian_email: 'sunita.verma@example.com',
    guardian_phone: '+91 98765 43216',
    enach_status: 'pending',
    net_payable_minor: '13500000',
    paid_minor: '3500000',
    outstanding_minor: '10000000',
  },
  {
    id: 'stu-8',
    full_name: 'Tara Nair',
    student_reference: 'DPS-2026-118',
    status: 'enrolled',
    institute: 'Delhi Public School (Demo)',
    group_name: 'Grade 6-C',
    course: 'CBSE Middle School',
    grade: '6',
    academic_year: '2026-27',
    campus: 'Delhi Main Campus',
    email: 'tara.student@example.com',
    phone: '+91 98765 00008',
    guardian_name: 'Madhavan Nair',
    guardian_email: 'madhavan.nair@example.com',
    guardian_phone: '+91 98765 43217',
    enach_status: 'active',
    net_payable_minor: '12800000',
    paid_minor: '6400000',
    outstanding_minor: '6400000',
  },
  {
    id: 'stu-9',
    full_name: 'Aditya Joshi',
    student_reference: 'DPS-2026-133',
    status: 'enrolled',
    institute: 'Delhi Public School (Demo)',
    group_name: 'Grade 10-B',
    course: 'CBSE Secondary',
    grade: '10',
    academic_year: '2026-27',
    campus: 'Delhi South Campus',
    email: 'aditya.student@example.com',
    phone: '+91 98765 00009',
    guardian_name: 'Sanjay Joshi',
    guardian_email: 'sanjay.joshi@example.com',
    guardian_phone: '+91 98765 43218',
    enach_status: 'failed',
    net_payable_minor: '11200000',
    paid_minor: '2800000',
    outstanding_minor: '8400000',
  },
  {
    id: 'stu-10',
    full_name: 'Meera Singhania',
    student_reference: 'DPS-2026-150',
    status: 'enrolled',
    institute: 'Delhi Public School (Demo)',
    group_name: 'Grade 12-Arts',
    course: 'CBSE Senior Secondary',
    grade: '12',
    academic_year: '2026-27',
    campus: 'Delhi Main Campus',
    email: 'meera.student@example.com',
    phone: '+91 98765 00010',
    guardian_name: 'Alok Singhania',
    guardian_email: 'alok.singhania@example.com',
    guardian_phone: '+91 98765 43219',
    enach_status: 'cancelled',
    net_payable_minor: '15000000',
    paid_minor: '4500000',
    outstanding_minor: '10500000',
  },
  {
    id: 'stu-12',
    enrollment_id: 'stu001',
    full_name: 'Saumya',
    student_reference: 'DPS-2026-160',
    status: 'enrolled',
    institute: 'Delhi Public School (Demo)',
    group_name: 'Grade 11-A',
    course: 'CBSE Senior Secondary',
    grade: '11',
    academic_year: '2026-2027',
    campus: 'Delhi Main Campus',
    email: 'saumya.student@example.com',
    phone: '+91 98765 00012',
    guardian_name: 'Sanjay Kumar',
    guardian_email: 'sanjay.kumar@example.com',
    guardian_phone: '+91 98765 43220',
    enach_status: 'active',
    net_payable_minor: '12000000',
    paid_minor: '0',
    outstanding_minor: '12000000',
  },
];

// Persistent storage file in .data directory
function getStorageFilePath(): string | null {
  try {
    const dataDir = path.resolve(process.cwd(), '.data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, 'student-roster.json');
  } catch {
    return null;
  }
}

function loadFromDisk(): StudentRosterItem[] | null {
  try {
    const filePath = getStorageFilePath();
    if (filePath && fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return null;
}

function saveToDisk(roster: StudentRosterItem[]): void {
  try {
    const filePath = getStorageFilePath();
    if (filePath) {
      fs.writeFileSync(filePath, JSON.stringify(roster, null, 2), 'utf-8');
    }
  } catch {}
}

const globalStore = globalThis as unknown as {
  __DODO_STUDENT_ROSTER__?: StudentRosterItem[];
};

function initRoster(): StudentRosterItem[] {
  if (globalStore.__DODO_STUDENT_ROSTER__ && Array.isArray(globalStore.__DODO_STUDENT_ROSTER__)) {
    return globalStore.__DODO_STUDENT_ROSTER__;
  }
  const fromDisk = loadFromDisk();
  if (fromDisk && Array.isArray(fromDisk) && fromDisk.length > 0) {
    // Ensure Saumya is included if disk had an older snapshot
    const hasSaumya = fromDisk.some(
      (s) =>
        s.id === 'stu-12' ||
        s.student_reference === 'DPS-2026-160' ||
        s.full_name.toLowerCase() === 'saumya',
    );
    if (!hasSaumya) {
      const saumya = BASELINE_STUDENTS.find((s) => s.id === 'stu-12');
      if (saumya) fromDisk.push(saumya);
    }
    globalStore.__DODO_STUDENT_ROSTER__ = fromDisk;
    return fromDisk;
  }
  const initial = JSON.parse(JSON.stringify(BASELINE_STUDENTS));
  globalStore.__DODO_STUDENT_ROSTER__ = initial;
  saveToDisk(initial);
  return initial;
}

/**
 * Sync ledger balances into roster item
 */
export function syncBalances(item: StudentRosterItem): StudentRosterItem {
  const account = findStudentAccount(item.id) || findStudentAccount(item.student_reference);
  if (account) {
    const net = Number(account.netPayableMinor || 0);
    const paid = Number(account.paidMinor || 0);
    const out = Math.max(0, net - paid);
    const excess = Math.max(0, paid - net);
    return {
      ...item,
      net_payable_minor: String(net),
      paid_minor: String(paid),
      outstanding_minor: String(out),
      excess_minor: String(excess),
      is_overpaid: excess > 0,
      enach_status: account.enachStatus || item.enach_status || 'active',
      guardian_name: account.guardianName || item.guardian_name,
      guardian_email: account.guardianEmail || item.guardian_email,
      guardian_phone: account.guardianPhone || item.guardian_phone,
    };
  }
  const net = Number(item.net_payable_minor || 0);
  const paid = Number(item.paid_minor || 0);
  const out = Math.max(0, net - paid);
  const excess = Math.max(0, paid - net);
  return {
    ...item,
    outstanding_minor: String(out),
    excess_minor: String(excess),
    is_overpaid: excess > 0,
  };
}

/**
 * Returns the authoritative list of all registered students, dynamically synced with fee ledger balances.
 */
export function getStudentRoster(): StudentRosterItem[] {
  const roster = initRoster();
  return roster.map(syncBalances);
}

/**
 * Find a student by ID, student reference, enrollment ID, or name
 */
export function findRosterStudent(query: string): StudentRosterItem | null {
  if (!query) return null;
  const q = query.trim().toLowerCase();
  const roster = getStudentRoster();
  const found = roster.find(
    (s) =>
      s.id.toLowerCase() === q ||
      s.student_reference.toLowerCase() === q ||
      (s.enrollment_id && s.enrollment_id.toLowerCase() === q) ||
      s.full_name.toLowerCase() === q,
  );
  return found || null;
}

export type RecoverOrCreateResult = {
  student: StudentRosterItem;
  recovered: boolean;
  created: boolean;
};

/**
 * Recovers an existing student record (such as Saumya) if already present in storage,
 * preserving her stable ID, enrollment number, fee ledger, and guardian link.
 * Otherwise creates and persists a new student record without duplicate collisions.
 */
export function recoverOrCreateStudent(payload: Record<string, any>): RecoverOrCreateResult {
  const roster = initRoster();

  const refInput = String(
    payload.studentReference ||
      payload.student_reference ||
      payload.enrollmentId ||
      payload.enrollment_id ||
      '',
  ).trim();
  const nameInput = String(payload.fullName || payload.full_name || '').trim();
  const idInput = String(payload.id || '').trim();

  // 1. Check if matching student already exists in storage
  let matchByRef: StudentRosterItem | undefined;
  if (idInput) {
    matchByRef = roster.find((s) => s.id.toLowerCase() === idInput.toLowerCase());
  }
  if (!matchByRef && refInput) {
    matchByRef = roster.find(
      (s) =>
        s.student_reference.toLowerCase() === refInput.toLowerCase() ||
        (s.enrollment_id && s.enrollment_id.toLowerCase() === refInput.toLowerCase()),
    );
  }

  // Prevent accidental reference collisions with another student
  if (matchByRef && nameInput && matchByRef.full_name.toLowerCase() !== nameInput.toLowerCase()) {
    throw new Error(
      `A student with enrollment reference '${refInput || idInput}' already exists (${matchByRef.full_name}).`,
    );
  }

  let existingIndex = -1;
  if (matchByRef) {
    existingIndex = roster.indexOf(matchByRef);
  } else if (nameInput) {
    existingIndex = roster.findIndex((s) => s.full_name.toLowerCase() === nameInput.toLowerCase());
  }

  if (existingIndex !== -1) {
    const existing = roster[existingIndex]!;
    // Recover existing student record without overwriting financial or ledger history
    const recovered: StudentRosterItem = {
      ...existing,
      status: payload.status || 'active', // Ensure recovered student is marked active
      group_name: payload.groupName || payload.group_name || existing.group_name,
      course: payload.course || existing.course,
      grade: payload.grade || existing.grade,
      academic_year: payload.academicYear || payload.academic_year || existing.academic_year,
      campus: payload.campus || existing.campus,
      email: payload.email || existing.email,
      phone: payload.phone || existing.phone,
      guardian_name: payload.guardianName || payload.guardian_name || existing.guardian_name,
      guardian_email: payload.guardianEmail || payload.guardian_email || existing.guardian_email,
      guardian_phone: payload.guardianPhone || payload.guardian_phone || existing.guardian_phone,
    };

    // Keep existing student in the roster, ensuring they are active
    roster[existingIndex] = recovered;
    globalStore.__DODO_STUDENT_ROSTER__ = roster;
    saveToDisk(roster);

    // Ensure corresponding account exists in student-ledger
    const existingAccount = findStudentAccount(recovered.id) || findStudentAccount(recovered.student_reference);
    if (!existingAccount) {
      const newAcc: StudentAccount = {
        id: recovered.id,
        enrollmentId: recovered.enrollment_id || recovered.student_reference,
        studentReference: recovered.student_reference,
        fullName: recovered.full_name,
        guardianName: recovered.guardian_name || 'Guardian',
        guardianEmail: recovered.guardian_email || 'guardian@example.com',
        guardianPhone: recovered.guardian_phone || '+91 98765 00000',
        institute: recovered.institute,
        course: recovered.course || 'CBSE Senior Secondary',
        grade: recovered.grade || 'Grade 11',
        academicYear: recovered.academic_year || '2026-2027',
        netPayableMinor: Number(recovered.net_payable_minor || 12000000),
        paidMinor: Number(recovered.paid_minor || 0),
        outstandingMinor: Number(recovered.outstanding_minor || 12000000),
        enachStatus: recovered.enach_status || 'active',
      };
      saveStudentAccount(newAcc);
    }

    // Ensure payer store has student profile
    if (!STUDENT_PROFILES[recovered.student_reference]) {
      STUDENT_PROFILES[recovered.student_reference] = {
        studentName: recovered.full_name,
        displayName: recovered.guardian_name || recovered.full_name + ' Guardian',
        accountReference: recovered.student_reference,
        email: recovered.guardian_email || 'guardian@example.com',
        phone: recovered.guardian_phone || '+91 98765 00000',
        netPayableMinor: Number(recovered.net_payable_minor || 12000000),
        paidMinor: Number(recovered.paid_minor || 0),
        outstandingMinor: Number(recovered.outstanding_minor || 12000000),
        groupName: recovered.group_name || 'Grade 11-A',
      };
    }

    return {
      student: syncBalances(recovered),
      recovered: true,
      created: false,
    };
  }

  // 2. Prevent accidental reference collisions with other students
  if (refInput) {
    const conflict = roster.find(
      (s) =>
        s.student_reference.toLowerCase() === refInput.toLowerCase() ||
        (s.enrollment_id && s.enrollment_id.toLowerCase() === refInput.toLowerCase()),
    );
    if (conflict) {
      throw new Error(
        `A student with enrollment reference '${refInput}' already exists (${conflict.full_name}).`,
      );
    }
  }

  // 3. Create a new student record
  const existingNumIds = roster
    .map((s) => {
      const m = s.id.match(/^stu-(\d+)$/);
      return m ? parseInt(m[1]!, 10) : 0;
    })
    .filter((n) => !isNaN(n));
  const maxId = existingNumIds.length ? Math.max(...existingNumIds) : roster.length;
  const newId = `stu-${maxId + 1}`;
  const studentReference =
    refInput || `DPS-2026-${String(maxId + 100).padStart(3, '0')}`;

  const newStudent: StudentRosterItem = {
    id: newId,
    full_name: nameInput || 'New Student',
    student_reference: studentReference,
    status: payload.status || 'active',
    institute: payload.institute || 'Delhi Public School (Demo)',
    group_name: payload.groupName || payload.group_name || 'Grade 10-A',
    course: payload.course || 'CBSE Secondary',
    grade: payload.grade || '10',
    academic_year: payload.academicYear || payload.academic_year || '2026-27',
    campus: payload.campus || 'Delhi Main Campus',
    email: payload.email || 'student@example.com',
    phone: payload.phone || '+91 98765 00000',
    guardian_name: payload.guardianName || payload.guardian_name || 'Guardian',
    guardian_email: payload.guardianEmail || payload.guardian_email || 'guardian@example.com',
    guardian_phone: payload.guardianPhone || payload.guardian_phone || '+91 98765 11111',
    enach_status: 'pending',
    net_payable_minor: '12000000',
    paid_minor: '0',
    outstanding_minor: '12000000',
  };

  roster.unshift(newStudent);
  globalStore.__DODO_STUDENT_ROSTER__ = roster;
  saveToDisk(roster);

  // Register in student-ledger ACCOUNT_STORE
  const newAccount: StudentAccount = {
    id: newStudent.id,
    enrollmentId: newStudent.student_reference,
    studentReference: newStudent.student_reference,
    fullName: newStudent.full_name,
    guardianName: newStudent.guardian_name || 'Guardian',
    guardianEmail: newStudent.guardian_email || 'guardian@example.com',
    guardianPhone: newStudent.guardian_phone || '+91 98765 11111',
    institute: newStudent.institute,
    course: newStudent.course || 'CBSE Secondary',
    grade: newStudent.grade || 'Grade 10',
    academicYear: newStudent.academic_year || '2026-2027',
    netPayableMinor: 12000000,
    paidMinor: 0,
    outstandingMinor: 12000000,
    enachStatus: 'pending',
  };
  saveStudentAccount(newAccount);

  // Register in payer-store
  STUDENT_PROFILES[newStudent.student_reference] = {
    studentName: newStudent.full_name,
    displayName: newStudent.guardian_name || newStudent.full_name + ' Guardian',
    accountReference: newStudent.student_reference,
    email: newStudent.guardian_email || 'guardian@example.com',
    phone: newStudent.guardian_phone || '+91 98765 11111',
    netPayableMinor: 12000000,
    paidMinor: 0,
    outstandingMinor: 12000000,
    groupName: newStudent.group_name || 'Grade 10-A',
  };

  return {
    student: newStudent,
    recovered: false,
    created: true,
  };
}

export type FilterStudentsQuery = {
  search?: string;
  status?: string;
  sort?: string;
  page?: string | number;
  pageSize?: string | number;
};

export type FilteredStudentsResult = {
  rows: StudentRosterItem[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Filter, sort, and paginate the persistent student roster.
 */
export function getFilteredStudents(query: FilterStudentsQuery = {}): FilteredStudentsResult {
  const roster = getStudentRoster();

  let filtered = [...roster];

  // 1. Search filter
  const search = (query.search || '').trim().toLowerCase();
  if (search) {
    filtered = filtered.filter((s) => {
      const matchName = s.full_name.toLowerCase().includes(search);
      const matchRef = s.student_reference.toLowerCase().includes(search);
      const matchEnrollment = s.enrollment_id && s.enrollment_id.toLowerCase().includes(search);
      const matchId = s.id.toLowerCase().includes(search);
      const matchGuardian = s.guardian_name && s.guardian_name.toLowerCase().includes(search);
      return matchName || matchRef || matchEnrollment || matchId || matchGuardian;
    });
  }

  // 2. Admission Status filter
  const status = (query.status || 'all').trim().toLowerCase();
  if (status && status !== 'all') {
    if (status === 'active') {
      // In this system, active enrolled students have status 'active' or 'enrolled'
      filtered = filtered.filter(
        (s) => s.status.toLowerCase() === 'active' || s.status.toLowerCase() === 'enrolled',
      );
    } else {
      filtered = filtered.filter((s) => s.status.toLowerCase() === status);
    }
  }

  // 3. Sorting
  const sort = (query.sort || 'name').trim().toLowerCase();
  if (sort === 'reference') {
    filtered.sort((a, b) => a.student_reference.localeCompare(b.student_reference));
  } else {
    // Default: Sort by student name
    filtered.sort((a, b) => a.full_name.localeCompare(b.full_name));
  }

  // 4. Pagination
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.max(1, Number(query.pageSize || 25));
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);

  return {
    rows,
    total,
    page,
    pageSize,
  };
}

/**
 * Reset roster back to initial baseline (for clean test isolation)
 */
export function resetStudentRoster(): void {
  const initial = JSON.parse(JSON.stringify(BASELINE_STUDENTS));
  globalStore.__DODO_STUDENT_ROSTER__ = initial;
  saveToDisk(initial);
}
