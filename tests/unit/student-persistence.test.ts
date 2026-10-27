import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST, GET } from '../../apps/web/src/app/api/v1/[...route]/route';
import {
  getStudentRoster,
  findRosterStudent,
  recoverOrCreateStudent,
  getFilteredStudents,
  resetStudentRoster,
} from '../../apps/web/src/lib/student-roster';
import {
  findStudentAccount,
  recordStudentPayment,
  resetStudentLedger,
} from '../../apps/web/src/lib/student-ledger';

test('Scenario 1: Student Roster initially loads 11 baseline students including Saumya (stu-12)', async () => {
  resetStudentLedger();
  resetStudentRoster();

  const req = new NextRequest('http://localhost:3000/api/v1/admin/fees/students?page=1&pageSize=25', {
    method: 'GET',
  });
  const res = await GET(req, { params: Promise.resolve({ route: ['admin', 'fees', 'students'] }) });
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.total, 11, 'Should contain 11 baseline students');
  assert.ok(Array.isArray(data.rows), 'rows should be an array');
  assert.equal(data.rows.length, 11);

  const saumya = data.rows.find((s: any) => s.id === 'stu-12' || s.full_name === 'Saumya');
  assert.ok(saumya, 'Saumya (stu-12) must be present in the students list');
  assert.equal(saumya.id, 'stu-12');
  assert.equal(saumya.student_reference, 'DPS-2026-160');
  assert.equal(saumya.guardian_name, 'Sanjay Kumar');
  assert.equal(saumya.institute, 'Delhi Public School (Demo)');
  assert.equal(saumya.net_payable_minor, '12000000');
});

test('Scenario 2: Newly added student persists in the list across refresh, navigation, and re-fetching', async () => {
  resetStudentLedger();
  resetStudentRoster();

  // 1. Submit New Student registration via POST admin/academic/students
  const createReq = new NextRequest('http://localhost:3000/api/v1/admin/academic/students', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Kabir Singh',
      studentReference: 'DPS-2026-500',
      campus: 'Delhi Main Campus',
      course: 'CBSE Secondary',
      grade: 'Grade 10',
      groupName: 'Grade 10-B',
      academicYear: '2026-2027',
      status: 'active',
      guardianName: 'Jaspreet Singh',
      guardianEmail: 'jaspreet@example.com',
      guardianPhone: '+91 98765 88888',
    }),
    headers: { 'Content-Type': 'application/json' },
  });

  const createRes = await POST(createReq, { params: Promise.resolve({ route: ['admin', 'academic', 'students'] }) });
  const created = await createRes.json();

  assert.equal(createRes.status, 200);
  assert.equal(created.ok, true);
  assert.equal(created.full_name, 'Kabir Singh');
  assert.equal(created.student_reference, 'DPS-2026-500');
  assert.equal(created.guardian_name, 'Jaspreet Singh');
  assert.equal(created.status, 'active');

  // 2. Simulate Refresh button / page reload: GET admin/fees/students
  const reloadReq1 = new NextRequest('http://localhost:3000/api/v1/admin/fees/students?search=&status=all&sort=name&page=1&pageSize=25', {
    method: 'GET',
  });
  const reloadRes1 = await GET(reloadReq1, { params: Promise.resolve({ route: ['admin', 'fees', 'students'] }) });
  const reloadData1 = await reloadRes1.json();

  assert.equal(reloadData1.total, 12, 'Total student count should now be 12');
  const kabirAfterRefresh = reloadData1.rows.find((s: any) => s.student_reference === 'DPS-2026-500');
  assert.ok(kabirAfterRefresh, 'Kabir Singh must remain visible after refresh');
  assert.equal(kabirAfterRefresh.full_name, 'Kabir Singh');

  // 3. Simulate navigation away and returning: GET admin/fees/students
  const navReq = new NextRequest('http://localhost:3000/api/v1/admin/fees/students?page=1&pageSize=25', {
    method: 'GET',
  });
  const navRes = await GET(navReq, { params: Promise.resolve({ route: ['admin', 'fees', 'students'] }) });
  const navData = await navRes.json();

  assert.equal(navData.total, 12);
  assert.ok(navData.rows.some((s: any) => s.student_reference === 'DPS-2026-500'), 'Kabir Singh must persist after navigation');

  // 4. Verify student profile endpoint can fetch Kabir Singh
  const profileReq = new NextRequest(`http://localhost:3000/api/v1/admin/fees/students/${created.id}`, {
    method: 'GET',
  });
  const profileRes = await GET(profileReq, {
    params: Promise.resolve({ route: ['admin', 'fees', 'students', created.id] }),
  });
  const profileData = await profileRes.json();

  assert.equal(profileRes.status, 200);
  assert.equal(profileData.full_name, 'Kabir Singh');
  assert.equal(profileData.guardian_name, 'Jaspreet Singh');
});

test('Scenario 3: Recovering Saumya if already registered (Data Integrity requirement)', async () => {
  resetStudentLedger();
  resetStudentRoster();

  // Record a payment of ₹40,000 on Saumya's ledger first
  recordStudentPayment({
    studentQuery: 'stu-12',
    amountMinor: 4000000,
    transactionId: 'TXN-EXISTING-SAUMYA-LEDGER',
    paymentMode: 'eNACH Auto-Debit',
    outcome: 'successful',
  });

  const accountBefore = findStudentAccount('stu-12');
  assert.ok(accountBefore);
  assert.equal(accountBefore.paidMinor, 4000000);
  assert.equal(accountBefore.outstandingMinor, 8000000);

  // Attempt to "create" Saumya again from the Institution Console form
  const recoverReq = new NextRequest('http://localhost:3000/api/v1/admin/academic/students', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Saumya',
      studentReference: 'DPS-2026-160',
      guardianName: 'Sanjay Kumar',
      guardianPhone: '+91 98765 43220',
      status: 'active',
    }),
    headers: { 'Content-Type': 'application/json' },
  });

  const recoverRes = await POST(recoverReq, { params: Promise.resolve({ route: ['admin', 'academic', 'students'] }) });
  const recovered = await recoverRes.json();

  assert.equal(recoverRes.status, 200);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.recovered, true, 'Must report student was recovered rather than duplicated');
  assert.equal(recovered.id, 'stu-12', 'Preserves her existing stable student ID');
  assert.equal(recovered.student_reference, 'DPS-2026-160', 'Preserves enrollment reference');
  assert.equal(recovered.guardian_name, 'Sanjay Kumar', 'Preserves guardian Sanjay Kumar');
  assert.equal(recovered.status, 'active');

  // Verify no duplicate record was created in the roster
  const listReq = new NextRequest('http://localhost:3000/api/v1/admin/fees/students?search=Saumya', {
    method: 'GET',
  });
  const listRes = await GET(listReq, { params: Promise.resolve({ route: ['admin', 'fees', 'students'] }) });
  const listData = await listRes.json();

  assert.equal(listData.total, 1, 'Only exactly 1 Saumya record must exist (no duplicate created)');
  assert.equal(listData.rows[0].id, 'stu-12');
  assert.equal(listData.rows[0].paid_minor, '4000000', 'Existing payment history of ₹40,000 preserved');
  assert.equal(listData.rows[0].outstanding_minor, '8000000', 'Outstanding balance preserved');
});

test('Scenario 4: Search filter correctly finds students by name, reference, and guardian', async () => {
  resetStudentLedger();
  resetStudentRoster();

  // Search by student name
  const reqName = new NextRequest('http://localhost:3000/api/v1/admin/fees/students?search=Saumya', { method: 'GET' });
  const resName = await GET(reqName, { params: Promise.resolve({ route: ['admin', 'fees', 'students'] }) });
  const dataName = await resName.json();
  assert.equal(dataName.total, 1);
  assert.equal(dataName.rows[0].full_name, 'Saumya');

  // Search by reference
  const reqRef = new NextRequest('http://localhost:3000/api/v1/admin/fees/students?search=DPS-2026-160', { method: 'GET' });
  const resRef = await GET(reqRef, { params: Promise.resolve({ route: ['admin', 'fees', 'students'] }) });
  const dataRef = await resRef.json();
  assert.equal(dataRef.total, 1);
  assert.equal(dataRef.rows[0].id, 'stu-12');

  // Search by guardian name
  const reqGuardian = new NextRequest('http://localhost:3000/api/v1/admin/fees/students?search=Sanjay Kumar', { method: 'GET' });
  const resGuardian = await GET(reqGuardian, { params: Promise.resolve({ route: ['admin', 'fees', 'students'] }) });
  const dataGuardian = await resGuardian.json();
  assert.equal(dataGuardian.total, 1);
  assert.equal(dataGuardian.rows[0].full_name, 'Saumya');

  // Search non-existent
  const reqNone = new NextRequest('http://localhost:3000/api/v1/admin/fees/students?search=NonExistentQuery123', { method: 'GET' });
  const resNone = await GET(reqNone, { params: Promise.resolve({ route: ['admin', 'fees', 'students'] }) });
  const dataNone = await resNone.json();
  assert.equal(dataNone.total, 0);
  assert.equal(dataNone.rows.length, 0);
});

test('Scenario 5: Admission status filter correctly includes enrolled and active students', async () => {
  resetStudentLedger();
  resetStudentRoster();

  // Filter status = active (should include enrolled/active students including Saumya)
  const reqActive = new NextRequest('http://localhost:3000/api/v1/admin/fees/students?status=active', { method: 'GET' });
  const resActive = await GET(reqActive, { params: Promise.resolve({ route: ['admin', 'fees', 'students'] }) });
  const dataActive = await resActive.json();

  assert.ok(dataActive.total >= 11);
  assert.ok(dataActive.rows.some((s: any) => s.full_name === 'Saumya'), 'Saumya must be visible under status=active');

  // Filter status = all
  const reqAll = new NextRequest('http://localhost:3000/api/v1/admin/fees/students?status=all', { method: 'GET' });
  const resAll = await GET(reqAll, { params: Promise.resolve({ route: ['admin', 'fees', 'students'] }) });
  const dataAll = await resAll.json();
  assert.equal(dataAll.total, 11);
});

test('Scenario 6: Sorting by name and reference works properly', async () => {
  resetStudentLedger();
  resetStudentRoster();

  // Sort by name
  const reqName = new NextRequest('http://localhost:3000/api/v1/admin/fees/students?sort=name', { method: 'GET' });
  const resName = await GET(reqName, { params: Promise.resolve({ route: ['admin', 'fees', 'students'] }) });
  const dataName = await resName.json();

  for (let i = 0; i < dataName.rows.length - 1; i++) {
    assert.ok(
      dataName.rows[i].full_name.localeCompare(dataName.rows[i + 1].full_name) <= 0,
      `Sorted by name: ${dataName.rows[i].full_name} should come before or equal to ${dataName.rows[i + 1].full_name}`,
    );
  }

  // Sort by reference
  const reqRef = new NextRequest('http://localhost:3000/api/v1/admin/fees/students?sort=reference', { method: 'GET' });
  const resRef = await GET(reqRef, { params: Promise.resolve({ route: ['admin', 'fees', 'students'] }) });
  const dataRef = await resRef.json();

  for (let i = 0; i < dataRef.rows.length - 1; i++) {
    assert.ok(
      dataRef.rows[i].student_reference.localeCompare(dataRef.rows[i + 1].student_reference) <= 0,
      `Sorted by reference: ${dataRef.rows[i].student_reference} should come before or equal to ${dataRef.rows[i + 1].student_reference}`,
    );
  }
});

test('Scenario 7: Pagination partitions rows correctly', async () => {
  resetStudentLedger();
  resetStudentRoster();

  const reqPage1 = new NextRequest('http://localhost:3000/api/v1/admin/fees/students?page=1&pageSize=5', { method: 'GET' });
  const resPage1 = await GET(reqPage1, { params: Promise.resolve({ route: ['admin', 'fees', 'students'] }) });
  const dataPage1 = await resPage1.json();

  assert.equal(dataPage1.page, 1);
  assert.equal(dataPage1.pageSize, 5);
  assert.equal(dataPage1.total, 11);
  assert.equal(dataPage1.rows.length, 5);

  const reqPage2 = new NextRequest('http://localhost:3000/api/v1/admin/fees/students?page=2&pageSize=5', { method: 'GET' });
  const resPage2 = await GET(reqPage2, { params: Promise.resolve({ route: ['admin', 'fees', 'students'] }) });
  const dataPage2 = await resPage2.json();

  assert.equal(dataPage2.page, 2);
  assert.equal(dataPage2.pageSize, 5);
  assert.equal(dataPage2.rows.length, 5);
  assert.notEqual(dataPage1.rows[0].id, dataPage2.rows[0].id);
});

test('Scenario 8: Prevent accidental overwriting of existing students with different names', async () => {
  resetStudentLedger();
  resetStudentRoster();

  // Attempt to register a different student with V Rakesh's reference DPS-2026-089
  const collisionReq = new NextRequest('http://localhost:3000/api/v1/admin/academic/students', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Imposter Student',
      studentReference: 'DPS-2026-089',
    }),
    headers: { 'Content-Type': 'application/json' },
  });

  const collisionRes = await POST(collisionReq, { params: Promise.resolve({ route: ['admin', 'academic', 'students'] }) });
  const collisionData = await collisionRes.json();

  assert.equal(collisionRes.status, 400);
  assert.ok(collisionData.message.includes('already exists'));

  // Ensure V Rakesh is still the owner of DPS-2026-089
  const rakesh = findRosterStudent('DPS-2026-089');
  assert.ok(rakesh);
  assert.equal(rakesh.full_name, 'V Rakesh');
});
