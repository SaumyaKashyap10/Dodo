'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type PortalStudent = {
  id: string;
  student_reference: string;
  full_name: string;
  email?: string;
  phone?: string;
  status: string;
  institution_name: string;
  course?: string;
  grade?: string;
  group_name?: string;
  academic_year?: string;
  campus?: string;
  payer_name?: string;
  payer_email?: string;
  payer_phone?: string;
};

type FeeSummary = {
  net_payable_minor: string | number;
  paid_minor: string | number;
  outstanding_minor: string | number;
};

type FeeComponent = {
  id: string;
  label: string;
  code: string;
  amount_minor: string | number;
};

type Installment = {
  id: string;
  sequence: number;
  due_date: string;
  amount_minor: string | number;
  adjustment_amount_minor: string | number;
  paid_amount_minor: string | number;
  remaining_minor: string | number;
  status: string;
};

type Mandate = {
  id: string;
  provider: string;
  provider_reference: string;
  status: string;
  rail: string;
  bank_name?: string;
  account_mask?: string;
  umrn?: string;
  ifsc?: string;
  max_amount_minor?: number;
  last_event_at?: string;
  type?: 'enach' | 'upi_autopay';
  upi_vpa?: string;
  upi_app?: string;
  valid_until?: string;
  is_simulation?: boolean;
};

type PaymentRecord = {
  id: string;
  provider_reference: string;
  amount_minor: string | number;
  refunded_amount_minor: string | number;
  recorded_at: string;
  status: string;
  receipt_number?: string;
  payment_method?: string;
};

type FormFieldConfig = {
  key: string;
  label: string;
  visible: boolean;
  required: boolean;
  editable: boolean;
  order: number;
};

type FormConfig = {
  fields: FormFieldConfig[];
  components: Array<{
    code: string;
    label: string;
    visible: boolean;
    required: boolean;
    selectable: boolean;
    fixed: boolean;
  }>;
  rules: {
    allowFullPayment: boolean;
    allowPartialPayment: boolean;
    allowAdvance: boolean;
    minPartialAmountMinor: number;
    maxPartialAmountMinor: number;
    requireDownPayment: boolean;
    enableEnach: boolean;
    allowPayerEditing: boolean;
  };
  instructions: {
    bannerText: string;
    termsText: string;
  };
};

type PaymentCompleteData = {
  paymentId: string;
  receiptNumber: string;
  transactionId: string;
  amountMinor: number;
  date: string;
  installmentRemainingMinor: number;
  netOutstandingMinor: number;
  paymentMethod?: string;
};

const formatMoney = (minor: string | number | undefined) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
    Number(minor || 0) / 100,
  );

const formatDate = (iso: string | undefined) => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export default function StudentPortalPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Login input fields
  const [loginReference, setLoginReference] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');

  // Portal State
  const [activeTab, setActiveTab] = useState<'home' | 'plans' | 'transactions' | 'support'>('home');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [scheduleView, setScheduleView] = useState<'flex' | 'master'>('flex');
  const [student, setStudent] = useState<PortalStudent | null>(null);
  const [tenant, setTenant] = useState<{ id: string; name: string } | null>(null);
  const [summary, setSummary] = useState<FeeSummary>({
    net_payable_minor: 0,
    paid_minor: 0,
    outstanding_minor: 0,
  });
  const [components, setComponents] = useState<FeeComponent[]>([]);
  const [masterSchedule, setMasterSchedule] = useState<Installment[]>([]);
  const [flexSchedule, setFlexSchedule] = useState<Installment[]>([]);
  const [upcomingInstallment, setUpcomingInstallment] = useState<Installment | null>(null);
  const [upcomingDebit, setUpcomingDebit] = useState<{
    amount_minor: number;
    scheduled_date?: string;
  } | null>(null);
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [formConfig, setFormConfig] = useState<FormConfig | null>(null);

  // Plans Tab Interactive State (eNACH Exclusive)
  const [showPlanWizard, setShowPlanWizard] = useState(false);
  const [selectedPlanFreq, setSelectedPlanFreq] = useState<'annual' | 'biannual' | 'quarterly' | 'monthly'>('quarterly');
  const [concessionCode, setConcessionCode] = useState('');
  const [concessionDiscountMinor, setConcessionDiscountMinor] = useState(0);
  const [concessionFeedback, setConcessionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [planSuccessNotice, setPlanSuccessNotice] = useState('');

  // eNACH Registration Form State
  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [bankName, setBankName] = useState('State Bank of India');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('SBIN0001234');
  const [accountType, setAccountType] = useState('savings');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [enachRegistering, setEnachRegistering] = useState(false);
  const [enachSuccessMessage, setEnachSuccessMessage] = useState('');
  const [enachError, setEnachError] = useState('');
  const [showUpdateMandate, setShowUpdateMandate] = useState(false);

  // AutoPay Modal & Payment Methods State
  const [showAutoPayModal, setShowAutoPayModal] = useState(false);
  const [selectedAutoPayInstallment, setSelectedAutoPayInstallment] = useState<Installment | null>(null);
  const [modalTab, setModalTab] = useState<'autopay' | 'pay_now'>('autopay');
  const [autoPayMethod, setAutoPayMethod] = useState<'enach' | 'upi_autopay'>('enach');
  const [selectedIndividualMethod, setSelectedIndividualMethod] = useState<'instant_upi' | 'netbanking' | 'card' | 'bank_transfer'>('instant_upi');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'enach' | 'upi' | 'netbanking' | 'card' | 'bank_transfer'>('enach');

  // UPI AutoPay Mandate Setup State (Recurring Mandate)
  const [upiMandateVpa, setUpiMandateVpa] = useState('student@okhdfcbank');
  const [upiMandateApp, setUpiMandateApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'cred'>('gpay');
  const [upiMandateAcceptedTerms, setUpiMandateAcceptedTerms] = useState(false);

  // Scheduled AutoPay Details Modal State (When Mandate is Already Active)
  const [showScheduledAutoPayModal, setShowScheduledAutoPayModal] = useState(false);
  const [scheduledModalInstallment, setScheduledModalInstallment] = useState<Installment | null>(null);

  // Individual Pay Now Inputs State (One-Time Payment)
  const [individualUpiId, setIndividualUpiId] = useState('');
  const [upiId, setUpiId] = useState('');
  const [selectedNetBank, setSelectedNetBank] = useState('HDFC Bank');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [autoPayProcessing, setAutoPayProcessing] = useState(false);
  const [autoPayError, setAutoPayError] = useState('');

  // Sandbox Debit Simulator State
  const [simulatingDebit, setSimulatingDebit] = useState(false);
  const [debitMessage, setDebitMessage] = useState('');
  const [paymentComplete, setPaymentComplete] = useState<PaymentCompleteData | null>(null);

  // Active Receipt Modal
  const [viewingReceipt, setViewingReceipt] = useState<any | null>(null);

  // Load token from sessionStorage on mount
  useEffect(() => {
    const savedToken =
      typeof window !== 'undefined' ? sessionStorage.getItem('portal_token') : null;
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  // Fetch portal data when token changes
  const fetchPortalData = async (authToken: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/portal/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.removeItem('portal_token');
          setToken(null);
        }
        throw new Error('Failed to load profile');
      }
      const data = await res.json();
      setStudent({
        ...data.student,
        student_reference: data.student.studentReference,
        full_name: data.student.fullName,
        institution_name: data.institution.name,
        academic_year: data.student.academicYear,
        group_name: data.student.groupName,
        payer_name: data.payer?.name || data.student?.payer_name,
        payer_email: data.payer?.email || data.student?.payer_email,
        payer_phone: data.payer?.phone || data.student?.payer_phone,
      });
      setTenant(data.institution);
      setSummary({
        net_payable_minor: data.summary.netPayableMinor,
        paid_minor: data.summary.paidMinor,
        outstanding_minor: data.summary.outstandingMinor,
      });
      setComponents(data.feeComponents.map((c: any) => ({ ...c, amount_minor: c.amountMinor })));
      const installments = data.installments.map((i: any) => ({
        ...i,
        due_date: i.dueDate,
        amount_minor: i.amountMinor,
        paid_amount_minor: i.paidAmountMinor,
        remaining_minor: i.remainingMinor,
      }));
      const masterInsts = (data.masterSchedule || []).map((m: any) => ({
        id: m.id,
        sequence: m.sequence,
        due_date: m.dueDate || m.due_date,
        status: m.status || 'scheduled',
        amount_minor: m.amountMinor || m.amount_minor,
        paid_amount_minor: m.paidAmountMinor || m.paid_amount_minor || 0,
        remaining_minor: m.remainingMinor || m.remaining_minor || m.amountMinor || m.amount_minor,
      }));
      setMasterSchedule(masterInsts);
      setFlexSchedule(installments);
      setUpcomingInstallment(installments.find((i: any) => Number(i.remaining_minor) > 0) || null);
      setUpcomingDebit(
        data.enach.upcomingDebit
          ? {
              amount_minor: data.enach.upcomingDebit.amountMinor,
              scheduled_date: data.enach.upcomingDebit.scheduledDate,
            }
          : null,
      );
      const storedMandateType =
        typeof window !== 'undefined'
          ? (sessionStorage.getItem('portal_mandate_type') as 'enach' | 'upi_autopay' | null)
          : null;
      setMandate(
        data.enach.mandateId
          ? {
              id: data.enach.mandateId,
              provider: data.enach.provider,
              provider_reference: data.enach.mandateReference || data.enach.umrn,
              status: data.enach.status,
              rail: storedMandateType === 'upi_autopay' ? 'upi' : 'enach',
              type: storedMandateType === 'upi_autopay' ? 'upi_autopay' : 'enach',
              bank_name: data.enach.bankName || 'HDFC Bank',
              account_mask: data.enach.accountMask || '•••• 8172',
              ifsc: data.enach.ifsc || 'HDFC0000001',
              umrn: data.enach.umrn || 'UMRN-ACTIVE-992',
              max_amount_minor: data.enach.maxAmountMinor || 5000000,
              valid_until: '30 Jun 2027',
              upi_vpa: 'student@okhdfcbank',
              upi_app: 'gpay',
              is_simulation: true,
            }
          : null,
      );
      setPayments(
        data.transactions.map((p: any) => ({
          ...p,
          amount_minor: p.amountMinor,
          recorded_at: p.recordedAt,
          receipt_number: p.receiptNumber,
          payment_method: p.mode,
          provider_reference: p.transactionId,
        })),
      );
      setPayerName(data.payer.name || '');
      setPayerEmail(data.payer.email || '');
      setPayerPhone(data.payer.phone || '');

      // Also fetch form config
      const cfgRes = await fetch('/api/v1/portal/form-config', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        setFormConfig({
          ...cfgData,
          instructions: {
            bannerText: cfgData.instructions,
            termsText:
              cfgData.rules.terms_text ||
              'Authorize Sandbox eNACH recurring debits for the current remaining installment balances.',
          },
          rules: {
            enableEnach: cfgData.rules.enable_enach,
            allowPayerEditing: cfgData.rules.allow_payer_contact_editing,
          },
        });
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      void fetchPortalData(token);
    }
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentReference: loginReference.trim(),
          identifier: loginIdentifier.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Authentication failed. Please verify your details.');
      }
      sessionStorage.setItem('portal_token', data.token);
      setToken(data.token);
    } catch (err: any) {
      setLoginError(
        err.message || 'Login failed. Please verify your Enrollment ID and phone/email.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/v1/portal/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    sessionStorage.removeItem('portal_token');
    setToken(null);
    setStudent(null);
    setMandate(null);
    setPaymentComplete(null);
    setActiveTab('home');
  };

  const handleRegisterEnach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setEnachError('');
    setEnachSuccessMessage('');
    if (!acceptedTerms) {
      setEnachError('Please accept the recurring eNACH mandate authorization terms.');
      return;
    }
    setEnachRegistering(true);
    try {
      const res = await fetch('/api/v1/portal/enach/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          payerName,
          payerEmail,
          payerPhone,
          bankName,
          accountNumber,
          ifsc: ifscCode,
          accountType,
          consent: true,
          mandateType: 'enach',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to register eNACH mandate.');
      }
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('portal_mandate_type', 'enach');
      }
      setMandate({
        id: data.mandateId || 'mndt-enach-sandbox-' + Date.now(),
        provider: 'sandbox_enach',
        provider_reference: 'ENACH-MNDT-' + (student?.student_reference || 'DEMO'),
        status: 'active',
        rail: 'enach',
        type: 'enach',
        bank_name: bankName || 'State Bank of India',
        account_mask: accountNumber ? `•••• ${accountNumber.slice(-4)}` : '•••• 8172',
        ifsc: ifscCode || 'SBIN0001234',
        umrn: 'UMRN-ENACH-' + (student?.student_reference || 'DEMO').replace(/[^0-9]/g, '') + '-01',
        max_amount_minor: 5000000,
        valid_until: '30 Jun 2027',
        is_simulation: true,
      });
      setEnachSuccessMessage('eNACH Bank Account AutoPay Mandate Active (Simulation Mode)');
      setShowAutoPayModal(false);
      await fetchPortalData(token);
    } catch (err: any) {
      setEnachError(err.message || 'eNACH registration could not be completed.');
    } finally {
      setEnachRegistering(false);
    }
  };

  const handleRegisterUpiAutoPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setEnachError('');
    setEnachSuccessMessage('');
    if (!upiMandateAcceptedTerms) {
      setEnachError('Please accept the recurring UPI AutoPay mandate authorization terms.');
      return;
    }
    const cleanVpa = (upiMandateVpa || '').trim();
    if (!cleanVpa || !cleanVpa.includes('@')) {
      setEnachError('Please enter a valid UPI ID (e.g. name@okhdfcbank).');
      return;
    }
    setEnachRegistering(true);
    try {
      const res = await fetch('/api/v1/portal/enach/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mandateType: 'upi_autopay',
          upiVpa: cleanVpa,
          upiApp: upiMandateApp,
          payerName,
          payerPhone,
          consent: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to authorize UPI AutoPay mandate.');
      }
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('portal_mandate_type', 'upi_autopay');
      }
      setMandate({
        id: data.mandateId || 'mndt-upi-sandbox-' + Date.now(),
        provider: 'sandbox_upi_autopay',
        provider_reference: 'UPI-MNDT-' + (student?.student_reference || 'DEMO'),
        status: 'active',
        rail: 'upi',
        type: 'upi_autopay',
        upi_vpa: cleanVpa,
        upi_app: upiMandateApp,
        max_amount_minor: 5000000,
        valid_until: '30 Jun 2027',
        is_simulation: true,
      });
      setEnachSuccessMessage('UPI AutoPay Mandate Active (Simulation Mode)');
      setShowAutoPayModal(false);
      await fetchPortalData(token);
    } catch (err: any) {
      setEnachError(err.message || 'UPI AutoPay mandate authorization could not be completed.');
    } finally {
      setEnachRegistering(false);
    }
  };

  const handleCancelAutoPay = () => {
    setMandate(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('portal_mandate_type');
    }
    setEnachSuccessMessage('AutoPay mandate removed for demonstration. You can set up eNACH or UPI AutoPay again.');
  };

  const handleSimulateDebit = async (outcome: 'success' | 'failed', installmentId?: string) => {
    if (!token) return;
    setDebitMessage('');
    setSimulatingDebit(true);
    try {
      const isUuid =
        !!installmentId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(installmentId);
      const res = await fetch('/api/v1/portal/enach/simulate-debit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          outcome: outcome === 'success' ? 'successful' : outcome,
          ...(isUuid ? { installmentId } : {}),
          amountMinor: upcomingInstallment?.remaining_minor || 4000000,
          paymentMode:
            mandate?.type === 'upi_autopay'
              ? 'UPI AutoPay Mandate (Simulation Mode)'
              : 'eNACH Auto-Debit (Simulation Mode)',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'AutoPay debit could not be processed');
      }
      if (outcome === 'failed') {
        setDebitMessage(data.message || 'Simulated debit failed as requested (e.g. Insufficient funds simulation).');
      } else if (data.paymentComplete) {
        const p = data.paymentComplete;
        setPaymentComplete({
          paymentId: p.transactionId,
          receiptNumber: p.receiptNumber,
          transactionId: p.transactionId,
          amountMinor: p.amountMinor,
          date: p.paymentDate,
          installmentRemainingMinor: 0,
          netOutstandingMinor: p.outstandingMinor,
          paymentMethod:
            mandate?.type === 'upi_autopay'
              ? 'UPI AutoPay Mandate (Simulation Mode)'
              : 'eNACH Auto-Debit (Simulation Mode)',
        });
      } else {
        setDebitMessage(data.message || 'AutoPay debit executed successfully via authorized mandate (Simulation Mode).');
      }
      await fetchPortalData(token);
    } catch (err: any) {
      setDebitMessage(err.message || 'AutoPay debit simulation could not be completed.');
    } finally {
      setSimulatingDebit(false);
    }
  };

  const openUnifiedPaymentModal = (inst: Installment, defaultTab: 'autopay' | 'pay_now' = 'autopay') => {
    setSelectedAutoPayInstallment(inst);
    setModalTab(defaultTab);
    setAutoPayError('');
    setShowAutoPayModal(true);
  };

  const openPayNowOnlyModal = (inst: Installment) => {
    openUnifiedPaymentModal(inst, 'pay_now');
  };

  const openScheduledAutoPayAction = (inst: Installment) => {
    setScheduledModalInstallment(inst);
    setAutoPayError('');
    setShowScheduledAutoPayModal(true);
  };

  const handleScheduledAutoPayDebit = async (inst: Installment) => {
    if (!token) return;
    if (inst.status === 'paid' || Number(inst.remaining_minor) <= 0) {
      setAutoPayError('This installment is already fully paid. Duplicate collection prevented.');
      return;
    }
    const maxLimit = mandate?.max_amount_minor || 5000000;
    if (Number(inst.remaining_minor) > maxLimit) {
      setAutoPayError(
        `Installment amount (${formatMoney(inst.remaining_minor)}) exceeds authorized mandate limit of ${formatMoney(maxLimit)}. Please contact the institution.`,
      );
      return;
    }
    setAutoPayProcessing(true);
    setAutoPayError('');
    try {
      const paymentMode =
        mandate?.type === 'upi_autopay'
          ? 'UPI AutoPay Mandate (Simulation Mode)'
          : 'eNACH Auto-Debit (Simulation Mode)';

      const res = await fetch('/api/v1/portal/enach/simulate-debit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          outcome: 'successful',
          installmentId: inst.id,
          paymentMode,
          amountMinor: inst.remaining_minor || inst.amount_minor || 4000000,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'AutoPay debit could not be simulated.');
      }

      setShowScheduledAutoPayModal(false);

      if (data.paymentComplete) {
        const p = data.paymentComplete;
        setPaymentComplete({
          paymentId: p.transactionId,
          receiptNumber: p.receiptNumber,
          transactionId: p.transactionId,
          amountMinor: p.amountMinor,
          date: p.paymentDate,
          installmentRemainingMinor: 0,
          netOutstandingMinor: p.outstandingMinor,
          paymentMethod: paymentMode,
        });
      }

      await fetchPortalData(token);
    } catch (err: any) {
      setAutoPayError(err.message || 'AutoPay debit simulation failed.');
    } finally {
      setAutoPayProcessing(false);
    }
  };

  const handleIndividualPayNowSubmit = async () => {
    if (!token || !selectedAutoPayInstallment) return;
    if (selectedAutoPayInstallment.status === 'paid' || Number(selectedAutoPayInstallment.remaining_minor) <= 0) {
      setAutoPayError('This installment is already fully paid. Duplicate payment prevented.');
      return;
    }
    setAutoPayProcessing(true);
    setAutoPayError('');
    try {
      const modeLabels: Record<string, string> = {
        instant_upi: 'Instant UPI QR & App (Individual Payment - Simulation Mode)',
        netbanking: `Net Banking (${selectedNetBank || 'HDFC Bank'}) (Individual Payment - Simulation Mode)`,
        card: 'Debit / Credit Card (Individual Payment - Simulation Mode)',
        bank_transfer: 'NEFT / RTGS Transfer (Individual Payment - Simulation Mode)',
      };
      const paymentMode = modeLabels[selectedIndividualMethod] || 'Instant UPI QR (Individual Payment - Simulation Mode)';

      const res = await fetch('/api/v1/portal/enach/simulate-debit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          outcome: 'successful',
          installmentId: selectedAutoPayInstallment.id,
          paymentMode,
          amountMinor: selectedAutoPayInstallment.remaining_minor || selectedAutoPayInstallment.amount_minor || 4000000,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Payment could not be processed.');
      }

      setShowAutoPayModal(false);

      if (data.paymentComplete) {
        const p = data.paymentComplete;
        setPaymentComplete({
          paymentId: p.transactionId,
          receiptNumber: p.receiptNumber,
          transactionId: p.transactionId,
          amountMinor: p.amountMinor,
          date: p.paymentDate,
          installmentRemainingMinor: 0,
          netOutstandingMinor: p.outstandingMinor,
          paymentMethod: paymentMode,
        });
      }

      await fetchPortalData(token);
    } catch (err: any) {
      setAutoPayError(err.message || 'Payment processing failed. Please verify your details.');
    } finally {
      setAutoPayProcessing(false);
    }
  };

  const openAutoPayModal = (inst: Installment) => {
    if (mandate && mandate.status === 'active') {
      openScheduledAutoPayAction(inst);
    } else {
      openUnifiedPaymentModal(inst, 'autopay');
    }
  };

  const handleAutoPaySubmit = async (method: 'enach' | 'upi' | 'netbanking' | 'card' | 'bank_transfer') => {
    await handleIndividualPayNowSubmit();
  };

  const openReceipt = async (receiptNumber: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/portal/receipts/${encodeURIComponent(receiptNumber)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const snap = data.snapshot || {};
        setViewingReceipt({
          ...data,
          receiptNumber: data.receipt_number,
          institutionName: snap.instituteName || data.institution_name,
          receiptConfig: snap.receiptConfig || {},
          studentName: snap.studentName,
          studentReference: snap.accountReference,
          paymentDate: data.recorded_at,
          transactionId: data.transaction_id,
          paymentMethod: data.payment_mode || 'eNACH',
          amountMinor: data.amount_minor,
          remainingMinor: snap.remainingMinor !== undefined ? snap.remainingMinor : data.remaining_minor,
        });
      }
    } catch {}
  };

  const printDocument = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const downloadReceiptDirectly = async (receiptNumber: string) => {
    if (!token) return;
    try {
      let rData: any = null;
      if (paymentComplete && paymentComplete.receiptNumber === receiptNumber) {
        rData = {
          receiptNumber: paymentComplete.receiptNumber,
          institutionName: tenant?.name || student?.institution_name || 'Educational Institution',
          studentName: student?.full_name || 'Student',
          studentReference: student?.student_reference || 'STU',
          course: student?.course || 'General',
          grade: student?.grade || 'Standard',
          paymentDate: formatDate(paymentComplete.date),
          transactionId: paymentComplete.transactionId,
          paymentMethod: paymentComplete.paymentMethod || 'AutoPay',
          amountFormatted: formatMoney(paymentComplete.amountMinor),
          remainingFormatted: formatMoney(paymentComplete.netOutstandingMinor),
        };
      } else {
        const res = await fetch(`/api/v1/portal/receipts/${encodeURIComponent(receiptNumber)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const snap = data.snapshot || {};
          rData = {
            receiptNumber: data.receipt_number,
            institutionName: snap.instituteName || data.institution_name || tenant?.name || 'Educational Institution',
            studentName: snap.studentName || student?.full_name || 'Student',
            studentReference: snap.accountReference || student?.student_reference || 'STU',
            course: snap.course || student?.course || 'General',
            grade: snap.grade || student?.grade || 'Standard',
            paymentDate: formatDate(data.recorded_at),
            transactionId: data.transaction_id,
            paymentMethod: data.payment_mode || 'AutoPay',
            amountFormatted: formatMoney(data.amount_minor),
            remainingFormatted: formatMoney(snap.remainingMinor !== undefined ? snap.remainingMinor : data.remaining_minor),
          };
        }
      }

      if (!rData) return;

      const cleanInst = String(rData.institutionName || 'Educational Institution').replace(/[\\()]/g, '');
      const cleanStudent = String(rData.studentName || 'Student').replace(/[\\()]/g, '');
      const cleanRef = String(rData.studentReference || 'STU').replace(/[\\()]/g, '');
      const cleanCourse = String(rData.course || 'General').replace(/[\\()]/g, '');
      const cleanGrade = String(rData.grade || 'Standard').replace(/[\\()]/g, '');
      const cleanTx = String(rData.transactionId || '').replace(/[\\()]/g, '');
      const cleanMode = String(rData.paymentMethod || 'AutoPay').replace(/[\\()]/g, '');
      const cleanAmount = String(rData.amountFormatted || '').replace('₹', 'INR ').replace(/[\\()]/g, '');
      const cleanDate = String(rData.paymentDate || '').replace(/[\\()]/g, '');
      const cleanRcpt = String(rData.receiptNumber || receiptNumber).replace(/[\\()]/g, '');

      const streamContent = [
        'BT',
        '/F1 18 Tf',
        '50 770 Td',
        '(OFFICIAL FEE RECEIPT) Tj',
        '/F1 13 Tf',
        '0 -26 Td',
        '(' + cleanInst + ') Tj',
        '0 -30 Td',
        '/F1 10 Tf',
        '(Receipt Number: ' + cleanRcpt + ') Tj',
        '0 -20 Td',
        '(Payment Date: ' + cleanDate + ') Tj',
        '0 -20 Td',
        '(Student Name: ' + cleanStudent + ') Tj',
        '0 -20 Td',
        '(Enrollment ID: ' + cleanRef + ') Tj',
        '0 -20 Td',
        '(Course / Grade: ' + cleanCourse + ' - ' + cleanGrade + ') Tj',
        '0 -20 Td',
        '(Transaction Reference: ' + cleanTx + ') Tj',
        '0 -20 Td',
        '(Payment Mode: ' + cleanMode + ') Tj',
        '0 -30 Td',
        '/F1 14 Tf',
        '(Total Amount Paid: ' + cleanAmount + ') Tj',
        ...(rData.remainingFormatted ? [
          '0 -24 Td',
          '/F1 11 Tf',
          '(Remaining Balance: ' + String(rData.remainingFormatted).replace('₹', 'INR ').replace(/[\\()]/g, '') + ') Tj',
        ] : []),
        '0 -30 Td',
        '/F1 9 Tf',
        '(Status: CONFIRMED & VERIFIED BY INSTITUTION FINANCIAL LEDGER) Tj',
        '0 -18 Td',
        '(This is an electronically generated official institutional receipt.) Tj',
        'ET',
      ].join('\n');

      const streamBytes = new TextEncoder().encode(streamContent);
      const streamLength = streamBytes.length;

      const header = '%PDF-1.4\n';
      const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
      const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
      const obj3 = '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n';
      const obj4 = '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';
      const obj5Header = '5 0 obj\n<< /Length ' + streamLength + ' >>\nstream\n';
      const obj5Footer = '\nendstream\nendobj\n';

      const offset1 = header.length;
      const offset2 = offset1 + obj1.length;
      const offset3 = offset2 + obj2.length;
      const offset4 = offset3 + obj3.length;
      const offset5 = offset4 + obj4.length;
      const xrefOffset = offset5 + obj5Header.length + streamLength + obj5Footer.length;

      const pad = (n: number) => n.toString().padStart(10, '0');
      const xref = [
        'xref',
        '0 6',
        '0000000000 65535 f ',
        pad(offset1) + ' 00000 n ',
        pad(offset2) + ' 00000 n ',
        pad(offset3) + ' 00000 n ',
        pad(offset4) + ' 00000 n ',
        pad(offset5) + ' 00000 n ',
        'trailer',
        '<< /Size 6 /Root 1 0 R >>',
        'startxref',
        xrefOffset.toString(),
        '%%EOF',
      ].join('\n');

      const fullPdf = header + obj1 + obj2 + obj3 + obj4 + obj5Header + streamContent + obj5Footer + xref;
      const blob = new Blob([fullPdf], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Fee_Receipt_${receiptNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Direct download failed:', err);
    }
  };

  

  const handleAddTestInstallment = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/portal/installments/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setDebitMessage('Added ₹5,000 test installment to official schedule. You can now simulate eNACH debit.');
        await fetchPortalData(token);
      } else {
        const data = await res.json();
        setDebitMessage(data.message || 'Could not add test installment.');
      }
    } catch (err: any) {
      setDebitMessage(err.message || 'Could not add test installment.');
    }
  };

  const handleApplyConcession = () => {
    const code = concessionCode.trim().toUpperCase();
    if (code === 'MERIT10') {
      const discount = 250000;
      setConcessionDiscountMinor(discount);
      setConcessionFeedback({
        type: 'success',
        message: '10% Merit Scholarship applied! You save ₹2,500.00.',
      });
    } else if (code === 'EARLYBIRD') {
      const discount = 200000;
      setConcessionDiscountMinor(discount);
      setConcessionFeedback({
        type: 'success',
        message: 'Early Bird Concession applied! You save ₹2,000.00.',
      });
    } else if (code === 'SIBLING') {
      const discount = 300000;
      setConcessionDiscountMinor(discount);
      setConcessionFeedback({
        type: 'success',
        message: 'Sibling Benefit applied! You save ₹3,000.00.',
      });
    } else if (code.length > 0) {
      setConcessionDiscountMinor(0);
      setConcessionFeedback({
        type: 'error',
        message: `Code "${code}" is invalid or expired. Try using MERIT10 or EARLYBIRD.`,
      });
    }
  };

  const handleCompletePlanSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) return;

    // Register mandate via eNACH endpoint
    await handleRegisterEnach(e);

    const totalMinor = Math.max(0, 2500000 - concessionDiscountMinor);
    let count = 4;
    if (selectedPlanFreq === 'annual') count = 1;
    if (selectedPlanFreq === 'biannual') count = 2;
    if (selectedPlanFreq === 'quarterly') count = 4;
    if (selectedPlanFreq === 'monthly') count = 10;

    const perInstMinor = Math.round(totalMinor / count);
    const newSchedule: Installment[] = [];
    const baseDate = new Date();

    for (let i = 1; i <= count; i++) {
      const d = new Date(baseDate);
      if (selectedPlanFreq === 'annual') d.setMonth(d.getMonth() + 1);
      else if (selectedPlanFreq === 'biannual') d.setMonth(d.getMonth() + (i - 1) * 6 + 1);
      else if (selectedPlanFreq === 'quarterly') d.setMonth(d.getMonth() + (i - 1) * 3 + 1);
      else if (selectedPlanFreq === 'monthly') d.setMonth(d.getMonth() + i);

      newSchedule.push({
        id: `plan-inst-${i}-${Date.now()}`,
        sequence: i,
        due_date: d.toISOString(),
        amount_minor: perInstMinor,
        adjustment_amount_minor: 0,
        paid_amount_minor: 0,
        remaining_minor: perInstMinor,
        status: 'scheduled',
      });
    }

    setFlexSchedule(newSchedule);
    setSummary({
      net_payable_minor: totalMinor,
      paid_minor: 0,
      outstanding_minor: totalMinor,
    });
    setUpcomingInstallment(newSchedule[0] || null);
    if (newSchedule[0]) {
      setUpcomingDebit({
        amount_minor: perInstMinor,
        scheduled_date: newSchedule[0].due_date,
      });
    }

    setPlanSuccessNotice(
      `eNACH Payment Plan registered successfully! ${count} recurring installment${count > 1 ? 's' : ''} of ${formatMoney(perInstMinor)} each linked to your bank mandate.`
    );
    setShowPlanWizard(false);
    setOnboardingStep(1);
  };

  // -------------------------------------------------------------
  // Unauthenticated: Student / Parent Login Form
  // -------------------------------------------------------------
  if (!token) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#F0F7F6',
          backgroundImage: 'radial-gradient(ellipse 90% 60% at 88% 18%, rgba(188, 234, 229, 0.25) 0%, rgba(240, 247, 246, 0.8) 60%, #F0F7F6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1rem',
          fontFamily: '"Plus Jakarta Sans", sans-serif',
        }}
      >
        <main
          id="main"
          className="portal-container"
          style={{ maxWidth: '480px', width: '100%', margin: '0 auto' }}
        >
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <Link href="/" style={{ textDecoration: 'none', color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#062B28', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem' }}>
                +
              </span>
              <span style={{ fontSize: '1.65rem', fontWeight: 800, color: '#062B28', letterSpacing: '-0.025em' }}>Pharmacy Fee Portal</span>
            </Link>
            <div style={{ marginTop: '0.85rem' }}>
              <span style={{ background: '#D7F4BE', color: '#173C1C', padding: '0.35rem 0.95rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em' }}>
                STUDENT & PARENT ACCESS
              </span>
            </div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#062B28', marginTop: '0.75rem', letterSpacing: '-0.02em' }}>Student / Parent Portal</h1>
            <p style={{ color: '#5C736E', fontSize: '0.925rem', marginTop: '0.4rem', lineHeight: 1.5 }}>
              Sign in with your enrollment ID and the secure access code issued by your institution to
              view fee schedules, receipts, and eNACH status.
            </p>
          </div>

          <div
            className="admin-panel"
            style={{
              padding: '2.25rem',
              background: '#FFFFFF',
              border: '1px solid #E1ECE9',
              borderRadius: '24px',
              boxShadow: '0 12px 36px rgba(6, 43, 40, 0.06)',
            }}
          >
          {loginError && (
            <div
              role="alert"
              style={{
                background: '#fdf2f2',
                border: '1px solid #f8b4b4',
                color: '#9b1c1c',
                padding: '0.75rem',
                borderRadius: '4px',
                marginBottom: '1.25rem',
              }}
            >
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="admin-form">
            <label className="field" style={{ display: 'block', marginBottom: '1rem' }}>
              <span>Enrollment / Student ID *</span>
              <input
                type="text"
                required
                placeholder="e.g. DPS-2026-089, DPS-2026-104, DPS-2026-141"
                value={loginReference}
                onChange={(e) => setLoginReference(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                autoFocus
              />
            </label>

            <label className="field" style={{ display: 'block', marginBottom: '1.5rem' }}>
              <span>Institution-issued Access Code *</span>
              <input
                type="text"
                required
                placeholder="e.g. access-DPS-2026-089 or demo-access-token-12345"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
              />
            </label>

            <button
              type="submit"
              className="button primary"
              disabled={loading}
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
            >
              {loading ? 'Authenticating…' : 'Access Student Portal'}
            </button>
          </form>

          {/* Quick-fill demo student references */}
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #E1ECE9' }}>
            <span style={{ fontSize: '0.75rem', color: '#5C736E', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
              Demo Student Accounts (Click to autofill):
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {[
                { id: 'DPS-2026-089', name: 'V Rakesh', parent: 'Rajesh Sharma' },
                { id: 'DPS-2026-104', name: 'Diya Patel', parent: 'Suresh Patel' },
                { id: 'DPS-2026-141', name: 'Rohan Mehta', parent: 'Vikram Mehta' },
                { id: 'DPS-2026-055', name: 'Kavya Reddy', parent: 'Venkat Reddy' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setLoginReference(item.id);
                    setLoginIdentifier(`access-${item.id}`);
                  }}
                  style={{
                    background: '#F0F7F6',
                    border: '1px solid #CBE0DC',
                    borderRadius: '8px',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.725rem',
                    color: '#062B28',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  title={`Student: ${item.name} | Parent: ${item.parent}`}
                >
                  {item.id} ({item.name})
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              marginTop: '1.25rem',
              textAlign: 'center',
              fontSize: '0.85rem',
              color: '#6b7280',
            }}
          >
            Need help? Contact your institution finance desk.
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link href="/" style={{ color: '#5C736E', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600 }}>
            ← Back to Public Home
          </Link>
        </div>
      </main>
    </div>
    );
  }

  // -------------------------------------------------------------
  // Authenticated Portal View
  // -------------------------------------------------------------
  return (
    <div
  className="student-portal-shell"
  style={{
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#F0F7F6',
    backgroundImage: 'radial-gradient(ellipse 90% 60% at 88% 18%, rgba(188, 234, 229, 0.22) 0%, rgba(240, 247, 246, 0.8) 60%, #F0F7F6 100%)',
    backgroundAttachment: 'fixed',
    color: '#062B28',
    fontFamily: '"Plus Jakarta Sans", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  }}
>
      {/* Mobile Drawer Backdrop */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 45,
          }}
        />
      )}

      {/* Left Sidebar Dashboard Navigation */}
      <aside
        className={`portal-sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}
        style={{
          width: '260px',
          minWidth: '260px',
          background: '#F0F7F6',
          borderRight: '1px solid #E1ECE9',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '1px 0 6px rgba(6, 43, 40, 0.02)',
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '1.25rem 1.25rem',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link
            href="/"
            style={{
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                background: '#062B28',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '1.15rem',
                borderRadius: '50%',
                boxShadow: '0 2px 8px rgba(6, 43, 40, 0.15)',
              }}
            >
              D
            </div>
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  color: '#062B28',
                  lineHeight: 1.15,
                  letterSpacing: '-0.02em',
                }}
              >
                Dodo
              </div>
              <div
                style={{
                  fontSize: '0.72rem',
                  color: '#7B8F8B',
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                }}
              >
                Student &amp; Parent Portal
              </div>
            </div>
          </Link>

          {/* Close button on mobile */}
          <button
            type="button"
            className="portal-mobile-close-btn"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation menu"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '0.25rem',
              display: 'none',
              fontSize: '1.25rem',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            &times;
          </button>
        </div>

        {/* Sidebar Nav Buttons */}
        <nav
          style={{
            flex: 1,
            padding: '1rem 0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: '#8A9995',
              letterSpacing: '0.08em',
              padding: '0 0.65rem 0.4rem',
              textTransform: 'uppercase',
            }}
          >
            Portal Dashboard
          </div>

          <button
            className={`portal-sidebar-nav-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('home');
              setPaymentComplete(null);
              setMobileNavOpen(false);
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Home</span>
          </button>

          <button
            className={`portal-sidebar-nav-item ${activeTab === 'plans' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('plans');
              setPaymentComplete(null);
              setMobileNavOpen(false);
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span>Fee Schedule</span>
          </button>

          <button
            className={`portal-sidebar-nav-item ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('transactions');
              setPaymentComplete(null);
              setMobileNavOpen(false);
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span>Transactions</span>
          </button>

          <button
            className={`portal-sidebar-nav-item ${activeTab === 'support' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('support');
              setPaymentComplete(null);
              setMobileNavOpen(false);
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>Support</span>
          </button>
        </nav>

        {/* Sidebar Footer Actions */}
        <div
          style={{
            padding: '1rem 0.85rem',
            borderTop: '1px solid #EEF5F3',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
          }}
        >
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.55rem 0.75rem',
              borderRadius: '6px',
              color: '#5C736E',
              textDecoration: 'none',
              fontSize: '0.825rem',
              fontWeight: 500,
              transition: 'background 0.15s ease',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back to Public Home</span>
          </Link>

          <button
            className="button outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.6rem 1rem',
              fontSize: '0.85rem',
              color: '#062B28',
              borderColor: '#E1ECE9',
              background: '#FFFFFF',
              borderRadius: '9999px',
              boxShadow: '0 1px 3px rgba(6, 43, 40, 0.02)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
            onClick={handleLogout}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area on the Right */}
      <div
        className="student-portal-main-area"
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        {/* Top Navbar Header (Clean Header without top navigation) */}
        <header
          className="portal-top-header"
          style={{
            background: 'rgba(240, 247, 246, 0.94)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid #E1ECE9',
            padding: '1.1rem 2.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 30,
            boxShadow: '0 1px 3px rgba(28, 29, 32, 0.02)',
          }}
        >
          {/* Left Region: Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <button
              type="button"
              className="portal-mobile-toggle-btn"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              style={{
                display: 'none',
                background: '#ffffff',
                border: '1px solid #E8E4DA',
                borderRadius: '8px',
                padding: '0.4rem 0.65rem',
                cursor: 'pointer',
                color: '#221C3E',
                fontSize: '1rem',
              }}
            >
              &#9776;
            </button>
            <h1
              style={{
                fontSize: '1.45rem',
                fontWeight: 700,
                margin: 0,
                color: '#062B28',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              {activeTab === 'home' && 'Student Dashboard'}
              {activeTab === 'plans' && 'Fee Schedule & Breakdown'}
              {activeTab === 'transactions' && 'Payment History & Receipts'}
              {activeTab === 'support' && 'Helpdesk & Support'}
            </h1>
          </div>

          {/* Right Region: Profile & Sign Out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {student && (
              <span
                style={{
                  background: '#FFFFFF',
                  padding: '0.45rem 1rem',
                  borderRadius: '9999px',
                  fontSize: '0.825rem',
                  color: '#585B62',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  border: '1px solid #E8E4DA',
                  boxShadow: '0 1px 3px rgba(28, 29, 32, 0.02)',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: '#00C271',
                    display: 'inline-block',
                  }}
                />
                {student.full_name} ({student.student_reference}) · {student.institution_name}
              </span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E8E4DA',
                borderRadius: '9999px',
                padding: '0.45rem 1.1rem',
                fontSize: '0.825rem',
                fontWeight: 600,
                color: '#221C3E',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 3px rgba(28, 29, 32, 0.02)',
              }}
              title="Sign out of portal"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Main Content Body */}
        <main
          id="main"
          style={{
            flex: 1,
            maxWidth: '1200px',
            width: '100%',
            margin: '0 auto',
            padding: '2rem 1.5rem',
            boxSizing: 'border-box',
          }}
        >
        {loading && !student && (
          <p role="status" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            Loading student financial records…
          </p>
        )}

        {/* -------------------------------------------------------------
            PAYMENT COMPLETE SCREEN (After Verified Money Collection)
        ------------------------------------------------------------- */}
        {paymentComplete && (
          <section
            className="admin-panel"
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #bbf7d0',
              padding: '2rem',
              marginBottom: '2rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              position: 'relative',
            }}
          >
            <button
              type="button"
              onClick={() => setPaymentComplete(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: '#F1F5F9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                color: '#64748b',
                cursor: 'pointer',
                lineHeight: 1,
              }}
              aria-label="Dismiss payment complete screen"
            >
              &times;
            </button>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '56px',
                  height: '56px',
                  background: '#dcfce7',
                  color: '#15803d',
                  borderRadius: '50%',
                  fontSize: '1.75rem',
                  marginBottom: '0.75rem',
                }}
              >
                ✓
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <span
                  style={{
                    background: '#fef3c7',
                    color: '#92400e',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.65rem',
                    borderRadius: '9999px',
                    letterSpacing: '0.03em',
                  }}
                >
                  SIMULATION MODE
                </span>
              </div>
              <h2 style={{ color: '#166534', margin: 0, fontSize: '1.75rem' }}>Payment Simulated Successfully</h2>
              <p style={{ color: '#15803d', marginTop: '0.25rem', fontSize: '0.9rem' }}>
                Simulated transaction confirmed and recorded in institutional fee ledger. No real bank or UPI funds were debited.
              </p>
            </div>

            <div
              style={{
                background: '#f8fafc',
                borderRadius: '8px',
                padding: '1.5rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>
                  Student Name
                </span>
                <strong style={{ fontSize: '1rem', color: '#1e293b' }}>{student?.full_name}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>
                  Course / Grade
                </span>
                <strong style={{ fontSize: '1rem', color: '#1e293b' }}>
                  {student?.course || 'General'} · {student?.grade || 'Standard'}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>
                  Receipt Number
                </span>
                <strong style={{ fontSize: '1rem', color: '#0369a1' }}>
                  {paymentComplete.receiptNumber}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>
                  Transaction Reference
                </span>
                <strong style={{ fontSize: '0.95rem', color: '#1e293b', wordBreak: 'break-all' }}>
                  {paymentComplete.transactionId}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>
                  Payment Date
                </span>
                <strong style={{ fontSize: '1rem', color: '#1e293b' }}>
                  {formatDate(paymentComplete.date)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>
                  Amount Paid
                </span>
                <strong style={{ fontSize: '1.25rem', color: '#166534' }}>
                  {formatMoney(paymentComplete.amountMinor)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>
                  Remaining Balance
                </span>
                <strong style={{ fontSize: '1.1rem', color: '#1e293b' }}>
                  {formatMoney(paymentComplete.netOutstandingMinor)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>
                  Payment Method
                </span>
                <strong style={{ fontSize: '1rem', color: '#1e293b' }}>{paymentComplete.paymentMethod || 'AutoPay'}</strong>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '0.85rem',
                justifyContent: 'center',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className="button primary"
                style={{
                  background: '#062B28',
                  color: '#FFFFFF',
                  borderRadius: '9999px',
                  padding: '0.7rem 1.85rem',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(6, 43, 40, 0.2)',
                }}
                onClick={() => openReceipt(paymentComplete.receiptNumber)}
              >
                View Receipt
              </button>
              <button
                type="button"
                className="button secondary"
                style={{
                  background: '#FFFFFF',
                  color: '#062B28',
                  border: '1.5px solid #062B28',
                  borderRadius: '9999px',
                  padding: '0.7rem 1.85rem',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(6, 43, 40, 0.05)',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => downloadReceiptDirectly(paymentComplete.receiptNumber)}
              >
                Download Receipt
              </button>
            </div>
          </section>
        )}

        {/* -------------------------------------------------------------
            TAB 1: HOME
        ------------------------------------------------------------- */}

        {activeTab === 'home' && !paymentComplete && student && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Greeting & Student Details */}
            <div
              className="admin-panel portal-welcome-card portal-stagger-1"
              style={{
                background: '#FFFFFF',
                borderRadius: '28px',
                border: '1px solid #E6ECF5',
                padding: '2rem 2.25rem',
                boxShadow: '0 4px 20px rgba(28, 29, 32, 0.03)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <h1 style={{ fontSize: '1.85rem', fontWeight: 700, letterSpacing: '-0.025em', color: '#062B28', margin: 0 }}>
                    Welcome, {student.full_name}!
                  </h1>
                  <p style={{ color: '#7B8F8B', fontSize: '0.925rem', marginTop: '0.35rem' }}>
                    Fee dashboard for <strong>{student.full_name}</strong> · Enrollment ID: <strong>{student.student_reference}</strong>
                    {student.payer_name ? ` · Linked Parent / Payer: ${student.payer_name}` : ''} at{' '}
                    <strong>{student.institution_name}</strong>
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      background: '#D7F4BE',
                      color: '#173C1C',
                      border: 'none',
                      padding: '0.35rem 1rem',
                      borderRadius: '9999px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  >
                    Status: {student.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  marginTop: '1.25rem',
                  paddingTop: '1.25rem',
                  borderTop: '1px solid #f1f5f9',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>
                    Enrollment ID
                  </span>
                  <strong>{student.student_reference}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>
                    Course / Program
                  </span>
                  <strong>{student.course || '—'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>
                    Grade / Class
                  </span>
                  <strong>{student.grade || '—'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>
                    Academic Year
                  </span>
                  <strong>{student.academic_year || '—'}</strong>
                </div>
              </div>
            </div>

            {/* Financial Overview Metrics */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1.5rem',
              }}
            >
              <div
                className="admin-panel portal-stat-card"
                style={{
                  background: '#FFFFFF',
                  borderRadius: '28px',
                  border: '1px solid #E6ECF5',
                  padding: '1.75rem 2rem',
                  boxShadow: '0 4px 20px rgba(28, 29, 32, 0.03)',
                }}
              >
                <span
                  style={{
                    fontSize: '0.85rem',
                    color: '#64748b',
                    fontWeight: 600,
                    letterSpacing: '0.025em',
                  }}
                >
                  NET PAYABLE
                </span>
                <h3 style={{ fontSize: '2.1rem', fontWeight: 700, letterSpacing: '-0.025em', margin: '0.5rem 0', color: '#173C1C' }}>
                  {formatMoney(summary.net_payable_minor)}
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                  Total fee components after approved concessions
                </p>
              </div>

              <div
                className="admin-panel portal-stat-card"
                style={{
                  background: '#FFFFFF',
                  borderRadius: '28px',
                  border: '1px solid #E6ECF5',
                  padding: '1.75rem 2rem',
                  boxShadow: '0 4px 20px rgba(28, 29, 32, 0.03)',
                }}
              >
                <span
                  style={{
                    fontSize: '0.85rem',
                    color: '#64748b',
                    fontWeight: 600,
                    letterSpacing: '0.025em',
                  }}
                >
                  TOTAL PAID
                </span>
                <h3 style={{ fontSize: '2.1rem', fontWeight: 700, letterSpacing: '-0.025em', margin: '0.5rem 0', color: '#0E3D36' }}>
                  {formatMoney(summary.paid_minor)}
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                  {Number(summary.net_payable_minor) > 0 && Number(summary.paid_minor) > 0
                    ? `Collection Progress: ${((Number(summary.paid_minor) / Number(summary.net_payable_minor)) * 100).toFixed(2)}%`
                    : 'Confirmed collections & cleared installments'}
                </p>
              </div>

              <div
                className="admin-panel portal-stat-card"
                style={{
                  background: '#FFFFFF',
                  borderRadius: '28px',
                  border: '1px solid #E6ECF5',
                  padding: '1.75rem 2rem',
                  boxShadow: '0 4px 20px rgba(28, 29, 32, 0.03)',
                }}
              >
                <span
                  style={{
                    fontSize: '0.85rem',
                    color: '#64748b',
                    fontWeight: 600,
                    letterSpacing: '0.025em',
                  }}
                >
                  OUTSTANDING BALANCE
                </span>
                <h3
                  style={{
                    fontSize: '2.1rem',
                    fontWeight: 700,
                    letterSpacing: '-0.025em',
                    margin: '0.5rem 0',
                    color: '#221C3E',
                  }}
                >
                  {formatMoney(summary.outstanding_minor)}
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                  {Number(summary.outstanding_minor) === 0
                    ? 'All fees settled'
                    : 'Remaining balance across schedule'}
                </p>
              </div>
            </div>

            {/* Unified AutoPay Status & Upcoming Schedule Card */}
            <div
              className="admin-panel portal-status-card portal-stagger-3"
              style={{
                background: '#FFFFFF',
                borderRadius: '28px',
                border: '1px solid #E6ECF5',
                padding: '2rem 2.25rem',
                boxShadow: '0 4px 20px rgba(28, 29, 32, 0.03)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.25rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span
                      style={{
                        background: '#062B28',
                        color: '#8BEA00',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.6rem',
                        borderRadius: '9999px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Unified AutoPay
                    </span>
                    <span
                      style={{
                        background: '#FEF3C7',
                        color: '#92400E',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.6rem',
                        borderRadius: '9999px',
                        letterSpacing: '0.03em',
                      }}
                    >
                      SIMULATION MODE
                    </span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#062B28', letterSpacing: '-0.015em' }}>
                    Automatic Instalment Collection Status
                  </h3>
                </div>

                <span
                  style={{
                    padding: '0.35rem 1rem',
                    borderRadius: '9999px',
                    fontSize: '0.8rem',
                    background: mandate?.status === 'active' ? '#D7F4BE' : '#F1F5F9',
                    color: mandate?.status === 'active' ? '#173C1C' : '#475569',
                    border: 'none',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: mandate?.status === 'active' ? '#16a34a' : '#94a3b8',
                    }}
                  />
                  {mandate?.status === 'active'
                    ? `AutoPay Active: ${mandate.type === 'upi_autopay' ? 'UPI AutoPay Mandate' : 'eNACH Bank Account'}`
                    : 'AutoPay: Not Registered (Setup Required)'}
                </span>
              </div>

              {mandate?.status === 'active' ? (
                <div>
                  {/* Active Mandate Parameter Details */}
                  <div
                    style={{
                      background: '#F8FAF8',
                      border: '1px solid #DCFCE7',
                      borderRadius: '16px',
                      padding: '1.25rem 1.5rem',
                      marginBottom: '1.25rem',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '1rem',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>
                        AutoPay Method &amp; Rail
                      </span>
                      <strong style={{ color: '#062B28', fontSize: '0.95rem' }}>
                        {mandate.type === 'upi_autopay' ? 'UPI AutoPay Mandate' : 'eNACH Bank Account AutoPay'}
                      </strong>
                      <span style={{ fontSize: '0.75rem', color: '#16a34a', display: 'block' }}>
                        {mandate.type === 'upi_autopay' ? 'NPCI UPI AutoPay Network' : 'NPCI Automated Clearing House'}
                      </span>
                    </div>

                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>
                        {mandate.type === 'upi_autopay' ? 'Linked UPI Handle / VPA' : 'Designated Bank & Account'}
                      </span>
                      <strong style={{ color: '#062B28', fontSize: '0.95rem' }}>
                        {mandate.type === 'upi_autopay'
                          ? mandate.upi_vpa || 'student@okhdfcbank'
                          : `${mandate.bank_name || 'HDFC Bank'} (A/C ${mandate.account_mask || '•••• 8172'})`}
                      </strong>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>
                        Reference: {mandate.umrn || mandate.provider_reference}
                      </span>
                    </div>

                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>
                        Authorised Maximum Amount
                      </span>
                      <strong style={{ color: '#062B28', fontSize: '0.95rem' }}>
                        {formatMoney(mandate.max_amount_minor || 5000000)} per cycle
                      </strong>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>
                        Enforced limit per recurring debit
                      </span>
                    </div>

                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>
                        Mandate Validity Period
                      </span>
                      <strong style={{ color: '#062B28', fontSize: '0.95rem' }}>
                        {mandate.valid_until ? `Valid through ${mandate.valid_until}` : 'Academic Year 2026-27'}
                      </strong>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>
                        Covers all scheduled academic dues
                      </span>
                    </div>
                  </div>

                  {upcomingInstallment && Number(upcomingInstallment.remaining_minor) > 0 ? (
                    <div
                      style={{
                        background: '#F0FDF4',
                        border: '1px solid #BBF7D0',
                        padding: '1rem 1.25rem',
                        borderRadius: '12px',
                        marginBottom: '1.25rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', background: '#DCFCE7', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>
                            NEXT SCHEDULED DEBIT
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.95rem', color: '#062B28' }}>
                          Installment <strong>#{upcomingInstallment.sequence}</strong> · Due on{' '}
                          <strong>{formatDate(upcomingInstallment.due_date)}</strong>
                        </p>
                        <p style={{ margin: '0.2rem 0 0 0', color: '#475569', fontSize: '0.85rem' }}>
                          Scheduled amount to collect:{' '}
                          <strong style={{ color: '#15803d', fontSize: '1rem' }}>
                            {formatMoney(upcomingInstallment.remaining_minor)}
                          </strong>
                        </p>
                      </div>

                      <button
                        type="button"
                        className="button primary"
                        disabled={simulatingDebit || autoPayProcessing}
                        onClick={() => handleScheduledAutoPayDebit(upcomingInstallment)}
                        style={{
                          background: '#062B28',
                          color: '#FFFFFF',
                          borderRadius: '9999px',
                          padding: '0.6rem 1.35rem',
                          fontSize: '0.825rem',
                          fontWeight: 700,
                          border: 'none',
                          cursor: simulatingDebit || autoPayProcessing ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          boxShadow: '0 4px 12px rgba(6, 43, 40, 0.2)',
                        }}
                      >
                        <span>{simulatingDebit ? 'Simulating Debit...' : 'Simulate AutoPay Debit (Simulation Mode)'}</span>
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        background: '#F8FAF8',
                        border: '1px solid #E2E8F0',
                        padding: '1rem 1.25rem',
                        borderRadius: '12px',
                        marginBottom: '1.25rem',
                        color: '#64748b',
                        fontSize: '0.9rem',
                      }}
                    >
                      ✓ All current installments are settled. Your active mandate remains in effect for any future dues.
                    </div>
                  )}

                  {/* Simulation Disclosure */}
                  <div
                    style={{
                      background: '#FFFBEB',
                      border: '1px solid #FDE68A',
                      borderRadius: '10px',
                      padding: '0.75rem 1rem',
                      marginBottom: '1.25rem',
                      fontSize: '0.8rem',
                      color: '#92400E',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                    }}
                  >
                    <span style={{ fontSize: '1rem', lineHeight: 1 }}>⚠️</span>
                    <div>
                      <strong>Simulation Mode Active:</strong> Live bank and NPCI APIs are currently unavailable in this deployment.
                      Mandates and debits are executed in simulated sandbox mode. No actual money is deducted from your bank or UPI app.
                    </div>
                  </div>
                </div>
              ) : (
                /* AutoPay Not Yet Registered - Offer eNACH & UPI AutoPay */
                <div>
                  <div
                    style={{
                      background: '#F8FAF8',
                      border: '1px solid #E2E8F0',
                      borderRadius: '16px',
                      padding: '1.5rem',
                      marginBottom: '1.25rem',
                    }}
                  >
                    <p style={{ margin: '0 0 1rem 0', color: '#475569', fontSize: '0.9rem' }}>
                      No active AutoPay mandate is currently registered for your account. Authorise recurring fee collection to ensure installments are settled on time without manual intervention.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                      <div
                        style={{
                          background: '#FFFFFF',
                          border: '1.5px solid #E2E8F0',
                          borderRadius: '12px',
                          padding: '1rem 1.15rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '1.1rem' }}>🏦</span>
                          <strong style={{ fontSize: '0.95rem', color: '#062B28' }}>1. eNACH — Bank Account AutoPay</strong>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
                          Direct bank debit through NPCI eNACH clearing. Authorises recurring collection up to ₹50,000 per cycle.
                        </p>
                      </div>

                      <div
                        style={{
                          background: '#FFFFFF',
                          border: '1.5px solid #E2E8F0',
                          borderRadius: '12px',
                          padding: '1rem 1.15rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '1.1rem' }}>📱</span>
                          <strong style={{ fontSize: '0.95rem', color: '#062B28' }}>2. UPI AutoPay — UPI Mandate</strong>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
                          Automated recurring payments through Google Pay, PhonePe, Paytm, or BHIM. Zero manual payment friction.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className="button primary"
                  style={{
                    background: '#062B28',
                    color: '#FFFFFF',
                    borderRadius: '9999px',
                    padding: '0.75rem 1.85rem',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    border: 'none',
                    boxShadow: '0 4px 14px rgba(6, 43, 40, 0.2)',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setActiveTab('plans');
                    if (mandate?.status !== 'active' && upcomingInstallment) {
                      openUnifiedPaymentModal(upcomingInstallment, 'autopay');
                    }
                  }}
                >
                  {mandate?.status === 'active' ? 'View Fee Schedule' : 'Set Up AutoPay / View Schedule'}
                </button>

                {mandate?.status === 'active' ? (
                  <button
                    type="button"
                    className="button outline"
                    onClick={() => {
                      if (upcomingInstallment) {
                        openUnifiedPaymentModal(upcomingInstallment, 'autopay');
                      } else if (flexSchedule[0]) {
                        openUnifiedPaymentModal(flexSchedule[0], 'autopay');
                      }
                    }}
                    style={{
                      borderRadius: '9999px',
                      padding: '0.75rem 1.5rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Switch / Re-authorise Method
                  </button>
                ) : null}

                {mandate?.status === 'active' ? (
                  <button
                    type="button"
                    onClick={handleCancelAutoPay}
                    title="Remove mandate to test setup flow from scratch"
                    style={{
                      background: 'transparent',
                      border: '1px dashed #CBD5E1',
                      borderRadius: '9999px',
                      padding: '0.75rem 1.25rem',
                      fontSize: '0.8rem',
                      color: '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    Reset Mandate (Demo Setup Test)
                  </button>
                ) : null}

                <button
                  className="button secondary"
                  style={{
                    background: '#FFFFFF',
                    color: '#062B28',
                    border: '1.5px solid #062B28',
                    borderRadius: '9999px',
                    padding: '0.75rem 1.85rem',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    boxShadow: '0 1px 3px rgba(28, 29, 32, 0.02)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setActiveTab('transactions')}
                >
                  View Receipts &amp; Transactions
                </button>
              </div>
            </div>
          </div>
        )}

                {/* -------------------------------------------------------------
            TAB 2: PLANS & PAYMENTS (FULLY FUNCTIONAL DASHBOARD & BUILDER)
        ------------------------------------------------------------- */}
        {activeTab === 'plans' && !paymentComplete && student && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Success Notification if Plan was updated */}
            {planSuccessNotice && (
              <div
                role="status"
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#166534',
                  padding: '1rem 1.25rem',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>✓</span>
                  <strong>{planSuccessNotice}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setPlanSuccessNotice('')}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#166534', fontSize: '1.1rem' }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* ---------------------------------------------------------
                ACTIVE PLAN OVERVIEW CARD & CONTROLS
            --------------------------------------------------------- */}
            <div
              className="admin-panel"
              style={{
                background: '#ffffff',
                borderRadius: '8px',
                padding: '1.5rem',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>
                      Plans &amp; Fee Breakdown
                    </h2>
                    <span
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: Number(summary.outstanding_minor) <= 0 ? '#dcfce7' : '#e0f2fe',
                        color: Number(summary.outstanding_minor) <= 0 ? '#15803d' : '#0369a1',
                      }}
                    >
                      {Number(summary.outstanding_minor) <= 0 ? '● FULLY PAID (100%)' : '● ACTIVE PLAN'}
                    </span>
                  </div>
                  <p style={{ color: '#64748b', margin: '0.35rem 0 0 0', fontSize: '0.9rem' }}>
                    {student.full_name} · {student.course || 'Cpa'} ({student.grade || 'grade1'}) · {student.institution_name}
                  </p>
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.8rem',
                      color: '#475569',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginTop: '0.6rem',
                    }}
                  >
                    <span>🏛️</span>
                    <span>
                      <strong>Official Schedule:</strong> Installments are set and scheduled by your institution. All collections are processed via NPCI eNACH recurring bank mandate.
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    className="button secondary"
                    onClick={printDocument}
                    style={{ fontSize: '0.875rem' }}
                  >
                    Download Statement
                  </button>
                  {Number(summary.outstanding_minor) <= 0 && (
                    <button
                      className="button outline"
                      onClick={handleAddTestInstallment}
                      title="Add a test installment of ₹5,000 to test direct online payment or live eNACH debits"
                      style={{ fontSize: '0.875rem', color: '#0369a1', borderColor: '#bae6fd' }}
                    >
                      + Add Test Installment (₹5,000)
                    </button>
                  )}
                </div>
              </div>

              {/* 3 Main Stat Cards (Pharmacy Inspiration Style) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1.25rem',
                }}
              >
                {/* Net Payable Card - Pastel Pistachio (#D7F4BE) */}
                <div
                  className="portal-stagger-1 portal-card-hover"
                  style={{
                    background: '#D7F4BE',
                    padding: '1.4rem 1.5rem',
                    borderRadius: '24px',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(215, 244, 190, 0.45)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '140px',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '10px',
                          background: 'rgba(255, 255, 255, 0.65)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#173C1C',
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                        </svg>
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#2D4E30' }}>
                        Net Payable
                      </span>
                    </div>
                    <span style={{ color: '#2D4E30', opacity: 0.6, fontSize: '1rem', letterSpacing: '1px' }}>•••</span>
                  </div>

                  <div style={{ marginTop: '0.75rem', position: 'relative', zIndex: 2 }}>
                    <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#062B28', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                      {formatMoney(summary.net_payable_minor)}
                    </div>
                    <span style={{ fontSize: '0.78rem', color: '#2D4E30', fontWeight: 500, marginTop: '0.35rem', display: 'inline-block' }}>
                      After approved concessions
                    </span>
                  </div>

                  {/* Micro bar silhouette watermark */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      right: '1.25rem',
                      bottom: '1rem',
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: '4px',
                      opacity: 0.28,
                      pointerEvents: 'none',
                    }}
                  >
                    <span style={{ width: '6px', height: '22px', borderRadius: '3px', background: '#062B28' }} />
                    <span style={{ width: '6px', height: '34px', borderRadius: '3px', background: '#062B28' }} />
                    <span style={{ width: '6px', height: '18px', borderRadius: '3px', background: '#062B28' }} />
                    <span style={{ width: '6px', height: '44px', borderRadius: '3px', background: '#062B28' }} />
                  </div>
                </div>

                {/* Total Paid Card - Soft Mint Seafoam (#BCEAE5) */}
                <div
                  className="portal-stagger-2 portal-card-hover"
                  style={{
                    background: '#BCEAE5',
                    padding: '1.4rem 1.5rem',
                    borderRadius: '24px',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(188, 234, 229, 0.45)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '140px',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '10px',
                          background: 'rgba(255, 255, 255, 0.65)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#0E3D36',
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#134D44' }}>
                        Total Paid
                      </span>
                    </div>
                    <span style={{ color: '#134D44', opacity: 0.6, fontSize: '1rem', letterSpacing: '1px' }}>•••</span>
                  </div>

                  <div style={{ marginTop: '0.75rem', position: 'relative', zIndex: 2 }}>
                    <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#062B28', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                      {formatMoney(summary.paid_minor)}
                    </div>
                    <span style={{ fontSize: '0.78rem', color: '#134D44', fontWeight: 500, marginTop: '0.35rem', display: 'inline-block' }}>
                      {Number(summary.net_payable_minor) > 0 && Number(summary.paid_minor) > 0
                        ? `Collection Progress: ${((Number(summary.paid_minor) / Number(summary.net_payable_minor)) * 100).toFixed(2)}%`
                        : 'Cleared installments & collections'}
                    </span>
                  </div>

                  {/* Micro bar silhouette watermark */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      right: '1.25rem',
                      bottom: '1rem',
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: '4px',
                      opacity: 0.28,
                      pointerEvents: 'none',
                    }}
                  >
                    <span style={{ width: '6px', height: '16px', borderRadius: '3px', background: '#062B28' }} />
                    <span style={{ width: '6px', height: '28px', borderRadius: '3px', background: '#062B28' }} />
                    <span style={{ width: '6px', height: '42px', borderRadius: '3px', background: '#062B28' }} />
                    <span style={{ width: '6px', height: '24px', borderRadius: '3px', background: '#062B28' }} />
                  </div>
                </div>

                {/* Outstanding Balance Card - Soft Coral Rose (#FCD0CF) */}
                <div
                  className="portal-stagger-3 portal-card-hover"
                  style={{
                    background: '#FCD0CF',
                    padding: '1.4rem 1.5rem',
                    borderRadius: '24px',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(252, 208, 207, 0.45)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '140px',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '10px',
                          background: 'rgba(255, 255, 255, 0.65)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#4A1B1B',
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6A2323' }}>
                        Outstanding Balance
                      </span>
                    </div>
                    <span style={{ color: '#6A2323', opacity: 0.6, fontSize: '1rem', letterSpacing: '1px' }}>•••</span>
                  </div>

                  <div style={{ marginTop: '0.75rem', position: 'relative', zIndex: 2 }}>
                    <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#062B28', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                      {formatMoney(summary.outstanding_minor || 0)}
                    </div>
                    <span style={{ fontSize: '0.78rem', color: '#6A2323', fontWeight: 500, marginTop: '0.35rem', display: 'inline-block' }}>
                      {Number(summary.outstanding_minor) <= 0 ? 'All fees settled' : 'Remaining across schedule'}
                    </span>
                  </div>

                  {/* Micro bar silhouette watermark */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      right: '1.25rem',
                      bottom: '1rem',
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: '4px',
                      opacity: 0.28,
                      pointerEvents: 'none',
                    }}
                  >
                    <span style={{ width: '6px', height: '36px', borderRadius: '3px', background: '#062B28' }} />
                    <span style={{ width: '6px', height: '20px', borderRadius: '3px', background: '#062B28' }} />
                    <span style={{ width: '6px', height: '46px', borderRadius: '3px', background: '#062B28' }} />
                    <span style={{ width: '6px', height: '28px', borderRadius: '3px', background: '#062B28' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------------
                FEE COMPONENTS BREAKDOWN TABLE
            --------------------------------------------------------- */}
            <section
              className="admin-panel"
              style={{ background: '#ffffff', borderRadius: '8px', padding: '1.5rem', border: '1px solid #e2e8f0' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>Configured Fee Components</h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Institution Approved Structure
                </span>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Component Description</th>
                      <th className="money">Allocated Fee</th>
                      <th>Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(components.length > 0
                      ? components
                      : [
                          { id: 'tui-1', code: 'TUI-01', label: 'Tuition & Academic Instruction', amount_minor: 1800000 },
                          { id: 'lab-1', code: 'LAB-01', label: 'Digital Lab & Computer Head', amount_minor: 500000 },
                          { id: 'exm-1', code: 'EXM-01', label: 'Examination & Assessment Head', amount_minor: 200000 },
                        ]
                    ).map((c: any) => (
                      <tr key={c.id}>
                        <td><strong>{c.code}</strong></td>
                        <td>{c.label}</td>
                        <td className="money" style={{ fontWeight: 600 }}>{formatMoney(c.amount_minor)}</td>
                        <td>
                          <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#f1f5f9', color: '#475569' }}>
                            Mandatory Core
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 700, borderTop: '2px solid #cbd5e1', background: '#f8fafc' }}>
                      <td colSpan={2}>Total Fee Sum</td>
                      <td className="money" style={{ color: '#0d6b60', fontSize: '1.1rem' }}>
                        {formatMoney(summary.net_payable_minor || 2500000)}
                      </td>
                      <td>—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* ---------------------------------------------------------
                INSTALLMENT SCHEDULE & ACTIONS (PAY NOW / VIEW RECEIPT)
            --------------------------------------------------------- */}
            <section
              className="admin-panel"
              style={{ background: '#ffffff', borderRadius: '8px', padding: '1.5rem', border: '1px solid #e2e8f0' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>Installment Schedule</h3>
                  <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                    {scheduleView === 'flex'
                      ? 'Student Flex Schedule: Your personalized installment schedule reflecting individual payments and active dues.'
                      : 'Master Template: Standard institutional fee structure and scheduled installments established for your academic program.'}
                  </p>
                </div>
                <div className="row" style={{ gap: '0.5rem' }}>
                  <button
                    className={`button ${scheduleView === 'flex' ? 'primary' : 'secondary'}`}
                    style={{ padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}
                    onClick={() => setScheduleView('flex')}
                  >
                    Student Flex Schedule
                  </button>
                  <button
                    className={`button ${scheduleView === 'master' ? 'primary' : 'secondary'}`}
                    style={{ padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}
                    onClick={() => setScheduleView('master')}
                  >
                    Master Template
                  </button>
                </div>
              </div>

              {(scheduleView === 'flex' ? flexSchedule : masterSchedule).length === 0 ? (
                <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>
                  No schedule installments available.
                </p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Installment</th>
                        <th>Due Date</th>
                        <th className="money">Original Fee</th>
                        <th className="money">Paid</th>
                        <th className="money">Remaining</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(scheduleView === 'flex' ? flexSchedule : masterSchedule).map((inst, idx) => {
                        const isPaid = inst.status === 'paid' || Number(inst.remaining_minor) <= 0;
                        const isAutoPayCovered = !isPaid && mandate && mandate.status === 'active';
                        return (
                          <tr key={`${inst.id || 'inst'}-${inst.sequence}-${idx}`}>
                            <td>
                              <strong>#{inst.sequence}</strong>
                            </td>
                            <td>{formatDate(inst.due_date)}</td>
                            <td className="money">{formatMoney(inst.amount_minor)}</td>
                            <td className="money" style={{ color: '#166534' }}>
                              {formatMoney(inst.paid_amount_minor)}
                            </td>
                            <td className="money" style={{ fontWeight: 600, color: isPaid ? '#64748b' : '#ea580c' }}>
                              {formatMoney(inst.remaining_minor)}
                            </td>
                            <td>
                              <span
                                style={{
                                  padding: '0.25rem 0.65rem',
                                  borderRadius: '9999px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  background: isPaid ? '#dcfce7' : isAutoPayCovered ? '#ccfbf1' : '#eff6ff',
                                  color: isPaid ? '#15803d' : isAutoPayCovered ? '#0f766e' : '#1d4ed8',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                }}
                              >
                                {isAutoPayCovered && (
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0d9488' }} />
                                )}
                                {isPaid ? 'PAID' : isAutoPayCovered ? 'Scheduled for AutoPay' : 'SCHEDULED'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {isPaid ? (
                                <button
                                  className="button secondary"
                                  onClick={() => {
                                    const matchingTx = payments.find((p) => p.receipt_number);
                                    openReceipt(matchingTx?.receipt_number || 'RCP-PAID-01');
                                  }}
                                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                >
                                  <span>Receipt</span>
                                </button>
                              ) : isAutoPayCovered ? (
                                <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', justifyContent: 'center' }}>
                                  <button
                                    className="button primary"
                                    disabled={simulatingDebit || autoPayProcessing}
                                    onClick={() => openScheduledAutoPayAction(inst)}
                                    title="View Scheduled AutoPay mandate details or simulate debit in Simulation Mode"
                                    style={{
                                      padding: '0.35rem 0.8rem',
                                      fontSize: '0.78rem',
                                      fontWeight: 700,
                                      borderRadius: '9999px',
                                      background: '#062B28',
                                      color: '#FFFFFF',
                                      border: 'none',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <span>AutoPay Details</span>
                                  </button>
                                  <button
                                    className="button secondary"
                                    disabled={simulatingDebit || autoPayProcessing}
                                    onClick={() => openPayNowOnlyModal(inst)}
                                    title="Make an individual one-time payment for this installment instead"
                                    style={{
                                      padding: '0.35rem 0.8rem',
                                      fontSize: '0.78rem',
                                      fontWeight: 600,
                                      borderRadius: '9999px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <span>Pay Now</span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="button primary"
                                  disabled={simulatingDebit || autoPayProcessing}
                                  onClick={() => openUnifiedPaymentModal(inst, 'autopay')}
                                  title="Set up recurring AutoPay (eNACH / UPI AutoPay) or Pay Now via individual payment"
                                  style={{ padding: '0.4rem 1.15rem', fontSize: '0.825rem', fontWeight: 700, borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', background: '#062B28', color: '#FFFFFF', border: 'none', cursor: 'pointer' }}
                                >
                                  <span>Set Up AutoPay / Pay</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            
            
          </div>
        )}
        {/* -------------------------------------------------------------
            TAB 3: TRANSACTIONS & RECEIPTS
        ------------------------------------------------------------- */}
        {activeTab === 'transactions' && !paymentComplete && student && (
          <section
            className="admin-panel"
            style={{ background: '#ffffff', borderRadius: '8px', padding: '1.5rem' }}
          >
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <h2 style={{ margin: 0 }}>Payment Transactions &amp; Receipts</h2>
                <span
                  style={{
                    background: '#FEF3C7',
                    color: '#92400E',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.6rem',
                    borderRadius: '9999px',
                    letterSpacing: '0.03em',
                  }}
                >
                  SIMULATION MODE
                </span>
              </div>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
                Complete ledger of individual payments (Instant UPI QR, Cash, Net Banking, Cards) and recurring AutoPay debits (eNACH and UPI AutoPay).
              </p>
            </div>

            <div
              style={{
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                fontSize: '0.825rem',
                color: '#92400E',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>ℹ️</span>
              <div>
                <strong>Simulation Mode Disclosure:</strong> Live bank/payment API is currently unavailable.
                All transactions displayed below are recorded in simulated sandbox mode for demonstration. No real funds were moved or debited.
              </div>
            </div>

            {payments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                <p>No payment transactions recorded yet.</p>
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Payment Date</th>
                      <th>Transaction ID / Reference</th>
                      <th>Method</th>
                      <th className="money">Amount</th>
                      <th>Status</th>
                      <th>Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td>{formatDate(p.recorded_at)}</td>
                        <td>
                          <strong>{p.provider_reference}</strong>
                        </td>
                        <td>
                          <span
                            style={{
                              background: '#f1f5f9',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                            }}
                          >
                            {p.payment_method ||
                              (p.provider_reference.startsWith('CASH') ? 'Cash' : 'Bank / eNACH')}
                          </span>
                        </td>
                        <td className="money" style={{ fontWeight: 600 }}>
                          {formatMoney(p.amount_minor)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span
                              style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: p.status === 'confirmed' || p.status === 'settled' ? '#dcfce7' : '#eff6ff',
                                color: p.status === 'confirmed' || p.status === 'settled' ? '#15803d' : '#1d4ed8',
                                width: 'fit-content',
                              }}
                            >
                              {(p.status || 'confirmed').toUpperCase()}
                            </span>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                color: '#92400e',
                                background: '#fef3c7',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '3px',
                                width: 'fit-content',
                                fontWeight: 600,
                              }}
                            >
                              Simulation Mode
                            </span>
                          </div>
                        </td>
                        <td>
                          {p.receipt_number ? (
                            <button
                              className="button secondary"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => downloadReceiptDirectly(p.receipt_number!)}
                            >
                              Download Receipt
                            </button>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Issued</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* -------------------------------------------------------------
            TAB 4: SUPPORT
        ------------------------------------------------------------- */}
        {activeTab === 'support' && !paymentComplete && student && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <section
              className="admin-panel"
              style={{ background: '#ffffff', borderRadius: '8px', padding: '1.5rem' }}
            >
              <h2 style={{ margin: '0 0 0.5rem 0' }}>Institution Support & Helpdesk</h2>
              <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '0 0 1.5rem 0' }}>
                Contact the student finance desk for assistance with fee plans, scholarship
                adjustments, or eNACH mandate updates.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1.5rem',
                }}
              >
                <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Institution Desk</h4>
                  <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem' }}>
                    <strong>{student.institution_name}</strong>
                  </p>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
                    Campus: {student.campus || 'Main Campus'}
                  </p>
                </div>

                <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Finance Helpdesk</h4>
                  <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem' }}>
                    Email:{' '}
                    <strong>
                      accounts@{student.institution_name.toLowerCase().replace(/[^a-z0-9]/g, '')}
                      .edu
                    </strong>
                  </p>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
                    Helpline: +91 1800-123-4567 (Toll-Free)
                  </p>
                </div>

                <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Operational Hours</h4>
                  <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem' }}>Monday – Saturday</p>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
                    9:00 AM – 5:00 PM IST
                  </p>
                </div>
              </div>
            </section>

            <section
              className="admin-panel"
              style={{ background: '#ffffff', borderRadius: '8px', padding: '1.5rem' }}
            >
              <h3 style={{ margin: '0 0 1rem 0' }}>Frequently Asked Questions</h3>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  fontSize: '0.9rem',
                }}
              >
                <div>
                  <strong>Does registering eNACH immediately deduct money?</strong>
                  <p style={{ color: '#64748b', margin: '0.25rem 0 0 0' }}>
                    No. Mandate registration merely authorizes automated recurring debits on
                    scheduled installment due dates. Money is debited only when an installment
                    becomes due.
                  </p>
                </div>
                <div>
                  <strong>
                    What happens if I pay an installment directly through Cash or Bank Transfer?
                  </strong>
                  <p style={{ color: '#64748b', margin: '0.25rem 0 0 0' }}>
                    When a direct payment is recorded by the institution, future eNACH debits are
                    automatically recalculated and reduced in real time. If the balance reaches
                    zero, debits are completely prevented.
                  </p>
                </div>
                <div>
                  <strong>Where can I access my official tax and fee receipts?</strong>
                  <p style={{ color: '#64748b', margin: '0.25rem 0 0 0' }}>
                    Every confirmed payment generates an official receipt accessible in the
                    Transactions tab. You can view, download, or print official receipts anytime.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
        </main>
      </div>

      {/* Styles for portal sidebar hover and responsive behavior */}
      <style>{`
        .portal-sidebar-nav-item {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          width: 100%;
          padding: 0.8rem 1.25rem;
          border-radius: 9999px;
          border: 1px solid transparent;
          background: transparent;
          color: #5C736E;
          font-weight: 500;
          font-size: 0.925rem;
          cursor: pointer;
          text-align: left;
          transition: all 0.18s ease;
        }
        .portal-sidebar-nav-item:hover {
          background: #E8F3F1;
          color: #062B28;
        }
        .portal-sidebar-nav-item.active {
          background: #062B28 !important;
          color: #FFFFFF !important;
          font-weight: 600;
          border-radius: 9999px;
          box-shadow: 0 4px 14px rgba(6, 43, 40, 0.18);
        }
        .portal-sidebar-nav-item.active svg {
          stroke: #FFFFFF !important;
        }
        .admin-panel {
          border-radius: 24px !important;
          border: 1px solid #E1ECE9 !important;
          background: #FFFFFF !important;
          box-shadow: 0 4px 20px rgba(6, 43, 40, 0.03) !important;
        }
        @media (max-width: 860px) {
          .portal-mobile-toggle-btn {
            display: inline-block !important;
          }
          .portal-mobile-close-btn {
            display: inline-block !important;
          }
          .portal-sidebar {
            position: fixed !important;
            top: 0 !important;
            bottom: 0 !important;
            left: -280px !important;
            transition: left 0.25s ease-in-out !important;
            z-index: 50 !important;
          }
          .portal-sidebar.mobile-open {
            left: 0 !important;
          }
        }
      `}</style>

      {/* -------------------------------------------------------------
          1. UNIFIED PAYMENT & AUTOPAY SETUP MODAL
          Separates AutoPay (Recurring) from Pay Now (Individual)
      ------------------------------------------------------------- */}
      {showAutoPayModal && selectedAutoPayInstallment && student && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Installment Payment & AutoPay Setup"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(6, 43, 40, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9998,
            padding: '1rem',
          }}
        >
          <div
            className="portal-autopay-modal"
            style={{
              background: '#FFFFFF',
              borderRadius: '24px',
              maxWidth: '700px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '2rem 2.25rem',
              boxShadow: '0 25px 50px -12px rgba(6, 43, 40, 0.25)',
              position: 'relative',
              boxSizing: 'border-box',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '1rem',
                borderBottom: '1px solid #EEF5F3',
                paddingBottom: '1rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span
                    style={{
                      background: '#062B28',
                      color: '#8BEA00',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.6rem',
                      borderRadius: '9999px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Fee Portal
                  </span>
                  <span
                    style={{
                      background: '#FEF3C7',
                      color: '#92400E',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.6rem',
                      borderRadius: '9999px',
                    }}
                  >
                    SIMULATION MODE
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: '1.45rem', color: '#062B28', fontWeight: 700, letterSpacing: '-0.02em' }}>
                  Installment #{selectedAutoPayInstallment.sequence} Payment &amp; AutoPay
                </h2>
                <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                  Due Date: <strong>{formatDate(selectedAutoPayInstallment.due_date)}</strong> · Outstanding:{' '}
                  <strong style={{ color: '#15803d' }}>{formatMoney(selectedAutoPayInstallment.remaining_minor)}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAutoPayModal(false)}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  color: '#64748b',
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            {/* Error Notification */}
            {(autoPayError || enachError) && (
              <div
                role="alert"
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#DC2626',
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  marginBottom: '1.25rem',
                  fontSize: '0.875rem',
                }}
              >
                ✕ {autoPayError || enachError}
              </div>
            )}

            {/* Top-Level Section Tabs: AutoPay vs Pay Now */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem',
                background: '#F1F5F9',
                padding: '0.35rem',
                borderRadius: '14px',
                marginBottom: '1.5rem',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setModalTab('autopay');
                  setAutoPayError('');
                  setEnachError('');
                }}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: modalTab === 'autopay' ? '#062B28' : 'transparent',
                  color: modalTab === 'autopay' ? '#FFFFFF' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.15rem',
                  transition: 'all 0.15s ease',
                  boxShadow: modalTab === 'autopay' ? '0 2px 8px rgba(6, 43, 40, 0.15)' : 'none',
                }}
              >
                <span>A. AutoPay — Automatic Collection</span>
                <span style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 500 }}>
                  Recurring Mandate (eNACH / UPI AutoPay)
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalTab('pay_now');
                  setAutoPayError('');
                  setEnachError('');
                }}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: modalTab === 'pay_now' ? '#062B28' : 'transparent',
                  color: modalTab === 'pay_now' ? '#FFFFFF' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.15rem',
                  transition: 'all 0.15s ease',
                  boxShadow: modalTab === 'pay_now' ? '0 2px 8px rgba(6, 43, 40, 0.15)' : 'none',
                }}
              >
                <span>B. Pay Now — Individual Payment</span>
                <span style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 500 }}>
                  One-Time Settle (Instant QR / NetBanking / Card)
                </span>
              </button>
            </div>

            {/* -----------------------------------------------------------
                SECTION A: AUTOPAY — AUTOMATIC INSTALMENT COLLECTION
            ----------------------------------------------------------- */}
            {modalTab === 'autopay' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div
                  style={{
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: '12px',
                    padding: '0.85rem 1rem',
                    fontSize: '0.825rem',
                    color: '#166534',
                  }}
                >
                  <strong>Recurring AutoPay Setup:</strong> Authorise recurring payments once to cover all eligible fee installments automatically. You will not need to select or authorise payment again for every covered installment.
                </div>

                {/* Sub-selector: eNACH vs UPI AutoPay */}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setAutoPayMethod('enach')}
                    style={{
                      flex: 1,
                      minWidth: '220px',
                      padding: '0.85rem 1rem',
                      borderRadius: '12px',
                      border: autoPayMethod === 'enach' ? '2px solid #062B28' : '1px solid #E2E8F0',
                      background: autoPayMethod === 'enach' ? '#F8FAF8' : '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: autoPayMethod === 'enach' ? '0 4px 12px rgba(6, 43, 40, 0.08)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <strong style={{ fontSize: '0.925rem', color: '#062B28' }}>1. eNACH — Bank AutoPay</strong>
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '9999px', background: '#DCFCE7', color: '#166534', fontWeight: 700 }}>
                        Bank Mandate
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                      Automated clearing from your savings or current bank account.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAutoPayMethod('upi_autopay')}
                    style={{
                      flex: 1,
                      minWidth: '220px',
                      padding: '0.85rem 1rem',
                      borderRadius: '12px',
                      border: autoPayMethod === 'upi_autopay' ? '2px solid #062B28' : '1px solid #E2E8F0',
                      background: autoPayMethod === 'upi_autopay' ? '#F8FAF8' : '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: autoPayMethod === 'upi_autopay' ? '0 4px 12px rgba(6, 43, 40, 0.08)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <strong style={{ fontSize: '0.925rem', color: '#062B28' }}>2. UPI AutoPay — UPI Mandate</strong>
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '9999px', background: '#E0F2FE', color: '#0369A1', fontWeight: 700 }}>
                        UPI App Mandate
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                      Recurring debits through Google Pay, PhonePe, Paytm, or BHIM.
                    </p>
                  </button>
                </div>

                {/* Option 1 Details: eNACH Mandate Parameters & Setup Form */}
                {autoPayMethod === 'enach' && (
                  <form onSubmit={handleRegisterEnach} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Mandate Parameters Specification */}
                    <div
                      style={{
                        background: '#F8FAF8',
                        border: '1px solid #DCFCE7',
                        borderRadius: '12px',
                        padding: '1rem 1.15rem',
                        fontSize: '0.825rem',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '0.75rem',
                      }}
                    >
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>Mandate Status</span>
                        <strong style={{ color: '#16a34a' }}>
                          {mandate?.type === 'enach' && mandate.status === 'active' ? 'Active (Simulation Mode)' : 'Ready for Authorisation'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>Authorised Maximum Amount</span>
                        <strong style={{ color: '#062B28' }}>₹50,000.00 per cycle</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>Mandate Validity Period</span>
                        <strong style={{ color: '#062B28' }}>01 Jul 2026 – 30 Jun 2027</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>Next Scheduled Instalment</span>
                        <strong style={{ color: '#062B28' }}>
                          Installment #{selectedAutoPayInstallment.sequence} ({formatDate(selectedAutoPayInstallment.due_date)})
                        </strong>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', fontWeight: 600, marginBottom: '0.25rem' }}>
                          Designated Bank Name *
                        </label>
                        <select
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            fontSize: '0.85rem',
                            background: '#FFFFFF',
                            boxSizing: 'border-box',
                          }}
                        >
                          <option value="State Bank of India">State Bank of India</option>
                          <option value="HDFC Bank">HDFC Bank</option>
                          <option value="ICICI Bank">ICICI Bank</option>
                          <option value="Axis Bank">Axis Bank</option>
                          <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                          <option value="Punjab National Bank">Punjab National Bank</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', fontWeight: 600, marginBottom: '0.25rem' }}>
                          Account Type *
                        </label>
                        <select
                          value={accountType}
                          onChange={(e) => setAccountType(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            fontSize: '0.85rem',
                            background: '#FFFFFF',
                            boxSizing: 'border-box',
                          }}
                        >
                          <option value="savings">Savings Bank Account</option>
                          <option value="current">Current Account</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', fontWeight: 600, marginBottom: '0.25rem' }}>
                          Bank Account Number *
                        </label>
                        <input
                          type="text"
                          required
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          placeholder="e.g. 50100234567890"
                          style={{
                            width: '100%',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', fontWeight: 600, marginBottom: '0.25rem' }}>
                          IFSC Code *
                        </label>
                        <input
                          type="text"
                          required
                          value={ifscCode}
                          onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                          placeholder="e.g. HDFC0000001"
                          style={{
                            width: '100%',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.8rem', color: '#334155', cursor: 'pointer', margin: '0.25rem 0' }}>
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        style={{ marginTop: '0.2rem', accentColor: '#062B28' }}
                      />
                      <span>
                        I hereby authorise recurring eNACH debits from my bank account for scheduled school fee instalments up to the authorised limit of ₹50,000.00 through Academic Year 2026-27.
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={enachRegistering}
                      style={{
                        background: '#062B28',
                        color: '#FFFFFF',
                        borderRadius: '9999px',
                        padding: '0.75rem 2rem',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        border: 'none',
                        cursor: enachRegistering ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 14px rgba(6, 43, 40, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      {enachRegistering ? 'Authorising eNACH Mandate...' : 'Authorise eNACH AutoPay (Simulation Mode)'}
                    </button>
                  </form>
                )}

                {/* Option 2 Details: UPI AutoPay Mandate Parameters & Setup Form */}
                {autoPayMethod === 'upi_autopay' && (
                  <form onSubmit={handleRegisterUpiAutoPay} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Mandate Parameters Specification */}
                    <div
                      style={{
                        background: '#F0F9FF',
                        border: '1px solid #BAE6FD',
                        borderRadius: '12px',
                        padding: '1rem 1.15rem',
                        fontSize: '0.825rem',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '0.75rem',
                      }}
                    >
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>Mandate Status</span>
                        <strong style={{ color: '#0284c7' }}>
                          {mandate?.type === 'upi_autopay' && mandate.status === 'active' ? 'Active (Simulation Mode)' : 'Ready for Authorisation'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>Authorised Maximum Limit</span>
                        <strong style={{ color: '#062B28' }}>₹50,000.00 per debit</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>Mandate Validity Period</span>
                        <strong style={{ color: '#062B28' }}>01 Jul 2026 – 30 Jun 2027</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>Next Scheduled Instalment</span>
                        <strong style={{ color: '#062B28' }}>
                          Installment #{selectedAutoPayInstallment.sequence} ({formatDate(selectedAutoPayInstallment.due_date)})
                        </strong>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', fontWeight: 600, marginBottom: '0.35rem' }}>
                        Select Supported UPI Application *
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
                        {[
                          { id: 'gpay', name: 'Google Pay' },
                          { id: 'phonepe', name: 'PhonePe' },
                          { id: 'paytm', name: 'Paytm' },
                          { id: 'bhim', name: 'BHIM UPI' },
                          { id: 'cred', name: 'CRED' },
                        ].map((app) => (
                          <button
                            key={app.id}
                            type="button"
                            onClick={() => setUpiMandateApp(app.id as any)}
                            style={{
                              padding: '0.5rem 0.6rem',
                              borderRadius: '8px',
                              border: upiMandateApp === app.id ? '2px solid #062B28' : '1px solid #CBD5E1',
                              background: upiMandateApp === app.id ? '#F0FDF4' : '#FFFFFF',
                              color: upiMandateApp === app.id ? '#062B28' : '#475569',
                              fontSize: '0.8rem',
                              fontWeight: upiMandateApp === app.id ? 700 : 500,
                              cursor: 'pointer',
                            }}
                          >
                            {app.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', fontWeight: 600, marginBottom: '0.25rem' }}>
                        Enter UPI ID / VPA Handle for Recurring Mandate *
                      </label>
                      <input
                        type="text"
                        required
                        value={upiMandateVpa}
                        onChange={(e) => setUpiMandateVpa(e.target.value)}
                        placeholder="e.g. parent@okhdfcbank or 9876543210@ybl"
                        style={{
                          width: '100%',
                          padding: '0.6rem 0.75rem',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          fontSize: '0.85rem',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                        {['@okhdfcbank', '@okaxis', '@ybl', '@paytm'].map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => {
                              const prefix = upiMandateVpa.includes('@') ? upiMandateVpa.split('@')[0] : 'student';
                              setUpiMandateVpa(prefix + h);
                            }}
                            style={{
                              background: '#F1F5F9',
                              border: '1px solid #E2E8F0',
                              borderRadius: '4px',
                              padding: '0.2rem 0.45rem',
                              fontSize: '0.72rem',
                              color: '#475569',
                              cursor: 'pointer',
                            }}
                          >
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.8rem', color: '#334155', cursor: 'pointer', margin: '0.25rem 0' }}>
                      <input
                        type="checkbox"
                        checked={upiMandateAcceptedTerms}
                        onChange={(e) => setUpiMandateAcceptedTerms(e.target.checked)}
                        style={{ marginTop: '0.2rem', accentColor: '#062B28' }}
                      />
                      <span>
                        I authorise automated recurring UPI AutoPay debits from my selected UPI handle for scheduled school fee instalments up to ₹50,000.00 through Academic Year 2026-27.
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={enachRegistering}
                      style={{
                        background: '#062B28',
                        color: '#FFFFFF',
                        borderRadius: '9999px',
                        padding: '0.75rem 2rem',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        border: 'none',
                        cursor: enachRegistering ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 14px rgba(6, 43, 40, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      {enachRegistering ? 'Authorising UPI AutoPay...' : 'Authorise UPI AutoPay Mandate (Simulation Mode)'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* -----------------------------------------------------------
                SECTION B: PAY NOW — INDIVIDUAL PAYMENT
            ----------------------------------------------------------- */}
            {modalTab === 'pay_now' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '0.85rem 1rem',
                    fontSize: '0.825rem',
                    color: '#475569',
                  }}
                >
                  <strong>Individual Payment Notice:</strong> Pay Installment #{selectedAutoPayInstallment.sequence} individually where permitted. This does not establish a recurring AutoPay mandate for future installments.
                </div>

                {/* Individual Payment Method Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Method 1: Instant UPI QR & App */}
                  <div
                    onClick={() => setSelectedIndividualMethod('instant_upi')}
                    style={{
                      border: selectedIndividualMethod === 'instant_upi' ? '2px solid #062B28' : '1px solid #E2E8F0',
                      background: selectedIndividualMethod === 'instant_upi' ? '#F8FAF8' : '#FFFFFF',
                      borderRadius: '14px',
                      padding: '1rem 1.15rem',
                      cursor: 'pointer',
                      boxShadow: selectedIndividualMethod === 'instant_upi' ? '0 4px 12px rgba(6, 43, 40, 0.08)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <input
                          type="radio"
                          name="individual_method"
                          checked={selectedIndividualMethod === 'instant_upi'}
                          onChange={() => setSelectedIndividualMethod('instant_upi')}
                          style={{ accentColor: '#062B28', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <strong style={{ fontSize: '0.95rem', color: '#062B28' }}>
                          Instant UPI QR &amp; App Payment
                        </strong>
                      </div>
                      <span style={{ background: '#E0F2FE', color: '#0369A1', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '9999px' }}>
                        One-Time Individual Settle
                      </span>
                    </div>
                    <p style={{ margin: '0 0 0 1.75rem', color: '#64748b', fontSize: '0.8rem' }}>
                      Pay now via dynamic UPI QR code or any UPI app. (Note: This is an individual payment, strictly not UPI AutoPay).
                    </p>

                    {selectedIndividualMethod === 'instant_upi' && (
                      <div
                        style={{
                          marginTop: '0.85rem',
                          marginLeft: '1.75rem',
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderRadius: '12px',
                          padding: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1.25rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        {/* Dynamic QR visual */}
                        <div
                          style={{
                            width: '110px',
                            height: '110px',
                            background: '#F8FAFC',
                            border: '1.5px solid #CBD5E1',
                            borderRadius: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0.5rem',
                            textAlign: 'center',
                            boxSizing: 'border-box',
                          }}
                        >
                          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#062B28" strokeWidth="1.5">
                            <rect x="3" y="3" width="7" height="7"></rect>
                            <rect x="14" y="3" width="7" height="7"></rect>
                            <rect x="14" y="14" width="7" height="7"></rect>
                            <rect x="3" y="14" width="7" height="7"></rect>
                            <rect x="6" y="6" width="1" height="1"></rect>
                            <rect x="17" y="6" width="1" height="1"></rect>
                            <rect x="6" y="17" width="1" height="1"></rect>
                          </svg>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#062B28', marginTop: '0.2rem' }}>
                            Scan to Pay {formatMoney(selectedAutoPayInstallment.remaining_minor)}
                          </span>
                        </div>

                        <div style={{ flex: 1, minWidth: '180px' }}>
                          <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                            Or Enter UPI ID / VPA
                          </span>
                          <input
                            type="text"
                            value={individualUpiId}
                            onChange={(e) => setIndividualUpiId(e.target.value)}
                            placeholder="e.g. mobile@upi or payer@oksbi"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              padding: '0.55rem 0.75rem',
                              borderRadius: '8px',
                              border: '1px solid #CBD5E1',
                              fontSize: '0.85rem',
                              boxSizing: 'border-box',
                            }}
                          />
                          <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '0.3rem' }}>
                            Supported: Google Pay · PhonePe · Paytm · BHIM
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Method 2: Net Banking */}
                  <div
                    onClick={() => setSelectedIndividualMethod('netbanking')}
                    style={{
                      border: selectedIndividualMethod === 'netbanking' ? '2px solid #062B28' : '1px solid #E2E8F0',
                      background: selectedIndividualMethod === 'netbanking' ? '#F8FAF8' : '#FFFFFF',
                      borderRadius: '14px',
                      padding: '1rem 1.15rem',
                      cursor: 'pointer',
                      boxShadow: selectedIndividualMethod === 'netbanking' ? '0 4px 12px rgba(6, 43, 40, 0.08)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <input
                          type="radio"
                          name="individual_method"
                          checked={selectedIndividualMethod === 'netbanking'}
                          onChange={() => setSelectedIndividualMethod('netbanking')}
                          style={{ accentColor: '#062B28', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <strong style={{ fontSize: '0.95rem', color: '#062B28' }}>
                          Net Banking (50+ Indian Banks)
                        </strong>
                      </div>
                      <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '9999px' }}>
                        One-Time
                      </span>
                    </div>
                    <p style={{ margin: '0 0 0 1.75rem', color: '#64748b', fontSize: '0.8rem' }}>
                      State Bank of India, HDFC Bank, ICICI Bank, Axis Bank, Kotak Mahindra.
                    </p>

                    {selectedIndividualMethod === 'netbanking' && (
                      <div style={{ marginTop: '0.85rem', marginLeft: '1.75rem' }}>
                        <select
                          value={selectedNetBank}
                          onChange={(e) => setSelectedNetBank(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: '100%',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            fontSize: '0.85rem',
                            background: '#FFFFFF',
                            boxSizing: 'border-box',
                          }}
                        >
                          <option value="HDFC Bank">HDFC Bank</option>
                          <option value="State Bank of India">State Bank of India</option>
                          <option value="ICICI Bank">ICICI Bank</option>
                          <option value="Axis Bank">Axis Bank</option>
                          <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Method 3: Cards */}
                  <div
                    onClick={() => setSelectedIndividualMethod('card')}
                    style={{
                      border: selectedIndividualMethod === 'card' ? '2px solid #062B28' : '1px solid #E2E8F0',
                      background: selectedIndividualMethod === 'card' ? '#F8FAF8' : '#FFFFFF',
                      borderRadius: '14px',
                      padding: '1rem 1.15rem',
                      cursor: 'pointer',
                      boxShadow: selectedIndividualMethod === 'card' ? '0 4px 12px rgba(6, 43, 40, 0.08)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <input
                          type="radio"
                          name="individual_method"
                          checked={selectedIndividualMethod === 'card'}
                          onChange={() => setSelectedIndividualMethod('card')}
                          style={{ accentColor: '#062B28', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <strong style={{ fontSize: '0.95rem', color: '#062B28' }}>
                          Debit &amp; Credit Cards
                        </strong>
                      </div>
                      <span style={{ background: '#F1F5F9', color: '#475569', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '9999px' }}>
                        Visa · RuPay · MasterCard
                      </span>
                    </div>
                    <p style={{ margin: '0 0 0 1.75rem', color: '#64748b', fontSize: '0.8rem' }}>
                      Individual payment via 3D Secure verification.
                    </p>

                    {selectedIndividualMethod === 'card' && (
                      <div style={{ marginTop: '0.85rem', marginLeft: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          placeholder="Card Number (e.g. 4111 2222 3333 4444)"
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          <input
                            type="text"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            placeholder="MM/YY"
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                          />
                          <input
                            type="password"
                            maxLength={4}
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            placeholder="CVV"
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Method 4: Bank Transfer */}
                  <div
                    onClick={() => setSelectedIndividualMethod('bank_transfer')}
                    style={{
                      border: selectedIndividualMethod === 'bank_transfer' ? '2px solid #062B28' : '1px solid #E2E8F0',
                      background: selectedIndividualMethod === 'bank_transfer' ? '#F8FAF8' : '#FFFFFF',
                      borderRadius: '14px',
                      padding: '1rem 1.15rem',
                      cursor: 'pointer',
                      boxShadow: selectedIndividualMethod === 'bank_transfer' ? '0 4px 12px rgba(6, 43, 40, 0.08)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <input
                          type="radio"
                          name="individual_method"
                          checked={selectedIndividualMethod === 'bank_transfer'}
                          onChange={() => setSelectedIndividualMethod('bank_transfer')}
                          style={{ accentColor: '#062B28', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <strong style={{ fontSize: '0.95rem', color: '#062B28' }}>
                          NEFT / RTGS Transfer (Virtual Account)
                        </strong>
                      </div>
                      <span style={{ background: '#F3E8FF', color: '#6B21A8', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '9999px' }}>
                        Direct Bank Settle
                      </span>
                    </div>
                    <p style={{ margin: '0 0 0 1.75rem', color: '#64748b', fontSize: '0.8rem' }}>
                      Transfer directly to institution designated collection account.
                    </p>

                    {selectedIndividualMethod === 'bank_transfer' && (
                      <div
                        style={{
                          marginTop: '0.85rem',
                          marginLeft: '1.75rem',
                          background: '#FFFFFF',
                          border: '1px solid #E9D5FF',
                          borderRadius: '10px',
                          padding: '0.75rem 1rem',
                          fontSize: '0.8rem',
                          color: '#1E293B',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                          gap: '0.4rem',
                        }}
                      >
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Beneficiary:</span>
                          <strong>{tenant?.name || student.institution_name}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Virtual A/C:</span>
                          <strong>JODO{student.student_reference.replace(/[^a-zA-Z0-9]/g, '')}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>IFSC Code:</span>
                          <strong>HDFC0000001</strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Individual Settle Button */}
                <button
                  type="button"
                  disabled={autoPayProcessing}
                  onClick={handleIndividualPayNowSubmit}
                  style={{
                    background: '#062B28',
                    color: '#FFFFFF',
                    borderRadius: '9999px',
                    padding: '0.8rem 2rem',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: autoPayProcessing ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(6, 43, 40, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {autoPayProcessing
                    ? 'Processing Payment...'
                    : `Pay ${formatMoney(selectedAutoPayInstallment.remaining_minor)} Now (Simulation Mode)`}
                </button>
              </div>
            )}

            {/* Bottom Simulation Mode Disclosure */}
            <div
              style={{
                marginTop: '1.5rem',
                paddingTop: '1rem',
                borderTop: '1px solid #EEF5F3',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.78rem',
                color: '#92400E',
                background: '#FFFBEB',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
              }}
            >
              <span>ℹ️</span>
              <span>
                <strong>Simulation Mode:</strong> The live bank/payment API is currently unavailable. Mandate authorisation and payments are simulated for demonstration. No real funds will be debited.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          2. SCHEDULED AUTOPAY DETAILS MODAL
          Displayed when student clicks AutoPay Details for an instalment
          covered by an active mandate (eNACH or UPI AutoPay).
      ------------------------------------------------------------- */}
      {showScheduledAutoPayModal && scheduledModalInstallment && student && mandate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Scheduled AutoPay Details"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(6, 43, 40, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9998,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '24px',
              maxWidth: '620px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '2rem 2.25rem',
              boxShadow: '0 25px 50px -12px rgba(6, 43, 40, 0.25)',
              position: 'relative',
              boxSizing: 'border-box',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '1.25rem',
                borderBottom: '1px solid #EEF5F3',
                paddingBottom: '1rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span
                    style={{
                      background: '#DCFCE7',
                      color: '#15803d',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.6rem',
                      borderRadius: '9999px',
                    }}
                  >
                    AUTOPAY ACTIVE
                  </span>
                  <span
                    style={{
                      background: '#FEF3C7',
                      color: '#92400E',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.6rem',
                      borderRadius: '9999px',
                    }}
                  >
                    SIMULATION MODE
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: '1.45rem', color: '#062B28', fontWeight: 700, letterSpacing: '-0.02em' }}>
                  Scheduled for AutoPay
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                  Installment #{scheduledModalInstallment.sequence} is covered by your active recurring mandate.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowScheduledAutoPayModal(false)}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  color: '#64748b',
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            {/* Error Notification */}
            {autoPayError && (
              <div
                role="alert"
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#DC2626',
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  marginBottom: '1.25rem',
                  fontSize: '0.875rem',
                }}
              >
                ✕ {autoPayError}
              </div>
            )}

            {/* Scheduled Collection Notice */}
            <div
              style={{
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '16px',
                padding: '1.25rem 1.5rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Covered Installment</span>
                  <strong style={{ color: '#062B28', fontSize: '1rem' }}>#{scheduledModalInstallment.sequence}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Scheduled Due Date</span>
                  <strong style={{ color: '#062B28', fontSize: '1rem' }}>{formatDate(scheduledModalInstallment.due_date)}</strong>
                </div>
                <div>
                  <span style={{ color: '#166534', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Scheduled Debit Amount</span>
                  <strong style={{ color: '#15803d', fontSize: '1.25rem', fontWeight: 800 }}>
                    {formatMoney(scheduledModalInstallment.remaining_minor)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Active Mandate Parameter Details */}
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: '#062B28', fontWeight: 700 }}>
              Covering Mandate Parameters
            </h3>
            <div
              style={{
                background: '#F8FAF8',
                border: '1px solid #E2E8F0',
                borderRadius: '14px',
                padding: '1.15rem 1.25rem',
                marginBottom: '1.5rem',
                fontSize: '0.825rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.85rem',
              }}
            >
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>AutoPay Mandate Type</span>
                <strong style={{ color: '#062B28', fontSize: '0.9rem' }}>
                  {mandate.type === 'upi_autopay' ? 'UPI AutoPay Mandate' : 'eNACH Bank Account AutoPay'}
                </strong>
                <span style={{ fontSize: '0.725rem', color: '#16a34a', display: 'block' }}>
                  {mandate.type === 'upi_autopay' ? 'NPCI UPI AutoPay Network' : 'NPCI Automated Clearing House'}
                </span>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>
                  {mandate.type === 'upi_autopay' ? 'Linked UPI Handle / App' : 'Designated Bank & Account'}
                </span>
                <strong style={{ color: '#062B28', fontSize: '0.9rem' }}>
                  {mandate.type === 'upi_autopay'
                    ? mandate.upi_vpa || 'student@okhdfcbank'
                    : `${mandate.bank_name || 'HDFC Bank'} (A/C ${mandate.account_mask || '•••• 8172'})`}
                </strong>
                <span style={{ fontSize: '0.725rem', color: '#64748b', display: 'block' }}>
                  Reference: {mandate.umrn || mandate.provider_reference}
                </span>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>Authorised Maximum Limit</span>
                <strong style={{ color: '#062B28', fontSize: '0.9rem' }}>
                  {formatMoney(mandate.max_amount_minor || 5000000)} per cycle
                </strong>
                <span style={{ fontSize: '0.725rem', color: '#64748b', display: 'block' }}>
                  Instalment fee is within authorized limit
                </span>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.725rem' }}>Mandate Validity Period</span>
                <strong style={{ color: '#062B28', fontSize: '0.9rem' }}>
                  {mandate.valid_until ? `Through ${mandate.valid_until}` : 'Academic Year 2026-27'}
                </strong>
                <span style={{ fontSize: '0.725rem', color: '#64748b', display: 'block' }}>
                  Active across scheduled dates
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
              Because your mandate is active, this installment will be collected automatically on its due date. You do not need to re-authorise or choose payment options again.
            </p>

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.75rem',
                borderTop: '1px solid #EEF5F3',
                paddingTop: '1.25rem',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className="button outline"
                onClick={() => {
                  setShowScheduledAutoPayModal(false);
                  openPayNowOnlyModal(scheduledModalInstallment);
                }}
                style={{
                  background: '#FFFFFF',
                  color: '#062B28',
                  border: '1px solid #CBD5E1',
                  borderRadius: '9999px',
                  padding: '0.65rem 1.35rem',
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Pay Early via Individual Payment
              </button>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setShowScheduledAutoPayModal(false)}
                  style={{
                    borderRadius: '9999px',
                    padding: '0.65rem 1.25rem',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>

                <button
                  type="button"
                  className="button primary"
                  disabled={simulatingDebit || autoPayProcessing}
                  onClick={() => handleScheduledAutoPayDebit(scheduledModalInstallment)}
                  style={{
                    background: '#062B28',
                    color: '#FFFFFF',
                    borderRadius: '9999px',
                    padding: '0.65rem 1.5rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: simulatingDebit || autoPayProcessing ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(6, 43, 40, 0.25)',
                  }}
                >
                  {autoPayProcessing ? 'Processing Debit...' : 'Simulate AutoPay Collection (Simulation Mode)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          RECEIPT MODAL (VIEW / PRINT)
      ------------------------------------------------------------- */}
      {viewingReceipt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Payment receipt"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            className="portal-receipt"
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              maxWidth: '650px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '2rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '2px solid #e2e8f0',
                paddingBottom: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
                  {viewingReceipt.receiptConfig?.receipt_heading ||
                    viewingReceipt.receiptConfig?.heading ||
                    'OFFICIAL FEE RECEIPT'}
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', fontWeight: 'bold', color: '#334155' }}>
                  {viewingReceipt.institutionName}
                </p>
                {viewingReceipt.receiptConfig?.institution_address && (
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                    {viewingReceipt.receiptConfig.institution_address}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Receipt Number</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0369a1' }}>
                  {viewingReceipt.receiptNumber}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Date: {formatDate(viewingReceipt.paymentDate)}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                fontSize: '0.9rem',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Student Name</span>
                <div style={{ fontWeight: 600 }}>{viewingReceipt.studentName}</div>
                <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                  ID: {viewingReceipt.studentReference}
                </div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Course / Grade</span>
                <div style={{ fontWeight: 600 }}>
                  {viewingReceipt.course} · {viewingReceipt.grade}
                </div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Transaction Reference</span>
                <div style={{ fontFamily: 'monospace' }}>{viewingReceipt.transactionId}</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Payment Method</span>
                <div>{viewingReceipt.paymentMethod}</div>
              </div>
            </div>

            <div
              style={{
                background: '#f8fafc',
                padding: '1rem',
                borderRadius: '6px',
                marginBottom: '1.5rem',
              }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Total Amount Paid</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#166534' }}>
                  {formatMoney(viewingReceipt.amountMinor)}
                </span>
              </div>
              {viewingReceipt.remainingMinor !== undefined && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid #e2e8f0',
                    paddingTop: '0.65rem',
                    marginTop: '0.65rem',
                  }}
                >
                  <span style={{ fontSize: '1rem', color: '#475569', fontWeight: 600 }}>Remaining Balance</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#0f172a' }}>
                    {formatMoney(viewingReceipt.remainingMinor)}
                  </span>
                </div>
              )}
            </div>

            {viewingReceipt.receiptConfig?.terms_and_conditions && (
              <p
                style={{
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: '0.75rem',
                  margin: '0 0 1.5rem 0',
                }}
              >
                {viewingReceipt.receiptConfig.terms_and_conditions}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="button primary" onClick={printDocument}>
                Print Receipt
              </button>
              <button className="button secondary" onClick={() => setViewingReceipt(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
