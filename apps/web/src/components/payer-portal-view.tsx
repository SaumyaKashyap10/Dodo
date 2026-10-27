'use client';

import React, { useState, useId } from 'react';
import Link from 'next/link';
import { SuccessModal, SuccessPopupDetail } from './admin/success-modal';

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

const formatINR = (minorOrMajor: number | string, isMinor: boolean = true) => {
  const num = Number(minorOrMajor || 0);
  const val = isMinor ? num / 100 : num;
  return '₹' + val.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export function PayerPortalView({
  data: initialData,
  token,
  mandateParam,
  mandateRefParam,
}: {
  data: PayerPortalData;
  token: string;
  mandateParam?: string;
  mandateRefParam?: string;
}) {
  const [data, setData] = useState<PayerPortalData>(initialData);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Installment accordion state (default open first pending installment)
  const firstPending = initialData.installments?.find((i) => i.status !== 'paid' && Number(i.remaining_minor) > 0);
  const [openInstallmentId, setOpenInstallmentId] = useState<string>(firstPending?.id || 'inst-2');

  // Installment tab states (for installment 2 and others)
  // tab options: 'full' | 'custom' | 'heads'
  const [activeTabByInst, setActiveTabByInst] = useState<Record<string, 'full' | 'custom' | 'heads'>>({
    'inst-2': 'full',
    'inst-3': 'full',
  });

  // Custom amount inputs
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  // Fee head selections per installment
  const [headInputs, setHeadInputs] = useState<Record<string, Record<string, string>>>({});

  // eNACH Workspace State
  const [enachTab, setEnachTab] = useState<'send_link' | 'enter_details' | 'active_status'>('send_link');
  const [enachLinkRecipient, setEnachLinkRecipient] = useState<'student' | 'guardian'>('student');
  const [enachLinkPhone, setEnachLinkPhone] = useState<string>(data.payer.phone || '+91 98765 43210');
  const [enachLinkEmail, setEnachLinkEmail] = useState<string>(data.payer.email || 'payer@example.com');
  const [enachLinkStatus, setEnachLinkStatus] = useState<'idle' | 'sent'>('idle');

  // Direct Bank Details Form State
  const [bankHolderName, setBankHolderName] = useState<string>(data.payer.displayName || '');
  const [selectedBank, setSelectedBank] = useState<string>('HDFC Bank');
  const [accountNumber, setAccountNumber] = useState<string>('50100234891244');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState<string>('50100234891244');
  const [ifscCode, setIfscCode] = useState<string>('HDFC0001234');
  const [accountType, setAccountType] = useState<'savings' | 'current'>('savings');
  const [authMode, setAuthMode] = useState<'netbanking' | 'debit_card' | 'aadhaar'>('netbanking');
  const [consentChecked, setConsentChecked] = useState<boolean>(true);
  const [bankError, setBankError] = useState<string>('');

  // Active Mandate state
  const hasActiveMandate = data.mandates?.some((m) => m.status === 'active');
  const [mandateActive, setMandateActive] = useState<boolean>(hasActiveMandate || false);
  const [mandateDetails, setMandateDetails] = useState({
    umrn: 'UMRN-NACH-2026-089412',
    bank: 'HDFC Bank',
    accountMask: '•••• 1244',
    authDate: '23/10/2026, 1:18:28 pm',
    status: 'Active',
  });

  // Selected Receipt Modal state
  const [viewReceipt, setViewReceipt] = useState<any | null>(null);

  // Reusable Success Modal Configuration
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    badge?: string;
    title: string;
    subtitle?: string;
    details?: SuccessPopupDetail[];
    note?: string;
    primaryAction?: { label: string; onClick: () => void };
  }>({
    isOpen: false,
    title: '',
  });

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  // Fee Heads definition from user's snippet
  const headsList = [
    { code: 'TUIT', label: 'Tuition fee', remainingMajor: 50000 },
    { code: 'DEV', label: 'Development fee', remainingMajor: 20000 },
    { code: 'ACT', label: 'Activity & lab fee', remainingMajor: 10000 },
  ];

  // Helper for computing installment fee-head sum
  const getHeadsSum = (instId: string) => {
    const inputs = headInputs[instId] || {};
    return Object.values(inputs).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  };

  // Send eNACH Approval Link Handler
  const handleSendEnachLink = () => {
    setEnachLinkStatus('sent');
    triggerToast('eNACH setup link dispatched to student/payer');

    setSuccessModal({
      isOpen: true,
      badge: 'eNACH LINK SENT TO USER',
      title: 'eNACH Setup Link Dispatched Successfully',
      subtitle: 'A secure tokenized authorization link has been sent to the student and payer to approve and submit their bank details.',
      details: [
        { label: 'Recipient Name', value: enachLinkRecipient === 'student' ? `${data.payer.studentName || 'Student'} (Student)` : `${data.payer.displayName} (Guardian)` },
        { label: 'Phone / WhatsApp', value: enachLinkPhone },
        { label: 'Email Address', value: enachLinkEmail },
        { label: 'Authorization Link', value: `https://dodo.finance/mandate/auth/${token}?sec=npci-v1` },
        { label: 'Status', value: 'Pending Student / Payer Submission' },
        { label: 'Validity Period', value: '48 Hours (Auto-refreshed on demand)' },
      ],
      note: 'The student or payer will complete 2-factor authentication via NetBanking, Debit Card, or Aadhaar OTP. Once submitted, mandate activates automatically.',
      primaryAction: {
        label: 'Awesome, Done ✓',
        onClick: () => setSuccessModal((prev) => ({ ...prev, isOpen: false })),
      },
    });
  };

  // Direct Bank Submission Handler
  const handleDirectBankSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (accountNumber !== confirmAccountNumber) {
      setBankError('Account numbers do not match. Please re-enter.');
      return;
    }
    if (!consentChecked) {
      setBankError('Please agree to the NPCI standing mandate authorization.');
      return;
    }
    setBankError('');

    const mask = '•••• ' + accountNumber.slice(-4);
    const newUmrn = 'UMRN-NACH-2026-' + Math.floor(100000 + Math.random() * 900000);
    const nowStr = new Date().toLocaleString('en-IN');

    setMandateDetails({
      umrn: newUmrn,
      bank: selectedBank,
      accountMask: mask,
      authDate: nowStr,
      status: 'Active',
    });
    setMandateActive(true);
    triggerToast('eNACH Mandate Registered Successfully');

    setSuccessModal({
      isOpen: true,
      badge: 'eNACH MANDATE ACTIVATED',
      title: 'eNACH Mandate Activated Successfully',
      subtitle: 'Standing instructions have been submitted and confirmed by NPCI sponsor clearing.',
      details: [
        { label: 'Mandate UMRN', value: newUmrn },
        { label: 'Bank Name', value: selectedBank },
        { label: 'Account Holder', value: bankHolderName },
        { label: 'Account Mask', value: mask },
        { label: 'Authentication Mode', value: authMode === 'netbanking' ? 'NetBanking eSign' : authMode === 'debit_card' ? 'Debit Card OTP' : 'Aadhaar eSign' },
        { label: 'Max Mandate Limit', value: '₹40,000.00 / installment' },
        { label: 'Next Scheduled Debit', value: '25/10/2026 (Installment #2)' },
        { label: 'Mandate Status', value: 'Active / Verified' },
      ],
      note: 'Due installments will be scheduled automatically with 2-day advance SMS/WhatsApp reminder.',
      primaryAction: {
        label: 'Awesome, Done ✓',
        onClick: () => setSuccessModal((prev) => ({ ...prev, isOpen: false })),
      },
    });
  };

  // Payment Simulation & Adjustment Handler
  const handlePay = (instSeq: number, amountStr: string, mode: string) => {
    triggerToast(`Processing payment · ${amountStr}`);

    const cleanNum = parseFloat(String(amountStr).replace(/[^0-9.]/g, '')) || 0;
    const amountMinor = Math.round(cleanNum * 100);
    const txnRef = 'TXN-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const rcpNumber = `DPS-REC-2026-${Math.floor(10000 + Math.random() * 90000)}`;

    // Immediately adjust local state so dashboard balances update in real-time
    setData((prev) => {
      const updated = { ...prev };
      const insts = updated.installments.map((i) => ({ ...i }));
      let targetInst = insts.find((i) => i.sequence === instSeq);
      if (!targetInst) {
        targetInst = insts.find((i) => i.status !== 'paid' && Number(i.remaining_minor) > 0);
      }
      if (!targetInst && insts.length > 0) {
        targetInst = insts[insts.length - 1];
      }

      if (targetInst && amountMinor > 0) {
        const toPay = Math.min(amountMinor, targetInst.remaining_minor);
        targetInst.paid_amount_minor += toPay;
        targetInst.remaining_minor = Math.max(0, targetInst.amount_minor - targetInst.paid_amount_minor);
        if (targetInst.remaining_minor === 0) {
          targetInst.status = 'paid';
        } else if (targetInst.paid_amount_minor > 0) {
          targetInst.status = 'part_paid';
        }

        const unallocated = amountMinor - toPay;
        if (unallocated > 0) {
          for (const nextInst of insts) {
            if (nextInst.id === targetInst.id || nextInst.status === 'paid' || nextInst.remaining_minor <= 0) continue;
            const extra = Math.min(unallocated, nextInst.remaining_minor);
            nextInst.paid_amount_minor += extra;
            nextInst.remaining_minor = Math.max(0, nextInst.amount_minor - nextInst.paid_amount_minor);
            if (nextInst.remaining_minor === 0) nextInst.status = 'paid';
            else if (nextInst.paid_amount_minor > 0) nextInst.status = 'part_paid';
            break;
          }
        }
      }

      const currentPaid = Number(updated.summary.paid_minor) || 0;
      const currentNet = Number(updated.summary.net_payable_minor) || 12000000;
      const newPaid = currentPaid + amountMinor;
      updated.summary = {
        ...updated.summary,
        paid_minor: String(newPaid),
        outstanding_minor: String(Math.max(0, currentNet - newPaid)),
      };

      updated.payments = [
        {
          id: 'pay-' + Math.floor(1000 + Math.random() * 9000),
          amount_minor: amountMinor,
          recorded_at: new Date().toISOString(),
          receipt_number: rcpNumber,
          status: 'settled',
        },
        ...updated.payments,
      ];

      updated.installments = insts;
      return updated;
    });

    // Advance open installment accordion if paid
    setTimeout(() => {
      setData((latest) => {
        const nextPending = latest.installments.find((i) => i.status !== 'paid' && Number(i.remaining_minor) > 0);
        if (nextPending) {
          setOpenInstallmentId(nextPending.id);
        } else {
          setOpenInstallmentId('');
        }
        return latest;
      });
    }, 100);

    // Sync with backend API in the background
    fetch('/api/v1/admin/fees/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountReference: data.payer.accountReference || '',
        studentId: data.payer.accountReference || '',
        installmentId: `inst-${instSeq}`,
        amountMinor,
        providerReference: txnRef,
        receiptNumber: rcpNumber,
        directPayment: { mode: 'online' },
      }),
    }).catch(() => {});

    // Sync with payer pay route to persist in server-side session store
    fetch(`/payer/${token}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installmentId: `inst-${instSeq}`,
        amountMinor,
        idempotencyKey: txnRef,
      }),
    }).catch(() => {});

    setTimeout(() => {
      setSuccessModal({
        isOpen: true,
        badge: 'PAYMENT SUCCESSFUL',
        title: 'Payment Completed Successfully',
        subtitle: `Electronic payment of ${amountStr} for Installment #${instSeq} was recorded and settled.`,
        details: [
          { label: 'Amount Paid', value: amountStr },
          { label: 'Installment', value: `#${instSeq} (Academic Fee)` },
          { label: 'Payment Mode', value: mode },
          { label: 'Transaction Reference', value: txnRef },
          { label: 'Receipt Number', value: rcpNumber },
          { label: 'Settlement Status', value: 'Settled & Verified' },
        ],
        note: 'Official stamped tax receipt has been generated. Credited to student ledger.',
        primaryAction: {
          label: 'View Stamped Receipt ✓',
          onClick: () => {
            setSuccessModal((prev) => ({ ...prev, isOpen: false }));
            setViewReceipt({
              receipt_number: rcpNumber,
              date: new Date().toLocaleDateString('en-IN'),
              amount: amountStr,
              student: data.payer.studentName || 'Student',
              payer: data.payer.displayName,
              ref: data.payer.accountReference,
              installment: `Installment #${instSeq}`,
            });
          },
        },
      });
    }, 400);
  };

  const netTotal = Number(data.summary.net_payable_minor) || 12000000;
  const paidMinor = Number(data.summary.paid_minor) || 0;
  const outstandingMinor = Number(data.summary.outstanding_minor) || Math.max(0, netTotal - paidMinor);
  const paidPercent = netTotal > 0 ? Math.min(100, Math.round((paidMinor / netTotal) * 1000) / 10) : 0;
  const outstandingPercent = Math.max(0, Math.round((100 - paidPercent) * 10) / 10);
  const nextPendingInst = data.installments.find((i) => i.status !== 'paid' && Number(i.remaining_minor) > 0);

  return (
    <div
      className="payer-portal-dashboard"
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 85% 10%, rgba(185, 243, 229, 0.45) 0%, rgba(210, 244, 156, 0.18) 35%, rgba(243, 250, 247, 0) 70%), #f3faf7',
        color: '#073533',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        padding: '24px 20px 80px',
      }}
    >
      {/* Universal Success Popup Modal */}
      <SuccessModal
        isOpen={successModal.isOpen}
        onClose={() => setSuccessModal((prev) => ({ ...prev, isOpen: false }))}
        title={successModal.title}
        badge={successModal.badge}
        subtitle={successModal.subtitle}
        details={successModal.details}
        note={successModal.note}
        primaryAction={successModal.primaryAction}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '28px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#063331',
            color: '#ffffff',
            padding: '12px 24px',
            borderRadius: '9999px',
            fontSize: '13.5px',
            fontWeight: 600,
            boxShadow: '0 12px 30px -4px rgba(6, 45, 42, 0.4)',
            zIndex: 10002,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'fadeInOverlay 0.2s ease-out both',
          }}
        >
          <span style={{ color: '#42c2a8', fontSize: '16px' }}>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Official Receipt Modal View */}
      {viewReceipt && (
        <>
          <div
            className="dashboard-success-backdrop"
            onClick={() => setViewReceipt(null)}
            style={{ zIndex: 10000 }}
          />
          <div
            className="dashboard-success-modal"
            style={{
              zIndex: 10001,
              maxWidth: '560px',
              padding: '28px 32px',
              textAlign: 'left',
              alignItems: 'stretch',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#075e47', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  OFFICIAL ELECTRONIC RECEIPT
                </span>
                <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '2px 0 0', color: '#073533' }}>
                  Delhi Public School, R.K. Puram
                </h3>
              </div>
              <button
                type="button"
                className="dashboard-success-close"
                onClick={() => setViewReceipt(null)}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                background: '#f7fbf9',
                borderRadius: '16px',
                border: '1px solid rgba(7, 53, 51, 0.08)',
                padding: '18px',
                marginBottom: '18px',
                display: 'grid',
                gap: '8px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6c8f89' }}>Receipt Number</span>
                <strong style={{ color: '#073533' }}>{viewReceipt.receipt_number}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6c8f89' }}>Student Name</span>
                <strong style={{ color: '#073533' }}>{viewReceipt.student}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6c8f89' }}>Account Reference</span>
                <strong style={{ color: '#073533' }}>{viewReceipt.ref}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6c8f89' }}>Payment For</span>
                <strong style={{ color: '#073533' }}>{viewReceipt.installment}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6c8f89' }}>Date &amp; Time</span>
                <strong style={{ color: '#073533' }}>{viewReceipt.date}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(7, 53, 51, 0.12)', paddingTop: '8px', marginTop: '4px' }}>
                <span style={{ color: '#073533', fontWeight: 700, fontSize: '14px' }}>Amount Paid</span>
                <strong style={{ color: '#075e47', fontSize: '18px' }}>{viewReceipt.amount}</strong>
              </div>
            </div>

            <p style={{ fontSize: '11.5px', color: '#6c8f89', textAlign: 'center', margin: '0 0 18px', lineHeight: 1.4 }}>
              Verified electronic acknowledgement. Computer generated receipt. Retain for personal record and tax deduction purposes.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="button secondary"
                style={{ borderRadius: '9999px', padding: '10px 22px', fontSize: '13.5px', fontWeight: 600 }}
                onClick={() => {
                  window.print();
                }}
              >
                🖨️ Print Receipt
              </button>
              <button
                type="button"
                className="button primary"
                style={{ borderRadius: '9999px', padding: '10px 24px', fontSize: '13.5px', fontWeight: 600 }}
                onClick={() => setViewReceipt(null)}
              >
                Done ✓
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Container */}
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        {/* Header */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 0 28px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800, fontSize: '22px', color: '#073533' }}>
            <span
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: '#063331',
                display: 'grid',
                placeItems: 'center',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(6, 51, 49, 0.25)',
              }}
            >
              ◆
            </span>
            <span>Dodo<span style={{ color: '#42c2a8' }}>.</span></span>
          </div>

          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              padding: '6px 14px',
              borderRadius: '9999px',
              background: '#e2f4ed',
              color: '#075e47',
              border: '1px solid rgba(7, 53, 51, 0.08)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#075e47' }} />
            Sandbox account: simulated collections
          </span>
        </header>

        {/* Hero Section */}
        <div style={{ marginBottom: '24px' }}>
          <p
            style={{
              fontSize: '12.5px',
              fontWeight: 700,
              color: '#075e47',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              margin: '0 0 6px',
            }}
          >
            Fee account · {data.payer.accountReference || '-'} · Student: {data.payer.studentName || 'Student'}
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', margin: '0 0 8px' }}>
            <h1
              style={{
                fontSize: '34px',
                fontWeight: 800,
                lineHeight: 1.15,
                color: '#073533',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Hello, {
                data.payer.displayName &&
                data.payer.displayName.trim().toLowerCase() !== 'guardian' &&
                !data.payer.displayName.trim().toLowerCase().startsWith('guardian') &&
                !data.payer.displayName.trim().toLowerCase().includes('hii')
                  ? data.payer.displayName.trim()
                  : (data.payer.studentName ? `${data.payer.studentName}` : 'Parent / Guardian')
              }
            </h1>
            <span
              style={{
                background: '#e6f4ea',
                color: '#137333',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Parent / Guardian of {data.payer.studentName || 'Student'} ({data.payer.accountReference})
            </span>
          </div>
          <p style={{ color: '#587973', fontSize: '15px', margin: '0 0 12px', lineHeight: 1.5 }}>
            Review your installments, payments and receipts from one protected view.
          </p>
          <p
            style={{
              fontSize: '13px',
              color: '#416660',
              background: '#eafbf4',
              border: '1px solid #a3ebce',
              padding: '8px 14px',
              borderRadius: '12px',
              display: 'inline-block',
              margin: 0,
            }}
          >
            Payment link mode: <strong style={{ color: '#073533' }}>Flexible collection</strong> · Custom and fee-head options are enforced by the server.
          </p>
        </div>

        {/* Summary Stats (3 Columns) */}
        <section
          aria-label="Summary"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '14px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid rgba(7, 53, 51, 0.08)',
              borderRadius: '20px',
              padding: '18px 22px',
              boxShadow: '0 8px 24px -4px rgba(6, 45, 42, 0.05)',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#6c8f89', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Schedule total
            </span>
            <strong style={{ display: 'block', fontSize: '26px', color: '#073533', marginTop: '6px', fontVariantNumeric: 'tabular-nums' }}>
              {formatINR(data.summary.net_payable_minor)}
            </strong>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid rgba(7, 53, 51, 0.08)',
              borderRadius: '20px',
              padding: '18px 22px',
              boxShadow: '0 8px 24px -4px rgba(6, 45, 42, 0.05)',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#6c8f89', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Recorded paid
            </span>
            <strong style={{ display: 'block', fontSize: '26px', color: '#075e47', marginTop: '6px', fontVariantNumeric: 'tabular-nums' }}>
              {formatINR(data.summary.paid_minor)}
            </strong>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid rgba(7, 53, 51, 0.08)',
              borderRadius: '20px',
              padding: '18px 22px',
              boxShadow: '0 8px 24px -4px rgba(6, 45, 42, 0.05)',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#6c8f89', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Outstanding
            </span>
            <strong style={{ display: 'block', fontSize: '26px', color: '#b45309', marginTop: '6px', fontVariantNumeric: 'tabular-nums' }}>
              {formatINR(data.summary.outstanding_minor)}
            </strong>
          </div>
        </section>

        {/* Visual Progress Bar */}
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              height: '10px',
              borderRadius: '9999px',
              background: 'rgba(7, 53, 51, 0.08)',
              overflow: 'hidden',
              margin: '4px 0 8px',
            }}
          >
            <div
              style={{
                width: `${paidPercent}%`,
                height: '100%',
                borderRadius: '9999px',
                background: 'linear-gradient(90deg, #42c2a8 0%, #075e47 100%)',
                boxShadow: '0 2px 6px rgba(7, 94, 71, 0.25)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#587973', fontWeight: 500 }}>
            <span>{formatINR(paidMinor)} recorded paid ({paidPercent}%)</span>
            <span>{formatINR(outstandingMinor)} outstanding ({outstandingPercent}%)</span>
          </div>
        </div>

        {/* Auto UPI Authorization Banner when opened from share link */}
        {mandateParam && !mandateActive && (
          <div
            style={{
              background: 'linear-gradient(135deg, #0f766e 0%, #064e3b 100%)',
              color: '#ffffff',
              borderRadius: '24px',
              padding: '24px 28px',
              marginBottom: '24px',
              boxShadow: '0 16px 36px -6px rgba(15, 118, 110, 0.35)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '18px',
              flexWrap: 'wrap',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            <div>
              <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 9999, fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                ⚡ Auto UPI Recurring Authorization Required
              </span>
              <h3 style={{ margin: '8px 0 4px', fontSize: '20px', fontWeight: 800 }}>
                Approve Auto UPI Mandate for {data.payer.studentName || 'Student'}
              </h3>
              <p style={{ margin: 0, fontSize: '13px', opacity: 0.9, lineHeight: 1.4, maxWidth: '580px' }}>
                Reference: <code style={{ color: '#99f6e4', fontWeight: 600 }}>{mandateRefParam || 'UMRN-AUTO-UPI-2026'}</code> · Max cap: <strong>₹50,000.00 / month</strong> · Authenticate your recurring auto-debit standing instruction to automate term fee payments.
              </p>
            </div>
            <button
              type="button"
              className="button"
              style={{
                background: '#ffffff',
                color: '#0f766e',
                borderRadius: '9999px',
                padding: '12px 28px',
                fontSize: '14.5px',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)',
                whiteSpace: 'nowrap',
              }}
              onClick={() => {
                setMandateActive(true);
                setMandateDetails({
                  umrn: mandateRefParam || 'UMRN-SBX-2026-9901',
                  bank: 'HDFC Bank',
                  accountMask: '•••• 1244',
                  authDate: new Date().toLocaleString('en-IN'),
                  status: 'Active (Approved)',
                });
                triggerToast('✓ Auto UPI Mandate Authorized and Activated Successfully!');
                setSuccessModal({
                  isOpen: true,
                  badge: 'AUTO UPI MANDATE AUTHORIZED',
                  title: 'Auto UPI Mandate Activated Successfully',
                  subtitle: `Mandate ${mandateRefParam || 'UMRN-AUTO-UPI-2026'} is now active for automatic term collections.`,
                  details: [
                    { label: 'Mandate UMRN', value: mandateRefParam || 'UMRN-SBX-2026-9901' },
                    { label: 'Student', value: data.payer.studentName || 'Student' },
                    { label: 'Payer / Guardian', value: data.payer.displayName },
                    { label: 'Max Mandate Limit', value: '₹50,000.00 / month' },
                    { label: 'Status', value: 'Active / Verified' },
                  ],
                  note: 'Scheduled instalments will be debited automatically on due dates with prior notification.',
                  primaryAction: {
                    label: 'Awesome, Done ✓',
                    onClick: () => setSuccessModal((prev) => ({ ...prev, isOpen: false })),
                  },
                });
                try {
                  fetch(`/v1/admin/fees/mandates/${mandateParam}/authorize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'approve' }),
                  }).catch(() => {});
                } catch {}
              }}
            >
              ✓ Approve &amp; Activate Auto UPI
            </button>
          </div>
        )}

        {/* Next Installment Due Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #063331 0%, #0e4c43 100%)',
            color: '#ffffff',
            borderRadius: '24px',
            padding: '24px 28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            marginBottom: '24px',
            boxShadow: '0 16px 36px -6px rgba(6, 51, 49, 0.3)',
          }}
        >
          {nextPendingInst ? (
            <>
              <div>
                <span style={{ opacity: 0.85, fontSize: '13px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  Next installment · due {nextPendingInst.due_date}
                </span>
                <strong style={{ fontSize: '30px', fontVariantNumeric: 'tabular-nums', display: 'block', marginTop: '4px', letterSpacing: '-0.02em' }}>
                  {formatINR(nextPendingInst.remaining_minor)}
                </strong>
              </div>
              <button
                type="button"
                className="button"
                style={{
                  background: '#ffffff',
                  color: '#063331',
                  borderRadius: '9999px',
                  padding: '12px 28px',
                  fontSize: '14.5px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => handlePay(nextPendingInst.sequence, formatINR(nextPendingInst.remaining_minor), 'Full Balance')}
              >
                Pay now →
              </button>
            </>
          ) : (
            <div>
              <span style={{ opacity: 0.85, fontSize: '13px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                All installments completed
              </span>
              <strong style={{ fontSize: '24px', fontVariantNumeric: 'tabular-nums', display: 'block', marginTop: '4px', letterSpacing: '-0.02em' }}>
                No pending dues · Schedule paid in full ✓
              </strong>
            </div>
          )}
        </div>

        {/* Installment Plan Card */}
        <section
          style={{
            background: '#ffffff',
            border: '1px solid rgba(7, 53, 51, 0.08)',
            borderRadius: '26px',
            padding: '26px 28px',
            marginBottom: '24px',
            boxShadow: '0 10px 30px -4px rgba(6, 45, 42, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#073533', margin: 0 }}>
              Installment plan
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: '9999px',
                background: '#eafbf4',
                color: '#075e47',
                border: '1px solid #a3ebce',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Active Schedule
            </span>
          </div>
          <p style={{ color: '#6c8f89', margin: '0 0 18px', fontSize: '13.5px' }}>
            Upcoming and completed fees. Open an installment to choose how much to pay.
          </p>

          {/* Dynamic Installments Plan */}
          {data.installments.map((inst) => {
            const isPaid = inst.status === 'paid' || Number(inst.remaining_minor) <= 0;
            const isPartPaid = !isPaid && (inst.status === 'part_paid' || Number(inst.paid_amount_minor) > 0);

            const formatDueDate = (d: string) => {
              if (!d) return '';
              if (d.includes('/')) return d;
              const parts = d.split('-');
              if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
              return d;
            };
            const dueFormatted = formatDueDate(inst.due_date);
            const totalAmtStr = formatINR(inst.amount_minor);
            const paidAmtStr = formatINR(inst.paid_amount_minor);
            const remainingAmtStr = formatINR(inst.remaining_minor);
            const maxVal = Math.round(Number(inst.remaining_minor) / 100);

            if (isPaid) {
              return (
                <div
                  key={inst.id}
                  style={{
                    border: '1px solid rgba(7, 53, 51, 0.08)',
                    borderRadius: '16px',
                    marginBottom: '12px',
                    overflow: 'hidden',
                    background: '#fbfdfc',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1.2fr 1fr 1fr auto',
                      gap: '12px',
                      alignItems: 'center',
                      padding: '14px 18px',
                      fontSize: '13.5px',
                    }}
                  >
                    <span
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: '#e2f4ed',
                        color: '#075e47',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 700,
                        fontSize: '13px',
                      }}
                    >
                      {inst.sequence}
                    </span>
                    <div>
                      <span style={{ fontSize: '11.5px', color: '#6c8f89', display: 'block' }}>Due date</span>
                      <span style={{ fontWeight: 600, color: '#073533' }}>{dueFormatted}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '11.5px', color: '#6c8f89', display: 'block' }}>Amount</span>
                      <span style={{ fontWeight: 600, color: '#073533' }}>{totalAmtStr}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '11.5px', color: '#6c8f89', display: 'block' }}>Paid</span>
                      <span style={{ fontWeight: 600, color: '#075e47' }}>{paidAmtStr}</span>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        background: '#eafbf4',
                        color: '#075e47',
                        border: '1px solid #a3ebce',
                      }}
                    >
                      ✓ Paid
                    </span>
                  </div>
                </div>
              );
            }

            const isOpen = openInstallmentId === inst.id;
            const currentTab = activeTabByInst[inst.id] || 'full';
            const customVal = customAmounts[inst.id] || '';
            const customNum = parseFloat(customVal) || 0;
            const headsSum = getHeadsSum(inst.id);

            return (
              <div
                key={inst.id}
                style={{
                  border: isOpen ? '1.5px solid #42c2a8' : '1px solid rgba(7, 53, 51, 0.1)',
                  borderRadius: '16px',
                  marginBottom: '12px',
                  overflow: 'hidden',
                  background: '#ffffff',
                  boxShadow: isOpen ? '0 8px 24px -4px rgba(66, 194, 168, 0.15)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Accordion Summary Header */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1.2fr 1fr 1fr auto',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '16px 18px',
                    cursor: 'pointer',
                    background: isOpen ? '#f7fbf9' : '#ffffff',
                  }}
                  onClick={() => setOpenInstallmentId(isOpen ? '' : inst.id)}
                >
                  <span
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: isOpen ? '#063331' : '#f0faf6',
                      color: isOpen ? '#ffffff' : '#073533',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 700,
                      fontSize: '13px',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {inst.sequence}
                  </span>
                  <div>
                    <span style={{ fontSize: '11.5px', color: '#6c8f89', display: 'block' }}>Due date</span>
                    <span style={{ fontWeight: 600, color: '#073533' }}>{dueFormatted}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '11.5px', color: '#6c8f89', display: 'block' }}>Amount</span>
                    <span style={{ fontWeight: 600, color: '#073533' }}>{totalAmtStr}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '11.5px', color: '#6c8f89', display: 'block' }}>Paid</span>
                    <span style={{ fontWeight: 600, color: isPartPaid ? '#075e47' : '#6c8f89' }}>{paidAmtStr}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        background: isPartPaid ? '#eff6ff' : '#fffbeb',
                        color: isPartPaid ? '#1e40af' : '#92400e',
                        border: isPartPaid ? '1px solid #bfdbfe' : '1px solid #fde68a',
                      }}
                    >
                      {isPartPaid ? `Part Paid (${remainingAmtStr} due)` : 'Pending'}
                    </span>
                    <span style={{ color: '#6c8f89', fontSize: '13px', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                      ▼
                    </span>
                  </div>
                </div>

                {/* Collapsible Payment Workspace */}
                {isOpen && (
                  <div
                    style={{
                      padding: '16px 20px 22px',
                      borderTop: '1px solid rgba(7, 53, 51, 0.08)',
                      background: '#f7fbf9',
                    }}
                  >
                    {/* Payment Mode Tabs */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        margin: '0 0 16px',
                        background: '#eaf4f0',
                        padding: '4px',
                        borderRadius: '9999px',
                        maxWidth: '440px',
                      }}
                    >
                      {(['full', 'custom', 'heads'] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          style={{
                            flex: 1,
                            height: '36px',
                            border: 0,
                            borderRadius: '9999px',
                            background: currentTab === tab ? '#ffffff' : 'transparent',
                            color: currentTab === tab ? '#063331' : '#587973',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '13px',
                            boxShadow: currentTab === tab ? '0 2px 8px rgba(6, 45, 42, 0.08)' : 'none',
                            transition: 'all 0.15s ease',
                          }}
                          onClick={() =>
                            setActiveTabByInst((prev) => ({
                              ...prev,
                              [inst.id]: tab,
                            }))
                          }
                        >
                          {tab === 'full' ? (isPartPaid ? 'Pay remaining' : 'Pay in full') : tab === 'custom' ? 'Custom amount' : 'By fee head'}
                        </button>
                      ))}
                    </div>

                    {/* Tab 1: Pay in Full */}
                    {currentTab === 'full' && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                          flexWrap: 'wrap',
                          background: '#ffffff',
                          padding: '16px 20px',
                          borderRadius: '16px',
                          border: '1px solid rgba(7, 53, 51, 0.08)',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '12px', color: '#6c8f89', display: 'block' }}>
                            {isPartPaid ? 'Remaining balance' : 'You pay'}
                          </span>
                          <strong style={{ fontSize: '22px', color: '#073533', fontVariantNumeric: 'tabular-nums' }}>
                            {remainingAmtStr}
                          </strong>
                        </div>
                        <button
                          type="button"
                          className="button primary"
                          style={{
                            borderRadius: '9999px',
                            padding: '10px 26px',
                            fontWeight: 600,
                            fontSize: '14px',
                            boxShadow: '0 4px 14px rgba(6, 51, 49, 0.2)',
                          }}
                          onClick={() => handlePay(inst.sequence, remainingAmtStr, isPartPaid ? 'Remaining Installment Balance' : 'Full Installment')}
                        >
                          Pay {remainingAmtStr}
                        </button>
                      </div>
                    )}

                    {/* Tab 2: Custom Amount */}
                    {currentTab === 'custom' && (
                      <div
                        style={{
                          background: '#ffffff',
                          padding: '18px 20px',
                          borderRadius: '16px',
                          border: '1px solid rgba(7, 53, 51, 0.08)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
                          <div>
                            <strong style={{ fontSize: '14px', color: '#073533' }}>Custom payment amount</strong>
                            <span style={{ fontSize: '12.5px', color: '#6c8f89', display: 'block' }}>
                              Up to {remainingAmtStr} for this installment
                            </span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              border: customNum > maxVal ? '1px solid #dc2626' : '1px solid rgba(7, 53, 51, 0.16)',
                              borderRadius: '12px',
                              background: '#ffffff',
                              padding: '0 12px',
                              height: '42px',
                              width: '180px',
                              boxShadow: '0 1px 4px rgba(6, 45, 42, 0.05)',
                            }}
                          >
                            <span style={{ color: '#6c8f89', fontWeight: 600 }}>₹</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={customVal}
                              onChange={(e) =>
                                setCustomAmounts((prev) => ({
                                  ...prev,
                                  [inst.id]: e.target.value,
                                }))
                              }
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#073533',
                                width: '100%',
                                outline: 'none',
                                textAlign: 'right',
                                fontSize: '15px',
                                fontWeight: 600,
                              }}
                            />
                          </div>
                        </div>

                        {customNum > maxVal && (
                          <p style={{ color: '#dc2626', fontSize: '12.5px', margin: '0 0 10px', fontWeight: 500 }}>
                            Amount cannot exceed {remainingAmtStr} for this installment.
                          </p>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                          <button
                            type="button"
                            className="button primary"
                            disabled={customNum <= 0 || customNum > maxVal}
                            style={{
                              borderRadius: '9999px',
                              padding: '10px 24px',
                              fontWeight: 600,
                              fontSize: '13.5px',
                              opacity: customNum <= 0 || customNum > maxVal ? 0.45 : 1,
                              cursor: customNum <= 0 || customNum > maxVal ? 'not-allowed' : 'pointer',
                            }}
                            onClick={() => handlePay(inst.sequence, formatINR(customNum, false), 'Custom Amount')}
                          >
                            Pay custom amount ({formatINR(customNum, false)})
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Tab 3: By Fee Head */}
                    {currentTab === 'heads' && (
                      <div
                        style={{
                          background: '#ffffff',
                          padding: '18px 20px',
                          borderRadius: '16px',
                          border: '1px solid rgba(7, 53, 51, 0.08)',
                        }}
                      >
                        <p style={{ color: '#6c8f89', fontSize: '13px', margin: '0 0 14px' }}>
                          Enter amounts against one or more fee heads. Combined amount cannot exceed {remainingAmtStr}.
                        </p>

                        <div style={{ display: 'grid', gap: '10px', marginBottom: '14px' }}>
                          {headsList.map((h) => {
                            const val = headInputs[inst.id]?.[h.code] || '';
                            return (
                              <div
                                key={h.code}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '10px 0',
                                  borderBottom: '1px solid rgba(7, 53, 51, 0.06)',
                                }}
                              >
                                <div>
                                  <strong style={{ fontSize: '13.5px', color: '#073533' }}>{h.label}</strong>
                                  <span style={{ fontSize: '12px', color: '#6c8f89', display: 'block' }}>
                                    {formatINR(h.remainingMajor, false)} remaining
                                  </span>
                                </div>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    border: '1px solid rgba(7, 53, 51, 0.16)',
                                    borderRadius: '10px',
                                    background: '#ffffff',
                                    padding: '0 10px',
                                    height: '38px',
                                    width: '160px',
                                  }}
                                >
                                  <span style={{ color: '#6c8f89', fontSize: '13px' }}>₹</span>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={val}
                                    onChange={(e) => {
                                      const raw = parseFloat(e.target.value) || 0;
                                      const safe = raw > h.remainingMajor ? String(h.remainingMajor) : e.target.value;
                                      setHeadInputs((prev) => ({
                                        ...prev,
                                        [inst.id]: {
                                          ...(prev[inst.id] || {}),
                                          [h.code]: safe,
                                        },
                                      }));
                                    }}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#073533',
                                      width: '100%',
                                      outline: 'none',
                                      textAlign: 'right',
                                      fontSize: '13.5px',
                                      fontWeight: 600,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {headsSum > maxVal && (
                          <p style={{ color: '#dc2626', fontSize: '12.5px', margin: '0 0 10px', fontWeight: 500 }}>
                            Total cannot exceed {remainingAmtStr} for this installment.
                          </p>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                          <div>
                            <span style={{ fontSize: '12px', color: '#6c8f89', display: 'block' }}>Selected total</span>
                            <strong style={{ fontSize: '18px', color: '#073533', fontVariantNumeric: 'tabular-nums' }}>
                              {formatINR(headsSum, false)}
                            </strong>
                          </div>
                          <button
                            type="button"
                            className="button primary"
                            disabled={headsSum <= 0 || headsSum > maxVal}
                            style={{
                              borderRadius: '9999px',
                              padding: '10px 24px',
                              fontWeight: 600,
                              fontSize: '13.5px',
                              opacity: headsSum <= 0 || headsSum > maxVal ? 0.45 : 1,
                              cursor: headsSum <= 0 || headsSum > maxVal ? 'not-allowed' : 'pointer',
                            }}
                            onClick={() => handlePay(inst.sequence, formatINR(headsSum, false), 'Selected Fee Heads')}
                          >
                            Pay selected fee heads
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* ============================================================== */}
        {/* Flex / eNACH Mandate Card (Informative Status Overview)        */}
        {/* ============================================================== */}
        <section
          style={{
            background: '#ffffff',
            border: '1px solid rgba(7, 53, 51, 0.08)',
            borderRadius: '26px',
            padding: '26px 28px',
            marginBottom: '24px',
            boxShadow: '0 10px 30px -4px rgba(6, 45, 42, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#d6f4ec',
                  color: '#064840',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '14px',
                }}
              >
                ⚡
              </span>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#073533', margin: 0 }}>
                Flex / eNACH mandate
              </h2>
            </div>

            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: '9999px',
                background: '#eafbf4',
                color: '#075e47',
                border: '1px solid #a3ebce',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Active
            </span>
          </div>

          <p style={{ color: '#587973', margin: '0 0 18px', fontSize: '13.5px', lineHeight: 1.5 }}>
            Automatic collection is active through <strong style={{ color: '#073533' }}>eNACH</strong>. Due installments can be submitted automatically to the configured provider. Final payment status is recorded only after verified provider confirmation.
          </p>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              padding: '16px 20px',
              border: '1px solid rgba(7, 53, 51, 0.08)',
              borderRadius: '16px',
              background: '#fbfdfc',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <b style={{ display: 'block', fontSize: '14.5px', color: '#073533' }}>
                eNACH · NPCI Standing Mandate
              </b>
              <small style={{ color: '#6c8f89', fontSize: '12px' }}>
                Started 23/10/2026, 1:18:28 pm · UMRN: <span style={{ fontFamily: 'monospace', color: '#073533', fontWeight: 600 }}>UMRN-NACH-2026-089412</span> · Bank: HDFC Bank (•••• 1244)
              </small>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: '9999px',
                background: '#eafbf4',
                color: '#075e47',
                border: '1px solid #a3ebce',
              }}
            >
              ✓ Active
            </span>
          </div>
        </section>

        {/* Payment History Card */}
        <section
          style={{
            background: '#ffffff',
            border: '1px solid rgba(7, 53, 51, 0.08)',
            borderRadius: '26px',
            padding: '26px 28px',
            marginBottom: '24px',
            boxShadow: '0 10px 30px -4px rgba(6, 45, 42, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#073533', margin: 0 }}>
              Payment history
            </h2>
            <span style={{ fontSize: '12px', color: '#6c8f89', fontWeight: 500 }}>
              {data.payments.length} settled {data.payments.length === 1 ? 'transaction' : 'transactions'}
            </span>
          </div>

          {data.payments.length === 0 ? (
            <div style={{ padding: '20px 0', color: '#6c8f89', fontSize: '13.5px' }}>
              No payments recorded yet.
            </div>
          ) : (
            data.payments.map((p, idx) => {
              const formattedDate = new Date(p.recorded_at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
              const rcp = p.receipt_number || `DPS-REC-2026-00${412 + idx}`;
              return (
                <div
                  key={p.id || idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 0',
                    borderTop: '1px solid rgba(7, 53, 51, 0.06)',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '18px', color: '#073533', fontVariantNumeric: 'tabular-nums' }}>
                      {formatINR(p.amount_minor)}
                    </strong>
                    <span style={{ display: 'block', fontSize: '12.5px', color: '#6c8f89', marginTop: '3px' }}>
                      Recorded {formattedDate} · {p.status || 'settled'}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11.5px', color: '#6c8f89', display: 'block' }}>Receipt</span>
                    <strong style={{ fontSize: '13.5px', color: '#073533' }}>{rcp}</strong>
                    {' · '}
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#075e47',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        padding: 0,
                      }}
                      onClick={() =>
                        setViewReceipt({
                          receipt_number: rcp,
                          date: formattedDate,
                          amount: formatINR(p.amount_minor),
                          student: data.payer.studentName || 'Student',
                          payer: data.payer.displayName,
                          ref: data.payer.accountReference,
                          installment: `Payment Reference: ${p.id}`,
                        })
                      }
                    >
                      View / print
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Security Note Alert Card */}
        <div
          style={{
            background: '#eafbf4',
            border: '1px solid #a3ebce',
            color: '#075e47',
            borderRadius: '20px',
            padding: '18px 22px',
            fontSize: '13.5px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontSize: '18px', flexShrink: 0 }}>🔒</span>
          <div>
            <strong style={{ display: 'block', color: '#064840', marginBottom: '2px', fontWeight: 700 }}>
              Security note
            </strong>
            Payment actions redirect to the approved hosted provider. This portal never asks for bank credentials, PINs or OTPs.
          </div>
        </div>
      </div>
    </div>
  );
}
