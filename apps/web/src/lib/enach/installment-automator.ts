/**
 * DODO.FINANCE — Scheduled Fee Instalment Automation Engine
 * Automates instalment generation according to school fee collection rules,
 * debit frequencies (4, 5, 10 cycles), date boundaries, and currency precision.
 */

import type { LinkedInstallment } from './types';

export type FrequencyType = 'monthly' | 'term_5' | 'bi-monthly' | 'quarterly' | 'as_presented';

export interface GenerateScheduleParams {
  frequency: FrequencyType | string;
  totalMinor: number;
  startDate?: string;
  endDate?: string;
  studentId?: string;
  dueDay?: number;
}

/**
 * Returns the standard cycle count for a given frequency option
 * - monthly: 10 cycles (10 academic instructional months July-April)
 * - term_5: 5 cycles (5 bi-monthly academic terms July-April)
 * - bi-monthly: 6 cycles (6 calendar bi-monthly cycles July-June)
 * - quarterly: 4 cycles (4 quarters Q1-Q4 July-June)
 * - as_presented: 3 cycles (3 milestone tranches)
 */
export function getFrequencyCycleCount(
  freq: string,
  startDate?: string,
  endDate?: string,
): number {
  if (freq === 'monthly' || freq === '10') return 10;
  if (freq === 'term_5' || freq === '5') return 5;
  if (freq === 'bi-monthly' || freq === '6') return 6;
  if (freq === 'quarterly' || freq === '4') return 4;
  if (freq === 'as_presented' || freq === '3') return 3;

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const months = Math.max(
        1,
        (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1,
      );
      if (freq.includes('month') && !freq.includes('bi')) return Math.min(60, months);
      if (freq.includes('quarter')) return Math.max(1, Math.ceil(months / 3));
      if (freq.includes('term')) return Math.max(1, Math.ceil(months / 2));
    }
  }
  return 4;
}

/**
 * Distributes a total fee amount evenly across all current instalments.
 * Applies exact currency rounding (two decimal places in INR / integer minor units)
 * and adjusts the final instalment for any rounding remainder so that:
 * sum(installments.amount_minor) === totalMinor
 */
export function balanceEvenly(
  installments: LinkedInstallment[],
  totalMinor: number,
): LinkedInstallment[] {
  if (!installments || installments.length === 0) return [];
  const count = installments.length;
  if (totalMinor <= 0 || !Number.isFinite(totalMinor)) {
    return installments;
  }

  const base = Math.floor(totalMinor / count);
  const remainder = totalMinor - base * count;

  return installments.map((inst, idx) => ({
    ...inst,
    sequence: idx + 1,
    amount_minor: idx === count - 1 ? base + remainder : base,
  }));
}

/**
 * Safely calculates a due date inside an instalment period, clamped to month boundaries
 */
export function calculateInstallmentDueDate(
  periodStart: string,
  periodEnd: string,
  targetDay: number = 10,
): string {
  try {
    const parts = periodStart.split('-').map(Number);
    const y = parts[0] ?? 2026;
    const m = parts[1] ?? 1;
    const lastDayOfMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const clampedDay = Math.min(Math.max(1, targetDay), lastDayOfMonth);
    const pad = (n: number) => String(n).padStart(2, '0');
    const computed = `${y}-${pad(m)}-${pad(clampedDay)}`;

    if (computed < periodStart) return periodStart;
    if (computed > periodEnd) return periodEnd;
    return computed;
  } catch {
    return periodStart;
  }
}

/**
 * Helper to compute month difference inclusive of start and end months
 */
export function calculateMonthDifference(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  const totalMonths = years * 12 + months + 1;
  return Math.max(1, totalMonths);
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Generates an automated instalment schedule matching the chosen debit frequency
 * and date range boundaries.
 */
export function generateAutomatedSchedule(
  params: GenerateScheduleParams,
): { items: LinkedInstallment[]; startDate: string; endDate: string } {
  const {
    frequency,
    totalMinor,
    startDate: customStart,
    endDate: customEnd,
    studentId = 'stu',
    dueDay = 10,
  } = params;

  const total = totalMinor > 0 ? totalMinor : 12000000;
  const pad = (n: number) => String(n).padStart(2, '0');

  // Normalize frequency key
  const normalizedFreq: FrequencyType =
    frequency === '10'
      ? 'monthly'
      : frequency === '5'
        ? 'term_5'
        : frequency === '4'
          ? 'quarterly'
          : (frequency as FrequencyType);

  // Determine standard default dates if not provided
  let effectiveStart = customStart;
  let effectiveEnd = customEnd;

  if (!effectiveStart) {
    effectiveStart = '2026-07-01';
  }

  const startYear = parseInt(effectiveStart.slice(0, 4), 10) || 2026;
  const endYear = startYear + 1;

  if (!effectiveEnd) {
    if (normalizedFreq === 'monthly' || normalizedFreq === 'term_5' || normalizedFreq === 'as_presented') {
      effectiveEnd = `${endYear}-04-30`;
    } else {
      effectiveEnd = `${endYear}-06-30`;
    }
  }

  // Ensure end is not before start
  if (effectiveEnd < effectiveStart) {
    effectiveEnd = effectiveStart;
  }

  // 1. Monthly (10 cycles for academic year July-April, or dynamic months between start & end)
  if (normalizedFreq === 'monthly') {
    const isStandardAcademicYear =
      effectiveStart === `${startYear}-07-01` && effectiveEnd === `${endYear}-04-30`;

    if (isStandardAcademicYear) {
      const months = [
        { name: 'July', start: `${startYear}-07-01`, end: `${startYear}-07-31`, due: `${startYear}-07-${pad(dueDay)}` },
        { name: 'August', start: `${startYear}-08-01`, end: `${startYear}-08-31`, due: `${startYear}-08-${pad(dueDay)}` },
        { name: 'September', start: `${startYear}-09-01`, end: `${startYear}-09-30`, due: `${startYear}-09-${pad(dueDay)}` },
        { name: 'October', start: `${startYear}-10-01`, end: `${startYear}-10-31`, due: `${startYear}-10-${pad(dueDay)}` },
        { name: 'November', start: `${startYear}-11-01`, end: `${startYear}-11-30`, due: `${startYear}-11-${pad(dueDay)}` },
        { name: 'December', start: `${startYear}-12-01`, end: `${startYear}-12-31`, due: `${startYear}-12-${pad(dueDay)}` },
        { name: 'January', start: `${endYear}-01-01`, end: `${endYear}-01-31`, due: `${endYear}-01-${pad(dueDay)}` },
        {
          name: 'February',
          start: `${endYear}-02-01`,
          end: `${endYear}-02-${new Date(Date.UTC(endYear, 2, 0)).getUTCDate()}`,
          due: `${endYear}-02-${pad(Math.min(dueDay, 28))}`,
        },
        { name: 'March', start: `${endYear}-03-01`, end: `${endYear}-03-31`, due: `${endYear}-03-${pad(dueDay)}` },
        { name: 'April', start: `${endYear}-04-01`, end: `${endYear}-04-30`, due: `${endYear}-04-${pad(dueDay)}` },
      ];

      const rawItems: LinkedInstallment[] = months.map((m, idx) => ({
        id: `inst-${studentId}-m-${idx + 1}`,
        sequence: idx + 1,
        name: `Instalment #${idx + 1}: ${m.name} Monthly Fee`,
        period_start: m.start,
        period_end: m.end,
        due_date: m.due,
        amount_minor: 0,
        status: (idx === 0 ? 'scheduled' : 'pending') as 'scheduled' | 'pending',
      }));

      return {
        items: balanceEvenly(rawItems, total),
        startDate: effectiveStart,
        endDate: effectiveEnd,
      };
    }

    // Dynamic month-by-month range
    const startD = new Date(effectiveStart);
    const endD = new Date(effectiveEnd);
    let curY = startD.getFullYear();
    let curM = startD.getMonth();
    const endY = endD.getFullYear();
    const endM = endD.getMonth();

    const rawItems: LinkedInstallment[] = [];
    let seq = 1;

    while (curY < endY || (curY === endY && curM <= endM)) {
      const pStart = seq === 1 ? effectiveStart : `${curY}-${pad(curM + 1)}-01`;
      const lastDay = new Date(Date.UTC(curY, curM + 1, 0)).getUTCDate();
      const isLast = curY === endY && curM === endM;
      const pEnd = isLast ? effectiveEnd : `${curY}-${pad(curM + 1)}-${pad(lastDay)}`;
      const targetDay = Math.min(Math.max(1, dueDay), lastDay);
      let due = `${curY}-${pad(curM + 1)}-${pad(targetDay)}`;
      if (due < pStart) due = pStart;
      if (due > pEnd) due = pEnd;

      rawItems.push({
        id: `inst-${studentId}-m-${seq}`,
        sequence: seq,
        name: `Instalment #${seq}: ${MONTH_NAMES[curM]} Monthly Fee`,
        period_start: pStart,
        period_end: pEnd,
        due_date: due,
        amount_minor: 0,
        status: seq === 1 ? 'scheduled' : 'pending',
      });

      seq++;
      curM++;
      if (curM > 11) {
        curM = 0;
        curY++;
      }
    }

    return {
      items: balanceEvenly(rawItems, total),
      startDate: effectiveStart,
      endDate: effectiveEnd,
    };
  }

  // 2. Term-Wise (5 cycles: 5 bi-monthly academic terms July-April)
  if (normalizedFreq === 'term_5') {
    const isStandardAcademicYear =
      effectiveStart === `${startYear}-07-01` && effectiveEnd === `${endYear}-04-30`;

    if (isStandardAcademicYear) {
      const terms = [
        { name: 'Term 1 (Jul - Aug)', start: `${startYear}-07-01`, end: `${startYear}-08-31`, due: `${startYear}-07-15` },
        { name: 'Term 2 (Sep - Oct)', start: `${startYear}-09-01`, end: `${startYear}-10-31`, due: `${startYear}-09-15` },
        { name: 'Term 3 (Nov - Dec)', start: `${startYear}-11-01`, end: `${startYear}-12-31`, due: `${startYear}-11-15` },
        {
          name: 'Term 4 (Jan - Feb)',
          start: `${endYear}-01-01`,
          end: `${endYear}-02-${new Date(Date.UTC(endYear, 2, 0)).getUTCDate()}`,
          due: `${endYear}-01-15`,
        },
        { name: 'Term 5 (Mar - Apr)', start: `${endYear}-03-01`, end: `${endYear}-04-30`, due: `${endYear}-03-15` },
      ];

      const rawItems: LinkedInstallment[] = terms.map((t, idx) => ({
        id: `inst-${studentId}-t5-${idx + 1}`,
        sequence: idx + 1,
        name: `Instalment #${idx + 1}: ${t.name}`,
        period_start: t.start,
        period_end: t.end,
        due_date: t.due,
        amount_minor: 0,
        status: (idx === 0 ? 'scheduled' : 'pending') as 'scheduled' | 'pending',
      }));

      return {
        items: balanceEvenly(rawItems, total),
        startDate: effectiveStart,
        endDate: effectiveEnd,
      };
    }

    // Dynamic 2-month steps up to 5 terms or date end
    const startD = new Date(effectiveStart);
    const endD = new Date(effectiveEnd);
    let curY = startD.getFullYear();
    let curM = startD.getMonth();
    const endY = endD.getFullYear();
    const endM = endD.getMonth();

    const rawItems: LinkedInstallment[] = [];
    let seq = 1;

    while (curY < endY || (curY === endY && curM <= endM)) {
      const pStart = seq === 1 ? effectiveStart : `${curY}-${pad(curM + 1)}-01`;
      let nextM = curM + 1;
      let nextY = curY;
      if (nextM > 11) {
        nextM = 0;
        nextY++;
      }

      const isLast = nextY > endY || (nextY === endY && nextM >= endM);
      const endMonthYear = isLast ? endY : nextY;
      const endMonthVal = isLast ? endM : nextM;
      const lastDay = new Date(Date.UTC(endMonthYear, endMonthVal + 1, 0)).getUTCDate();
      const pEnd = isLast ? effectiveEnd : `${endMonthYear}-${pad(endMonthVal + 1)}-${pad(lastDay)}`;

      const startMonthName = MONTH_NAMES[curM]?.slice(0, 3);
      const endMonthName = MONTH_NAMES[endMonthVal]?.slice(0, 3);
      let due = `${curY}-${pad(curM + 1)}-15`;
      if (due < pStart) due = pStart;
      if (due > pEnd) due = pEnd;

      rawItems.push({
        id: `inst-${studentId}-t5-${seq}`,
        sequence: seq,
        name: `Instalment #${seq}: Term ${seq} (${startMonthName} - ${endMonthName})`,
        period_start: pStart,
        period_end: pEnd,
        due_date: due,
        amount_minor: 0,
        status: seq === 1 ? 'scheduled' : 'pending',
      });

      seq++;
      curM = nextM + 1;
      curY = nextY;
      if (curM > 11) {
        curM = 0;
        curY++;
      }
      if (isLast) break;
    }

    return {
      items: balanceEvenly(rawItems, total),
      startDate: effectiveStart,
      endDate: effectiveEnd,
    };
  }

  // 3. Bi-Monthly (6 cycles: July - June)
  if (normalizedFreq === 'bi-monthly') {
    const isStandardAcademicYear =
      effectiveStart === `${startYear}-07-01` && effectiveEnd === `${endYear}-06-30`;

    if (isStandardAcademicYear) {
      const cycles = [
        { name: 'Jul - Aug', start: `${startYear}-07-01`, end: `${startYear}-08-31`, due: `${startYear}-07-15` },
        { name: 'Sep - Oct', start: `${startYear}-09-01`, end: `${startYear}-10-31`, due: `${startYear}-09-15` },
        { name: 'Nov - Dec', start: `${startYear}-11-01`, end: `${startYear}-12-31`, due: `${startYear}-11-15` },
        {
          name: 'Jan - Feb',
          start: `${endYear}-01-01`,
          end: `${endYear}-02-${new Date(Date.UTC(endYear, 2, 0)).getUTCDate()}`,
          due: `${endYear}-01-15`,
        },
        { name: 'Mar - Apr', start: `${endYear}-03-01`, end: `${endYear}-04-30`, due: `${endYear}-03-15` },
        { name: 'May - Jun', start: `${endYear}-05-01`, end: `${endYear}-06-30`, due: `${endYear}-05-15` },
      ];

      const rawItems: LinkedInstallment[] = cycles.map((c, idx) => ({
        id: `inst-${studentId}-bm-${idx + 1}`,
        sequence: idx + 1,
        name: `Instalment #${idx + 1}: ${c.name} Fee`,
        period_start: c.start,
        period_end: c.end,
        due_date: c.due,
        amount_minor: 0,
        status: (idx === 0 ? 'scheduled' : 'pending') as 'scheduled' | 'pending',
      }));

      return {
        items: balanceEvenly(rawItems, total),
        startDate: effectiveStart,
        endDate: effectiveEnd,
      };
    }

    // Dynamic 2-month steps
    const startD = new Date(effectiveStart);
    const endD = new Date(effectiveEnd);
    let curY = startD.getFullYear();
    let curM = startD.getMonth();
    const endY = endD.getFullYear();
    const endM = endD.getMonth();

    const rawItems: LinkedInstallment[] = [];
    let seq = 1;

    while (curY < endY || (curY === endY && curM <= endM)) {
      const pStart = seq === 1 ? effectiveStart : `${curY}-${pad(curM + 1)}-01`;
      let nextM = curM + 1;
      let nextY = curY;
      if (nextM > 11) {
        nextM = 0;
        nextY++;
      }

      const isLast = nextY > endY || (nextY === endY && nextM >= endM);
      const endMonthYear = isLast ? endY : nextY;
      const endMonthVal = isLast ? endM : nextM;
      const lastDay = new Date(Date.UTC(endMonthYear, endMonthVal + 1, 0)).getUTCDate();
      const pEnd = isLast ? effectiveEnd : `${endMonthYear}-${pad(endMonthVal + 1)}-${pad(lastDay)}`;

      const startMonthName = MONTH_NAMES[curM]?.slice(0, 3);
      const endMonthName = MONTH_NAMES[endMonthVal]?.slice(0, 3);
      let due = `${curY}-${pad(curM + 1)}-15`;
      if (due < pStart) due = pStart;
      if (due > pEnd) due = pEnd;

      rawItems.push({
        id: `inst-${studentId}-bm-${seq}`,
        sequence: seq,
        name: `Instalment #${seq}: ${startMonthName} - ${endMonthName} Fee`,
        period_start: pStart,
        period_end: pEnd,
        due_date: due,
        amount_minor: 0,
        status: seq === 1 ? 'scheduled' : 'pending',
      });

      seq++;
      curM = nextM + 1;
      curY = nextY;
      if (curM > 11) {
        curM = 0;
        curY++;
      }
      if (isLast) break;
    }

    return {
      items: balanceEvenly(rawItems, total),
      startDate: effectiveStart,
      endDate: effectiveEnd,
    };
  }

  // 4. As Presented / Milestone-Based (3 cycles)
  if (normalizedFreq === 'as_presented') {
    const milestones = [
      { name: 'Milestone 1: Admission & Term Fee', start: `${startYear}-07-01`, end: `${startYear}-10-31`, due: `${startYear}-07-15` },
      { name: 'Milestone 2: Mid-Session Fee', start: `${startYear}-11-01`, end: `${endYear}-01-31`, due: `${startYear}-11-15` },
      { name: 'Milestone 3: Year-End Assessment Fee', start: `${endYear}-02-01`, end: `${endYear}-04-30`, due: `${endYear}-02-15` },
    ];

    const rawItems: LinkedInstallment[] = milestones.map((m, idx) => ({
      id: `inst-${studentId}-ap-${idx + 1}`,
      sequence: idx + 1,
      name: `Instalment #${idx + 1}: ${m.name}`,
      period_start: m.start,
      period_end: m.end,
      due_date: m.due,
      amount_minor: 0,
      status: (idx === 0 ? 'scheduled' : 'pending') as 'scheduled' | 'pending',
    }));

    return {
      items: balanceEvenly(rawItems, total),
      startDate: effectiveStart,
      endDate: effectiveEnd,
    };
  }

  // 5. Default: Quarterly (4 cycles: Q1, Q2, Q3, Q4)
  const isStandardAcademicYear =
    effectiveStart === `${startYear}-07-01` && effectiveEnd === `${endYear}-06-30`;

  if (isStandardAcademicYear) {
    const quarters = [
      { name: 'Q1 Tuition & Term Fee', start: `${startYear}-07-01`, end: `${startYear}-09-30`, due: `${startYear}-07-10` },
      { name: 'Q2 Tuition & Term Fee', start: `${startYear}-10-01`, end: `${startYear}-12-31`, due: `${startYear}-10-25` },
      { name: 'Q3 Tuition & Term Fee', start: `${endYear}-01-01`, end: `${endYear}-03-31`, due: `${endYear}-01-15` },
      { name: 'Q4 Final Assessment Fee', start: `${endYear}-04-01`, end: `${endYear}-06-30`, due: `${endYear}-04-15` },
    ];

    const rawItems: LinkedInstallment[] = quarters.map((q, idx) => ({
      id: `inst-${studentId}-q-${idx + 1}`,
      sequence: idx + 1,
      name: `Instalment #${idx + 1}: ${q.name}`,
      period_start: q.start,
      period_end: q.end,
      due_date: q.due,
      amount_minor: 0,
      status: (idx === 0 ? 'scheduled' : 'pending') as 'scheduled' | 'pending',
    }));

    return {
      items: balanceEvenly(rawItems, total),
      startDate: effectiveStart,
      endDate: effectiveEnd,
    };
  }

  // Dynamic 3-month quarterly steps
  const startD = new Date(effectiveStart);
  const endD = new Date(effectiveEnd);
  let curY = startD.getFullYear();
  let curM = startD.getMonth();
  const endY = endD.getFullYear();
  const endM = endD.getMonth();

  const rawItems: LinkedInstallment[] = [];
  let seq = 1;

  while (curY < endY || (curY === endY && curM <= endM)) {
    const pStart = seq === 1 ? effectiveStart : `${curY}-${pad(curM + 1)}-01`;
    let endCycleM = curM + 2;
    let endCycleY = curY;
    if (endCycleM > 11) {
      endCycleM -= 12;
      endCycleY++;
    }

    const isLast = endCycleY > endY || (endCycleY === endY && endCycleM >= endM);
    const endMonthYear = isLast ? endY : endCycleY;
    const endMonthVal = isLast ? endM : endCycleM;
    const lastDay = new Date(Date.UTC(endMonthYear, endMonthVal + 1, 0)).getUTCDate();
    const pEnd = isLast ? effectiveEnd : `${endMonthYear}-${pad(endMonthVal + 1)}-${pad(lastDay)}`;

    let due = `${curY}-${pad(curM + 1)}-10`;
    if (due < pStart) due = pStart;
    if (due > pEnd) due = pEnd;

    rawItems.push({
      id: `inst-${studentId}-q-${seq}`,
      sequence: seq,
      name: `Instalment #${seq}: Quarter ${seq} Fee`,
      period_start: pStart,
      period_end: pEnd,
      due_date: due,
      amount_minor: 0,
      status: seq === 1 ? 'scheduled' : 'pending',
    });

    seq++;
    curM = endCycleM + 1;
    curY = endCycleY;
    if (curM > 11) {
      curM -= 12;
      curY++;
    }
    if (isLast) break;
  }

  return {
    items: balanceEvenly(rawItems, total),
    startDate: effectiveStart,
    endDate: effectiveEnd,
  };
}
