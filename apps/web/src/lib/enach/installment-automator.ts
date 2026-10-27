/**
 * DODO.FINANCE — Scheduled Fee Instalment Automation Engine
 * Automates instalment generation according to school fee collection rules,
 * debit frequencies (4, 5, 6, 10 cycles), date boundaries, and currency precision.
 */

import type { LinkedInstallment } from './types';

export type FrequencyType =
  | 'quarterly'
  | 'term_5'
  | 'bi-monthly'
  | 'monthly'
  | 'as_presented';

export interface GenerateScheduleParams {
  frequency: FrequencyType | string;
  totalMinor: number;
  startDate?: string;
  endDate?: string;
  studentId?: string;
  dueDay?: number;
  customInstallmentCount?: number;
  installmentCount?: number;
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
 * Returns the cycle count for a given frequency option:
 * - quarterly / 4: 4 cycles (12 months coverage)
 * - term_5 / 5: 5 cycles (10 months coverage)
 * - bi-monthly / 6: 6 cycles (12 months coverage)
 * - monthly / 10: 10 cycles (10 months coverage)
 * - as_presented / flexible: custom count (default 3)
 */
export function getFrequencyCycleCount(
  freq: string,
  startDate?: string,
  endDate?: string,
): number {
  const norm = String(freq || '').toLowerCase().trim();
  if (norm === 'monthly' || norm === '10') return 10;
  if (norm === 'term_5' || norm === '5') return 5;
  if (norm === 'bi-monthly' || norm === '6') return 6;
  if (norm === 'quarterly' || norm === '4') return 4;
  if (norm === 'as_presented' || norm === '3') return 3;

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const months = Math.max(
        1,
        (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1,
      );
      if (norm.includes('month') && !norm.includes('bi')) return Math.min(60, months);
      if (norm.includes('quarter')) return Math.max(1, Math.ceil(months / 3));
      if (norm.includes('term')) return Math.max(1, Math.ceil(months / 2));
    }
  }
  return 4;
}

export function getFrequencyCycleMonths(freq: string): number {
  const norm = String(freq || '').toLowerCase().trim();
  if (norm === 'monthly' || norm === '10') return 1;
  if (norm === 'term_5' || norm === '5') return 2;
  if (norm === 'bi-monthly' || norm === '6') return 2;
  if (norm === 'quarterly' || norm === '4') return 3;
  return 3;
}

/**
 * Calculates sequential, non-overlapping coverage windows (period_start, period_end).
 * Ensures zero gaps, zero overlaps, and handles month-end dates, leap years, and year rollovers.
 */
export function calculateCoverageWindow(
  startDateStr: string,
  cycleIndex: number,
  cycleMonths: number,
): { period_start: string; period_end: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const [sY = 2026, sM = 7, sD = 1] = startDateStr.split('-').map(Number);

  if (sD === 1) {
    // Standard calendar month-aligned cycle
    const startMonthOffset = (sM - 1) + cycleIndex * cycleMonths;
    const startY = sY + Math.floor(startMonthOffset / 12);
    const startM = (startMonthOffset % 12) + 1;
    const periodStart = `${startY}-${pad(startM)}-01`;

    const endMonthOffset = startMonthOffset + cycleMonths - 1;
    const endY = sY + Math.floor(endMonthOffset / 12);
    const endM = (endMonthOffset % 12) + 1;
    const lastDay = new Date(Date.UTC(endY, endM, 0)).getUTCDate();
    const periodEnd = `${endY}-${pad(endM)}-${pad(lastDay)}`;

    return { period_start: periodStart, period_end: periodEnd };
  }

  // Mid-month custom start day: continuous sequential coverage windows without gaps or overlaps
  const startMonthOffset = (sM - 1) + cycleIndex * cycleMonths;
  const startY = sY + Math.floor(startMonthOffset / 12);
  const startM = (startMonthOffset % 12) + 1;
  const maxStartDay = new Date(Date.UTC(startY, startM, 0)).getUTCDate();
  const clampedStartDay = Math.min(sD, maxStartDay);
  const periodStart = `${startY}-${pad(startM)}-${pad(clampedStartDay)}`;

  const nextStartMonthOffset = startMonthOffset + cycleMonths;
  const nextY = sY + Math.floor(nextStartMonthOffset / 12);
  const nextM = (nextStartMonthOffset % 12) + 1;
  const maxNextDay = new Date(Date.UTC(nextY, nextM, 0)).getUTCDate();
  const nextStartDay = Math.min(sD, maxNextDay);

  // Previous day before next start date
  const nextStartDate = new Date(Date.UTC(nextY, nextM - 1, nextStartDay));
  nextStartDate.setUTCDate(nextStartDate.getUTCDate() - 1);
  const periodEnd = nextStartDate.toISOString().slice(0, 10);

  return { period_start: periodStart, period_end: periodEnd };
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

/**
 * Calculates the overall mandate validity end date based on start date, frequency, and cycle count
 */
export function calculateMandateEndDate(
  startDate: string,
  frequency: FrequencyType | string,
  customCount?: number,
): string {
  const norm = String(frequency || '').toLowerCase().trim();
  let count = 4;
  let cycleMonths = 3;

  if (norm === 'quarterly' || norm === '4') {
    count = 4;
    cycleMonths = 3;
  } else if (norm === 'term_5' || norm === '5') {
    count = 5;
    cycleMonths = 2;
  } else if (norm === 'bi-monthly' || norm === '6') {
    count = 6;
    cycleMonths = 2;
  } else if (norm === 'monthly' || norm === '10') {
    count = 10;
    cycleMonths = 1;
  } else if (norm === 'as_presented') {
    count = customCount || 3;
    cycleMonths = Math.max(1, Math.floor(12 / count));
  }

  const lastWindow = calculateCoverageWindow(startDate || '2026-07-01', count - 1, cycleMonths);
  return lastWindow.period_end;
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
 * Recalculates only the coverage dates and due dates of existing instalments,
 * preserving manual edits to instalment names and amounts.
 */
export function recalculateScheduleDates(
  installments: LinkedInstallment[],
  newStartDate: string,
  frequency: FrequencyType | string,
  dueDay: number = 10,
): { items: LinkedInstallment[]; startDate: string; endDate: string } {
  if (!installments || installments.length === 0) {
    return { items: [], startDate: newStartDate, endDate: newStartDate };
  }

  const cycleMonths = getFrequencyCycleMonths(frequency);

  const updated = installments.map((inst, idx) => {
    const { period_start, period_end } = calculateCoverageWindow(newStartDate, idx, cycleMonths);
    const due = calculateInstallmentDueDate(period_start, period_end, dueDay);
    return {
      ...inst,
      sequence: idx + 1,
      period_start,
      period_end,
      due_date: due,
    };
  });

  const overallEndDate = updated[updated.length - 1]?.period_end || newStartDate;

  return {
    items: updated,
    startDate: newStartDate,
    endDate: overallEndDate,
  };
}

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
    studentId = 'stu',
    dueDay,
    customInstallmentCount,
    installmentCount,
  } = params;

  const total = totalMinor > 0 ? totalMinor : 12000000;
  const effectiveStart = customStart || '2026-07-01';
  const norm = String(frequency || '').toLowerCase().trim();

  let count = 4;
  let cycleMonths = 3;
  let defaultDue = 10;
  let namePrefix = 'Quarter';

  if (norm === 'quarterly' || norm === '4') {
    count = 4;
    cycleMonths = 3;
    defaultDue = 10;
    namePrefix = 'Quarter';
  } else if (norm === 'term_5' || norm === '5') {
    count = 5;
    cycleMonths = 2;
    defaultDue = 15;
    namePrefix = 'Term';
  } else if (norm === 'bi-monthly' || norm === '6') {
    count = 6;
    cycleMonths = 2;
    defaultDue = 15;
    namePrefix = 'Bi-Monthly Cycle';
  } else if (norm === 'monthly' || norm === '10') {
    count = 10;
    cycleMonths = 1;
    defaultDue = 10;
    namePrefix = 'Month';
  } else if (norm === 'as_presented') {
    count = installmentCount || customInstallmentCount || 3;
    cycleMonths = Math.max(1, Math.floor(12 / count));
    defaultDue = 15;
    namePrefix = 'Instalment';
  }

  const effectiveDueDay = dueDay || defaultDue;
  const rawItems: LinkedInstallment[] = [];

  for (let i = 0; i < count; i++) {
    const seq = i + 1;
    const { period_start, period_end } = calculateCoverageWindow(effectiveStart, i, cycleMonths);
    const due = calculateInstallmentDueDate(period_start, period_end, effectiveDueDay);

    let instName = `Instalment #${seq}: ${namePrefix} ${seq}`;
    if (norm === 'quarterly' || norm === '4') {
      if (seq === 1) instName = `Instalment #1: Q1 Tuition & Term Fee`;
      else if (seq === 2) instName = `Instalment #2: Q2 Tuition & Term Fee`;
      else if (seq === 3) instName = `Instalment #3: Q3 Tuition & Term Fee`;
      else if (seq === 4) instName = `Instalment #4: Q4 Final Assessment Fee`;
    } else if (norm === 'monthly' || norm === '10') {
      const parts = period_start.split('-').map(Number);
      const mIdx = ((parts[1] || 1) - 1 + 12) % 12;
      instName = `Instalment #${seq}: ${MONTH_NAMES[mIdx]} Monthly Fee`;
    } else if (norm === 'term_5' || norm === '5') {
      instName = `Instalment #${seq}: Term ${seq} Fee`;
    } else if (norm === 'bi-monthly' || norm === '6') {
      instName = `Instalment #${seq}: Bi-Monthly Cycle ${seq} Fee`;
    }

    rawItems.push({
      id: `inst-${studentId}-auto-${seq}`,
      sequence: seq,
      name: instName,
      period_start,
      period_end,
      due_date: due,
      amount_minor: 0,
      status: seq === 1 ? 'scheduled' : 'pending',
    });
  }

  const balanced = balanceEvenly(rawItems, total);
  const overallEndDate = balanced[balanced.length - 1]?.period_end || effectiveStart;

  return {
    items: balanced,
    startDate: effectiveStart,
    endDate: overallEndDate,
  };
}
