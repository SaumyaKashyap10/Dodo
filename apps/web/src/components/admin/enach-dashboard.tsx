'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useAdminApi } from './context';
import { formatMoney } from './finance-dashboard';
import type {
  SandboxMandate,
  SandboxDebitAttempt,
  SandboxReconciliationRecord,
  SandboxNotification,
  SandboxAuditEvent,
  StudentEnachMapping,
  LinkedInstallment,
  MandateStatus,
  DebitStatus,
  AuthMethod,
} from '@/lib/enach/types';
import { CURRENT_PROVIDER_METRICS, type ProviderCapabilityMatrix } from '@/lib/enach/provider';
import {
  balanceEvenly,
  generateAutomatedSchedule,
  recalculateScheduleDates,
  getFrequencyCycleMonths,
  calculateCoverageWindow,
  calculateInstallmentDueDate,
  type FrequencyType,
} from '@/lib/enach/installment-automator';

type Props = {
  openFeeOperations?: (target: 'payer' | 'schedule' | 'reconciliation') => void;
  initialView?: string;
  onViewChange?: (view: any) => void;
  page?: string;
};

type EnachTab =
  | 'overview'
  | 'setup'
  | 'mandates'
  | 'students'
  | 'debits'
  | 'failures'
  | 'recovery'
  | 'reconciliation'
  | 'notifications'
  | 'reports'
  | 'audit';

const TAB_CONFIG: Array<{ id: EnachTab; label: string; icon: string; badge?: string }> = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'setup', label: 'One-Click Setup', icon: '⚡', badge: 'Primary' },
  { id: 'mandates', label: 'Mandates', icon: '📜' },
  { id: 'students', label: 'Students & Payers', icon: '🎓' },
  { id: 'debits', label: 'Automatic Debits', icon: '🔄' },
  { id: 'failures', label: 'Failed Payments', icon: '⚠️' },
  { id: 'recovery', label: 'Recovery & Retries', icon: '🛡️' },
  { id: 'reconciliation', label: 'Reconciliation', icon: '⚖️' },
  { id: 'notifications', label: 'Notifications', icon: '💬' },
  { id: 'reports', label: 'Reports', icon: '📑' },
  { id: 'audit', label: 'Audit & Compliance', icon: '🔒' },
];

export function EnachDashboard({ openFeeOperations, initialView = 'overview', onViewChange, page }: Props) {
  if (page === 'custom-fields') {
    return (
      <section className="enach-dashboard-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div id="enach-custom-fields" className="admin-panel">
          <h2>Custom fields</h2>
          <p>Configure custom fields for Auto UPI mandates.</p>
        </div>
      </section>
    );
  }

  if (page === 'reports') {
    return (
      <section className="enach-dashboard-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div id="enach-reports" className="admin-panel">
          <h2>Reports</h2>
          <p>Export Auto UPI collection reports.</p>
        </div>
      </section>
    );
  }

  if (page === 'debits') {
    return (
      <section className="enach-dashboard-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className="admin-panel">
          <h2>Automatic Debits & Scheduled AutoPay</h2>
          <p className="status-pill warn" style={{ margin: '8px 0' }}>Provider not connected</p>
          <p>Connect a provider to enable AutoPay automated recurring debits on live banking rails.</p>
        </div>
      </section>
    );
  }

  const { request, session } = useAdminApi();

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<EnachTab>(() => {
    if (page === 'overview') return 'overview';
    if (initialView === 'debits') return 'debits';
    if (initialView === 'setups' || initialView === 'setup') return 'setup';
    if (initialView === 'recovery') return 'recovery';
    if (initialView === 'reports') return 'reports';
    if (initialView === 'mandates') return 'mandates';
    return 'overview';
  });

  // Data States
  const [overview, setOverview] = useState<any>(null);
  const [mandates, setMandates] = useState<SandboxMandate[]>([]);
  const [studentMappings, setStudentMappings] = useState<StudentEnachMapping[]>([]);
  const [debits, setDebits] = useState<SandboxDebitAttempt[]>([]);
  const [failedDebits, setFailedDebits] = useState<SandboxDebitAttempt[]>([]);
  const [reconciliations, setReconciliations] = useState<SandboxReconciliationRecord[]>([]);
  const [notifications, setNotifications] = useState<SandboxNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<SandboxAuditEvent[]>([]);
  const [providerInfo, setProviderInfo] = useState<ProviderCapabilityMatrix>(CURRENT_PROVIDER_METRICS);

  // Loading & Feedback
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  // Filters
  const [mandateSearch, setMandateSearch] = useState('');
  const [mandateStatusFilter, setMandateStatusFilter] = useState('');
  const [debitSearch, setDebitSearch] = useState('');
  const [debitStatusFilter, setDebitStatusFilter] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [reportType, setReportType] = useState('active_mandates');
  const [reportData, setReportData] = useState<any>(null);

  // Modals & Action States
  const [selectedMandate, setSelectedMandate] = useState<SandboxMandate | null>(null);
  const [authModalMandate, setAuthModalMandate] = useState<SandboxMandate | null>(null);
  const [cancelModalMandate, setCancelModalMandate] = useState<SandboxMandate | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedDebit, setSelectedDebit] = useState<SandboxDebitAttempt | null>(null);
  const [retryModalDebit, setRetryModalDebit] = useState<SandboxDebitAttempt | null>(null);
  const [showDiagnosticsDrawer, setShowDiagnosticsDrawer] = useState(false);
  const [testNotificationModal, setTestNotificationModal] = useState(false);
  // Share Mandate Approval Link Modal State (WhatsApp, SMS, Email, Copy Link)
  const [shareModalData, setShareModalData] = useState<{
    isOpen: boolean;
    mandate: SandboxMandate;
    recipientType: 'student' | 'guardian';
    recipientName: string;
    recipientPhone: string;
    recipientEmail: string;
    approvalUrl: string;
    sentChannels: {
      whatsapp?: boolean;
      sms?: boolean;
      email?: boolean;
    };
  } | null>(null);

  // One-Click Setup Form State
  const [setupPaymentMethod, setSetupPaymentMethod] = useState<'upi_autopay' | 'enach'>('upi_autopay');
  const [setupAccountType, setSetupAccountType] = useState<'savings' | 'current'>('savings');
  const [mandateRailFilter, setMandateRailFilter] = useState<'all' | 'upi_autopay' | 'enach'>('all');
  const [debitRailFilter, setDebitRailFilter] = useState<'all' | 'upi_autopay' | 'enach'>('all');
  const [reconciliationRailFilter, setReconciliationRailFilter] = useState<'all' | 'upi_autopay' | 'enach'>('all');
  const [setupStudentId, setSetupStudentId] = useState('');
  const [setupPayerName, setSetupPayerName] = useState('');
  const [setupPayerPhone, setSetupPayerPhone] = useState('+91 98765 43210');
  const [setupPayerEmail, setSetupPayerEmail] = useState('');
  const [setupPayerVpa, setSetupPayerVpa] = useState('sharma.rajesh@okhdfcbank');
  const [setupPreferredUpiApp, setSetupPreferredUpiApp] = useState<'Google Pay' | 'PhonePe' | 'Paytm' | 'BHIM UPI' | 'Cred' | 'Any UPI App'>('Google Pay');
  const [setupBankName, setSetupBankName] = useState('HDFC Bank');
  const [setupAccountLast4, setSetupAccountLast4] = useState('4321');
  const [setupIfsc, setSetupIfsc] = useState('HDFC0001234');
  const [setupMaxAmountMinor, setSetupMaxAmountMinor] = useState(5000000);
  const [setupFrequency, setSetupFrequency] = useState<FrequencyType>('quarterly');
  const [setupStartDate, setSetupStartDate] = useState('2026-07-01');
  const [setupEndDate, setSetupEndDate] = useState('2027-06-30');
  const [setupAuthMethod, setSetupAuthMethod] = useState<AuthMethod>('UPI App Intent (Simulated)');
  const [setupInstallments, setSetupInstallments] = useState<LinkedInstallment[]>([]);
  const [hasCustomAmounts, setHasCustomAmounts] = useState(false);
  const [viewReceiptDebit, setViewReceiptDebit] = useState<SandboxDebitAttempt | null>(null);

  const updateInstallment = (idx: number, patch: Partial<LinkedInstallment>) => {
    if ('amount_minor' in patch) {
      setHasCustomAmounts(true);
    }
    setSetupInstallments((prev) => {
      const updated = prev.map((inst, i) => (i === idx ? ({ ...inst, ...patch } as LinkedInstallment) : inst));
      if (idx === updated.length - 1 && patch.period_end) {
        setSetupEndDate(patch.period_end);
      }
      return updated;
    });
  };

  // Helper: Generates realistic scheduled instalments matching selected debit frequency
  const generateSchedule = (
    freq: FrequencyType,
    totalMinor: number,
    studentId: string = 'stu',
    startDate?: string,
  ): { items: LinkedInstallment[]; startDate: string; endDate: string } => {
    return generateAutomatedSchedule({
      frequency: freq,
      totalMinor,
      studentId,
      startDate: startDate || setupStartDate,
    });
  };

  // Handles dynamic frequency dropdown selection (Quarterly: 4, 5 cycles: 5, 6 cycles: 6, 10 cycles: 10, Flexible)
  const handleFrequencyChange = (newFreq: FrequencyType) => {
    setSetupFrequency(newFreq);
    setHasCustomAmounts(false);
    const student = studentMappings.find((s) => s.student_id === setupStudentId);
    const assignedFee = student ? (student.total_fee_minor || student.remaining_minor || 12000000) : 12000000;
    const { items, startDate, endDate } = generateAutomatedSchedule({
      frequency: newFreq,
      totalMinor: assignedFee,
      startDate: setupStartDate,
      studentId: setupStudentId || 'stu',
    });
    setSetupInstallments(items);
    setSetupStartDate(startDate);
    setSetupEndDate(endDate);
  };

  // Handles start date change and automatically recalculates all dependent coverage dates and mandate end date
  const handleStartDateChange = (newStart: string) => {
    setSetupStartDate(newStart);
    if (!newStart) return;
    const student = studentMappings.find((s) => s.student_id === setupStudentId);
    const assignedFee = student ? (student.total_fee_minor || student.remaining_minor || 12000000) : 12000000;

    if (hasCustomAmounts || setupFrequency === 'as_presented') {
      const { items, endDate } = recalculateScheduleDates(
        setupInstallments,
        newStart,
        setupFrequency,
      );
      setSetupInstallments(items);
      setSetupEndDate(endDate);
    } else {
      const { items, endDate } = generateAutomatedSchedule({
        frequency: setupFrequency,
        totalMinor: assignedFee,
        startDate: newStart,
        studentId: setupStudentId || 'stu',
      });
      setSetupInstallments(items);
      setSetupEndDate(endDate);
    }
  };

  // Handles end date change
  const handleEndDateChange = (newEnd: string) => {
    setSetupEndDate(newEnd);
  };

  // Increases instalments by adding a new scheduled period
  const handleAddInstallment = () => {
    const student = studentMappings.find((s) => s.student_id === setupStudentId);
    const assignedFee = student ? (student.total_fee_minor || student.remaining_minor || 12000000) : 12000000;
    const nextSeq = setupInstallments.length + 1;
    const cycleMonths = getFrequencyCycleMonths(setupFrequency);

    let nextStart = '2026-07-01';
    let nextEnd = '2026-09-30';
    let nextDue = '2026-07-10';

    if (setupInstallments.length > 0) {
      const last = setupInstallments[setupInstallments.length - 1];
      if (last && last.period_end) {
        const [lY = 2026, lM = 7, lD = 1] = last.period_end.split('-').map(Number);
        const nextStartDateObj = new Date(Date.UTC(lY, lM - 1, lD + 1));
        nextStart = nextStartDateObj.toISOString().slice(0, 10);
        const { period_end: nextCalculatedEnd } = calculateCoverageWindow(nextStart, 0, cycleMonths);
        nextEnd = nextCalculatedEnd;
        nextDue = calculateInstallmentDueDate(nextStart, nextEnd, 10);
      }
    }

    const currentTotal = setupInstallments.reduce((sum, inst) => sum + (inst.amount_minor || 0), 0);
    const amountMinor = currentTotal < assignedFee ? assignedFee - currentTotal : Math.round(assignedFee / nextSeq);

    const newInst: LinkedInstallment = {
      id: `inst-${setupStudentId || 'stu'}-custom-${Date.now()}`,
      sequence: nextSeq,
      name: `Instalment #${nextSeq}: Extended Term Fee`,
      period_start: nextStart,
      period_end: nextEnd,
      due_date: nextDue,
      amount_minor: amountMinor,
      status: 'pending',
    };

    const updated = [...setupInstallments, newInst];
    setSetupInstallments(updated);
    setSetupEndDate(nextEnd);
  };

  // Decreases instalments by removing a specific row
  const handleRemoveInstallment = (indexToRemove: number) => {
    if (setupInstallments.length <= 1) {
      alert('At least one instalment must be scheduled.');
      return;
    }
    const updated = setupInstallments
      .filter((_, idx) => idx !== indexToRemove)
      .map((inst, idx) => ({
        ...inst,
        sequence: idx + 1,
      }));
    setSetupInstallments(updated);
    const lastInst = updated[updated.length - 1];
    if (lastInst && lastInst.period_end) {
      setSetupEndDate(lastInst.period_end);
    }
  };

  // Splits student remaining balance evenly across current instalments with exact minor currency rounding
  const handleBalanceEvenly = () => {
    if (setupInstallments.length === 0) return;
    const student = studentMappings.find((s) => s.student_id === setupStudentId);
    const currentSum = setupInstallments.reduce((sum, inst) => sum + (inst.amount_minor || 0), 0);
    const assignedFee =
      student && (student.total_fee_minor || student.remaining_minor)
        ? (student.total_fee_minor || student.remaining_minor)
        : currentSum > 0
          ? currentSum
          : 12000000;
    const balanced = balanceEvenly(setupInstallments, assignedFee);
    setSetupInstallments(balanced);
    setHasCustomAmounts(false);
    showToast(`✓ Total fee of ₹${(assignedFee / 100).toLocaleString('en-IN')} balanced evenly across ${setupInstallments.length} instalments.`);
  };

  // Auto-populates setup form and linked instalments when a student is selected
  useEffect(() => {
    if (!setupStudentId) {
      setSetupInstallments([]);
      return;
    }
    const student = studentMappings.find((s) => s.student_id === setupStudentId);
    if (student) {
      setSetupPayerName(student.payer_name || 'Primary Guardian');
      setSetupPayerPhone(student.payer_phone || '+91 98765 00000');
      setSetupPayerEmail(student.payer_email || 'parent@example.com');
      if (student.payer_vpa) {
        setSetupPayerVpa(student.payer_vpa);
      }
      if (student.bank_name) {
        setSetupBankName(student.bank_name);
      }
      if (student.masked_account) {
        setSetupAccountLast4(student.masked_account.replace(/\D/g, '') || '4321');
      }
      if (student.ifsc_code) {
        setSetupIfsc(student.ifsc_code);
      }
      const remaining = student.remaining_minor || student.total_fee_minor || 12000000;
      if (student.max_amount_minor) {
        setSetupMaxAmountMinor(student.max_amount_minor);
      }

      if (Array.isArray(student.installments) && student.installments.length > 0) {
        setSetupInstallments(student.installments);
        if (student.installments[0]?.period_start) {
          setSetupStartDate(student.installments[0].period_start);
        }
        const last = student.installments[student.installments.length - 1];
        if (last?.period_end) {
          setSetupEndDate(last.period_end);
        }
      } else {
        const initialFreq: FrequencyType = student.fee_plan?.toLowerCase().includes('monthly')
          ? (student.fee_plan.toLowerCase().includes('bi-monthly') ? 'bi-monthly' : 'monthly')
          : student.fee_plan?.toLowerCase().includes('term')
            ? 'term_5'
            : 'quarterly';
        setSetupFrequency(initialFreq);
        const { items, startDate, endDate } = generateSchedule(initialFreq, remaining, student.student_id);
        setSetupInstallments(items);
        setSetupStartDate(startDate);
        setSetupEndDate(endDate);
      }
    }
  }, [setupStudentId, studentMappings]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 5000);
  };

  // -------------------------------------------------------------
  // Data Loader
  // -------------------------------------------------------------
  useEffect(() => {
    let active = true;
    setLoading(true);

    async function loadAll() {
      try {
        const [
          ovData,
          mandatesData,
          studentsData,
          debitsData,
          reconcileData,
          notifsData,
          auditData,
          provData,
        ] = await Promise.all([
          request<any>('admin/enach/overview'),
          request<SandboxMandate[]>('admin/fees/mandates'),
          request<StudentEnachMapping[]>('admin/enach/student-mapping'),
          request<SandboxDebitAttempt[]>('admin/fees/autopay-attempts'),
          request<SandboxReconciliationRecord[]>('admin/enach/reconciliation'),
          request<SandboxNotification[]>('admin/enach/notifications'),
          request<SandboxAuditEvent[]>('admin/enach/audit'),
          request<ProviderCapabilityMatrix>('provider/enach/diagnostics'),
        ]);

        if (active) {
          setOverview(ovData);
          setMandates(mandatesData || []);
          setStudentMappings(studentsData || []);
          setDebits(debitsData || []);
          setFailedDebits((debitsData || []).filter((d) => d.status === 'failed'));
          setReconciliations(reconcileData || []);
          setNotifications(notifsData || []);
          setAuditLogs(auditData || []);
          if (provData) setProviderInfo(provData);
          setLoading(false);
        }
      } catch (err: any) {
        if (active) {
          showToast('Some sandbox records could not load: ' + (err.message || 'Error'));
          setLoading(false);
        }
      }
    }

    void loadAll();
    return () => {
      active = false;
    };
  }, [session.tenant.id, refreshCount]);

  // Keep studentMappings fresh whenever switching to Setup or Students tabs
  useEffect(() => {
    if (activeTab === 'setup' || activeTab === 'students') {
      let active = true;
      request<StudentEnachMapping[]>('admin/enach/student-mapping')
        .then((data) => {
          if (active && Array.isArray(data)) setStudentMappings(data);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }
  }, [activeTab]);

  // Load report data when report tab or report type changes
  useEffect(() => {
    if (activeTab !== 'reports') return;
    let active = true;
    request<any>(`admin/enach/reports?type=${reportType}`)
      .then((res) => {
        if (active) setReportData(res);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [activeTab, reportType, refreshCount]);

  // -------------------------------------------------------------
  // Workflow Handlers
  // -------------------------------------------------------------

  // 1. One-Click Mandate Creation
  const handleCreateMandate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupStudentId) {
      alert('Please select an enrolled student.');
      return;
    }
    const isUpi = setupPaymentMethod === 'upi_autopay';
    if (!setupMaxAmountMinor || setupMaxAmountMinor <= 0) {
      alert('Please enter a valid Maximum Mandate Debit Cap greater than ₹0.');
      return;
    }
    if (isUpi && setupMaxAmountMinor > 10000000) {
      alert('NPCI UPI AutoPay mandate limit cannot exceed ₹1,00,000 per recurring debit.');
      return;
    }
    const exceedingInst = setupInstallments.find((inst) => inst.amount_minor > setupMaxAmountMinor);
    if (exceedingInst) {
      alert(
        `Scheduled instalment "${exceedingInst.name}" (${formatMoney(exceedingInst.amount_minor)}) exceeds the maximum mandate debit cap (${formatMoney(setupMaxAmountMinor)}). Please increase the maximum debit cap in Step 3 or reduce/balance instalment amounts before proceeding.`
      );
      return;
    }
    if (isUpi) {
      if (!setupPayerVpa || !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(setupPayerVpa.trim())) {
        alert('Please enter a valid UPI ID / VPA (e.g. parent@okhdfcbank).');
        return;
      }
    } else {
      if (!setupBankName) {
        alert('Please select the destination bank.');
        return;
      }
      if (!setupAccountLast4 || setupAccountLast4.trim().length < 3) {
        alert('Please enter the bank account number.');
        return;
      }
      if (!setupIfsc || setupIfsc.trim().length < 4) {
        alert('Please enter the bank IFSC code.');
        return;
      }
    }
    setBusy(true);
    try {
      const selectedStudent = studentMappings.find((s) => s.student_id === setupStudentId);
      const res = await request<{ ok: boolean; mandate: SandboxMandate; error?: string }>(
        'admin/fees/mandates',
        'POST',
        {
          student_id: setupStudentId,
          student_name: selectedStudent?.student_name,
          account_reference: selectedStudent?.student_reference,
          payer_name: setupPayerName,
          payer_phone: setupPayerPhone,
          payer_email: setupPayerEmail,
          payment_method: setupPaymentMethod,
          rail: isUpi ? 'UPI AutoPay (Sandbox)' : 'eNACH (Sandbox)',
          payer_vpa: isUpi ? setupPayerVpa.trim() : undefined,
          preferred_upi_app: isUpi ? setupPreferredUpiApp : undefined,
          bank_name: isUpi ? 'UPI PSP Bank' : setupBankName,
          account_last4: isUpi ? undefined : setupAccountLast4,
          ifsc_code: isUpi ? undefined : setupIfsc.toUpperCase(),
          account_type: isUpi ? undefined : setupAccountType,
          fee_plan: selectedStudent?.fee_plan || 'Academic Standard Plan',
          max_amount_minor: setupMaxAmountMinor,
          frequency: setupFrequency,
          start_date: setupStartDate,
          end_date: setupEndDate,
          auth_mode: setupAuthMethod,
          installments: setupInstallments,
        },
      );

      if (res.ok && res.mandate) {
        setRefreshCount((n) => n + 1);
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
        const approvalUrl = `${baseUrl}/payer/demo-access-token-12345?mandate=${res.mandate.id}&ref=${encodeURIComponent(res.mandate.mandate_reference)}`;

        setShareModalData({
          isOpen: true,
          mandate: res.mandate,
          recipientType: 'student',
          recipientName: res.mandate.student_name || 'V Rakesh',
          recipientPhone: res.mandate.payer_phone || setupPayerPhone || '+91 98765 43210',
          recipientEmail: res.mandate.payer_email || setupPayerEmail || 'payer@example.com',
          approvalUrl,
          sentChannels: {},
        });
        const railLabel = isUpi ? 'UPI AutoPay' : 'eNACH';
        showToast(`✓ ${railLabel} Mandate ${res.mandate.mandate_reference} created! Share link with student for approval.`);
      }
    } catch (err: any) {
      alert(err.message || 'Could not create mandate.');
    } finally {
      setBusy(false);
    }
  };

  // 2. Simulate Authorization (Approve or Reject)
  const handleSimulateAuthorization = async (action: 'approve' | 'reject') => {
    if (!authModalMandate) return;
    setBusy(true);
    try {
      const res = await request<{ ok: boolean; message: string }>(
        `admin/fees/mandates/${authModalMandate.id}/authorize`,
        'POST',
        {
          action,
          method: authModalMandate.auth_mode,
          bank_name: authModalMandate.bank_name,
        },
      );
      if (res.ok) {
        showToast(
          action === 'approve'
            ? `✓ Mandate ${authModalMandate.mandate_reference} is now ACTIVE (Sandbox).`
            : `Mandate authorization declined by simulated payer.`,
        );
        setAuthModalMandate(null);
        setRefreshCount((n) => n + 1);
        setActiveTab('mandates');
      }
    } catch (err: any) {
      alert(err.message || 'Authorization simulation failed.');
    } finally {
      setBusy(false);
    }
  };

  // 3. Cancel Mandate
  const handleCancelMandate = async () => {
    if (!cancelModalMandate) return;
    setBusy(true);
    try {
      const res = await request<{ ok: boolean; message: string }>(
        `admin/fees/mandates/${cancelModalMandate.id}/cancel`,
        'POST',
        { reason: cancelReason || 'Staff initiated cancellation' },
      );
      if (res.ok) {
        showToast(`Mandate ${cancelModalMandate.mandate_reference} has been cancelled.`);
        setCancelModalMandate(null);
        setCancelReason('');
        setRefreshCount((n) => n + 1);
      }
    } catch (err: any) {
      alert(err.message || 'Could not cancel mandate.');
    } finally {
      setBusy(false);
    }
  };

  // 4. Run Scheduled Debits Batch Simulation
  const handleRunDebitSimulation = async (mode: 'auto' | 'force_fail' | 'force_success') => {
    setBusy(true);
    try {
      const res = await request<any>('admin/enach/debits/simulate', 'POST', {
        simulation_mode: mode,
      });
      if (res.ok) {
        showToast(`✓ Debit Batch Completed: ${res.succeeded} cleared, ${res.failed} simulated return.`);
        setRefreshCount((n) => n + 1);
      }
    } catch (err: any) {
      alert(err.message || 'Debit simulation failed.');
    } finally {
      setBusy(false);
    }
  };

  // 5. Retry a Failed Debit
  const handleExecuteRetry = async () => {
    if (!retryModalDebit) return;
    setBusy(true);
    try {
      const res = await request<any>(`admin/enach/debits/${retryModalDebit.id}/retry`, 'POST', {});
      if (res.ok) {
        showToast(`✓ Retry executed successfully! Recovered ${formatMoney(retryModalDebit.amount_minor)}.`);
        setRetryModalDebit(null);
        setRefreshCount((n) => n + 1);
      }
    } catch (err: any) {
      alert(err.message || 'Retry failed.');
    } finally {
      setBusy(false);
    }
  };

  // 6. Run Reconciliation Batch
  const handleRunReconciliation = async () => {
    setBusy(true);
    try {
      const res = await request<any>('admin/enach/reconciliation/run', 'POST', {});
      if (res.ok) {
        showToast(`✓ Sandbox Reconciliation Batch: ${res.matched} matched, ${res.discrepant} exceptions.`);
        setRefreshCount((n) => n + 1);
      }
    } catch (err: any) {
      alert(err.message || 'Reconciliation failed.');
    } finally {
      setBusy(false);
    }
  };

  // 7. Send Test Notification Preview
  const handleSendTestNotification = async (channel: string, eventType: string) => {
    setBusy(true);
    try {
      const res = await request<any>('admin/enach/notifications/test', 'POST', {
        channel,
        event_type: eventType,
        recipient_name: 'Simulated Parent (Test)',
        recipient_phone: '+91 98765 43210',
        title: 'Fee Collection Notification Preview',
        message: 'This is a sandbox test notification verifying recipient dispatch formatting.',
      });
      if (res.ok) {
        showToast(`✓ Test ${channel} notification dispatched to sandbox log.`);
        setTestNotificationModal(false);
        setRefreshCount((n) => n + 1);
      }
    } catch (err: any) {
      alert(err.message || 'Notification simulation failed.');
    } finally {
      setBusy(false);
    }
  };

  // CSV Export for Debits or Reports
  const exportCsv = (filename: string, headers: string[], rows: any[][]) => {
    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c ?? ''}"`).join(','))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Status Badge Helper
  const renderStatusBadge = (status: string) => {
    const normalized = (status || '').toLowerCase().replace(/_/g, ' ');
    let color = '#475569';
    let bg = '#f1f5f9';
    let border = '#cbd5e1';

    if (normalized === 'active' || normalized.includes('active') || normalized === 'succeeded' || normalized === 'matched') {
      color = '#0f766e';
      bg = '#f0fdfa';
      border = '#99f6e4';
    } else if (normalized.includes('pending') || normalized === 'queued' || normalized === 'processing') {
      color = '#b45309';
      bg = '#fffbeb';
      border = '#fde68a';
    } else if (normalized === 'failed' || normalized === 'rejected' || normalized === 'unmatched') {
      color = '#b91c1c';
      bg = '#fef2f2';
      border = '#fecaca';
    } else if (normalized.includes('investigation') || normalized === 'partially matched') {
      color = '#6d28d9';
      bg = '#f5f3ff';
      border = '#ddd6fe';
    } else if (normalized === 'cancelled' || normalized === 'expired') {
      color = '#64748b';
      bg = '#f8fafc';
      border = '#e2e8f0';
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 600,
          color,
          background: bg,
          border: `1px solid ${border}`,
          textTransform: 'capitalize',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
        {normalized}
      </span>
    );
  };

  // Payment Rail Badge Helper
  const renderRailBadge = (rail?: string) => {
    const isUpi = rail ? rail.includes('UPI') : true;
    return isUpi ? (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 700,
          color: '#0f766e',
          background: '#ccfbf1',
          border: '1px solid #99f6e4',
          whiteSpace: 'nowrap',
        }}
      >
        ⚡ UPI AutoPay
      </span>
    ) : (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 700,
          color: '#0284c7',
          background: '#e0f2fe',
          border: '1px solid #bae6fd',
          whiteSpace: 'nowrap',
        }}
      >
        🏦 eNACH
      </span>
    );
  };

  // -------------------------------------------------------------
  // Render Main Layout
  // -------------------------------------------------------------
  return (
    <div className="flex-enach-workspace" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Mandatory Sandbox Disclaimer Banner */}
      <div
        role="alert"
        style={{
          background: 'linear-gradient(90deg, #f0fdfa 0%, #fef3c7 100%)',
          border: '1px solid #0d9488',
          borderLeft: '6px solid #0d9488',
          borderRadius: 8,
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>🛡️</span>
          <div>
            <strong style={{ color: '#0f766e', fontSize: '13px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              SANDBOX MODE — NO REAL BANK TRANSACTIONS
            </strong>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#475569' }}>
              Isolated simulation rail for student Auto UPI mandates, recurring collections, failed debit recovery, and reconciliation. No live banking credentials or money movement.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 4,
              background: '#0f766e',
              color: '#ffffff',
            }}
          >
            PROVIDER: {providerInfo.providerId.toUpperCase()} (ACTIVE)
          </span>
          <button
            type="button"
            className="button secondary"
            style={{ fontSize: '12px', padding: '4px 10px' }}
            onClick={() => setShowDiagnosticsDrawer(true)}
          >
            Diagnostics & Matrix ⚙️
          </button>
        </div>
      </div>

      {/* 2. Top Header Panel */}
      <section className="admin-panel" style={{ margin: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <span className="eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0d9488', fontWeight: 600 }}>
              Dodo · Auto UPI operations
            </span>
            <h2 style={{ margin: '4px 0 6px', fontSize: 'var(--text-xl)', fontWeight: 700 }}>Flex / Auto UPI Fee Automation</h2>
            <p className="small" style={{ margin: 0, color: 'var(--text-muted)' }}>
              NPCI Auto UPI recurring mandate infrastructure, one-click authorization workflows, automatic debit scheduling, recovery retries, and sandbox reconciliation. Live Auto UPI authorization is unavailable on simulated rails.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
              <span>Mandates ({mandates.length})</span> · 
              <span>Setup attempts ({mandates.filter((m) => m.status === 'pending_authorization').length})</span> · 
              <span>Automatic debits ({debits.length})</span> · 
              <span>Settlements (0)</span> · 
              <span>Checkouts (0)</span>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '12px' }}>
              <button type="button" style={{ background: 'none', border: 'none', padding: 0, color: '#0f766e', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => openFeeOperations?.('payer')}>Create payer profile</button>
              <button type="button" style={{ background: 'none', border: 'none', padding: 0, color: '#0f766e', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => openFeeOperations?.('schedule')}>Create fee schedule</button>
              <button type="button" style={{ background: 'none', border: 'none', padding: 0, color: '#0f766e', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => openFeeOperations?.('reconciliation')}>Reconciliation and evidence review</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="button primary"
              style={{ background: '#0d9488', borderColor: '#0d9488', color: '#ffffff', fontWeight: 600 }}
              onClick={() => setActiveTab('setup')}
            >
              + Activate Auto UPI
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => handleRunDebitSimulation('auto')}
              disabled={busy}
              title="Execute scheduled debits run in sandbox"
            >
              ▶ Run Debit Simulation
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setRefreshCount((n) => n + 1)}
              title="Refresh all Auto UPI records"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </section>

      {/* Toast Feedback */}
      {toastMessage && (
        <div
          role="status"
          style={{
            background: '#ecfdf5',
            border: '1px solid #6ee7b7',
            padding: '10px 16px',
            borderRadius: 6,
            color: '#065f46',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* 3. Horizontal Tab Navigation Bar (11 Core Areas) */}
      <nav
        aria-label="Flex and Auto UPI tabs"
        style={{
          display: 'inline-flex',
          maxWidth: '100%',
          gap: '3px',
          background: 'rgba(255, 255, 255, 0.9)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          borderRadius: '9999px',
          padding: '4px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
          marginBottom: '20px',
        }}
      >
        {TAB_CONFIG.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                onViewChange?.(tab.id);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                border: 'none',
                background: isSelected ? '#18181b' : 'transparent',
                color: isSelected ? '#ffffff' : '#52525b',
                fontWeight: isSelected ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                borderRadius: '9999px',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 7px',
                    borderRadius: '9999px',
                    background: isSelected ? '#facc15' : 'rgba(0, 0, 0, 0.07)',
                    color: isSelected ? '#18181b' : '#52525b',
                    fontWeight: 700,
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ========================================================= */}
      {/* TAB 1: OVERVIEW DASHBOARD (Module 1)                      */}
      {/* ========================================================= */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#18181b', margin: 0 }}>
              Collection overview
            </h2>
          </div>
          {/* 8 KPI Cards Strip */}
          <div className="dashboard-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', margin: 0 }}>
            <div className="finance-metric finance-metric-emphasis">
              <span className="finance-metric-label">Total Mandates</span>
              <strong>{overview?.kpis?.total_mandates ?? mandates.length}</strong>
              <span className="finance-metric-hint">Registered on sandbox rail</span>
            </div>
            <div className="finance-metric">
              <span className="finance-metric-label">Active Mandates</span>
              <strong style={{ color: '#0d9488' }}>
                {overview?.kpis?.active_sandbox_mandates ?? mandates.filter((m) => m.status === 'active').length}
              </strong>
              <span className="finance-metric-hint">Authorized for auto-debit</span>
            </div>
            <div className="finance-metric">
              <span className="finance-metric-label">Pending Authorizations</span>
              <strong style={{ color: '#d97706' }}>
                {overview?.kpis?.pending_registrations ?? mandates.filter((m) => m.status === 'pending_authorization').length}
              </strong>
              <span className="finance-metric-hint">Awaiting simulated payer auth</span>
            </div>
            <div className="finance-metric">
              <span className="finance-metric-label">Upcoming Debits</span>
              <strong>{formatMoney(overview?.kpis?.upcoming_simulated_debits_minor ?? 4300000)}</strong>
              <span className="finance-metric-hint">
                {overview?.kpis?.upcoming_simulated_debits_count ?? 2} queue presentation(s)
              </span>
            </div>
            <div className="finance-metric">
              <span className="finance-metric-label">Successful Debits</span>
              <strong style={{ color: '#16a34a' }}>
                {formatMoney(overview?.kpis?.successful_simulated_debits_minor ?? 4300000)}
              </strong>
              <span className="finance-metric-hint">
                {overview?.kpis?.successful_simulated_debits_count ?? 2} cleared debits
              </span>
            </div>
            <div className="finance-metric">
              <span className="finance-metric-label">Failed Debits</span>
              <strong style={{ color: '#dc2626' }}>
                {formatMoney(overview?.kpis?.failed_simulated_debits_minor ?? 5400000)}
              </strong>
              <span className="finance-metric-hint">
                {overview?.kpis?.failed_simulated_debits_count ?? 2} returned unpaid
              </span>
            </div>
            <div className="finance-metric">
              <span className="finance-metric-label">Open Investigations</span>
              <strong style={{ color: '#7c3aed' }}>{overview?.kpis?.pending_investigations ?? 2}</strong>
              <span className="finance-metric-hint">Discrepancy review needed</span>
            </div>
            <div className="finance-metric">
              <span className="finance-metric-label">Simulated Recovery</span>
              <strong style={{ color: '#0284c7' }}>
                {formatMoney(overview?.kpis?.simulated_recovery_minor ?? 3200000)}
              </strong>
              <span className="finance-metric-hint">In active retry scheduler</span>
            </div>
          </div>

          {/* Quick Setup Callout Card */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                ⚡ One-Click Auto UPI Activation Available
              </h3>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
                Instantly map student instalments to recurring UPI AutoPay mandates. Test payer UPI app approval, QR/Intent, or NetBanking authorization directly in sandbox.
              </p>
            </div>
            <button
              type="button"
              className="button primary"
              style={{ background: '#0d9488', borderColor: '#0d9488', color: '#ffffff', fontWeight: 600 }}
              onClick={() => setActiveTab('setup')}
            >
              + Activate Auto UPI Now
            </button>
          </div>

          {/* Grid: Mandate Status Funnel & Upcoming Debit Queue */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-6)' }}>
            {/* Status Breakdown */}
            <div className="admin-panel" style={{ margin: 0 }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '15px', fontWeight: 700 }}>Mandate Status Breakdown</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(overview?.funnel || [
                  { status: 'Active (Sandbox)', count: 2, color: '#0d9488' },
                  { status: 'Pending Authorization', count: 2, color: '#f59e0b' },
                  { status: 'Rejected', count: 1, color: '#ef4444' },
                  { status: 'Cancelled', count: 1, color: '#64748b' },
                ]).map((item: any) => {
                  const total = mandates.length || 6;
                  const pct = Math.round((item.count / total) * 100);
                  return (
                    <div key={item.status}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{item.status}</span>
                        <span style={{ color: '#64748b' }}>
                          {item.count} mandates ({pct}%)
                        </span>
                      </div>
                      <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: item.color, borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upcoming Debits Schedule */}
            <div className="admin-panel" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Upcoming Scheduled Debits</h3>
                <span className="status-pill">Next 7 Days</span>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table" style={{ minWidth: 480 }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: 140 }}>Student</th>
                      <th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>Due Date</th>
                      <th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>Amount</th>
                      <th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(overview?.upcoming_schedule || []).slice(0, 4).map((row: any) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.student_name}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{row.account_reference}</div>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{row.scheduled_date}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <strong>{formatMoney(row.amount_minor)}</strong>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="button outline"
                            style={{ fontSize: '11px', padding: '2px 8px' }}
                            onClick={() => setActiveTab('debits')}
                          >
                            View Queue
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!overview?.upcoming_schedule || overview.upcoming_schedule.length === 0) && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>
                          No pending debits scheduled for presentation.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Failed Debit Alerts Panel */}
          {overview?.failed_alerts && overview.failed_alerts.length > 0 && (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 8,
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ margin: 0, color: '#92400e', fontSize: '14px', fontWeight: 700 }}>
                  ⚠️ Attention Needed: {overview.failed_alerts.length} Failed Debit Instruction(s)
                </h4>
                <button
                  type="button"
                  className="button secondary"
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                  onClick={() => setActiveTab('failures')}
                >
                  Manage Failures →
                </button>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#78350f' }}>
                Simulated provider returns require recovery scheduling or fee plan adjustment.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {overview.failed_alerts.map((f: any) => (
                  <div
                    key={f.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #fef3c7',
                      padding: '8px 12px',
                      borderRadius: 6,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '12px' }}>{f.student_name}</strong> — {formatMoney(f.amount_minor)} (
                      <span style={{ color: '#dc2626', fontWeight: 600 }}>{f.failure_code}</span>: {f.failure_reason})
                    </div>
                    <div>
                      {f.retry_eligible ? (
                        <button
                          type="button"
                          className="button primary"
                          style={{ fontSize: '11px', padding: '2px 8px', background: '#0d9488' }}
                          onClick={() => setActiveTab('recovery')}
                        >
                          Retry in Recovery →
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Ineligible for Auto-Retry</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: ONE-CLICK eNACH SETUP (Module 2)                    */}
      {/* ========================================================= */}
      {activeTab === 'setup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <section className="admin-panel" style={{ margin: 0 }}>
            <div style={{ maxWidth: 840 }}>
              <span className="eyebrow" style={{ textTransform: 'uppercase', color: '#0d9488', fontWeight: 600 }}>
                Module 2 · One-Click Authorization
              </span>
              <h3 style={{ margin: '4px 0 8px', fontSize: '1.25rem', fontWeight: 700 }}>
                Activate Student Recurring Fee Mandate
              </h3>
              <p style={{ margin: '0 0 1.5rem', color: '#64748b', fontSize: '13px' }}>
                Select an enrolled student to pull their linked fee schedule. Support both instant UPI AutoPay and eNACH bank mandates with method-specific authorization.
              </p>

              <form onSubmit={handleCreateMandate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Payment Method Selector: UPI AutoPay vs eNACH */}
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 10, padding: '1.25rem' }}>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', marginBottom: 8, color: '#0f172a' }}>
                    Select Fee Automation Payment Method *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSetupPaymentMethod('upi_autopay');
                        setSetupAuthMethod('UPI App Intent (Simulated)');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        borderRadius: 8,
                        border: setupPaymentMethod === 'upi_autopay' ? '2px solid #0d9488' : '1px solid #cbd5e1',
                        background: setupPaymentMethod === 'upi_autopay' ? '#f0fdfa' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        boxShadow: setupPaymentMethod === 'upi_autopay' ? '0 0 0 1px #0d9488' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '24px' }}>⚡</span>
                        <div>
                          <strong style={{ fontSize: '14px', color: setupPaymentMethod === 'upi_autopay' ? '#0f766e' : '#0f172a', display: 'block' }}>
                            UPI AutoPay
                          </strong>
                          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                            Instant NPCI UPI 2.0 app authorization (GPay, PhonePe, Paytm, BHIM)
                          </span>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="payment_rail_radio"
                        checked={setupPaymentMethod === 'upi_autopay'}
                        onChange={() => {}}
                        style={{ accentColor: '#0d9488', width: 18, height: 18, cursor: 'pointer' }}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSetupPaymentMethod('enach');
                        setSetupAuthMethod('NetBanking (Simulated)');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        borderRadius: 8,
                        border: setupPaymentMethod === 'enach' ? '2px solid #0d9488' : '1px solid #cbd5e1',
                        background: setupPaymentMethod === 'enach' ? '#f0fdfa' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        boxShadow: setupPaymentMethod === 'enach' ? '0 0 0 1px #0d9488' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '24px' }}>🏦</span>
                        <div>
                          <strong style={{ fontSize: '14px', color: setupPaymentMethod === 'enach' ? '#0f766e' : '#0f172a', display: 'block' }}>
                            eNACH Bank Mandate
                          </strong>
                          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                            National Automated Clearing House (NetBanking, Debit Card, Aadhaar OTP)
                          </span>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="payment_rail_radio"
                        checked={setupPaymentMethod === 'enach'}
                        onChange={() => {}}
                        style={{ accentColor: '#0d9488', width: 18, height: 18, cursor: 'pointer' }}
                      />
                    </button>
                  </div>
                </div>

                {/* Step 1: Student Selection */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1.25rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: 6 }}>
                    1. Select Enrolled Student *
                  </label>
                  <select
                    value={setupStudentId}
                    onChange={(e) => {
                      const sid = e.target.value;
                      setSetupStudentId(sid);
                      const selected = studentMappings.find((s) => s.student_id === sid);
                      if (selected) {
                        if (selected.payer_name) setSetupPayerName(selected.payer_name);
                        if (selected.payer_phone) setSetupPayerPhone(selected.payer_phone);
                        if (selected.payer_email) setSetupPayerEmail(selected.payer_email);
                        if (selected.payer_vpa) {
                          setSetupPayerVpa(selected.payer_vpa);
                        } else if (selected.payer_name) {
                          setSetupPayerVpa(`${selected.payer_name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@okhdfcbank`);
                        }
                        const remaining = selected.remaining_minor || 12000000;
                        const { items, startDate, endDate } = generateSchedule(setupFrequency, remaining, sid);
                        setSetupInstallments(items);
                        setSetupStartDate(startDate);
                        setSetupEndDate(endDate);
                        if (selected.max_amount_minor) {
                          setSetupMaxAmountMinor(selected.max_amount_minor);
                        }
                      }
                    }}
                    onFocus={() => {
                      request<StudentEnachMapping[]>('admin/enach/student-mapping')
                        .then((data) => {
                          if (data && Array.isArray(data)) setStudentMappings(data);
                        })
                        .catch(() => {});
                    }}
                    required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '14px' }}
                  >
                    <option value="">-- Choose student from directory --</option>
                    {studentMappings.map((s) => (
                      <option key={s.student_id} value={s.student_id}>
                        {s.student_name} ({s.student_reference}) — {s.group_name} | {s.mandate_status === 'active' ? '✓ Active Mandate' : s.mandate_status === 'not_setup' ? 'Setup Required' : `Status: ${s.mandate_status}`}
                      </option>
                    ))}
                  </select>
                  {setupStudentId && (
                    <div style={{ marginTop: 10, fontSize: '12px', color: '#0f766e', background: '#f0fdfa', padding: '6px 12px', borderRadius: 4 }}>
                      ✓ Linked Fee Plan: {studentMappings.find((s) => s.student_id === setupStudentId)?.fee_plan} | Remaining Fee:{' '}
                      {formatMoney(studentMappings.find((s) => s.student_id === setupStudentId)?.remaining_minor || 0)}
                    </div>
                  )}
                </div>

                {/* Step 2: Payer Profile Review (Method-Specific Fields) */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700 }}>
                    {setupPaymentMethod === 'upi_autopay'
                      ? '2. Authorized Payer & UPI AutoPay Details'
                      : '2. Authorized Payer & Bank Mandate Details (eNACH)'}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
                        Payer Full Name *
                      </label>
                      <input
                        type="text"
                        value={setupPayerName}
                        onChange={(e) => setSetupPayerName(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                    </div>

                    {/* When UPI AutoPay is selected */}
                    {setupPaymentMethod === 'upi_autopay' && (
                      <>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
                            Payer UPI ID / VPA *
                          </label>
                          <input
                            type="text"
                            value={setupPayerVpa}
                            onChange={(e) => setSetupPayerVpa(e.target.value)}
                            placeholder="e.g. sharma.rajesh@okhdfcbank"
                            required={setupPaymentMethod === 'upi_autopay'}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          />
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Primary NPCI VPA for recurring collections</span>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
                            Preferred UPI App
                          </label>
                          <select
                            value={setupPreferredUpiApp}
                            onChange={(e) => setSetupPreferredUpiApp(e.target.value as any)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          >
                            <option value="Google Pay">Google Pay</option>
                            <option value="PhonePe">PhonePe</option>
                            <option value="Paytm">Paytm</option>
                            <option value="BHIM UPI">BHIM UPI</option>
                            <option value="Cred">Cred</option>
                            <option value="Any UPI App">Any UPI App</option>
                          </select>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>App used by payer for mandate authorization</span>
                        </div>
                      </>
                    )}

                    {/* When eNACH is selected */}
                    {setupPaymentMethod === 'enach' && (
                      <>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
                            Destination Bank *
                          </label>
                          <select
                            value={setupBankName}
                            onChange={(e) => setSetupBankName(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          >
                            <option value="HDFC Bank">HDFC Bank</option>
                            <option value="ICICI Bank">ICICI Bank</option>
                            <option value="State Bank of India">State Bank of India</option>
                            <option value="Axis Bank">Axis Bank</option>
                            <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                            <option value="Punjab National Bank">Punjab National Bank</option>
                            <option value="Bank of Baroda">Bank of Baroda</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
                            Bank Account Number / Masked Account *
                          </label>
                          <input
                            type="text"
                            value={setupAccountLast4}
                            onChange={(e) => setSetupAccountLast4(e.target.value)}
                            placeholder="e.g. 50100492104321 or 4321"
                            required={setupPaymentMethod === 'enach'}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          />
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Account for eNACH National Automated Clearing</span>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
                            Bank IFSC Code *
                          </label>
                          <input
                            type="text"
                            value={setupIfsc}
                            onChange={(e) => setSetupIfsc(e.target.value.toUpperCase())}
                            placeholder="e.g. HDFC0001234"
                            required={setupPaymentMethod === 'enach'}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
                            Account Type
                          </label>
                          <select
                            value={setupAccountType}
                            onChange={(e) => setSetupAccountType(e.target.value as any)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          >
                            <option value="savings">Savings Account</option>
                            <option value="current">Current Account</option>
                          </select>
                        </div>
                      </>
                    )}

                    {/* Common Contact Details */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
                        Mobile Phone (Alerts) *
                      </label>
                      <input
                        type="tel"
                        value={setupPayerPhone}
                        onChange={(e) => setSetupPayerPhone(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={setupPayerEmail}
                        onChange={(e) => setSetupPayerEmail(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Step 3: Mandate Financial Parameters */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700 }}>3. Mandate Terms & Frequency</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
                        Maximum Mandate Cap (INR)
                      </label>
                      <input
                        type="number"
                        step="1000"
                        value={setupMaxAmountMinor / 100}
                        onChange={(e) => setSetupMaxAmountMinor(Math.round(Number(e.target.value) * 100))}
                        required
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                      <span style={{ fontSize: '11px', color: '#0d9488', fontWeight: 600 }}>
                        {setupPaymentMethod === 'upi_autopay' ? 'NPCI UPI AutoPay limit: Up to ₹1,00,000' : 'eNACH bank debit limit: Up to ₹10,00,000'}
                      </span>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
                        Debit Frequency
                      </label>
                      <select
                        value={setupFrequency}
                        onChange={(e) => handleFrequencyChange(e.target.value as any)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontWeight: 600 }}
                      >
                        <option value="quarterly">Quarterly (4 cycles)</option>
                        <option value="term_5">5 instalments (Term-Wise)</option>
                        <option value="bi-monthly">6 instalments (Bi-Monthly)</option>
                        <option value="monthly">10 instalments (Monthly)</option>
                        <option value="as_presented">Flexible / Custom (As Presented)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
                        Validity Start Date (From Date)
                      </label>
                      <input
                        type="date"
                        value={setupStartDate}
                        onChange={(e) => handleStartDateChange(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Coverage start date for auto-debit</span>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
                        Validity End Date (To Date)
                      </label>
                      <input
                        type="date"
                        value={setupEndDate}
                        onChange={(e) => handleEndDateChange(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                      />
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Expiry date of mandate authorization</span>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
                        Simulated Authorization Mode
                      </label>
                      <select
                        value={setupAuthMethod}
                        onChange={(e) => setSetupAuthMethod(e.target.value as AuthMethod)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                      >
                        {setupPaymentMethod === 'upi_autopay' ? (
                          <>
                            <option value="UPI App Intent (Simulated)">UPI App Intent (Simulated)</option>
                            <option value="UPI Collect / Push Request (Simulated)">UPI Collect / Push Request (Simulated)</option>
                            <option value="UPI QR Flow (Simulated)">UPI QR Flow (Simulated)</option>
                          </>
                        ) : (
                          <>
                            <option value="NetBanking (Simulated)">NetBanking (Simulated)</option>
                            <option value="Debit Card (Simulated)">Debit Card (Simulated)</option>
                            <option value="Aadhaar OTP (Simulated)">Aadhaar OTP (Simulated)</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Step 4: Scheduled Fee Instalments Breakdown & Dates */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                        4. Scheduled Fee Instalments (Coverage Dates: From When to When)
                      </h4>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                        Add or remove instalments, customize coverage windows (From Date → To Date), and balance fee amounts.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Counter Stepper */}
                      <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveInstallment(setupInstallments.length - 1)}
                          disabled={setupInstallments.length <= 1}
                          title="Decrease instalments count (-1)"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            padding: '4px 10px',
                            fontSize: '15px',
                            fontWeight: 700,
                            color: setupInstallments.length <= 1 ? '#94a3b8' : '#0f172a',
                            cursor: setupInstallments.length <= 1 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          −
                        </button>
                        <span style={{ fontSize: '12px', fontWeight: 700, padding: '0 8px', color: '#0f172a', whiteSpace: 'nowrap' }}>
                          {setupInstallments.length} Instalment{setupInstallments.length !== 1 ? 's' : ''}
                        </span>
                        <button
                          type="button"
                          onClick={handleAddInstallment}
                          title="Increase instalments count (+1)"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            padding: '4px 10px',
                            fontSize: '15px',
                            fontWeight: 700,
                            color: '#0d9488',
                            cursor: 'pointer',
                          }}
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddInstallment}
                        className="button primary"
                        style={{
                          fontSize: '12px',
                          padding: '6px 14px',
                          background: '#0d9488',
                          borderColor: '#0d9488',
                          color: '#ffffff',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        + Add Instalment
                      </button>

                      <button
                        type="button"
                        onClick={handleBalanceEvenly}
                        className="button secondary"
                        style={{ fontSize: '12px', padding: '6px 12px', fontWeight: 600 }}
                        title="Split student remaining balance evenly across all current instalments"
                      >
                        ⚖️ Balance Evenly
                      </button>
                    </div>
                  </div>

                  {setupInstallments.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', background: '#f8fafc', borderRadius: 6, color: '#64748b', fontSize: '13px' }}>
                      Select an enrolled student in Step 1 to load and configure their instalment schedule and dates.
                    </div>
                  ) : (
                    <>
                      {setupInstallments.some((inst) => inst.amount_minor > setupMaxAmountMinor) && (
                        <div
                          style={{
                            marginBottom: '1rem',
                            padding: '12px 16px',
                            background: '#fff1f2',
                            border: '1px solid #fecdd3',
                            borderRadius: 6,
                            color: '#9f1239',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                          }}
                        >
                          <span style={{ fontSize: '18px', flexShrink: 0 }}>⚠️</span>
                          <div>
                            <strong>Mandate Cap Limit Exceeded:</strong> One or more scheduled instalment amounts exceed the maximum debit cap of {formatMoney(setupMaxAmountMinor)}. 
                            Mandate submission is blocked until you raise the Maximum Mandate Cap in Step 3 or click &ldquo;⚖️ Balance Evenly&rdquo; / adjust instalment amounts below.
                          </div>
                        </div>
                      )}
                      <div className="admin-table-wrap">
                        <table className="admin-table" style={{ margin: 0, minWidth: 960 }}>
                          <thead>
                            <tr>
                              <th style={{ width: 40 }}>#</th>
                              <th>Instalment Name</th>
                              <th style={{ minWidth: 280 }}>Instalment Dates (From When to When)</th>
                              <th style={{ minWidth: 130 }}>Due Date</th>
                              <th style={{ minWidth: 120 }}>Amount</th>
                              <th>Auto UPI Status</th>
                              <th>Cap Limit Check</th>
                              <th style={{ width: 80, textAlign: 'center' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {setupInstallments.map((inst, idx) => {
                              const isWithinCap = inst.amount_minor <= setupMaxAmountMinor;
                              return (
                                <tr key={inst.id || idx}>
                                  <td style={{ fontWeight: 600, color: '#64748b' }}>{idx + 1}</td>
                                  <td>
                                    <input
                                      type="text"
                                      value={inst.name}
                                      onChange={(e) => updateInstallment(idx, { name: e.target.value })}
                                      style={{ width: '100%', minWidth: 170, padding: '6px 8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600 }}
                                    />
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>FROM DATE</span>
                                        <input
                                          type="date"
                                          value={inst.period_start || ''}
                                          onChange={(e) => updateInstallment(idx, { period_start: e.target.value })}
                                          style={{ padding: '4px 6px', fontSize: '12px', borderRadius: 4, border: '1px solid #cbd5e1' }}
                                        />
                                      </div>
                                      <span style={{ color: '#0d9488', fontWeight: 700, marginTop: 14 }}>→</span>
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>TO DATE</span>
                                        <input
                                          type="date"
                                          value={inst.period_end || ''}
                                          onChange={(e) => updateInstallment(idx, { period_end: e.target.value })}
                                          style={{ padding: '4px 6px', fontSize: '12px', borderRadius: 4, border: '1px solid #cbd5e1' }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <input
                                      type="date"
                                      value={inst.due_date}
                                      onChange={(e) => updateInstallment(idx, { due_date: e.target.value })}
                                      style={{ padding: '5px 8px', fontSize: '12px', borderRadius: 4, border: '1px solid #cbd5e1' }}
                                    />
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <span style={{ fontSize: '12px', color: '#64748b' }}>₹</span>
                                      <input
                                        type="number"
                                        value={inst.amount_minor / 100}
                                        step="500"
                                        onChange={(e) => updateInstallment(idx, { amount_minor: Math.round(Number(e.target.value) * 100) })}
                                        style={{ width: '90px', padding: '5px 8px', fontSize: '12px', borderRadius: 4, border: '1px solid #cbd5e1', fontWeight: 600 }}
                                      />
                                    </div>
                                  </td>
                                  <td>
                                    {renderStatusBadge(inst.status)}
                                  </td>
                                  <td>
                                    {isWithinCap ? (
                                      <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        ✓ Within Cap (≤ ₹{(setupMaxAmountMinor / 100).toLocaleString('en-IN')})
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        ⚠ Exceeds Cap (&gt; ₹{(setupMaxAmountMinor / 100).toLocaleString('en-IN')})
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveInstallment(idx)}
                                      disabled={setupInstallments.length <= 1}
                                      title={setupInstallments.length <= 1 ? 'At least one instalment is required' : `Remove Instalment #${idx + 1}`}
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: '11px',
                                        borderRadius: 4,
                                        border: '1px solid #fecaca',
                                        background: setupInstallments.length <= 1 ? '#f8fafc' : '#fef2f2',
                                        color: setupInstallments.length <= 1 ? '#94a3b8' : '#dc2626',
                                        cursor: setupInstallments.length <= 1 ? 'not-allowed' : 'pointer',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '2px',
                                      }}
                                    >
                                      ✕ Remove
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Summary Banner */}
                      <div style={{ marginTop: '12px', padding: '10px 14px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', fontSize: '12px' }}>
                          <span>
                            <strong>Scheduled Total:</strong>{' '}
                            <span style={{ color: '#0d9488', fontWeight: 700 }}>
                              {formatMoney(setupInstallments.reduce((sum, inst) => sum + (inst.amount_minor || 0), 0))}
                            </span>
                          </span>
                          <span>
                            <strong>Student Remaining Fee:</strong>{' '}
                            <span>
                              {formatMoney(studentMappings.find((s) => s.student_id === setupStudentId)?.remaining_minor || 12000000)}
                            </span>
                          </span>
                          {(() => {
                            const scheduledTotal = setupInstallments.reduce((sum, inst) => sum + (inst.amount_minor || 0), 0);
                            const remaining = studentMappings.find((s) => s.student_id === setupStudentId)?.remaining_minor || 12000000;
                            const diff = scheduledTotal - remaining;
                            if (diff === 0) {
                              return <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Total Matches Remaining Fee</span>;
                            }
                            if (diff < 0) {
                              return <span style={{ color: '#d97706', fontWeight: 600 }}>⚠ {formatMoney(Math.abs(diff))} unallocated</span>;
                            }
                            return <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠ {formatMoney(diff)} exceeds remaining</span>;
                          })()}
                          <span>
                            <strong>Frequency:</strong>{' '}
                            <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#475569' }}>
                              {setupFrequency === 'term_5' ? 'Term-Wise (5 cycles)' : setupFrequency.replace('_', ' ')}
                            </span>
                          </span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          Mandate Coverage Window: {setupStartDate} → {setupEndDate}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Submit Action */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button
                    type="submit"
                    className="button primary"
                    style={{
                      background: setupInstallments.some((inst) => inst.amount_minor > setupMaxAmountMinor) ? '#94a3b8' : '#0d9488',
                      borderColor: setupInstallments.some((inst) => inst.amount_minor > setupMaxAmountMinor) ? '#94a3b8' : '#0d9488',
                      color: '#ffffff',
                      fontWeight: 700,
                      padding: '10px 24px',
                      cursor: setupInstallments.some((inst) => inst.amount_minor > setupMaxAmountMinor) ? 'not-allowed' : 'pointer',
                    }}
                    disabled={busy || !setupStudentId || setupInstallments.some((inst) => inst.amount_minor > setupMaxAmountMinor)}
                    title={
                      setupInstallments.some((inst) => inst.amount_minor > setupMaxAmountMinor)
                        ? 'Cannot submit: one or more instalments exceed maximum mandate debit cap'
                        : undefined
                    }
                  >
                    {busy
                      ? 'Initiating…'
                      : setupPaymentMethod === 'upi_autopay'
                      ? '⚡ Register & Authorize UPI AutoPay Mandate'
                      : '🏦 Register & Authorize eNACH Mandate'}
                  </button>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Generates a unique UMRN reference and triggers simulated payer authorization modal.
                  </span>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: MANDATE MANAGEMENT (Module 3)                      */}
      {/* ========================================================= */}
      {activeTab === 'mandates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <section className="admin-panel" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Registered Sandbox Mandates</h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Manage student auto-debit authorizations for both UPI AutoPay and eNACH bank mandates.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Rail Filter Pills */}
                <div style={{ display: 'inline-flex', borderRadius: 6, border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setMandateRailFilter('all')}
                    style={{
                      padding: '5px 10px',
                      fontSize: '12px',
                      fontWeight: mandateRailFilter === 'all' ? 700 : 500,
                      background: mandateRailFilter === 'all' ? '#0d9488' : '#ffffff',
                      color: mandateRailFilter === 'all' ? '#ffffff' : '#475569',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    All ({mandates.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMandateRailFilter('upi_autopay')}
                    style={{
                      padding: '5px 10px',
                      fontSize: '12px',
                      fontWeight: mandateRailFilter === 'upi_autopay' ? 700 : 500,
                      background: mandateRailFilter === 'upi_autopay' ? '#0d9488' : '#ffffff',
                      color: mandateRailFilter === 'upi_autopay' ? '#ffffff' : '#475569',
                      borderLeft: '1px solid #cbd5e1',
                      borderRight: '1px solid #cbd5e1',
                      borderTop: 'none',
                      borderBottom: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    ⚡ UPI AutoPay ({mandates.filter((m) => m.rail.includes('UPI')).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMandateRailFilter('enach')}
                    style={{
                      padding: '5px 10px',
                      fontSize: '12px',
                      fontWeight: mandateRailFilter === 'enach' ? 700 : 500,
                      background: mandateRailFilter === 'enach' ? '#0d9488' : '#ffffff',
                      color: mandateRailFilter === 'enach' ? '#ffffff' : '#475569',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    🏦 eNACH ({mandates.filter((m) => m.rail.includes('eNACH')).length})
                  </button>
                </div>

                <input
                  type="search"
                  placeholder="Search student, UMN, UMRN, payer…"
                  value={mandateSearch}
                  onChange={(e) => setMandateSearch(e.target.value)}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '13px', minWidth: 200 }}
                />
                <select
                  value={mandateStatusFilter}
                  onChange={(e) => setMandateStatusFilter(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active (Sandbox)</option>
                  <option value="pending_authorization">Pending Authorization</option>
                  <option value="draft">Draft</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table" style={{ minWidth: 1080 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 140, whiteSpace: 'nowrap' }}>Mandate Ref &amp; Rail</th>
                    <th style={{ minWidth: 130 }}>Student</th>
                    <th style={{ minWidth: 170 }}>Payer Details</th>
                    <th style={{ minWidth: 140 }}>Fee Plan</th>
                    <th style={{ minWidth: 110, whiteSpace: 'nowrap' }}>Amount Cap</th>
                    <th style={{ minWidth: 90, whiteSpace: 'nowrap' }}>Frequency</th>
                    <th style={{ minWidth: 160, whiteSpace: 'nowrap' }}>Validity</th>
                    <th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ minWidth: 180, whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mandates
                    .filter((m) => {
                      if (mandateRailFilter === 'upi_autopay' && !m.rail.includes('UPI')) return false;
                      if (mandateRailFilter === 'enach' && !m.rail.includes('eNACH')) return false;
                      if (mandateStatusFilter && m.status !== mandateStatusFilter) return false;
                      if (!mandateSearch) return true;
                      const q = mandateSearch.toLowerCase();
                      return (
                        m.mandate_reference.toLowerCase().includes(q) ||
                        m.student_name.toLowerCase().includes(q) ||
                        m.payer_name.toLowerCase().includes(q) ||
                        (m.payer_vpa && m.payer_vpa.toLowerCase().includes(q)) ||
                        m.bank_name.toLowerCase().includes(q)
                      );
                    })
                    .map((m) => (
                      <tr key={m.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <strong style={{ fontSize: '12px', color: '#0f766e' }}>{m.mandate_reference}</strong>
                          <div style={{ marginTop: 2 }}>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: m.rail.includes('UPI') ? '#ecfdf5' : '#eff6ff',
                                color: m.rail.includes('UPI') ? '#065f46' : '#1e40af',
                                border: m.rail.includes('UPI') ? '1px solid #a7f3d0' : '1px solid #bfdbfe',
                              }}
                            >
                              {m.rail.includes('UPI') ? '⚡ UPI AutoPay' : '🏦 eNACH'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <strong>{m.student_name}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{m.account_reference}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{m.payer_name}</div>
                          {m.rail.includes('UPI') ? (
                            <>
                              {m.payer_vpa && (
                                <div style={{ fontSize: '11px', color: '#0d9488', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  {m.payer_vpa} {m.preferred_upi_app ? `· ${m.preferred_upi_app}` : ''}
                                </div>
                              )}
                              <div style={{ fontSize: '10.5px', color: '#64748b' }}>App: {m.preferred_upi_app || 'UPI PSP'}</div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {m.bank_name} ({m.masked_account})
                              </div>
                              <div style={{ fontSize: '10.5px', color: '#64748b' }}>IFSC: {m.ifsc_code} · {m.auth_mode.replace(' (Simulated)', '')}</div>
                            </>
                          )}
                        </td>
                        <td style={{ fontSize: '12px' }}>{m.fee_plan}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <strong>{formatMoney(m.max_amount_minor)}</strong>
                        </td>
                        <td style={{ textTransform: 'capitalize', fontSize: '12px', whiteSpace: 'nowrap' }}>{m.frequency}</td>
                        <td style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {m.start_date} to {m.end_date}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{renderStatusBadge(m.status)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="button secondary"
                              style={{ fontSize: '11px', padding: '3px 8px', whiteSpace: 'nowrap' }}
                              onClick={() => setSelectedMandate(m)}
                              title="Inspect mandate profile and audit history"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="button secondary"
                              style={{ fontSize: '11px', padding: '3px 8px', background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46', fontWeight: 600, whiteSpace: 'nowrap' }}
                              onClick={() => {
                                const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
                                const approvalUrl = `${baseUrl}/payer/demo-access-token-12345?mandate=${m.id}&ref=${encodeURIComponent(m.mandate_reference)}`;
                                setShareModalData({
                                  isOpen: true,
                                  mandate: m,
                                  recipientType: 'student',
                                  recipientName: m.student_name || 'V Rakesh',
                                  recipientPhone: m.payer_phone || '+91 98765 43210',
                                  recipientEmail: m.payer_email || 'payer@example.com',
                                  approvalUrl,
                                  sentChannels: {},
                                });
                              }}
                              title="Share authorization link via WhatsApp, SMS, or Email"
                            >
                              Share Link 📨
                            </button>
                            {m.status === 'pending_authorization' && (
                              <button
                                type="button"
                                className="button primary"
                                style={{ fontSize: '11px', padding: '3px 8px', background: '#0d9488', whiteSpace: 'nowrap' }}
                                onClick={() => setAuthModalMandate(m)}
                                title="Open test authorization simulation"
                              >
                                Authorize ⚡
                              </button>
                            )}
                            {m.status === 'active' && (
                              <button
                                type="button"
                                className="button outline"
                                style={{ fontSize: '11px', padding: '3px 8px', color: '#b91c1c', borderColor: '#fca5a5', whiteSpace: 'nowrap' }}
                                onClick={() => {
                                  setCancelModalMandate(m);
                                  setCancelReason('');
                                }}
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  {mandates.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                        No sandbox mandates created yet. Click "+ Activate Auto UPI" to set up your first mandate.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: STUDENTS & PAYERS (Module 4)                       */}
      {/* ========================================================= */}
      {activeTab === 'students' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <section className="admin-panel" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Student Auto UPI Mapping Matrix</h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Overview of student fee obligations, authorized payers, linked instalments, and recurring mandate readiness.
                </p>
              </div>
              <input
                type="search"
                placeholder="Search students, class, course…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '13px', minWidth: 260 }}
              />
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table" style={{ minWidth: 1100 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 140, whiteSpace: 'nowrap' }}>Student & Ref</th>
                    <th style={{ minWidth: 120 }}>Class / Group</th>
                    <th style={{ minWidth: 140 }}>Authorized Payer</th>
                    <th style={{ minWidth: 140 }}>Fee Structure</th>
                    <th style={{ minWidth: 160, whiteSpace: 'nowrap' }}>Instalment Dates (From - To)</th>
                    <th style={{ minWidth: 120, whiteSpace: 'nowrap' }}>Remaining Balance</th>
                    <th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>Next Due</th>
                    <th style={{ minWidth: 120, whiteSpace: 'nowrap' }}>Auto UPI Mandate Status</th>
                    <th style={{ minWidth: 160, whiteSpace: 'nowrap' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {studentMappings
                    .filter((s) => {
                      if (!studentSearch) return true;
                      const q = studentSearch.toLowerCase();
                      return (
                        s.student_name.toLowerCase().includes(q) ||
                        s.student_reference.toLowerCase().includes(q) ||
                        s.group_name.toLowerCase().includes(q) ||
                        s.payer_name.toLowerCase().includes(q)
                      );
                    })
                    .map((s) => (
                      <tr key={s.student_id}>
                        <td>
                          <strong>{s.student_name}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{s.student_reference}</div>
                        </td>
                        <td>
                          <div>{s.group_name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{s.course}</div>
                        </td>
                        <td>
                          <div>{s.payer_name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{s.payer_phone}</div>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <div>{s.fee_plan}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>Total: {formatMoney(s.total_fee_minor)}</div>
                        </td>
                        <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600 }}>{s.installments_count || 4} Instalments</div>
                          <div style={{ fontSize: '11px', color: '#0f766e', fontWeight: 600 }}>
                            {s.installments?.[0]?.period_start || '2026-07-01'} → {s.installments?.[s.installments.length - 1]?.period_end || '2027-06-30'}
                          </div>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <strong>{formatMoney(s.remaining_minor)}</strong>
                          <div style={{ fontSize: '11px', color: '#16a34a' }}>Paid: {formatMoney(s.paid_minor)}</div>
                        </td>
                        <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{s.next_due_date || 'No upcoming'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {s.mandate_status === 'not_setup' ? (
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 4, background: '#f8fafc', border: '1px solid #cbd5e1', color: '#64748b', whiteSpace: 'nowrap' }}>
                              Not Setup
                            </span>
                          ) : (
                            renderStatusBadge(s.mandate_status)
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {s.mandate_status === 'not_setup' || s.mandate_status === 'rejected' || s.mandate_status === 'cancelled' ? (
                            <button
                              type="button"
                              className="button primary"
                              style={{ fontSize: '11px', padding: '3px 10px', background: '#0d9488', whiteSpace: 'nowrap' }}
                              onClick={() => {
                                setSetupStudentId(s.student_id);
                                setActiveTab('setup');
                              }}
                            >
                              + Setup Mandate
                            </button>
                          ) : (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="button secondary"
                                style={{ fontSize: '11px', padding: '3px 8px', whiteSpace: 'nowrap' }}
                                onClick={() => {
                                  const found = mandates.find((m) => m.student_id === s.student_id);
                                  if (found) setSelectedMandate(found);
                                }}
                              >
                                Inspect
                              </button>
                              <button
                                type="button"
                                className="button secondary"
                                style={{ fontSize: '11px', padding: '3px 8px', background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46', fontWeight: 600, whiteSpace: 'nowrap' }}
                                onClick={() => {
                                  const found = mandates.find((m) => m.student_id === s.student_id);
                                  const m = found || {
                                    id: `mandate-${s.student_id}`,
                                    mandate_reference: `UMRN-NACH-2026-${s.student_reference}`,
                                    student_id: s.student_id,
                                    student_name: s.student_name,
                                    account_reference: s.student_reference,
                                    payer_name: s.payer_name,
                                    payer_phone: s.payer_phone,
                                    payer_email: s.payer_email,
                                    bank_name: 'HDFC Bank',
                                    masked_account: '•••• 1244',
                                    ifsc_code: 'HDFC0001234',
                                    fee_plan: s.fee_plan,
                                    max_amount_minor: s.remaining_minor ? Math.min(s.remaining_minor, 5000000) : 5000000,
                                    frequency: 'quarterly',
                                    start_date: '2026-07-01',
                                    end_date: '2027-06-30',
                                    status: s.mandate_status as MandateStatus,
                                    auth_mode: 'NetBanking (Simulated)',
                                    created_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString(),
                                  };
                                  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
                                  const approvalUrl = `${baseUrl}/payer/demo-access-token-12345?mandate=${m.id}&ref=${encodeURIComponent(m.mandate_reference)}`;
                                  setShareModalData({
                                    isOpen: true,
                                    mandate: m as SandboxMandate,
                                    recipientType: 'student',
                                    recipientName: s.student_name,
                                    recipientPhone: s.payer_phone || '+91 98765 43210',
                                    recipientEmail: s.payer_email || 'payer@example.com',
                                    approvalUrl,
                                    sentChannels: {},
                                  });
                                }}
                                title="Share authorization link via WhatsApp, SMS, or Email"
                              >
                                Share Link 📨
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: AUTOMATIC DEBITS (Modules 5 & 6)                   */}
      {/* ========================================================= */}
      {activeTab === 'debits' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Scheduling Engine Controls */}
          <section className="admin-panel" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <span className="eyebrow" style={{ textTransform: 'uppercase', color: '#0d9488', fontWeight: 600 }}>
                  Modules 5 & 6 · Recurring Debit Automation
                </span>
                <h3 style={{ margin: '4px 0 4px', fontSize: '1.15rem', fontWeight: 700 }}>
                  Automatic Debit Scheduling & Ledger
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  Eligible active mandates automatically present due instalments. Run sandbox simulations to test bank clearing outcomes.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="button primary"
                  style={{ background: '#0d9488', borderColor: '#0d9488', color: '#ffffff', fontWeight: 600 }}
                  onClick={() => handleRunDebitSimulation('auto')}
                  disabled={busy}
                >
                  ▶ Simulate Due Debits Run
                </button>
                <button
                  type="button"
                  className="button outline"
                  onClick={() => handleRunDebitSimulation('force_fail')}
                  disabled={busy}
                  title="Simulate insufficient funds return (Code 05) for testing"
                >
                  Simulate Failure Test (Code 05)
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() =>
                    exportCsv(
                      'sandbox-debits-ledger',
                      ['Debit ID', 'Mandate Ref', 'Student Name', 'Installment', 'Amount (INR)', 'Status', 'Failure Reason', 'Execution Date'],
                      debits.map((d) => [d.id, d.mandate_reference, d.student_name, d.installment_name, d.amount_minor / 100, d.status, d.failure_reason || '', d.execution_date]),
                    )
                  }
                >
                  ↓ Export CSV
                </button>
              </div>
            </div>
          </section>

          {/* Debit Transactions Table */}
          <section className="admin-panel" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Debit Presentation Attempts</h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Debit Rail Filter */}
                <div style={{ display: 'inline-flex', borderRadius: 6, border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setDebitRailFilter('all')}
                    style={{
                      padding: '5px 10px',
                      fontSize: '12px',
                      fontWeight: debitRailFilter === 'all' ? 700 : 500,
                      background: debitRailFilter === 'all' ? '#0d9488' : '#ffffff',
                      color: debitRailFilter === 'all' ? '#ffffff' : '#475569',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    All ({debits.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebitRailFilter('upi_autopay')}
                    style={{
                      padding: '5px 10px',
                      fontSize: '12px',
                      fontWeight: debitRailFilter === 'upi_autopay' ? 700 : 500,
                      background: debitRailFilter === 'upi_autopay' ? '#0d9488' : '#ffffff',
                      color: debitRailFilter === 'upi_autopay' ? '#ffffff' : '#475569',
                      borderLeft: '1px solid #cbd5e1',
                      borderRight: '1px solid #cbd5e1',
                      borderTop: 'none',
                      borderBottom: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    ⚡ UPI ({debits.filter((d) => d.mandate_reference.includes('UPI') || d.rrn_reference).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebitRailFilter('enach')}
                    style={{
                      padding: '5px 10px',
                      fontSize: '12px',
                      fontWeight: debitRailFilter === 'enach' ? 700 : 500,
                      background: debitRailFilter === 'enach' ? '#0d9488' : '#ffffff',
                      color: debitRailFilter === 'enach' ? '#ffffff' : '#475569',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    🏦 eNACH ({debits.filter((d) => !d.mandate_reference.includes('UPI') && !d.rrn_reference).length})
                  </button>
                </div>

                <input
                  type="search"
                  placeholder="Filter debits by student, ID, batch…"
                  value={debitSearch}
                  onChange={(e) => setDebitSearch(e.target.value)}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '13px', minWidth: 200 }}
                />
                <select
                  value={debitStatusFilter}
                  onChange={(e) => setDebitStatusFilter(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="">All Statuses</option>
                  <option value="succeeded">Succeeded (Sandbox)</option>
                  <option value="failed">Failed (Sandbox)</option>
                  <option value="queued">Queued</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table" style={{ minWidth: 1020 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 130, whiteSpace: 'nowrap' }}>Debit Attempt &amp; Rail</th>
                    <th style={{ minWidth: 120, whiteSpace: 'nowrap' }}>Mandate Ref</th>
                    <th style={{ minWidth: 130 }}>Student</th>
                    <th style={{ minWidth: 140 }}>Instalment</th>
                    <th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>Amount</th>
                    <th style={{ minWidth: 130, whiteSpace: 'nowrap' }}>Scheduled / Executed</th>
                    <th style={{ minWidth: 120, whiteSpace: 'nowrap' }}>Simulated Result</th>
                    <th style={{ minWidth: 80, whiteSpace: 'nowrap' }}>Retry Count</th>
                    <th style={{ minWidth: 120, whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {debits
                    .filter((d) => {
                      const isUpi = d.mandate_reference.includes('UPI') || Boolean(d.rrn_reference);
                      if (debitRailFilter === 'upi_autopay' && !isUpi) return false;
                      if (debitRailFilter === 'enach' && isUpi) return false;
                      if (debitStatusFilter && d.status !== debitStatusFilter) return false;
                      if (!debitSearch) return true;
                      const q = debitSearch.toLowerCase();
                      return (
                        d.id.toLowerCase().includes(q) ||
                        d.mandate_reference.toLowerCase().includes(q) ||
                        d.student_name.toLowerCase().includes(q) ||
                        d.installment_name.toLowerCase().includes(q) ||
                        d.provider_reference.toLowerCase().includes(q)
                      );
                    })
                    .map((d) => {
                      const isUpi = d.mandate_reference.includes('UPI') || Boolean(d.rrn_reference);
                      return (
                      <tr key={d.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <strong style={{ fontSize: '12px' }}>{d.id}</strong>
                          <div style={{ marginTop: 2 }}>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: 3,
                                background: isUpi ? '#ecfdf5' : '#eff6ff',
                                color: isUpi ? '#065f46' : '#1e40af',
                                border: isUpi ? '1px solid #a7f3d0' : '1px solid #bfdbfe',
                              }}
                            >
                              {isUpi ? '⚡ UPI' : '🏦 eNACH'}
                            </span>
                          </div>
                          {d.rrn_reference ? (
                            <div style={{ fontSize: '10px', color: '#0d9488', fontWeight: 600 }}>RRN: {d.rrn_reference}</div>
                          ) : (
                            <div style={{ fontSize: '10px', color: '#64748b' }}>{d.provider_batch_id || d.provider_reference}</div>
                          )}
                        </td>
                        <td style={{ fontSize: '12px', color: '#0f766e', fontWeight: 600, whiteSpace: 'nowrap' }}>{d.mandate_reference}</td>
                        <td>
                          <strong>{d.student_name}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{d.account_reference}</div>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <div style={{ fontWeight: 600 }}>{d.installment_name}</div>
                          <div style={{ fontSize: '10px', color: '#0f766e', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {d.installment_name.includes('1') ? '01-Jul-2026 → 30-Sep-2026' : d.installment_name.includes('2') ? '01-Oct-2026 → 31-Dec-2026' : d.installment_name.includes('3') ? '01-Jan-2027 → 31-Mar-2027' : '01-Apr-2027 → 30-Jun-2027'}
                          </div>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <strong>{formatMoney(d.amount_minor)}</strong>
                        </td>
                        <td style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          <div>Sched: {d.scheduled_date}</div>
                          {d.execution_date && <div>Exec: {new Date(d.execution_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>}
                          {isUpi ? (
                            <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>✓ 24h Pre-Debit Alert</div>
                          ) : (
                            <div style={{ fontSize: '10px', color: '#1e40af', fontWeight: 600 }}>✓ Clearing Cycle T-1</div>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div>{renderStatusBadge(d.status)}</div>
                          {d.failure_reason && (
                            <div style={{ fontSize: '10px', color: '#dc2626', marginTop: 2 }}>{d.failure_reason}</div>
                          )}
                        </td>
                        <td style={{ fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {d.attempt_no} / {d.max_retries}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="button secondary"
                              style={{ fontSize: '11px', padding: '3px 8px', whiteSpace: 'nowrap' }}
                              onClick={() => setSelectedDebit(d)}
                            >
                              Details
                            </button>
                            {d.status === 'succeeded' && (
                              <button
                                type="button"
                                className="button secondary"
                                style={{ fontSize: '11px', padding: '3px 8px', background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46', fontWeight: 600, whiteSpace: 'nowrap' }}
                                onClick={() => setViewReceiptDebit(d)}
                                title="View authentic UPI AutoPay receipt"
                              >
                                Receipt 🧾
                              </button>
                            )}
                            {d.status === 'failed' && d.attempt_no < d.max_retries && (
                              <button
                                type="button"
                                className="button primary"
                                style={{ fontSize: '11px', padding: '3px 8px', background: '#0d9488' }}
                                onClick={() => setRetryModalDebit(d)}
                              >
                                Retry
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {debits.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                        No debit attempts recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 6: FAILED PAYMENTS (Module 7)                         */}
      {/* ========================================================= */}
      {activeTab === 'failures' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <section className="admin-panel" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <span className="eyebrow" style={{ textTransform: 'uppercase', color: '#dc2626', fontWeight: 600 }}>
                  Module 7 · Failed Collection Investigations
                </span>
                <h3 style={{ margin: '4px 0 4px', fontSize: '1.15rem', fontWeight: 700 }}>Failed Sandbox Debit Outcomes</h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  Simulated return conditions (Insufficient funds [NPCI Code U69], Inactive mandate [NPCI Code U30], Limit exceeded [NPCI Code ZM]). Tagged as simulated provider outcomes.
                </p>
              </div>
              <button
                type="button"
                className="button primary"
                style={{ background: '#0d9488' }}
                onClick={() => setActiveTab('recovery')}
              >
                Go to Recovery Queue →
              </button>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table" style={{ minWidth: 1020 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 130 }}>Student & Ref</th>
                    <th style={{ minWidth: 130 }}>Payer Contact</th>
                    <th style={{ minWidth: 120, whiteSpace: 'nowrap' }}>Mandate UMN</th>
                    <th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>Failed Amount</th>
                    <th style={{ minWidth: 110, whiteSpace: 'nowrap' }}>Failure Date</th>
                    <th style={{ minWidth: 180 }}>Simulated Code & Reason</th>
                    <th style={{ minWidth: 120, whiteSpace: 'nowrap' }}>Retry Eligibility</th>
                    <th style={{ minWidth: 120, whiteSpace: 'nowrap' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {failedDebits.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <strong>{f.student_name}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{f.account_reference}</div>
                      </td>
                      <td>
                        <div>{f.payer_name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{f.payer_phone}</div>
                      </td>
                      <td style={{ fontSize: '12px', color: '#0f766e', fontWeight: 600, whiteSpace: 'nowrap' }}>{f.mandate_reference}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <strong style={{ color: '#dc2626' }}>{formatMoney(f.amount_minor)}</strong>
                      </td>
                      <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{new Date(f.execution_date).toLocaleDateString('en-IN')}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '2px 6px', borderRadius: 4, fontSize: '11px', whiteSpace: 'nowrap' }}>
                          {f.failure_code || 'U69'}
                        </span>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: 2 }}>{f.failure_reason}</div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {f.recovery_status === 'retry_scheduled' || f.recovery_status === 'eligible' ? (
                          <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                            ✓ Eligible ({f.attempt_no}/{f.max_retries})
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Ineligible / Exceeded</span>
                        )}
                      </td>
                      <td>
                        {f.attempt_no < f.max_retries && f.recovery_status !== 'ineligible' ? (
                          <button
                            type="button"
                            className="button primary"
                            style={{ fontSize: '11px', padding: '3px 8px', background: '#0d9488' }}
                            onClick={() => setRetryModalDebit(f)}
                          >
                            Retry Now
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="button outline"
                            style={{ fontSize: '11px', padding: '3px 8px' }}
                            onClick={() => alert(`Reviewing exception notes for ${f.student_name}. Mandate investigation open.`)}
                          >
                            Investigate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {failedDebits.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: '#16a34a', padding: '2rem' }}>
                        ✓ No failed debit attempts currently recorded in sandbox.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 7: RECOVERY & RETRIES (Module 8)                      */}
      {/* ========================================================= */}
      {activeTab === 'recovery' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <section className="admin-panel" style={{ margin: 0 }}>
            <span className="eyebrow" style={{ textTransform: 'uppercase', color: '#0d9488', fontWeight: 600 }}>
              Module 8 · Safe Sandbox Recovery
            </span>
            <h3 style={{ margin: '4px 0 8px', fontSize: '1.2rem', fontWeight: 700 }}>
              Recovery Workflow & Re-Presentment Rules
            </h3>
            <p style={{ margin: '0 0 1.25rem', color: '#64748b', fontSize: '13px' }}>
              Guardrails prevent duplicate concurrent retries, check maximum retry attempt limits (max 3), and ensure cancelled mandates are never re-presented.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Retry Presentation Policy
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, marginTop: 4, color: '#0f172a' }}>
                  Smart Interval (3 Days after failure)
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Presents on parent salary window (1st-5th of calendar month) or T+3 banking days.
                </p>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Maximum Retry Ceiling
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, marginTop: 4, color: '#0f172a' }}>
                  3 Attempts per Instalment
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                  After 3 failed cycles, mandate is escalated to direct offline parent counselling.
                </p>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Recovery Success Rate (Simulation)
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, marginTop: 4, color: '#16a34a' }}>
                  85.4% on 2nd Presentment
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                  High simulated recovery due to automated WhatsApp debit alerts prior to retry.
                </p>
              </div>
            </div>

            <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 700 }}>Scheduled Retry Queue</h4>
            <div className="admin-table-wrap">
              <table className="admin-table" style={{ minWidth: 980 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 130 }}>Student Name</th>
                    <th style={{ minWidth: 120, whiteSpace: 'nowrap' }}>Mandate UMN</th>
                    <th style={{ minWidth: 120 }}>Instalment</th>
                    <th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>Amount</th>
                    <th style={{ minWidth: 160 }}>Previous Failure</th>
                    <th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>Retry Count</th>
                    <th style={{ minWidth: 110, whiteSpace: 'nowrap' }}>Scheduled Date</th>
                    <th style={{ minWidth: 120, whiteSpace: 'nowrap' }}>Immediate Action</th>
                  </tr>
                </thead>
                <tbody>
                  {failedDebits
                    .filter((f) => f.attempt_no < f.max_retries && f.recovery_status !== 'ineligible')
                    .map((f) => (
                      <tr key={f.id}>
                        <td>
                          <strong>{f.student_name}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{f.account_reference}</div>
                        </td>
                        <td style={{ fontSize: '12px', color: '#0f766e', fontWeight: 600, whiteSpace: 'nowrap' }}>{f.mandate_reference}</td>
                        <td style={{ fontSize: '12px' }}>{f.installment_name}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <strong>{formatMoney(f.amount_minor)}</strong>
                        </td>
                        <td style={{ fontSize: '11px', color: '#dc2626' }}>
                          {f.failure_code}: {f.failure_reason}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          Attempt {f.attempt_no + 1} of {f.max_retries}
                        </td>
                        <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{f.next_retry_date || '2026-10-24'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="button primary"
                            style={{ fontSize: '11px', padding: '3px 10px', background: '#0d9488' }}
                            onClick={() => setRetryModalDebit(f)}
                          >
                            Trigger Sandbox Retry Now ⚡
                          </button>
                        </td>
                      </tr>
                    ))}
                  {failedDebits.filter((f) => f.attempt_no < f.max_retries && f.recovery_status !== 'ineligible').length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                        No debits currently queued for retry presentation.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 8: RECONCILIATION (Module 9)                          */}
      {/* ========================================================= */}
      {activeTab === 'reconciliation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <section className="admin-panel" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <span className="eyebrow" style={{ textTransform: 'uppercase', color: '#0d9488', fontWeight: 600 }}>
                  Module 9 · Isolated Sandbox Reconciliation
                </span>
                <h3 style={{ margin: '4px 0 4px', fontSize: '1.15rem', fontWeight: 700 }}>
                  NPCI Settlement & Clearing Reconciliation (AutoPay & eNACH)
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  Audits expected debit amounts against simulated clearing reports and settlement batches across both UPI AutoPay and eNACH rails.
                </p>
              </div>
              <button
                type="button"
                className="button primary"
                style={{ background: '#0d9488' }}
                onClick={handleRunReconciliation}
                disabled={busy}
              >
                ↻ Run Reconciliation Batch
              </button>
            </div>

            {/* Reconciliation Rail Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Clearing Rail:</span>
              <button
                type="button"
                onClick={() => setReconciliationRailFilter('all')}
                style={{
                  padding: '4px 12px',
                  borderRadius: 9999,
                  fontSize: '11.5px',
                  fontWeight: reconciliationRailFilter === 'all' ? 700 : 500,
                  border: '1px solid',
                  borderColor: reconciliationRailFilter === 'all' ? '#0d9488' : '#cbd5e1',
                  background: reconciliationRailFilter === 'all' ? '#0d9488' : '#ffffff',
                  color: reconciliationRailFilter === 'all' ? '#ffffff' : '#334155',
                  cursor: 'pointer',
                }}
              >
                All Clearing Records ({reconciliations.length})
              </button>
              <button
                type="button"
                onClick={() => setReconciliationRailFilter('upi_autopay')}
                style={{
                  padding: '4px 12px',
                  borderRadius: 9999,
                  fontSize: '11.5px',
                  fontWeight: reconciliationRailFilter === 'upi_autopay' ? 700 : 500,
                  border: '1px solid',
                  borderColor: reconciliationRailFilter === 'upi_autopay' ? '#0d9488' : '#cbd5e1',
                  background: reconciliationRailFilter === 'upi_autopay' ? '#0d9488' : '#ffffff',
                  color: reconciliationRailFilter === 'upi_autopay' ? '#ffffff' : '#334155',
                  cursor: 'pointer',
                }}
              >
                ⚡ UPI AutoPay ({reconciliations.filter((r) => r.mandate_reference.startsWith('UMN-UPI') || r.clearing_cycle.includes('UPI')).length})
              </button>
              <button
                type="button"
                onClick={() => setReconciliationRailFilter('enach')}
                style={{
                  padding: '4px 12px',
                  borderRadius: 9999,
                  fontSize: '11.5px',
                  fontWeight: reconciliationRailFilter === 'enach' ? 700 : 500,
                  border: '1px solid',
                  borderColor: reconciliationRailFilter === 'enach' ? '#0284c7' : '#cbd5e1',
                  background: reconciliationRailFilter === 'enach' ? '#0284c7' : '#ffffff',
                  color: reconciliationRailFilter === 'enach' ? '#ffffff' : '#334155',
                  cursor: 'pointer',
                }}
              >
                🏦 eNACH Clearing ({reconciliations.filter((r) => r.mandate_reference.startsWith('UMRN-ENACH') || r.clearing_cycle.includes('eNACH') || r.clearing_cycle.includes('NACH')).length})
              </button>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table" style={{ minWidth: 1100 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 140, whiteSpace: 'nowrap' }}>Reconciliation Ref</th>
                    <th style={{ minWidth: 110, whiteSpace: 'nowrap' }}>Clearing Rail</th>
                    <th style={{ minWidth: 120, whiteSpace: 'nowrap' }}>Debit Attempt</th>
                    <th style={{ minWidth: 130, whiteSpace: 'nowrap' }}>Mandate Ref</th>
                    <th style={{ minWidth: 130 }}>Student</th>
                    <th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>Expected Amount</th>
                    <th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>Cleared Amount</th>
                    <th style={{ minWidth: 90, whiteSpace: 'nowrap' }}>Variance</th>
                    <th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ minWidth: 140 }}>Clearing Session / Exception</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliations
                    .filter((r) => {
                      if (reconciliationRailFilter === 'upi_autopay') {
                        return r.mandate_reference.startsWith('UMN-UPI') || r.clearing_cycle.includes('UPI');
                      }
                      if (reconciliationRailFilter === 'enach') {
                        return r.mandate_reference.startsWith('UMRN-ENACH') || r.clearing_cycle.includes('eNACH') || r.clearing_cycle.includes('NACH');
                      }
                      return true;
                    })
                    .map((r) => {
                      const isUpi = r.mandate_reference.startsWith('UMN-UPI') || r.clearing_cycle.includes('UPI');
                      return (
                        <tr key={r.id}>
                          <td style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.id}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {isUpi ? (
                              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#0f766e', background: '#ccfbf1', padding: '2px 8px', borderRadius: 9999, border: '1px solid #99f6e4' }}>
                                ⚡ UPI AutoPay
                              </span>
                            ) : (
                              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: 9999, border: '1px solid #bae6fd' }}>
                                🏦 eNACH
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{r.debit_attempt_id}</td>
                          <td style={{ fontSize: '12px', color: '#0f766e', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{r.mandate_reference}</td>
                          <td>
                            <strong>{r.student_name}</strong>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{formatMoney(r.expected_amount_minor)}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <strong>{formatMoney(r.simulated_successful_amount_minor)}</strong>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span style={{ color: r.variance_minor > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                              {formatMoney(r.variance_minor)}
                            </span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{renderStatusBadge(r.status)}</td>
                          <td style={{ fontSize: '11px', color: '#64748b' }}>
                            {r.exception_reason ? (
                              <span style={{ color: '#dc2626' }}>{r.exception_reason}</span>
                            ) : (
                              r.clearing_cycle
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 9: NOTIFICATIONS (Module 10)                          */}
      {/* ========================================================= */}
      {activeTab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <section className="admin-panel" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <span className="eyebrow" style={{ textTransform: 'uppercase', color: '#0d9488', fontWeight: 600 }}>
                  Module 10 · Communication Automation
                </span>
                <h3 style={{ margin: '4px 0 4px', fontSize: '1.15rem', fontWeight: 700 }}>Sandbox Notification Logs</h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  Audits simulated parent communications: Mandate setup notices, pre-debit T-2 reminders, receipts, and failure advisories.
                </p>
              </div>
              <button
                type="button"
                className="button primary"
                style={{ background: '#0d9488' }}
                onClick={() => setTestNotificationModal(true)}
              >
                + Send Test Preview Notice
              </button>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table" style={{ minWidth: 980 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 120, whiteSpace: 'nowrap' }}>Event Type</th>
                    <th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>Channel</th>
                    <th style={{ minWidth: 140 }}>Recipient</th>
                    <th style={{ minWidth: 140 }}>Subject / Header</th>
                    <th style={{ minWidth: 220 }}>Message Snapshot</th>
                    <th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ minWidth: 140, whiteSpace: 'nowrap' }}>Dispatched Date</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((n) => (
                    <tr key={n.id}>
                      <td style={{ fontSize: '12px', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                        <strong>{n.event_type.replace(/_/g, ' ')}</strong>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: n.channel.includes('WhatsApp') ? '#ecfdf5' : '#eff6ff',
                            color: n.channel.includes('WhatsApp') ? '#047857' : '#1d4ed8',
                            border: '1px solid rgba(0,0,0,0.05)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {n.channel}
                        </span>
                      </td>
                      <td>
                        <div>{n.recipient_name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{n.recipient_phone}</div>
                      </td>
                      <td style={{ fontSize: '12px', fontWeight: 600 }}>{n.title}</td>
                      <td style={{ fontSize: '12px', color: '#334155' }}>{n.message}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{renderStatusBadge(n.status)}</td>
                      <td style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(n.sent_at).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 10: REPORTS (Module 11)                               */}
      {/* ========================================================= */}
      {activeTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <section className="admin-panel" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <span className="eyebrow" style={{ textTransform: 'uppercase', color: '#0d9488', fontWeight: 600 }}>
                  Module 11 · Institutional AutoPay & eNACH Reports
                </span>
                <h3 style={{ margin: '4px 0 4px', fontSize: '1.15rem', fontWeight: 700 }}>AutoPay & eNACH Reports & Analytics</h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  Generate and download 9 specialized recurring collection reports covering UPI AutoPay and eNACH operations. Clearly watermarked as Sandbox / Test data.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="button primary"
                  style={{ background: '#0d9488' }}
                  onClick={() => {
                    if (!reportData?.rows || reportData.rows.length === 0) return;
                    const headers = Object.keys(reportData.rows[0]);
                    const rows = reportData.rows.map((r: any) => headers.map((k) => r[k]));
                    exportCsv(`auto-upi-report-${reportType}`, headers, rows);
                  }}
                  disabled={!reportData?.rows || reportData.rows.length === 0}
                >
                  ↓ Export Report CSV
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => window.print()}
                >
                  ⎙ Print / PDF Preview
                </button>
              </div>
            </div>

            {/* Report Selector Pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {[
                { id: 'active_mandates', label: '1. Active Mandates' },
                { id: 'registrations', label: '2. All Registrations' },
                { id: 'pending_authorizations', label: '3. Pending Authorizations' },
                { id: 'scheduled_debits', label: '4. Scheduled Debits' },
                { id: 'successful_debits', label: '5. Successful Debits' },
                { id: 'failed_debits', label: '6. Failed Debits' },
                { id: 'recovery_attempts', label: '7. Recovery Attempts' },
                { id: 'reconciliation', label: '8. Reconciliation Ledger' },
                { id: 'investigations', label: '9. Dispute History' },
              ].map((rpt) => (
                <button
                  key={rpt.id}
                  type="button"
                  onClick={() => setReportType(rpt.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    border: '1px solid',
                    borderColor: reportType === rpt.id ? '#0d9488' : '#cbd5e1',
                    background: reportType === rpt.id ? '#0d9488' : '#ffffff',
                    color: reportType === rpt.id ? '#ffffff' : '#334155',
                    fontWeight: reportType === rpt.id ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {rpt.label}
                </button>
              ))}
            </div>

            {/* Watermark Banner */}
            <div style={{ background: '#f8fafc', border: '1px dashed #94a3b8', borderRadius: 6, padding: '8px 12px', marginBottom: '1rem', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>
              SANDBOX / TEST DATA REPORT — STRICTLY NON-FINANCIAL
            </div>

            {/* Dynamic Report Table */}
            <div className="admin-table-wrap">
              <table className="admin-table" style={{ minWidth: 720 }}>
                <thead>
                  {reportData?.rows && reportData.rows.length > 0 ? (
                    <tr>
                      {Object.keys(reportData.rows[0]).map((key) => (
                        <th key={key} style={{ textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                          {key.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  ) : (
                    <tr>
                      <th>Report Data</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {reportData?.rows && reportData.rows.length > 0 ? (
                    reportData.rows.map((row: any, i: number) => (
                      <tr key={i}>
                        {Object.keys(row).map((key) => (
                          <td key={key} style={{ fontSize: '12px' }}>
                            {typeof row[key] === 'number' && key.includes('amount')
                              ? formatMoney(row[key] * 100)
                              : String(row[key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                        No records matching the selected report type in sandbox.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 11: AUDIT & COMPLIANCE (Module 12)                    */}
      {/* ========================================================= */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <section className="admin-panel" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <span className="eyebrow" style={{ textTransform: 'uppercase', color: '#0d9488', fontWeight: 600 }}>
                  Module 12 · Compliance & Tamper-Resistant Trail
                </span>
                <h3 style={{ margin: '4px 0 4px', fontSize: '1.15rem', fontWeight: 700 }}>
                  AutoPay & eNACH Immutable Audit Ledger
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  Cryptographically referenced chronological log of all mandate creations, payer authorizations, cancellations, and debit attempts.
                </p>
              </div>
              <button
                type="button"
                className="button secondary"
                onClick={() => setShowDiagnosticsDrawer(true)}
              >
                Provider Diagnostics & Live Matrix ⚙️
              </button>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table" style={{ minWidth: 980 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 150, whiteSpace: 'nowrap' }}>Timestamp</th>
                    <th style={{ minWidth: 130 }}>Actor (Staff / System)</th>
                    <th style={{ minWidth: 120, whiteSpace: 'nowrap' }}>Event Type</th>
                    <th style={{ minWidth: 120, whiteSpace: 'nowrap' }}>Target Reference</th>
                    <th style={{ minWidth: 110, whiteSpace: 'nowrap' }}>Action</th>
                    <th style={{ minWidth: 200 }}>Audit Details</th>
                    <th style={{ minWidth: 110, whiteSpace: 'nowrap' }}>IP / Origin</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleString('en-IN')}
                      </td>
                      <td>
                        <strong style={{ fontSize: '12px' }}>{log.actor}</strong>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 6px', background: '#f1f5f9', borderRadius: 4, whiteSpace: 'nowrap' }}>
                          {log.event_type}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: '#0f766e', fontWeight: 600, whiteSpace: 'nowrap' }}>{log.reference}</td>
                      <td style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{log.action}</td>
                      <td style={{ fontSize: '12px', color: '#334155' }}>{log.details}</td>
                      <td style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{log.ip_address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 0: Share eNACH Setup Link to Student for Approval   */}
      {/* ========================================================= */}
      {shareModalData && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(7, 43, 38, 0.72)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 9999,
            animation: 'fadeInOverlay 0.2s ease-out both',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 20,
              padding: '24px 28px',
              maxWidth: 620,
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(6, 45, 42, 0.28)',
              border: '1px solid rgba(7, 53, 51, 0.12)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    background: '#eafbf4',
                    color: '#075e47',
                    border: '1px solid #a3ebce',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: '6px',
                  }}
                >
                  ⚡ Auto UPI Mandate Created · Approval Link Ready
                </span>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#073533' }}>
                  Share Auto UPI Setup Link to Student for Approval
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShareModalData(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  fontSize: '16px',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: '#587973', lineHeight: 1.5 }}>
              Dispatch an encrypted mandate authorization link to the student or guardian. They can open the link, verify the auto-debit schedule, enter their banking details, and approve via WhatsApp, SMS, or Email.
            </p>

            {/* Mandate Summary Overview */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                padding: '14px 16px',
                marginBottom: '18px',
                fontSize: '12.5px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '10px',
              }}
            >
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Mandate UMN Reference</span>
                <strong style={{ color: '#0d9488', fontFamily: 'monospace' }}>{shareModalData.mandate.mandate_reference}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Student</span>
                <strong style={{ color: '#0f172a' }}>{shareModalData.mandate.student_name} ({shareModalData.mandate.account_reference})</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Authorized Payer / Guardian</span>
                <strong style={{ color: '#0f172a' }}>{shareModalData.mandate.payer_name}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Mandate Cap / Frequency</span>
                <strong style={{ color: '#0f766e' }}>{formatMoney(shareModalData.mandate.max_amount_minor)} ({shareModalData.mandate.frequency})</strong>
              </div>
            </div>

            {/* Recipient Configuration */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#073533', marginBottom: '6px' }}>
                Recipient Designation &amp; Contact Info
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                <select
                  value={shareModalData.recipientType}
                  onChange={(e) => {
                    const type = e.target.value as 'student' | 'guardian';
                    setShareModalData((prev) =>
                      prev
                        ? {
                            ...prev,
                            recipientType: type,
                            recipientName:
                              type === 'student'
                                ? prev.mandate.student_name || 'V Rakesh'
                                : prev.mandate.payer_name || 'Rajesh Sharma',
                            recipientPhone:
                              type === 'student'
                                ? prev.mandate.payer_phone || '+91 98765 43210'
                                : prev.mandate.payer_phone || '+91 98765 00000',
                            recipientEmail:
                              type === 'student'
                                ? 'student@example.com'
                                : prev.mandate.payer_email || 'parent@example.com',
                          }
                        : null
                    );
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#073533',
                    background: '#ffffff',
                    fontWeight: 600,
                  }}
                >
                  <option value="student">🎓 Student: {shareModalData.mandate.student_name}</option>
                  <option value="guardian">👨‍👩‍👦 Guardian: {shareModalData.mandate.payer_name}</option>
                </select>

                <input
                  type="tel"
                  value={shareModalData.recipientPhone}
                  onChange={(e) => {
                    const val = e.target.value;
                    setShareModalData((prev) => (prev ? { ...prev, recipientPhone: val } : null));
                  }}
                  placeholder="Mobile / WhatsApp (+91 98765 43210)"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#073533',
                  }}
                />

                <input
                  type="email"
                  value={shareModalData.recipientEmail}
                  onChange={(e) => {
                    const val = e.target.value;
                    setShareModalData((prev) => (prev ? { ...prev, recipientEmail: val } : null));
                  }}
                  placeholder="Email address (payer@example.com)"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#073533',
                  }}
                />
              </div>
            </div>

            {/* Share Channel Cards: WhatsApp, SMS, Email */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#073533', marginBottom: '8px' }}>
                Select Delivery Channel (WhatsApp, SMS, Email)
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
                {/* 1. WhatsApp Button */}
                <div
                  style={{
                    border: shareModalData.sentChannels.whatsapp ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '12px',
                    background: shareModalData.sentChannels.whatsapp ? '#ecfdf5' : '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '18px' }}>💬</span>
                      <strong style={{ fontSize: '13px', color: '#073533' }}>WhatsApp</strong>
                    </div>
                    {shareModalData.sentChannels.whatsapp && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '2px 6px', borderRadius: 9999 }}>
                        ✓ Shared
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                    Send direct WhatsApp message with approval link.
                  </p>
                  <button
                    type="button"
                    className="button"
                    style={{
                      background: '#25D366',
                      borderColor: '#25D366',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '12px',
                      padding: '6px 10px',
                      borderRadius: 8,
                      width: '100%',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      const cleanPhone = (shareModalData.recipientPhone || '').replace(/\D/g, '');
                      const isMandateUpi = shareModalData.mandate.rail ? shareModalData.mandate.rail.includes('UPI') : !!shareModalData.mandate.payer_vpa;
                      const railName = isMandateUpi ? 'Auto UPI' : 'eNACH bank mandate';
                      const msg = `Hello ${shareModalData.recipientName}, please review and approve the ${railName} auto-debit schedule for student ${shareModalData.mandate.student_name} (${shareModalData.mandate.account_reference}) for ${formatMoney(shareModalData.mandate.max_amount_minor)}. Authorize securely here: ${shareModalData.approvalUrl}`;
                      const waUrl = cleanPhone
                        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`
                        : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
                      window.open(waUrl, '_blank');
                      setShareModalData((prev) =>
                        prev ? { ...prev, sentChannels: { ...prev.sentChannels, whatsapp: true } } : null
                      );
                      void request('admin/enach/notifications/test', 'POST', {
                        event_type: 'mandate_share_link',
                        channel: 'WhatsApp',
                        recipient_name: shareModalData.recipientName,
                        recipient_phone: shareModalData.recipientPhone,
                        recipient_email: shareModalData.recipientEmail,
                        title: `${isMandateUpi ? 'Auto UPI' : 'eNACH'} Approval Link (WhatsApp): ${shareModalData.mandate.student_name}`,
                        message: msg,
                        status: 'delivered',
                      }).then(() => setRefreshCount((n) => n + 1));
                      showToast(`✓ WhatsApp approval link initiated for ${shareModalData.recipientName}`);
                    }}
                  >
                    Share on WhatsApp ↗
                  </button>
                </div>

                {/* 2. SMS Button */}
                <div
                  style={{
                    border: shareModalData.sentChannels.sms ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '12px',
                    background: shareModalData.sentChannels.sms ? '#f0f9ff' : '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '18px' }}>📱</span>
                      <strong style={{ fontSize: '13px', color: '#073533' }}>SMS Alert</strong>
                    </div>
                    {shareModalData.sentChannels.sms && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '2px 6px', borderRadius: 9999 }}>
                        ✓ Dispatched
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                    Dispatch instant SMS alert to recipient phone.
                  </p>
                  <button
                    type="button"
                    className="button"
                    style={{
                      background: '#0284c7',
                      borderColor: '#0284c7',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '12px',
                      padding: '6px 10px',
                      borderRadius: 8,
                      width: '100%',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      const cleanPhone = (shareModalData.recipientPhone || '').replace(/\D/g, '');
                      const isMandateUpi = shareModalData.mandate.rail ? shareModalData.mandate.rail.includes('UPI') : !!shareModalData.mandate.payer_vpa;
                      const railName = isMandateUpi ? 'Auto UPI' : 'eNACH bank mandate';
                      const msg = `Hello ${shareModalData.recipientName}, please review and authorize the ${railName} recurring fee schedule for student ${shareModalData.mandate.student_name} (${shareModalData.mandate.account_reference}) with limit ${formatMoney(shareModalData.mandate.max_amount_minor)}. Authorize securely here: ${shareModalData.approvalUrl}`;
                      const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(msg)}`;
                      try {
                        window.open(smsUrl, '_blank');
                      } catch {}
                      setShareModalData((prev) =>
                        prev ? { ...prev, sentChannels: { ...prev.sentChannels, sms: true } } : null
                      );
                      void request('admin/enach/notifications/test', 'POST', {
                        event_type: 'mandate_share_link',
                        channel: 'SMS',
                        recipient_name: shareModalData.recipientName,
                        recipient_phone: shareModalData.recipientPhone,
                        recipient_email: shareModalData.recipientEmail,
                        title: `${isMandateUpi ? 'Auto UPI' : 'eNACH'} Authorization Link (SMS): ${shareModalData.mandate.student_name}`,
                        message: msg,
                        status: 'delivered',
                      }).then(() => setRefreshCount((n) => n + 1));
                      showToast(`✓ SMS alert dispatched to ${shareModalData.recipientPhone}`);
                    }}
                  >
                    Dispatch via SMS ↗
                  </button>
                </div>

                {/* 3. Email Button */}
                <div
                  style={{
                    border: shareModalData.sentChannels.email ? '1.5px solid #7c3aed' : '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '12px',
                    background: shareModalData.sentChannels.email ? '#faf5ff' : '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '18px' }}>✉️</span>
                      <strong style={{ fontSize: '13px', color: '#073533' }}>Email Invite</strong>
                    </div>
                    {shareModalData.sentChannels.email && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#7c3aed', background: '#f3e8ff', padding: '2px 6px', borderRadius: 9999 }}>
                        ✓ Dispatched
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                    Send official email invite with approval button.
                  </p>
                  <button
                    type="button"
                    className="button"
                    style={{
                      background: '#7c3aed',
                      borderColor: '#7c3aed',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '12px',
                      padding: '6px 10px',
                      borderRadius: 8,
                      width: '100%',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      const isMandateUpi = shareModalData.mandate.rail ? shareModalData.mandate.rail.includes('UPI') : !!shareModalData.mandate.payer_vpa;
                      const railName = isMandateUpi ? 'Auto UPI' : 'eNACH';
                      const subject = `Action Required: ${railName} Mandate Authorization for ${shareModalData.mandate.student_name}`;
                      const msg = `Hello ${shareModalData.recipientName},\n\nPlease review and authorize the ${railName} recurring fee schedule for student ${shareModalData.mandate.student_name} (${shareModalData.mandate.account_reference}) with maximum debit cap ${formatMoney(shareModalData.mandate.max_amount_minor)} (${shareModalData.mandate.frequency}).\n\nClick the secure authorization link below to verify your details and approve:\n${shareModalData.approvalUrl}\n\nThank you,\nFinance Department`;
                      const mailtoUrl = `mailto:${encodeURIComponent(shareModalData.recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`;
                      try {
                        window.open(mailtoUrl, '_blank');
                      } catch {}
                      setShareModalData((prev) =>
                        prev ? { ...prev, sentChannels: { ...prev.sentChannels, email: true } } : null
                      );
                      void request('admin/enach/notifications/test', 'POST', {
                        event_type: 'mandate_share_link',
                        channel: 'Email',
                        recipient_name: shareModalData.recipientName,
                        recipient_phone: shareModalData.recipientPhone,
                        recipient_email: shareModalData.recipientEmail,
                        title: `${railName} Authorization Email: ${shareModalData.mandate.student_name}`,
                        message: `Authorization invitation dispatched to ${shareModalData.recipientEmail} with link ${shareModalData.approvalUrl}`,
                        status: 'delivered',
                      }).then(() => setRefreshCount((n) => n + 1));
                      showToast(`✓ Email invitation dispatched to ${shareModalData.recipientEmail}`);
                    }}
                  >
                    Send via Email ↗
                  </button>
                </div>
              </div>
            </div>

            {/* Direct Link Copy Bar */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 12,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                marginBottom: '20px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>
                  Student Direct Authorization Link
                </span>
                <span style={{ fontSize: '12px', color: '#073533', fontFamily: 'monospace', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {shareModalData.approvalUrl}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <a
                  href={shareModalData.approvalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button primary"
                  style={{ fontSize: '12px', padding: '6px 14px', fontWeight: 700, whiteSpace: 'nowrap', borderRadius: 8, background: '#0d9488', textDecoration: 'none', color: '#ffffff' }}
                  title="Open student authorization page in a new browser tab"
                >
                  Open Link ↗
                </a>
                <button
                  type="button"
                  className="button secondary"
                  style={{ fontSize: '12px', padding: '6px 14px', fontWeight: 700, whiteSpace: 'nowrap', borderRadius: 8 }}
                  onClick={async () => {
                    try {
                      if (navigator.clipboard && window.isSecureContext) {
                        await navigator.clipboard.writeText(shareModalData.approvalUrl);
                      } else {
                        const textarea = document.createElement('textarea');
                        textarea.value = shareModalData.approvalUrl;
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        textarea.focus();
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                      }
                      showToast('✓ Authorization link copied to clipboard!');
                    } catch {
                      showToast('✓ Link ready: ' + shareModalData.approvalUrl);
                    }
                  }}
                >
                  Copy Link 📋
                </button>
              </div>
            </div>

            {/* Footer Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="button primary"
                  style={{
                    fontSize: '12.5px',
                    background: shareModalData.mandate.status === 'active' ? '#16a34a' : '#0d9488',
                    borderColor: shareModalData.mandate.status === 'active' ? '#16a34a' : '#0d9488',
                    color: '#ffffff',
                    fontWeight: 700,
                  }}
                  disabled={busy || shareModalData.mandate.status === 'active'}
                  onClick={async () => {
                    const m = shareModalData.mandate;
                    setBusy(true);
                    try {
                      const res = await request<{ ok: boolean; message: string }>(
                        `admin/fees/mandates/${m.id}/authorize`,
                        'POST',
                        {
                          action: 'approve',
                          method: m.auth_mode || 'NetBanking (Simulated)',
                          bank_name: m.bank_name || 'HDFC Bank',
                        },
                      );
                      if (res.ok) {
                        showToast(`✓ Mandate ${m.mandate_reference} is now ACTIVE! Student authorization confirmed.`);
                        setRefreshCount((n) => n + 1);
                        setShareModalData((prev) =>
                          prev ? { ...prev, mandate: { ...prev.mandate, status: 'active' } } : null
                        );
                      }
                    } catch (err: any) {
                      alert(err.message || 'Authorization simulation failed.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {shareModalData.mandate.status === 'active'
                    ? '✓ Mandate Active (Verified)'
                    : (shareModalData.mandate.rail ? shareModalData.mandate.rail.includes('UPI') : !!shareModalData.mandate.payer_vpa)
                    ? '⚡ Simulate UPI AutoPay Approval'
                    : '🏦 Simulate eNACH Approval'}
                </button>

                <button
                  type="button"
                  className="button outline"
                  style={{ fontSize: '12.5px', color: '#0f766e', borderColor: '#a7f3d0', background: '#f0fdfa' }}
                  onClick={() => {
                    const m = shareModalData.mandate;
                    setShareModalData(null);
                    setAuthModalMandate(m);
                  }}
                  title="Open simulated netbanking / card selection dialog"
                >
                  Simulation Options ⚙️
                </button>
              </div>

              <button
                type="button"
                className="button primary"
                style={{ background: '#073533', borderColor: '#073533', color: '#ffffff', fontWeight: 700, padding: '8px 24px', borderRadius: '9999px' }}
                onClick={() => setShareModalData(null)}
              >
                Done ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: Simulated Payer Authorization Workflow           */}
      {/* ========================================================= */}
      {authModalMandate && (() => {
        const isAuthUpi = authModalMandate.rail ? authModalMandate.rail.includes('UPI') : !!authModalMandate.payer_vpa;
        return (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              zIndex: 9999,
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 12,
                padding: '1.75rem',
                maxWidth: 580,
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '20px' }}>{isAuthUpi ? '⚡' : '🏦'}</span>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                    Simulated {isAuthUpi ? 'UPI AutoPay' : 'eNACH'} Payer Authorization
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAuthModalMandate(null)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 14px', marginBottom: '1.25rem' }}>
                <strong style={{ fontSize: '12px', color: '#92400e', textTransform: 'uppercase' }}>
                  Secure Test-Only Workflow
                </strong>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#78350f' }}>
                  {isAuthUpi
                    ? "Simulates the payer's UPI application (Google Pay / PhonePe / Paytm / BHIM) mandate approval request. Payer confirms recurring auto-debit with their simulated UPI PIN. No live banking credentials or money movement occur."
                    : "Simulates the payer's destination bank authorization portal (NetBanking / Debit Card / Aadhaar OTP). Payer confirms recurring auto-debit mandate with simulated OTP. No live banking credentials or money movement occur."}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>{isAuthUpi ? 'Mandate UMN Reference:' : 'Mandate UMRN Reference:'}</span>
                  <strong style={{ color: '#0f766e', fontFamily: 'monospace' }}>{authModalMandate.mandate_reference}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>Payment Rail:</span>
                  <div>{renderRailBadge(authModalMandate.rail)}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Student Name:</span>
                  <strong>{authModalMandate.student_name} ({authModalMandate.account_reference})</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Authorized Payer:</span>
                  <strong>{authModalMandate.payer_name}</strong>
                </div>
                {isAuthUpi ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Payer UPI ID / VPA:</span>
                      <strong style={{ color: '#0d9488' }}>
                        {authModalMandate.payer_vpa || '—'} {authModalMandate.preferred_upi_app ? `(${authModalMandate.preferred_upi_app})` : ''}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Authorization Mode:</span>
                      <span>{authModalMandate.auth_mode}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Bank & Masked Account:</span>
                      <strong>{authModalMandate.bank_name} ({authModalMandate.masked_account})</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Bank IFSC:</span>
                      <strong>{authModalMandate.ifsc_code}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Authorization Rail:</span>
                      <span>{authModalMandate.auth_mode}</span>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Maximum Debit Cap:</span>
                  <strong style={{ color: '#0f766e', fontSize: '14px' }}>{formatMoney(authModalMandate.max_amount_minor)} / month</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="button outline"
                  style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                  onClick={() => handleSimulateAuthorization('reject')}
                  disabled={busy}
                >
                  ✕ Simulate Payer Rejection
                </button>
                <button
                  type="button"
                  className="button primary"
                  style={{ background: '#0d9488', borderColor: '#0d9488', color: '#ffffff', fontWeight: 700 }}
                  onClick={() => handleSimulateAuthorization('approve')}
                  disabled={busy}
                >
                  ✓ Simulate {isAuthUpi ? 'UPI AutoPay' : 'eNACH'} Approval (Activate)
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* MODAL 2: View Mandate Details                             */}
      {/* ========================================================= */}
      {selectedMandate && (() => {
        const isMandateUpi = selectedMandate.rail ? selectedMandate.rail.includes('UPI') : !!selectedMandate.payer_vpa;
        return (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              zIndex: 9999,
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 12,
                padding: '1.75rem',
                maxWidth: 680,
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Mandate Profile</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: '12px', color: '#0f766e', fontWeight: 600, fontFamily: 'monospace' }}>
                      {selectedMandate.mandate_reference}
                    </span>
                    {renderRailBadge(selectedMandate.rail)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMandate(null)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: 8, fontSize: '12px' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Student:</span>
                  <div style={{ fontWeight: 700 }}>{selectedMandate.student_name}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Account Ref:</span>
                  <div style={{ fontWeight: 700 }}>{selectedMandate.account_reference}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Authorized Payer:</span>
                  <div style={{ fontWeight: 700 }}>{selectedMandate.payer_name}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Payment Rail:</span>
                  <div>{renderRailBadge(selectedMandate.rail)}</div>
                </div>
                {isMandateUpi ? (
                  <div>
                    <span style={{ color: '#64748b' }}>UPI ID / VPA:</span>
                    <div style={{ fontWeight: 700, color: '#0d9488' }}>
                      {selectedMandate.payer_vpa || '—'} {selectedMandate.preferred_upi_app ? `(${selectedMandate.preferred_upi_app})` : ''}
                    </div>
                  </div>
                ) : (
                  <div>
                    <span style={{ color: '#64748b' }}>Bank & Masked Account:</span>
                    <div style={{ fontWeight: 700 }}>{selectedMandate.bank_name} ({selectedMandate.masked_account})</div>
                    <div style={{ color: '#64748b' }}>IFSC: {selectedMandate.ifsc_code}</div>
                  </div>
                )}
                <div>
                  <span style={{ color: '#64748b' }}>Phone / Email:</span>
                  <div>{selectedMandate.payer_phone}</div>
                  <div style={{ color: '#64748b' }}>{selectedMandate.payer_email}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Auth Mode:</span>
                  <div style={{ fontWeight: 600 }}>{selectedMandate.auth_mode}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Monthly Cap:</span>
                  <div style={{ fontWeight: 700, color: '#0f766e', fontSize: '14px' }}>{formatMoney(selectedMandate.max_amount_minor)}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Frequency / Status:</span>
                  <div style={{ textTransform: 'capitalize' }}>{selectedMandate.frequency} · {renderStatusBadge(selectedMandate.status)}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Validity Range:</span>
                  <div>{selectedMandate.start_date} to {selectedMandate.end_date}</div>
                </div>
              </div>

            {/* Authorization Events */}
            <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700 }}>Authorization Event Log</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '1.5rem', fontSize: '12px' }}>
              {selectedMandate.authorization_events && selectedMandate.authorization_events.length > 0 ? (
                selectedMandate.authorization_events.map((ev, i) => (
                  <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>{ev.event_type.replace(/_/g, ' ').toUpperCase()}</span>
                      <span style={{ color: '#64748b' }}>{new Date(ev.timestamp).toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ color: '#475569', marginTop: 2 }}>{ev.details || `Auth via ${ev.method} (${ev.bank_name})`}</div>
                  </div>
                ))
              ) : (
                <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>No authorization events recorded.</p>
              )}
            </div>

            {/* Linked Instalments */}
            <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700 }}>Linked Instalments</h4>
            <div className="admin-table-wrap" style={{ marginBottom: '1.5rem' }}>
              <table className="admin-table" style={{ minWidth: 620 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 120 }}>Instalment Name</th>
                    <th style={{ minWidth: 160, whiteSpace: 'nowrap' }}>Instalment Dates (From When to When)</th>
                    <th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>Due Date</th>
                    <th style={{ minWidth: 90, whiteSpace: 'nowrap' }}>Amount</th>
                    <th style={{ minWidth: 90, whiteSpace: 'nowrap' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedMandate.linked_installments || []).map((inst) => (
                    <tr key={inst.id}>
                      <td style={{ fontSize: '12px', fontWeight: 600 }}>{inst.name}</td>
                      <td style={{ fontSize: '12px', color: '#0f766e', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {inst.period_start && inst.period_end
                          ? `${inst.period_start} → ${inst.period_end}`
                          : `${selectedMandate.start_date} → ${selectedMandate.end_date}`}
                      </td>
                      <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{inst.due_date}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatMoney(inst.amount_minor)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{renderStatusBadge(inst.status)}</td>
                    </tr>
                  ))}
                  {(!selectedMandate.linked_installments || selectedMandate.linked_installments.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ color: '#64748b', textAlign: 'center', padding: '1rem' }}>
                        No instalments directly mapped.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <button
                type="button"
                className="button primary"
                style={{ background: '#0d9488', borderColor: '#0d9488', color: '#ffffff', fontWeight: 600, fontSize: '12.5px' }}
                onClick={() => {
                  const m = selectedMandate;
                  setSelectedMandate(null);
                  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
                  const approvalUrl = `${baseUrl}/payer/demo-access-token-12345?mandate=${m.id}&ref=${encodeURIComponent(m.mandate_reference)}`;
                  setShareModalData({
                    isOpen: true,
                    mandate: m,
                    recipientType: 'student',
                    recipientName: m.student_name || 'V Rakesh',
                    recipientPhone: m.payer_phone || '+91 98765 43210',
                    recipientEmail: m.payer_email || 'payer@example.com',
                    approvalUrl,
                    sentChannels: {},
                  });
                }}
              >
                Share Approval Link 📨
              </button>
              <button type="button" className="button secondary" onClick={() => setSelectedMandate(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      );
    })()}

      {/* ========================================================= */}
      {/* MODAL 3: Cancel Mandate Confirmation                      */}
      {/* ========================================================= */}
      {cancelModalMandate && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: '1.75rem',
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '1.15rem', fontWeight: 700, color: '#b91c1c' }}>
              Cancel Sandbox Mandate
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '13px', color: '#475569' }}>
              Are you sure you want to cancel mandate <strong>{cancelModalMandate.mandate_reference}</strong> for{' '}
              <strong>{cancelModalMandate.student_name}</strong>? All future scheduled debits will be paused.
            </p>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
              Cancellation Reason *
            </label>
            <input
              type="text"
              placeholder="e.g. Student opted for direct settlement / Parent request"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', marginBottom: '1.25rem' }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setCancelModalMandate(null)}
                disabled={busy}
              >
                Keep Mandate
              </button>
              <button
                type="button"
                className="button primary"
                style={{ background: '#b91c1c', borderColor: '#b91c1c', color: '#ffffff' }}
                onClick={handleCancelMandate}
                disabled={busy}
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: Debit Retry Confirmation                         */}
      {/* ========================================================= */}
      {retryModalDebit && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: '1.75rem',
              maxWidth: 500,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '1.15rem', fontWeight: 700, color: '#0f766e' }}>
              Execute Simulated Debit Retry
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '13px', color: '#475569' }}>
              Re-presenting debit instruction <strong>{retryModalDebit.id}</strong> (Attempt {retryModalDebit.attempt_no + 1} of {retryModalDebit.max_retries}) for{' '}
              <strong>{retryModalDebit.student_name}</strong>.
            </p>
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 6, marginBottom: '1.25rem', fontSize: '12px' }}>
              <div>Amount to Collect: <strong>{formatMoney(retryModalDebit.amount_minor)}</strong></div>
              <div>Previous Failure: <span style={{ color: '#dc2626' }}>{retryModalDebit.failure_reason}</span></div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setRetryModalDebit(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button primary"
                style={{ background: '#0d9488', borderColor: '#0d9488', color: '#ffffff', fontWeight: 700 }}
                onClick={handleExecuteRetry}
                disabled={busy}
              >
                Confirm Re-Presentment ⚡
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DRAWER: Provider Diagnostics & Future Live Architecture   */}
      {/* ========================================================= */}
      {showDiagnosticsDrawer && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: 520,
              height: '100%',
              padding: '2rem',
              overflowY: 'auto',
              boxShadow: '-4px 0 25px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="eyebrow" style={{ textTransform: 'uppercase', color: '#0d9488', fontWeight: 700 }}>
                  Section 7 Provider Architecture
                </span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.2rem', fontWeight: 700 }}>Payment Rails & Provider Diagnostics</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnosticsDrawer(false)}
                style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem', fontSize: '12px' }}>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Active Rail Configuration</div>
              <div>Provider: <strong>{providerInfo.providerId}</strong></div>
              <div>Status: <span style={{ color: '#16a34a', fontWeight: 700 }}>● {providerInfo.operationalStatus}</span></div>
              <div>Rail Spec: {providerInfo.railVersion}</div>
              <div>Clearing Window: {providerInfo.clearingCycle}</div>
              <div style={{ marginTop: 6, color: '#b45309', fontWeight: 600 }}>
                Live Clearing: DISABLED (Simulation Only)
              </div>
            </div>

            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>Capability Matrix</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '12px' }}>
              {Object.entries(providerInfo.capabilities).map(([cap, enabled]) => (
                <div key={cap} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', borderRadius: 4 }}>
                  <span style={{ textTransform: 'capitalize' }}>{cap.replace(/([A-Z])/g, ' $1')}</span>
                  <span style={{ fontWeight: 700, color: enabled ? '#16a34a' : '#94a3b8' }}>
                    {enabled ? '✓ Supported' : '✕ Disabled'}
                  </span>
                </div>
              ))}
            </div>

            <h4 style={{ margin: '8px 0 0', fontSize: '13px', fontWeight: 700 }}>Future Live Activation Checklist</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '11px', color: '#475569' }}>
              {providerInfo.liveActivationPrerequisites.map((req, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: '#cbd5e1' }}>☐</span>
                  <span>{req}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
              <button
                type="button"
                className="button secondary"
                style={{ width: '100%' }}
                onClick={() => setShowDiagnosticsDrawer(false)}
              >
                Close Diagnostics
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: Send Test Preview Notification                   */}
      {/* ========================================================= */}
      {testNotificationModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: '1.75rem',
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '1.15rem', fontWeight: 700 }}>Send Test Notification Preview</h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '12px', color: '#64748b' }}>
              Simulates message dispatch into the sandbox audit stream. No actual SMS or WhatsApp messages are delivered to external phones.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>Channel</label>
                <select id="test-channel-select" defaultValue="WhatsApp (Simulated)" style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                  <option value="WhatsApp (Simulated)">WhatsApp (Simulated)</option>
                  <option value="SMS (Simulated)">SMS (Simulated)</option>
                  <option value="Email (Simulated)">Email (Simulated)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>Event Template</label>
                <select id="test-event-select" defaultValue="upcoming_debit" style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                  <option value="upcoming_debit">Upcoming Debit Reminder (T-2 Days)</option>
                  <option value="debit_succeeded">Debit Succeeded & Receipt Advice</option>
                  <option value="debit_failed">Debit Failed Urgent Advisory</option>
                  <option value="mandate_authorized">Mandate Activated Confirmation</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="button secondary" onClick={() => setTestNotificationModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="button primary"
                style={{ background: '#0d9488' }}
                onClick={() => {
                  const chEl = document.getElementById('test-channel-select') as HTMLSelectElement;
                  const evEl = document.getElementById('test-event-select') as HTMLSelectElement;
                  handleSendTestNotification(chEl.value, evEl.value);
                }}
              >
                Send Sandbox Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6: View Official Fee Collection Receipt             */}
      {/* ========================================================= */}
      {viewReceiptDebit && (() => {
        const isDebitUpi = viewReceiptDebit.mandate_reference.startsWith('UMN-UPI') || Boolean(viewReceiptDebit.rrn_reference && !viewReceiptDebit.provider_batch_id);
        return (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              zIndex: 9999,
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 12,
                padding: '2rem',
                maxWidth: 540,
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
                border: '1px solid #e2e8f0',
              }}
            >
              {/* Receipt Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px dashed #cbd5e1', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', color: '#0d9488', textTransform: 'uppercase' }}>
                    Official Fee Collection Receipt
                  </span>
                  <h3 style={{ margin: '4px 0 2px', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                    Delhi Public School
                  </h3>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {isDebitUpi
                      ? 'Campus Fee Collection Console · NPCI UPI AutoPay Rail'
                      : 'Campus Fee Collection Console · NPCI eNACH Clearing Rail'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ display: 'inline-block', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: 4, fontSize: '11px', fontWeight: 700 }}>
                    PAID ✓
                  </span>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: 4 }}>
                    {viewReceiptDebit.receipt_number || (isDebitUpi ? 'RCP-UPI-2026-0891' : 'RCP-ENACH-2026-0891')}
                  </div>
                </div>
              </div>

              {/* Receipt Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '12px', marginBottom: '1.25rem', background: '#f8fafc', padding: '1rem', borderRadius: 8 }}>
                <div>
                  <span style={{ color: '#64748b' }}>Student Name:</span>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{viewReceiptDebit.student_name}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Account / Roll No:</span>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{viewReceiptDebit.account_reference}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Fee Instalment:</span>
                  <div style={{ fontWeight: 600 }}>{viewReceiptDebit.installment_name}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Date of Collection:</span>
                  <div>{new Date(viewReceiptDebit.execution_date || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Payment Mode:</span>
                  <div style={{ fontWeight: 600, color: isDebitUpi ? '#0f766e' : '#0284c7' }}>
                    {isDebitUpi ? '⚡ UPI AutoPay 2.0' : '🏦 eNACH Bank Mandate'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Payer Name:</span>
                  <div>{viewReceiptDebit.payer_name}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>{isDebitUpi ? 'Mandate UMN:' : 'Mandate UMRN:'}</span>
                  <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '11px' }}>{viewReceiptDebit.mandate_reference}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>{isDebitUpi ? 'UPI Bank RRN:' : 'Clearing Batch Ref:'}</span>
                  <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '11px', color: isDebitUpi ? '#0d9488' : '#0284c7' }}>
                    {isDebitUpi
                      ? (viewReceiptDebit.rrn_reference || '894120984123')
                      : (viewReceiptDebit.provider_batch_id || 'NACH-BATCH-2026-0891')}
                  </div>
                </div>
              </div>

              {/* Total Paid Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, marginBottom: '1.25rem' }}>
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f766e' }}>Amount Cleared & Settled</span>
                <span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0f766e' }}>
                  {formatMoney(viewReceiptDebit.amount_minor)}
                </span>
              </div>

              <div style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center', marginBottom: '1.25rem' }}>
                System generated receipt in sandbox demo mode · {isDebitUpi ? 'NPCI UPI AutoPay clearing simulation' : 'NPCI National Automated Clearing House (eNACH) simulation'}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="button outline"
                  onClick={() => window.print()}
                  style={{ fontSize: '12px' }}
                >
                  Print Receipt ⎙
                </button>
                <button
                  type="button"
                  className="button primary"
                  style={{ background: '#0d9488', fontSize: '12px' }}
                  onClick={() => setViewReceiptDebit(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
