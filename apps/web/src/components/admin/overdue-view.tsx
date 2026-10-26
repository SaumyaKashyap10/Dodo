'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import {
  IndianRupee,
  Users,
  CalendarClock,
  AlertTriangle,
  TrendingUp,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  RefreshCw,
  Download,
  X,
  Check,
  Clock,
  Phone,
  PhoneCall,
  MessageSquare,
  AlertCircle,
  ShieldAlert,
  Ban,
  Send,
  History,
  FileText,
  Copy,
  Calendar,
  Filter,
} from 'lucide-react';
import { useAdminApi } from './context';
import { formatMoney } from './finance-dashboard';

export type OverdueRecord = {
  id: string;
  student_name: string;
  account_reference: string;
  student_id: string;
  class_name: string;
  due_date: string;
  outstanding_minor: number;
  days_overdue: number;
  debit_status: string;
  reminder_status: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email?: string;
  recovery_logs: Array<{ date: string; type: string; note: string }>;
};

export type HorizonOption = 'all' | '1-7' | '8-15' | '16-30' | '31-60' | '61-90' | '90+' | 'custom';

type OverdueApiResponse = {
  rows: OverdueRecord[];
  total: number;
  kpis: {
    total_overdue_minor: number;
    students_with_dues: number;
    overdue_instalments: number;
    failed_debits: number;
    recovered_amount_minor: number;
  };
  agingBuckets: {
    b1_30: { label: string; amount_minor: number; student_count: number };
    b31_60: { label: string; amount_minor: number; student_count: number };
    b61_90: { label: string; amount_minor: number; student_count: number };
    b90_plus: { label: string; amount_minor: number; student_count: number };
  };
  horizonBuckets?: Record<string, { label: string; count: number; amount_minor: number; min?: number; max?: number }>;
};

export function OverdueView() {
  const { request, session } = useAdminApi();
  const [data, setData] = useState<OverdueApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);

  // Filters & UX controls
  const [search, setSearch] = useState('');
  const [selectedHorizon, setSelectedHorizon] = useState<HorizonOption>('all');
  const [customMinDays, setCustomMinDays] = useState('');
  const [customMaxDays, setCustomMaxDays] = useState('');
  const [appliedCustomMin, setAppliedCustomMin] = useState<number | null>(null);
  const [appliedCustomMax, setAppliedCustomMax] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'days_desc' | 'days_asc' | 'amount_desc' | 'name_asc'>('days_desc');
  const [debitStatusFilter, setDebitStatusFilter] = useState('');

  // Filter Popover Visibility State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  // Modals
  const [feeDetailsStudent, setFeeDetailsStudent] = useState<OverdueRecord | null>(null);
  const [reminderTarget, setReminderTarget] = useState<OverdueRecord | null>(null);
  const [recoveryHistoryStudent, setRecoveryHistoryStudent] = useState<OverdueRecord | null>(null);
  const [reminderChannel, setReminderChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderSuccessNotice, setReminderSuccessNotice] = useState('');

  // Dedicated UX "Contact & Enquire" Modal States
  const [enquiryTarget, setEnquiryTarget] = useState<OverdueRecord | null>(null);
  const [enquiryChannel, setEnquiryChannel] = useState<'Phone Call' | 'WhatsApp' | 'In-Person Meeting' | 'SMS' | 'Email'>('Phone Call');
  const [enquiryOutcome, setEnquiryOutcome] = useState('Promised to Pay');
  const [promisedDate, setPromisedDate] = useState('');
  const [enquiryNotes, setEnquiryNotes] = useState('');
  const [savingEnquiry, setSavingEnquiry] = useState(false);
  const [enquirySuccessNotice, setEnquirySuccessNotice] = useState('');
  const [phoneCopiedNotice, setPhoneCopiedNotice] = useState(false);

  const detailsDialogRef = useRef<HTMLDialogElement>(null);
  const reminderDialogRef = useRef<HTMLDialogElement>(null);
  const historyDialogRef = useRef<HTMLDialogElement>(null);
  const enquiryDialogRef = useRef<HTMLDialogElement>(null);

  // Close filter popover on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen]);

  // Data fetching
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);

    const params = new URLSearchParams();
    if (selectedHorizon === 'custom') {
      if (appliedCustomMin !== null) params.set('minDays', String(appliedCustomMin));
      if (appliedCustomMax !== null) params.set('maxDays', String(appliedCustomMax));
    } else if (selectedHorizon !== 'all') {
      params.set('daysHorizon', selectedHorizon);
    }
    if (search) params.set('search', search);
    if (sortBy) params.set('sortBy', sortBy);

    request<OverdueApiResponse>(`admin/fees/overdue?${params.toString()}`)
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [session.tenant.id, selectedHorizon, appliedCustomMin, appliedCustomMax, search, sortBy, refresh]);

  useEffect(() => {
    if (feeDetailsStudent) detailsDialogRef.current?.showModal();
    else detailsDialogRef.current?.close();
  }, [feeDetailsStudent]);

  useEffect(() => {
    if (reminderTarget) reminderDialogRef.current?.showModal();
    else reminderDialogRef.current?.close();
  }, [reminderTarget]);

  useEffect(() => {
    if (recoveryHistoryStudent) historyDialogRef.current?.showModal();
    else historyDialogRef.current?.close();
  }, [recoveryHistoryStudent]);

  useEffect(() => {
    if (enquiryTarget) {
      if (enquiryTarget.days_overdue <= 7) {
        setEnquiryOutcome('Promised to Pay');
        setEnquiryNotes('Grace period check-in: Guardian informed about pending instalment. Payment expected shortly.');
      } else if (enquiryTarget.days_overdue <= 15) {
        setEnquiryOutcome('Promised to Pay');
        setEnquiryNotes('First follow-up enquiry: Called parent regarding payment verification and payment link assistance.');
      } else if (enquiryTarget.days_overdue <= 30) {
        setEnquiryOutcome('Follow-up Call Scheduled');
        setEnquiryNotes('Second follow-up discussion: Parent requested check on salary cycle schedule.');
      } else if (enquiryTarget.days_overdue <= 60) {
        setEnquiryOutcome('Requested Instalment Extension / Split');
        setEnquiryNotes('Escalated follow-up: Discussed pending dues and evaluated flexible payment options.');
      } else {
        setEnquiryOutcome('In-Person Meeting Requested');
        setEnquiryNotes('High delinquency follow-up: Requested parent conference at institution accounts office.');
      }
      setPromisedDate('');
      setEnquiryChannel('Phone Call');
      setPhoneCopiedNotice(false);
      enquiryDialogRef.current?.showModal();
    } else {
      enquiryDialogRef.current?.close();
    }
  }, [enquiryTarget]);

  // Clean phone helper
  const cleanPhone = (phone: string) => phone.replace(/[^\d]/g, '');

  // Dynamic WhatsApp enquiry launcher with pre-filled message
  const getWhatsAppEnquiryUrl = (record: OverdueRecord) => {
    const rawDigits = cleanPhone(record.guardian_phone);
    const phoneWithCountry = rawDigits.startsWith('91') ? rawDigits : `91${rawDigits}`;
    const days = record.days_overdue;

    let leadIn = 'this is a gentle check-in from';
    if (days > 60) {
      leadIn = 'this is an urgent notification from';
    } else if (days > 15) {
      leadIn = 'this is a follow-up inquiry from';
    }

    const message = `Namaste ${record.guardian_name},\n\n${leadIn} ${session.tenant.name} Accounts Office regarding ${record.student_name} (${record.class_name}, Ref: ${record.account_reference}).\n\nThe pending fee instalment of ${formatMoney(record.outstanding_minor)} was due on ${new Date(record.due_date).toLocaleDateString('en-IN')} (${record.days_overdue} days overdue).\n\nPlease let us know if you require any assistance with the digital payment link or instalment schedule.\n\nThank you,\n${session.tenant.name} Finance & Accounts`;

    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
  };

  // Dispatch Authorized Reminder Notice
  const sendReminder = async () => {
    if (!reminderTarget) return;
    setSendingReminder(true);
    try {
      await request('admin/fees/overdue/reminder', 'POST', {
        overdueId: reminderTarget.id,
        accountReference: reminderTarget.account_reference,
        channel: reminderChannel === 'whatsapp' ? 'WhatsApp' : reminderChannel === 'sms' ? 'SMS' : 'Email',
      });
      setReminderSuccessNotice(`Authorized reminder notice sent to ${reminderTarget.guardian_name}!`);
      setTimeout(() => setReminderSuccessNotice(''), 5000);
      setReminderTarget(null);
      setRefresh((n) => n + 1);
    } catch {
      alert('Could not dispatch reminder. Check connectivity.');
    } finally {
      setSendingReminder(false);
    }
  };

  // Save Follow-up Enquiry
  const saveEnquiry = async () => {
    if (!enquiryTarget) return;
    setSavingEnquiry(true);
    try {
      await request('admin/fees/overdue/enquiry', 'POST', {
        overdueId: enquiryTarget.id,
        accountReference: enquiryTarget.account_reference,
        channel: enquiryChannel,
        outcome: enquiryOutcome,
        promisedDate: promisedDate || undefined,
        note: enquiryNotes,
      });
      setEnquirySuccessNotice(
        `✓ Enquiry recorded for ${enquiryTarget.student_name} (${enquiryOutcome}). Status and recovery audit trail updated!`
      );
      setTimeout(() => setEnquirySuccessNotice(''), 6000);
      setEnquiryTarget(null);
      setRefresh((n) => n + 1);
    } catch {
      alert('Failed to log enquiry. Please check your connection and try again.');
    } finally {
      setSavingEnquiry(false);
    }
  };

  // Severity metadata based on overdue days
  const getOverdueSeverity = (days: number) => {
    if (days <= 7) {
      return {
        label: 'Grace (1–7d)',
        badgeBg: '#ecfdf5',
        badgeBorder: '#a7f3d0',
        badgeColor: '#065f46',
        dotColor: '#10b981',
        icon: <Clock size={12} strokeWidth={1.75} />,
        tag: 'Grace Period',
        guidance: 'Within grace period. Soft reminder or courtesy WhatsApp enquiry recommended.',
      };
    } else if (days <= 15) {
      return {
        label: 'Follow-up 1 (8–15d)',
        badgeBg: '#eff6ff',
        badgeBorder: '#bfdbfe',
        badgeColor: '#1e40af',
        dotColor: '#3b82f6',
        icon: <Phone size={12} strokeWidth={1.75} />,
        tag: 'First Follow-up',
        guidance: 'Primary follow-up stage. Telephone guardian to check if payment link was received.',
      };
    } else if (days <= 30) {
      return {
        label: 'Active (16–30d)',
        badgeBg: '#fff7ed',
        badgeBorder: '#fed7aa',
        badgeColor: '#9a3412',
        dotColor: '#f59e0b',
        icon: <AlertCircle size={12} strokeWidth={1.75} />,
        tag: 'Active Delinquency',
        guidance: 'Active delinquency. Call guardian, confirm salary cycle, and log commitment date.',
      };
    } else if (days <= 60) {
      return {
        label: 'Escalated (31–60d)',
        badgeBg: '#fef2f2',
        badgeBorder: '#fecaca',
        badgeColor: '#991b1b',
        dotColor: '#ef4444',
        icon: <AlertTriangle size={12} strokeWidth={1.75} />,
        tag: 'Escalated',
        guidance: 'Secondary cycle delinquency. Issue formal demand notice; offer instalment restructuring.',
      };
    } else if (days <= 90) {
      return {
        label: 'Severe (61–90d)',
        badgeBg: '#fdf2f8',
        badgeBorder: '#fbcfe8',
        badgeColor: '#831843',
        dotColor: '#be123c',
        icon: <ShieldAlert size={12} strokeWidth={1.75} />,
        tag: 'Severe Delinquency',
        guidance: 'High severity overdue. Call parent for in-person discussion at accounts office.',
      };
    } else {
      return {
        label: 'Critical (90+d)',
        badgeBg: '#450a0a',
        badgeBorder: '#991b1b',
        badgeColor: '#ffffff',
        dotColor: '#7f1d1d',
        icon: <Ban size={12} strokeWidth={1.75} />,
        tag: 'Critical Recovery',
        guidance: 'Critical default stage. Final administrative escalation & academic services hold review.',
      };
    }
  };

  // Filtered rows for current view
  const filteredRows = useMemo(() => {
    return (data?.rows || []).filter((r) => {
      if (debitStatusFilter && !r.debit_status.toLowerCase().includes(debitStatusFilter.toLowerCase())) {
        return false;
      }
      if (selectedHorizon === 'custom') {
        if (appliedCustomMin !== null && r.days_overdue < appliedCustomMin) return false;
        if (appliedCustomMax !== null && r.days_overdue > appliedCustomMax) return false;
      }
      return true;
    });
  }, [data?.rows, debitStatusFilter, selectedHorizon, appliedCustomMin, appliedCustomMax]);

  // Export CSV of currently filtered cohort
  const exportCsv = () => {
    if (!filteredRows || filteredRows.length === 0) return;
    const headers = [
      'Student Name',
      'Student ID',
      'Class / Grade',
      'Due Date',
      'Outstanding (INR)',
      'Days Overdue',
      'Overdue Severity',
      'Debit Status',
      'Current Status',
      'Guardian Name',
      'Guardian Phone',
      'Guardian Email',
      'Last Recovery Note',
    ];
    const rows = filteredRows.map((r) => [
      `"${r.student_name}"`,
      `"${r.account_reference}"`,
      `"${r.class_name}"`,
      `"${r.due_date}"`,
      r.outstanding_minor / 100,
      r.days_overdue,
      `"${getOverdueSeverity(r.days_overdue).tag}"`,
      `"${r.debit_status}"`,
      `"${r.reminder_status}"`,
      `"${r.guardian_name}"`,
      `"${r.guardian_phone}"`,
      `"${r.guardian_email || ''}"`,
      `"${r.recovery_logs?.[0]?.note?.replace(/"/g, '""') || ''}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `overdue-followup-${selectedHorizon}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const kpis = data?.kpis || {
    total_overdue_minor: 58200000,
    students_with_dues: 12,
    overdue_instalments: 20,
    failed_debits: 4,
    recovered_amount_minor: 12800000,
  };

  // Horizon options definition with live stats
  const horizonOptions: Array<{ id: HorizonOption; label: string; dot: string; count: number; amount_minor: number }> = [
    { id: 'all', label: 'All Overdue', dot: '#94a3b8', count: data?.horizonBuckets?.all?.count ?? 12, amount_minor: data?.horizonBuckets?.all?.amount_minor ?? 58200000 },
    { id: '1-7', label: '1–7 Days (Grace)', dot: '#10b981', count: data?.horizonBuckets?.h1_7?.count ?? 2, amount_minor: data?.horizonBuckets?.h1_7?.amount_minor ?? 5700000 },
    { id: '8-15', label: '8–15 Days (Follow-up 1)', dot: '#3b82f6', count: data?.horizonBuckets?.h8_15?.count ?? 2, amount_minor: data?.horizonBuckets?.h8_15?.amount_minor ?? 8000000 },
    { id: '16-30', label: '16–30 Days (Active)', dot: '#f59e0b', count: data?.horizonBuckets?.h16_30?.count ?? 2, amount_minor: data?.horizonBuckets?.h16_30?.amount_minor ?? 6200000 },
    { id: '31-60', label: '31–60 Days (Escalated)', dot: '#ef4444', count: data?.horizonBuckets?.h31_60?.count ?? 2, amount_minor: data?.horizonBuckets?.h31_60?.amount_minor ?? 14300000 },
    { id: '61-90', label: '61–90 Days (Severe)', dot: '#be123c', count: data?.horizonBuckets?.h61_90?.count ?? 2, amount_minor: data?.horizonBuckets?.h61_90?.amount_minor ?? 11300000 },
    { id: '90+', label: '90+ Days (Critical)', dot: '#7f1d1d', count: data?.horizonBuckets?.h90_plus?.count ?? 2, amount_minor: data?.horizonBuckets?.h90_plus?.amount_minor ?? 12700000 },
    { id: 'custom', label: 'Custom Day Range', dot: '#6366f1', count: 0, amount_minor: 0 },
  ];

  // Active Horizon Summary calculation
  const totalFilteredOutstanding = filteredRows.reduce((sum, r) => sum + r.outstanding_minor, 0);

  // Active filter count for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedHorizon !== 'all') count++;
    if (appliedCustomMin !== null || appliedCustomMax !== null) count++;
    if (debitStatusFilter) count++;
    return count;
  }, [selectedHorizon, appliedCustomMin, appliedCustomMax, debitStatusFilter]);

  const clearAllFilters = () => {
    setSelectedHorizon('all');
    setCustomMinDays('');
    setCustomMaxDays('');
    setAppliedCustomMin(null);
    setAppliedCustomMax(null);
    setDebitStatusFilter('');
    setSearch('');
  };

  return (
    <div className="overdue-view-wrapper">
      {/* 1. Compact Page Header (One row) */}
      <section className="admin-panel overdue-header-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <span className="eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', color: '#ea580c', fontWeight: 700, fontSize: '11px', display: 'block', marginBottom: '2px' }}>
              Accounts &amp; Delinquency Recovery
            </span>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--ink, #063331)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Overdue &amp; Enquiries
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-muted, #6c8f89)' }}>
              Track delinquent fee cycles, filter by aging urgency, and log parent enquiry outcomes.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="button secondary"
              onClick={() => setRefresh((n) => n + 1)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: 'var(--radius-pill)', fontSize: '13px', fontWeight: 600, background: '#ffffff', border: '1px solid rgba(7, 53, 51, 0.12)', color: 'var(--text-main, #073533)' }}
              title="Refresh overdue records"
            >
              <RefreshCw size={14} strokeWidth={1.75} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              className="button primary"
              onClick={exportCsv}
              disabled={filteredRows.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: 'var(--radius-pill)', fontSize: '13px', fontWeight: 600, background: 'var(--color-dark-pill, #063331)', color: '#ffffff', border: 'none' }}
              title="Export current filtered cohort with parent phone numbers"
            >
              <Download size={14} strokeWidth={1.75} />
              <span>Export follow-up sheet ({filteredRows.length})</span>
            </button>
          </div>
        </div>
      </section>

      {/* Success Notification Banners */}
      {enquirySuccessNotice && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '10px 16px', borderRadius: 12, color: '#065f46', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Check size={16} strokeWidth={2} />
            {enquirySuccessNotice}
          </span>
          <button type="button" onClick={() => setEnquirySuccessNotice('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#065f46', padding: 0 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {reminderSuccessNotice && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 16px', borderRadius: 12, color: '#166534', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Check size={16} strokeWidth={2} />
            {reminderSuccessNotice}
          </span>
          <button type="button" onClick={() => setReminderSuccessNotice('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#166534', padding: 0 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. Compact KPI Strip (5 cards in one row, reduced height by ~40%) */}
      <div className="overdue-kpi-strip">
        {/* Card 1: Total Overdue Dues */}
        <div className="overdue-kpi-card" style={{ borderLeft: '3px solid #d97706' }}>
          <div className="overdue-kpi-top">
            <span className="overdue-kpi-label">Total Overdue</span>
            <span className="overdue-kpi-icon-badge" style={{ background: '#fef3c7', color: '#d97706' }}>
              <IndianRupee size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div className="overdue-kpi-value" style={{ color: '#b45309' }}>
            {formatMoney(kpis.total_overdue_minor)}
          </div>
          <div className="overdue-kpi-sub">Across all classes</div>
        </div>

        {/* Card 2: Overdue Students */}
        <div className="overdue-kpi-card">
          <div className="overdue-kpi-top">
            <span className="overdue-kpi-label">Overdue Students</span>
            <span className="overdue-kpi-icon-badge" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <Users size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div className="overdue-kpi-value">
            {kpis.students_with_dues}
          </div>
          <div className="overdue-kpi-sub">Active delinquencies</div>
        </div>

        {/* Card 3: Overdue Instalments */}
        <div className="overdue-kpi-card">
          <div className="overdue-kpi-top">
            <span className="overdue-kpi-label">Overdue Instalments</span>
            <span className="overdue-kpi-icon-badge" style={{ background: '#ffedd5', color: '#ea580c' }}>
              <CalendarClock size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div className="overdue-kpi-value">
            {kpis.overdue_instalments}
          </div>
          <div className="overdue-kpi-sub">Past milestone cycles</div>
        </div>

        {/* Card 4: Failed Auto UPI Debits */}
        <div className="overdue-kpi-card">
          <div className="overdue-kpi-top">
            <span className="overdue-kpi-label">Failed Auto UPI</span>
            <span className="overdue-kpi-icon-badge" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <AlertTriangle size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div className="overdue-kpi-value" style={{ color: '#dc2626' }}>
            {kpis.failed_debits}
          </div>
          <div className="overdue-kpi-sub">Rejection code 03/05</div>
        </div>

        {/* Card 5: Recovered Amount */}
        <div className="overdue-kpi-card">
          <div className="overdue-kpi-top">
            <span className="overdue-kpi-label">Recovered Amount</span>
            <span className="overdue-kpi-icon-badge" style={{ background: '#dcfce7', color: '#059669' }}>
              <TrendingUp size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div className="overdue-kpi-value" style={{ color: '#059669' }}>
            {formatMoney(kpis.recovered_amount_minor)}
          </div>
          <div className="overdue-kpi-sub">Cleared post due date</div>
        </div>
      </div>

      {/* 3. Sticky Toolbar (One row, sticky under header) */}
      <section className="admin-panel overdue-toolbar-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
          {/* Search Input with Search Icon */}
          <div className="overdue-search-box">
            <Search size={15} strokeWidth={1.75} style={{ color: '#6c8f89', flexShrink: 0 }} />
            <input
              type="search"
              className="overdue-search-input"
              placeholder="Search student, ID, class, parent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: '#6c8f89', display: 'flex' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* ONE Filter Button with Active Badge */}
          <div style={{ position: 'relative' }} ref={filterPopoverRef}>
            <button
              type="button"
              className={`overdue-filter-btn ${isFilterOpen || activeFilterCount > 0 ? 'active' : ''}`}
              onClick={() => setIsFilterOpen((prev) => !prev)}
              aria-expanded={isFilterOpen}
              aria-label="Filter overdue records"
            >
              <SlidersHorizontal size={14} strokeWidth={1.75} />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className="overdue-filter-badge">{activeFilterCount}</span>
              )}
            </button>

            {/* Filter Popover (Desktop Popover / Mobile Drawer) */}
            {isFilterOpen && (
              <>
                <div className="overdue-popover-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(7, 53, 51, 0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13px', color: '#073533' }}>
                      <Filter size={14} strokeWidth={1.75} />
                      <span>Filter Delinquencies</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsFilterOpen(false)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6c8f89', padding: '2px' }}
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* Section 1: Days Overdue (Vertical Radio List) */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6c8f89', marginBottom: '6px' }}>
                      Days Overdue Horizon
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {horizonOptions.map((opt) => {
                        const isSelected = selectedHorizon === opt.id;
                        return (
                          <div
                            key={opt.id}
                            className={`overdue-radio-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => setSelectedHorizon(opt.id)}
                          >
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', fontWeight: isSelected ? 700 : 500, color: '#073533' }}>
                              <input
                                type="radio"
                                name="daysHorizon"
                                checked={isSelected}
                                onChange={() => setSelectedHorizon(opt.id)}
                                style={{ accentColor: '#063331', cursor: 'pointer' }}
                              />
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.dot, flexShrink: 0 }} />
                              <span>{opt.label}</span>
                            </label>

                            {opt.id !== 'custom' && (
                              <span style={{ fontSize: '11px', fontWeight: 600, color: isSelected ? '#063331' : '#6c8f89', fontVariantNumeric: 'tabular-nums' }}>
                                {opt.count} {opt.amount_minor > 0 ? `· ${formatMoney(opt.amount_minor)}` : ''}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Custom Range Drawer (when Custom selected) */}
                    {selectedHorizon === 'custom' && (
                      <div style={{ background: '#f7fbf9', padding: '10px 12px', borderRadius: 8, border: '1px solid #d4ece3', marginTop: '8px' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#073533', display: 'block', marginBottom: '6px' }}>
                          Specify Range in Days:
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            min="1"
                            placeholder="From"
                            value={customMinDays}
                            onChange={(e) => setCustomMinDays(e.target.value)}
                            style={{ width: '70px', padding: '4px 6px', fontSize: '12px', borderRadius: 6, border: '1px solid rgba(7,53,51,0.15)' }}
                          />
                          <span style={{ fontSize: '11px', color: '#6c8f89' }}>to</span>
                          <input
                            type="number"
                            min="1"
                            placeholder="To"
                            value={customMaxDays}
                            onChange={(e) => setCustomMaxDays(e.target.value)}
                            style={{ width: '70px', padding: '4px 6px', fontSize: '12px', borderRadius: 6, border: '1px solid rgba(7,53,51,0.15)' }}
                          />
                          <button
                            type="button"
                            className="button primary"
                            style={{ padding: '4px 8px', fontSize: '11px', background: '#063331', color: '#fff', borderRadius: 6, border: 'none' }}
                            onClick={() => {
                              setAppliedCustomMin(customMinDays ? parseInt(customMinDays, 10) : null);
                              setAppliedCustomMax(customMaxDays ? parseInt(customMaxDays, 10) : null);
                            }}
                          >
                            Set
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 2: Debit Status */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6c8f89', marginBottom: '6px' }}>
                      Debit Status
                    </div>
                    <select
                      value={debitStatusFilter}
                      onChange={(e) => setDebitStatusFilter(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', fontSize: '12.5px', borderRadius: 8, border: '1px solid rgba(7, 53, 51, 0.15)', background: '#ffffff', color: '#073533' }}
                    >
                      <option value="">All Debit Statuses</option>
                      <option value="Active Mandate">Active Mandate</option>
                      <option value="Failed Debit">Failed Debit Attempt</option>
                      <option value="No Mandate">No Mandate Registered</option>
                    </select>
                  </div>

                  {/* Popover Footer Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(7, 53, 51, 0.08)' }}>
                    <button
                      type="button"
                      onClick={() => {
                        clearAllFilters();
                        setIsFilterOpen(false);
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#c2410c', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    >
                      Reset All
                    </button>
                    <button
                      type="button"
                      className="button primary"
                      style={{ padding: '6px 16px', borderRadius: 'var(--radius-pill)', fontSize: '12.5px', fontWeight: 600, background: '#063331', color: '#ffffff', border: 'none' }}
                      onClick={() => setIsFilterOpen(false)}
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sort Dropdown with ArrowUpDown Icon */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ffffff', borderRadius: 'var(--radius-pill)', border: '1px solid rgba(7, 53, 51, 0.12)', padding: '0 8px' }}>
            <ArrowUpDown size={13} strokeWidth={1.75} style={{ color: '#6c8f89' }} />
            <select
              className="overdue-sort-select"
              style={{ border: 'none', padding: '6px 4px', background: 'transparent' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="days_desc">Days overdue (highest first)</option>
              <option value="days_asc">Days overdue (lowest first)</option>
              <option value="amount_desc">Amount (highest first)</option>
              <option value="name_asc">Student name (A → Z)</option>
            </select>
          </div>
        </div>

        {/* Right Side Result Summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#073533', whiteSpace: 'nowrap' }}>
          <span>{filteredRows.length} students</span>
          <span style={{ color: '#cbd5e1' }}>·</span>
          <span style={{ color: '#991b1b', fontVariantNumeric: 'tabular-nums' }}>
            {formatMoney(totalFilteredOutstanding)} outstanding
          </span>
        </div>
      </section>

      {/* 4. Active-filter chips row (Visible only when filters are applied) */}
      {(selectedHorizon !== 'all' || appliedCustomMin !== null || appliedCustomMax !== null || debitStatusFilter || search) && (
        <div className="overdue-active-chips-strip">
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#6c8f89', marginRight: '4px' }}>
            Active:
          </span>

          {selectedHorizon !== 'all' && selectedHorizon !== 'custom' && (
            <span className="overdue-active-chip">
              <span>Horizon: {selectedHorizon} days</span>
              <button
                type="button"
                className="overdue-chip-close-btn"
                onClick={() => setSelectedHorizon('all')}
                title="Remove horizon filter"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </span>
          )}

          {(appliedCustomMin !== null || appliedCustomMax !== null) && (
            <span className="overdue-active-chip">
              <span>Days: {appliedCustomMin ?? 1}–{appliedCustomMax ?? '∞'}</span>
              <button
                type="button"
                className="overdue-chip-close-btn"
                onClick={() => {
                  setCustomMinDays('');
                  setCustomMaxDays('');
                  setAppliedCustomMin(null);
                  setAppliedCustomMax(null);
                }}
                title="Remove custom range"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </span>
          )}

          {debitStatusFilter && (
            <span className="overdue-active-chip">
              <span>Debit: {debitStatusFilter}</span>
              <button
                type="button"
                className="overdue-chip-close-btn"
                onClick={() => setDebitStatusFilter('')}
                title="Remove debit status filter"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </span>
          )}

          {search && (
            <span className="overdue-active-chip">
              <span>Search: &ldquo;{search}&rdquo;</span>
              <button
                type="button"
                className="overdue-chip-close-btn"
                onClick={() => setSearch('')}
                title="Clear search"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </span>
          )}

          <button
            type="button"
            className="overdue-clear-all-btn"
            onClick={clearAllFilters}
          >
            Clear all
          </button>
        </div>
      )}

      {/* 5. Results as a Clean Data Table (Stacked Cards on Mobile) */}
      <section className="admin-panel overdue-table-panel">
        {loading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>Loading delinquent student records…</p>
          </div>
        ) : error ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <p style={{ color: '#dc2626' }}>Could not load overdue records.</p>
            <button type="button" className="button secondary" onClick={() => setRefresh((n) => n + 1)}>
              Retry
            </button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '16px', color: '#073533' }}>No delinquent records found</h3>
            <p className="small" style={{ margin: 0 }}>There are no student accounts matching your current filter criteria.</p>
            <button
              type="button"
              className="button secondary"
              style={{ marginTop: '12px' }}
              onClick={clearAllFilters}
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="overdue-desktop-table-wrap" style={{ width: '100%', overflowX: 'auto' }}>
              <table className="admin-table overdue-table">
                <thead>
                  <tr>
                    <th>Student &amp; Guardian</th>
                    <th>Student ID</th>
                    <th>Class</th>
                    <th>Due Date</th>
                    <th>Outstanding</th>
                    <th>Days Overdue</th>
                    <th>Debit Status</th>
                    <th>Follow-up Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const severity = getOverdueSeverity(row.days_overdue);

                    return (
                      <tr key={row.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-main, #073533)' }}>{row.student_name}</div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #6c8f89)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <span>{row.guardian_name}</span>
                            <span style={{ color: '#cbd5e1' }}>•</span>
                            <a
                              href={`tel:${row.guardian_phone}`}
                              title="Direct call"
                              style={{ color: '#0f766e', textDecoration: 'none', fontWeight: 600 }}
                            >
                              {row.guardian_phone}
                            </a>
                          </div>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, color: 'var(--text-muted)', fontSize: '12.5px' }}>
                          {row.account_reference}
                        </td>
                        <td>{row.class_name}</td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                          {new Date(row.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ fontWeight: 800, color: '#991b1b', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {formatMoney(row.outstanding_minor)}
                        </td>
                        <td>
                          <span
                            className="overdue-badge-pill"
                            style={{
                              background: severity.badgeBg,
                              border: `1px solid ${severity.badgeBorder}`,
                              color: severity.badgeColor,
                            }}
                            title={severity.guidance}
                          >
                            {severity.icon}
                            <span>{row.days_overdue} days</span>
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-pill)',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: row.debit_status.toLowerCase().includes('fail') ? '#fee2e2' : '#f1f5f9',
                              color: row.debit_status.toLowerCase().includes('fail') ? '#991b1b' : '#334155',
                              border: `1px solid ${row.debit_status.toLowerCase().includes('fail') ? '#fca5a5' : 'rgba(7,53,51,0.08)'}`,
                            }}
                          >
                            {row.debit_status}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: 170 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.reminder_status}>
                            {row.reminder_status}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {/* Primary Action: Enquire */}
                            <button
                              type="button"
                              className="overdue-enquire-btn"
                              onClick={() => setEnquiryTarget(row)}
                              title="Contact guardian via WhatsApp/Call and log enquiry"
                            >
                              <PhoneCall size={13} strokeWidth={1.75} />
                              <span>Enquire</span>
                            </button>

                            {/* Secondary Action: Notice */}
                            <button
                              type="button"
                              className="overdue-icon-action-btn"
                              onClick={() => setReminderTarget(row)}
                              title="Send Formal Delinquency Notice"
                            >
                              <Send size={13} strokeWidth={1.75} />
                            </button>

                            {/* Secondary Action: History */}
                            <button
                              type="button"
                              className="overdue-icon-action-btn"
                              onClick={() => setRecoveryHistoryStudent(row)}
                              title="View Recovery Audit Trail"
                            >
                              <History size={13} strokeWidth={1.75} />
                            </button>

                            {/* Secondary Action: Details */}
                            <button
                              type="button"
                              className="overdue-icon-action-btn"
                              onClick={() => setFeeDetailsStudent(row)}
                              title="View Student Fee Schedule"
                            >
                              <FileText size={13} strokeWidth={1.75} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card View */}
            <div className="overdue-mobile-card-list">
              {filteredRows.map((row) => {
                const severity = getOverdueSeverity(row.days_overdue);

                return (
                  <div
                    key={row.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid rgba(7, 53, 51, 0.08)',
                      borderRadius: 14,
                      padding: '12px 14px',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#073533' }}>{row.student_name}</div>
                        <div style={{ fontSize: '11px', color: '#6c8f89' }}>
                          {row.class_name} · <span style={{ fontFamily: 'monospace' }}>{row.account_reference}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '15px' }}>
                          {formatMoney(row.outstanding_minor)}
                        </div>
                        <span
                          className="overdue-badge-pill"
                          style={{
                            background: severity.badgeBg,
                            border: `1px solid ${severity.badgeBorder}`,
                            color: severity.badgeColor,
                            marginTop: '2px',
                          }}
                        >
                          {severity.icon}
                          <span>{row.days_overdue}d</span>
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: '11.5px', color: '#475569', marginBottom: '10px', background: '#f7fbf9', padding: '6px 10px', borderRadius: 8 }}>
                      <div>Guardian: <strong>{row.guardian_name}</strong> ({row.guardian_phone})</div>
                      <div style={{ color: '#6c8f89', fontSize: '10.5px', marginTop: '2px' }}>
                        Debit: {row.debit_status} · Status: {row.reminder_status}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="overdue-enquire-btn"
                        onClick={() => setEnquiryTarget(row)}
                      >
                        <PhoneCall size={13} strokeWidth={1.75} />
                        <span>Contact &amp; Enquire</span>
                      </button>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="overdue-icon-action-btn"
                          onClick={() => setReminderTarget(row)}
                          title="Notice"
                        >
                          <Send size={13} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          className="overdue-icon-action-btn"
                          onClick={() => setRecoveryHistoryStudent(row)}
                          title="History"
                        >
                          <History size={13} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          className="overdue-icon-action-btn"
                          onClick={() => setFeeDetailsStudent(row)}
                          title="Details"
                        >
                          <FileText size={13} strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Modal 1: Parent Contact & Enquiry Workspace */}
      <dialog
        className="finance-dialog"
        ref={enquiryDialogRef}
        onCancel={() => setEnquiryTarget(null)}
        style={{ maxWidth: 560 }}
      >
        {enquiryTarget && (
          <div style={{ padding: 'var(--space-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
              <div>
                <span className="eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: '#047857', fontWeight: 700, fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                  Parent Recovery Workspace
                </span>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#073533' }}>
                  Contact &amp; Enquire Overdue Payment
                </h3>
              </div>
              <button
                type="button"
                className="button secondary"
                onClick={() => setEnquiryTarget(null)}
                style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center' }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Student & Guardian Info Card */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '12px 14px',
                borderRadius: 12,
                marginBottom: '14px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Student</span>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    {enquiryTarget.student_name} ({enquiryTarget.class_name})
                  </div>
                  <div className="small" style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {enquiryTarget.account_reference}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Guardian Contact</span>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{enquiryTarget.guardian_name}</div>
                  <div className="small" style={{ color: '#0f766e', fontWeight: 600 }}>{enquiryTarget.guardian_phone}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Outstanding Dues:</span>
                  <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '16px', fontVariantNumeric: 'tabular-nums' }}>
                    {formatMoney(enquiryTarget.outstanding_minor)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Days Delinquent:</span>
                  <div>
                    <span
                      className="overdue-badge-pill"
                      style={{
                        background: getOverdueSeverity(enquiryTarget.days_overdue).badgeBg,
                        border: `1px solid ${getOverdueSeverity(enquiryTarget.days_overdue).badgeBorder}`,
                        color: getOverdueSeverity(enquiryTarget.days_overdue).badgeColor,
                      }}
                    >
                      {getOverdueSeverity(enquiryTarget.days_overdue).icon}
                      <span>{enquiryTarget.days_overdue} days</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick 1-Click Communication Triggers */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#475569', marginBottom: '8px' }}>
                1-Click Direct Parent Contact:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <a
                  href={getWhatsAppEnquiryUrl(enquiryTarget)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-pill)',
                    background: '#25D366',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '12.5px',
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                  title="Open WhatsApp chat with pre-composed fee enquiry text"
                >
                  <MessageSquare size={14} strokeWidth={1.75} />
                  <span>WhatsApp</span>
                </a>

                <a
                  href={`tel:${enquiryTarget.guardian_phone}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-pill)',
                    background: '#0284c7',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '12.5px',
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                  title="Initiate phone call to parent"
                >
                  <Phone size={14} strokeWidth={1.75} />
                  <span>Direct Call</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(enquiryTarget.guardian_phone);
                    setPhoneCopiedNotice(true);
                    setTimeout(() => setPhoneCopiedNotice(false), 3000);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-pill)',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    fontWeight: 600,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                  }}
                >
                  <Copy size={14} strokeWidth={1.75} />
                  <span>{phoneCopiedNotice ? 'Copied!' : 'Copy Phone'}</span>
                </button>
              </div>
            </div>

            {/* Enquiry Outcome Logging Section */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 14px', marginBottom: '14px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', marginBottom: '10px' }}>
                Log Enquiry Outcome &amp; Follow-up Action
              </div>

              {/* Channel Selector */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Contact Channel Used:
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(['Phone Call', 'WhatsApp', 'In-Person Meeting', 'SMS', 'Email'] as const).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setEnquiryChannel(ch)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '11.5px',
                        fontWeight: enquiryChannel === ch ? 700 : 500,
                        background: enquiryChannel === ch ? '#063331' : '#f8fafc',
                        color: enquiryChannel === ch ? '#ffffff' : '#475569',
                        border: '1px solid #cbd5e1',
                        cursor: 'pointer',
                      }}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              {/* Outcome Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label htmlFor="enquiry-outcome-select" style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Discussion Outcome:
                  </label>
                  <select
                    id="enquiry-outcome-select"
                    value={enquiryOutcome}
                    onChange={(e) => setEnquiryOutcome(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: 6 }}
                  >
                    <option value="Promised to Pay">Promised to Pay (Specify Date)</option>
                    <option value="Follow-up Call Scheduled">Follow-up Call Scheduled</option>
                    <option value="Requested Instalment Extension / Split">Requested Fee Extension / Split</option>
                    <option value="Dispute on Fee Head / Receipt Pending">Fee Dispute / Receipt Verification</option>
                    <option value="Call Not Answered / Ringing">Call Not Answered / Ringing</option>
                    <option value="Phone Switched Off / Unreachable">Phone Switched Off / Unreachable</option>
                    <option value="Wrong Number / Need Alternate Guardian">Wrong Number / Alternate Needed</option>
                    <option value="Payment Already Made (Needs Reconciliation)">Payment Already Made (Reconciliation)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="promised-payment-date" style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Promised Payment / Callback Date:
                  </label>
                  <input
                    id="promised-payment-date"
                    type="date"
                    value={promisedDate}
                    onChange={(e) => setPromisedDate(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', fontSize: '12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="enquiry-notes-textarea" style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Enquiry Discussion Notes / Remarks:
                </label>
                <textarea
                  id="enquiry-notes-textarea"
                  rows={2}
                  value={enquiryNotes}
                  onChange={(e) => setEnquiryNotes(e.target.value)}
                  placeholder="Record summary of conversation with parent, commitments made, or next follow-up instructions..."
                  style={{ width: '100%', padding: '8px', fontSize: '12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setEnquiryTarget(null)}
                disabled={savingEnquiry}
                style={{ padding: '6px 14px', borderRadius: 'var(--radius-pill)', fontSize: '12.5px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button primary"
                onClick={saveEnquiry}
                disabled={savingEnquiry}
                style={{ padding: '6px 16px', borderRadius: 'var(--radius-pill)', fontSize: '12.5px', background: '#063331', color: '#ffffff', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Check size={14} strokeWidth={2} />
                <span>{savingEnquiry ? 'Saving…' : 'Save Enquiry & Update'}</span>
              </button>
            </div>
          </div>
        )}
      </dialog>

      {/* Modal 2: Send Formal Reminder Notice */}
      <dialog
        className="finance-dialog"
        ref={reminderDialogRef}
        onCancel={() => setReminderTarget(null)}
        style={{ maxWidth: 540 }}
      >
        {reminderTarget && (
          <div style={{ padding: 'var(--space-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#073533' }}>Send Delinquency Notice</h3>
              <button
                type="button"
                className="button secondary"
                onClick={() => setReminderTarget(null)}
                style={{ padding: '4px 8px', fontSize: '12px', display: 'flex' }}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10, marginBottom: '14px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Recipient:</span>
                <strong>{reminderTarget.guardian_name} ({reminderTarget.guardian_phone})</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Student Reference:</span>
                <strong>{reminderTarget.student_name} · {reminderTarget.account_reference}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Overdue Balance:</span>
                <strong style={{ color: '#991b1b', fontSize: '15px', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(reminderTarget.outstanding_minor)}</strong>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Select Delivery Channel:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setReminderChannel('whatsapp')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 'var(--radius-pill)',
                    border: reminderChannel === 'whatsapp' ? '2px solid #059669' : '1px solid #cbd5e1',
                    background: reminderChannel === 'whatsapp' ? '#f0fdf4' : '#ffffff',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setReminderChannel('sms')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 'var(--radius-pill)',
                    border: reminderChannel === 'sms' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                    background: reminderChannel === 'sms' ? '#f0f9ff' : '#ffffff',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  SMS Notice
                </button>
                <button
                  type="button"
                  onClick={() => setReminderChannel('email')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 'var(--radius-pill)',
                    border: reminderChannel === 'email' ? '2px solid #063331' : '1px solid #cbd5e1',
                    background: reminderChannel === 'email' ? '#f8fafc' : '#ffffff',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Email
                </button>
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px', marginBottom: '14px', fontSize: '12.5px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 600 }}>
                Notice Preview:
              </div>
              <p style={{ margin: 0, fontStyle: 'italic', color: '#334155' }}>
                &ldquo;Dear {reminderTarget.guardian_name}, this is an official delinquency notification from {session.tenant.name} regarding the fee instalment for {reminderTarget.student_name} ({reminderTarget.class_name}). The outstanding amount of {formatMoney(reminderTarget.outstanding_minor)} was due on {new Date(reminderTarget.due_date).toLocaleDateString('en-IN')} ({reminderTarget.days_overdue} days overdue). Please settle the fee online via the parent portal or verify your registered autopay mandate. Thank you.&rdquo;
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setReminderTarget(null)}
                disabled={sendingReminder}
                style={{ padding: '6px 14px', borderRadius: 'var(--radius-pill)', fontSize: '12.5px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button primary"
                onClick={sendReminder}
                disabled={sendingReminder}
                style={{ padding: '6px 16px', borderRadius: 'var(--radius-pill)', fontSize: '12.5px', background: '#063331', color: '#ffffff', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Send size={13} strokeWidth={1.75} />
                <span>{sendingReminder ? 'Dispatching…' : 'Send Notice'}</span>
              </button>
            </div>
          </div>
        )}
      </dialog>

      {/* Modal 3: Recovery Audit History */}
      <dialog
        className="finance-dialog"
        ref={historyDialogRef}
        onCancel={() => setRecoveryHistoryStudent(null)}
        style={{ maxWidth: 540 }}
      >
        {recoveryHistoryStudent && (
          <div style={{ padding: 'var(--space-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#073533' }}>Fee Recovery &amp; Enquiry History</h3>
                <p className="small" style={{ margin: '2px 0 0', color: 'var(--text-muted)' }}>
                  {recoveryHistoryStudent.student_name} ({recoveryHistoryStudent.account_reference}) • Guardian: {recoveryHistoryStudent.guardian_name}
                </p>
              </div>
              <button
                type="button"
                className="button secondary"
                onClick={() => setRecoveryHistoryStudent(null)}
                style={{ padding: '4px 8px', fontSize: '12px', display: 'flex' }}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '14px 0', maxHeight: '360px', overflowY: 'auto' }}>
              {recoveryHistoryStudent.recovery_logs.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No previous recovery actions logged for this student.
                </div>
              ) : (
                recoveryHistoryStudent.recovery_logs.map((log, idx) => (
                  <div key={idx} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '12.5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong style={{ color: '#073533' }}>{log.type}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{log.date}</span>
                    </div>
                    <p style={{ margin: 0, color: '#475569' }}>{log.note}</p>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="button primary"
                style={{ background: '#063331', color: '#ffffff', fontSize: '12px', padding: '6px 14px', borderRadius: 'var(--radius-pill)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => {
                  const s = recoveryHistoryStudent;
                  setRecoveryHistoryStudent(null);
                  setEnquiryTarget(s);
                }}
              >
                <PhoneCall size={13} strokeWidth={1.75} />
                <span>Log New Enquiry</span>
              </button>
              <button type="button" className="button secondary" onClick={() => setRecoveryHistoryStudent(null)} style={{ padding: '6px 12px', borderRadius: 'var(--radius-pill)', fontSize: '12px' }}>
                Close
              </button>
            </div>
          </div>
        )}
      </dialog>

      {/* Modal 4: Student Fee Details */}
      <dialog
        className="finance-dialog"
        ref={detailsDialogRef}
        onCancel={() => setFeeDetailsStudent(null)}
        style={{ maxWidth: 520 }}
      >
        {feeDetailsStudent && (
          <div style={{ padding: 'var(--space-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#073533' }}>Student Fee Details</h3>
              <button
                type="button"
                className="button secondary"
                onClick={() => setFeeDetailsStudent(null)}
                style={{ padding: '4px 8px', fontSize: '12px', display: 'flex' }}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: 10, marginBottom: '14px', fontSize: '13px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Student Full Name</span>
                  <div style={{ fontWeight: 600, color: '#073533' }}>{feeDetailsStudent.student_name}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Student Reference</span>
                  <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{feeDetailsStudent.account_reference}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Enrolled Class</span>
                  <div>{feeDetailsStudent.class_name}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Due Date</span>
                  <div>{new Date(feeDetailsStudent.due_date).toLocaleDateString('en-IN')}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Outstanding Dues</span>
                  <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '15px', fontVariantNumeric: 'tabular-nums' }}>
                    {formatMoney(feeDetailsStudent.outstanding_minor)}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Days Delinquent</span>
                  <div>
                    <span style={{ fontWeight: 700, color: '#c2410c' }}>{feeDetailsStudent.days_overdue} days</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  const s = feeDetailsStudent;
                  setFeeDetailsStudent(null);
                  setEnquiryTarget(s);
                }}
                style={{ padding: '6px 16px', borderRadius: 'var(--radius-pill)', fontSize: '12.5px', background: '#063331', color: '#ffffff', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <PhoneCall size={13} strokeWidth={1.75} />
                <span>Proceed to Contact &amp; Enquire</span>
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
