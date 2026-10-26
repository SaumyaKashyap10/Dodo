import test from 'node:test';
import assert from 'node:assert/strict';
import {
  balanceEvenly,
  generateAutomatedSchedule,
  getFrequencyCycleCount,
  calculateInstallmentDueDate,
  calculateMonthDifference,
} from '../../apps/web/src/lib/enach/installment-automator';
import type { LinkedInstallment } from '../../apps/web/src/lib/enach/types';

test('1. Frequency options 4, 5, and 10 cycle count and generation semantics', () => {
  // Option 10: Monthly (10 academic months July - April)
  const count10 = getFrequencyCycleCount('monthly');
  const count10Alt = getFrequencyCycleCount('10');
  assert.equal(count10, 10, 'Monthly frequency should represent 10 academic cycles');
  assert.equal(count10Alt, 10, 'Numeric 10 should resolve to 10 cycles');

  const monthlySchedule = generateAutomatedSchedule({
    frequency: 'monthly',
    totalMinor: 10000000, // ₹100,000
    startDate: '2026-07-01',
    endDate: '2027-04-30',
    studentId: 'stu-101',
  });
  assert.equal(monthlySchedule.items.length, 10, 'Monthly schedule must have 10 instalments');
  assert.equal(monthlySchedule.startDate, '2026-07-01');
  assert.equal(monthlySchedule.endDate, '2027-04-30');
  assert.equal(monthlySchedule.items[0]?.name, 'Instalment #1: July Monthly Fee');
  assert.equal(monthlySchedule.items[9]?.name, 'Instalment #10: April Monthly Fee');

  // Option 5: Term-Wise (5 bi-monthly academic terms July - April)
  const count5 = getFrequencyCycleCount('term_5');
  const count5Alt = getFrequencyCycleCount('5');
  assert.equal(count5, 5, 'Term-Wise frequency should represent 5 academic terms');
  assert.equal(count5Alt, 5, 'Numeric 5 should resolve to 5 cycles');

  const term5Schedule = generateAutomatedSchedule({
    frequency: 'term_5',
    totalMinor: 10000000,
    startDate: '2026-07-01',
    endDate: '2027-04-30',
    studentId: 'stu-102',
  });
  assert.equal(term5Schedule.items.length, 5, 'Term-Wise schedule must have 5 instalments');
  assert.equal(term5Schedule.items[0]?.name, 'Instalment #1: Term 1 (Jul - Aug)');
  assert.equal(term5Schedule.items[4]?.name, 'Instalment #5: Term 5 (Mar - Apr)');

  // Option 4: Quarterly (4 cycles Q1 - Q4 July - June)
  const count4 = getFrequencyCycleCount('quarterly');
  const count4Alt = getFrequencyCycleCount('4');
  assert.equal(count4, 4, 'Quarterly frequency should represent 4 cycles');
  assert.equal(count4Alt, 4, 'Numeric 4 should resolve to 4 cycles');

  const quarterlySchedule = generateAutomatedSchedule({
    frequency: 'quarterly',
    totalMinor: 10000000,
    startDate: '2026-07-01',
    endDate: '2027-06-30',
    studentId: 'stu-103',
  });
  assert.equal(quarterlySchedule.items.length, 4, 'Quarterly schedule must have 4 instalments');
  assert.equal(quarterlySchedule.items[0]?.name, 'Instalment #1: Q1 Tuition & Term Fee');
  assert.equal(quarterlySchedule.items[3]?.name, 'Instalment #4: Q4 Final Assessment Fee');
});

test('2. Start and end date boundaries and due date clamping', () => {
  // Custom date range: 6-month window (2026-07-01 to 2026-12-31)
  const customMonthly = generateAutomatedSchedule({
    frequency: 'monthly',
    totalMinor: 6000000,
    startDate: '2026-07-01',
    endDate: '2026-12-31',
    studentId: 'stu-date-boundary',
    dueDay: 15,
  });

  assert.equal(customMonthly.items.length, 6, 'Should generate exactly 6 months');
  assert.equal(customMonthly.items[0]?.period_start, '2026-07-01');
  assert.equal(customMonthly.items[5]?.period_end, '2026-12-31');

  // Verify due date clamping
  for (const item of customMonthly.items) {
    assert.ok(item.due_date >= item.period_start, `Due date ${item.due_date} must not precede start ${item.period_start}`);
    assert.ok(item.due_date <= item.period_end, `Due date ${item.due_date} must not exceed end ${item.period_end}`);
  }

  // Clamping test with February (leap/short month)
  const clampedFebDue = calculateInstallmentDueDate('2027-02-01', '2027-02-28', 31);
  assert.equal(clampedFebDue, '2027-02-28', 'Day 31 must clamp to last day of February');

  // Clamping test with April (30-day month)
  const clampedAprDue = calculateInstallmentDueDate('2027-04-01', '2027-04-30', 31);
  assert.equal(clampedAprDue, '2027-04-30', 'Day 31 must clamp to 30 for April');
});

test('3. Balance Evenly with 2, 3, 4, and uneven numbers of instalments', () => {
  const dummyInstallment = (id: string, seq: number): LinkedInstallment => ({
    id,
    sequence: seq,
    name: `Instalment #${seq}`,
    due_date: '2026-10-10',
    amount_minor: 0,
    status: seq === 1 ? 'scheduled' : 'pending',
  });

  // Test Case A: 3 instalments for ₹100,000 (10,000,000 minor)
  // Expected: ₹33,333.33, ₹33,333.33, ₹33,333.34 (3333333, 3333333, 3333334 paise)
  const threeInst = [dummyInstallment('i1', 1), dummyInstallment('i2', 2), dummyInstallment('i3', 3)];
  const balanced3 = balanceEvenly(threeInst, 10000000);
  assert.equal(balanced3.length, 3);
  assert.equal(balanced3[0]?.amount_minor, 3333333, 'Instalment 1 should be 33,333.33');
  assert.equal(balanced3[1]?.amount_minor, 3333333, 'Instalment 2 should be 33,333.33');
  assert.equal(balanced3[2]?.amount_minor, 3333334, 'Final instalment should have 1 paisa remainder (33,333.34)');

  const sum3 = balanced3.reduce((sum, item) => sum + item.amount_minor, 0);
  assert.equal(sum3, 10000000, 'Sum of 3 instalments must exactly match total fee');

  // Test Case B: 2 instalments for ₹100,000 (10,000,000 minor)
  // Expected: ₹50,000.00, ₹50,000.00 (5000000, 5000000)
  const twoInst = [dummyInstallment('i1', 1), dummyInstallment('i2', 2)];
  const balanced2 = balanceEvenly(twoInst, 10000000);
  assert.equal(balanced2[0]?.amount_minor, 5000000);
  assert.equal(balanced2[1]?.amount_minor, 5000000);
  assert.equal(balanced2.reduce((sum, i) => sum + i.amount_minor, 0), 10000000);

  // Test Case C: 4 instalments for ₹100,000 (10,000,000 minor)
  // Expected: ₹25,000.00 each (2500000 each)
  const fourInst = [
    dummyInstallment('i1', 1),
    dummyInstallment('i2', 2),
    dummyInstallment('i3', 3),
    dummyInstallment('i4', 4),
  ];
  const balanced4 = balanceEvenly(fourInst, 10000000);
  assert.ok(balanced4.every((i) => i.amount_minor === 2500000));
  assert.equal(balanced4.reduce((sum, i) => sum + i.amount_minor, 0), 10000000);

  // Test Case D: 7 instalments for ₹100,000 (uneven split)
  // 10,000,000 / 7 = 1,428,571 with remainder 3
  const sevenInst = Array.from({ length: 7 }, (_, i) => dummyInstallment(`i${i + 1}`, i + 1));
  const balanced7 = balanceEvenly(sevenInst, 10000000);
  assert.equal(balanced7[0]?.amount_minor, 1428571);
  assert.equal(balanced7[5]?.amount_minor, 1428571);
  assert.equal(balanced7[6]?.amount_minor, 1428574, 'Final instalment carries remainder 3 paise');
  assert.equal(balanced7.reduce((sum, i) => sum + i.amount_minor, 0), 10000000);
});

test('4. Manual editing followed by balancing preserves dates and metadata', () => {
  const schedule = generateAutomatedSchedule({
    frequency: 'quarterly',
    totalMinor: 8000000,
    startDate: '2026-07-01',
    endDate: '2027-06-30',
  });

  // User manually edits instalment #2's amount and instalment #3's date
  const edited = [...schedule.items];
  edited[1] = { ...edited[1]!, amount_minor: 5000000 };
  edited[2] = { ...edited[2]!, due_date: '2027-01-20' };

  // User then clicks "Balance Evenly"
  const rebalanced = balanceEvenly(edited, 8000000);

  // Amounts should now be evenly balanced (8000000 / 4 = 2000000 each)
  assert.equal(rebalanced[0]?.amount_minor, 2000000);
  assert.equal(rebalanced[1]?.amount_minor, 2000000);
  assert.equal(rebalanced[2]?.amount_minor, 2000000);
  assert.equal(rebalanced[3]?.amount_minor, 2000000);

  // Manually updated due date in #3 must be preserved!
  assert.equal(rebalanced[2]?.due_date, '2027-01-20', 'Instalment dates must be preserved after balance evenly');
  // Sequences must remain intact
  assert.deepEqual(rebalanced.map((r) => r.sequence), [1, 2, 3, 4]);
});

test('5. Empty schedules and invalid amounts handle safely', () => {
  // Empty schedule
  const emptyRes = balanceEvenly([], 10000000);
  assert.deepEqual(emptyRes, []);

  // Zero total
  const inst = [{
    id: 'i1',
    sequence: 1,
    name: 'Inst 1',
    due_date: '2026-07-10',
    amount_minor: 5000,
    status: 'scheduled' as const,
  }];
  const zeroRes = balanceEvenly(inst, 0);
  assert.equal(zeroRes[0]?.amount_minor, 5000, 'Should not modify when totalMinor is 0');

  // Negative total
  const negRes = balanceEvenly(inst, -100);
  assert.equal(negRes[0]?.amount_minor, 5000, 'Should not modify when totalMinor is negative');

  // NaN total
  const nanRes = balanceEvenly(inst, NaN);
  assert.equal(nanRes[0]?.amount_minor, 5000, 'Should not modify when totalMinor is NaN');
});

test('6. Schedule regeneration produces distinct, non-duplicate IDs', () => {
  const sched1 = generateAutomatedSchedule({
    frequency: 'quarterly',
    totalMinor: 10000000,
    studentId: 'stu-abc',
  });

  const ids = sched1.items.map((i) => i.id);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, ids.length, 'Generated instalment IDs must be unique');

  // Regenerate with monthly
  const sched2 = generateAutomatedSchedule({
    frequency: 'monthly',
    totalMinor: 10000000,
    studentId: 'stu-abc',
  });
  const ids2 = sched2.items.map((i) => i.id);
  const uniqueIds2 = new Set(ids2);
  assert.equal(uniqueIds2.size, ids2.length, 'Regenerated instalment IDs must be unique');
});

test('7. Month difference calculation helper', () => {
  assert.equal(calculateMonthDifference('2026-07-01', '2026-07-31'), 1);
  assert.equal(calculateMonthDifference('2026-07-01', '2026-10-31'), 4);
  assert.equal(calculateMonthDifference('2026-07-01', '2027-04-30'), 10);
  assert.equal(calculateMonthDifference('2026-07-01', '2027-06-30'), 12);
});
