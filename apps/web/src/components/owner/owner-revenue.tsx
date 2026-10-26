'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/client';
import { useOwner } from './owner-context';
import { OwnerModal } from './owner-modal';

export function OwnerRevenue() {
  const { refreshTrigger, refreshData } = useOwner();
  const [data, setData] = useState<any>(null);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'saas' | 'flex' | 'pg_rates' | 'invoices'>('saas');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [manualPayModalOpen, setManualPayModalOpen] = useState(false);
  const [advanceAdjustModalOpen, setAdvanceAdjustModalOpen] = useState(false);
  const [selectedInstForAdvance, setSelectedInstForAdvance] = useState<any | null>(null);
  const [editRateModalOpen, setEditRateModalOpen] = useState(false);
  const [selectedRate, setSelectedRate] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Manual payment form
  const [manualPayForm, setManualPayForm] = useState({
    tenant_id: '',
    plan_id: 'plan_growth',
    amount_inr: 3000,
    payment_method: 'bank_neft',
    reference_id: '',
  });

  // Advance adjust form
  const [advanceForm, setAdvanceForm] = useState({
    type: 'credit',
    amount_inr: 10000,
    description: '',
  });

  // PG rate edit form
  const [rateEditForm, setRateEditForm] = useState({
    id: '',
    rate: 0,
    gst_percentage: 18,
  });

  useEffect(() => {
    let unmounted = false;
    async function loadRevenue() {
      setLoading(true);
      setError('');
      try {
        const [revRes, instRes] = await Promise.all([
          api<any>('/v1/owner/revenue'),
          api<any[]>('/v1/owner/institutions'),
        ]);
        if (!unmounted) {
          setData(revRes);
          setInstitutions(instRes || []);
          if (instRes && instRes[0]) {
            setManualPayForm((prev) => ({
              ...prev,
              tenant_id: instRes[0].id,
            }));
            setSelectedInstForAdvance(instRes[0]);
          }
        }
      } catch (e: any) {
        if (!unmounted) setError(e.message || 'Failed to load revenue ledger');
      } finally {
        if (!unmounted) setLoading(false);
      }
    }
    void loadRevenue();
    return () => {
      unmounted = true;
    };
  }, [refreshTrigger]);

  if (loading && !data) {
    return (
      <div className="p-12 text-center text-slate-500">
        <div className="inline-block h-7 w-7 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" />
        <p className="mt-2.5 text-xs font-medium text-slate-600">
          Loading platform revenue & commercial billing…
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-5 m-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
        <h3 className="font-semibold text-sm">Unable to load revenue ledger</h3>
        <p className="mt-1 text-xs text-rose-700">{error}</p>
      </div>
    );
  }

  const handleOpenInvoice = (tx: any) => {
    setSelectedInvoice(tx);
    setInvoiceModalOpen(true);
  };

  const handleOpenAdvanceAdjust = (inst: any) => {
    setSelectedInstForAdvance(inst);
    setAdvanceForm({
      type: 'credit',
      amount_inr: 10000,
      description: 'Advance security top-up for scheduled debit runs',
    });
    setAdvanceAdjustModalOpen(true);
  };

  const handleOpenEditRate = (rate: any) => {
    setSelectedRate(rate);
    setRateEditForm({
      id: rate.id,
      rate: rate.rate,
      gst_percentage: rate.gst_percentage || 18,
    });
    setEditRateModalOpen(true);
  };

  const handleRecordManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPayForm.tenant_id || !manualPayForm.reference_id.trim()) return;
    setSubmitting(true);
    try {
      await api('/v1/owner/revenue/record-payment', {
        method: 'POST',
        body: JSON.stringify({
          ...manualPayForm,
          amount_inr: Number(manualPayForm.amount_inr),
        }),
      });
      setManualPayModalOpen(false);
      setManualPayForm({
        tenant_id: institutions[0]?.id || '',
        plan_id: 'plan_growth',
        amount_inr: 3000,
        payment_method: 'bank_neft',
        reference_id: '',
      });
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Failed to record subscription payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAdvanceAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstForAdvance) return;
    setSubmitting(true);
    try {
      await api(`/v1/owner/institutions/${selectedInstForAdvance.id}/advance/adjust`, {
        method: 'POST',
        body: JSON.stringify({
          type: advanceForm.type,
          amount_inr: Number(advanceForm.amount_inr),
          description: advanceForm.description || 'Advance ledger adjustment',
        }),
      });
      setAdvanceAdjustModalOpen(false);
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Failed to adjust advance balance');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateEditForm.id) return;
    setSubmitting(true);
    try {
      await api('/v1/owner/revenue/pg-rates', {
        method: 'POST',
        body: JSON.stringify({
          id: rateEditForm.id,
          rate: Number(rateEditForm.rate),
          gst_percentage: Number(rateEditForm.gst_percentage),
        }),
      });
      setEditRateModalOpen(false);
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Failed to update PG commercial rate');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    window.open('/api/v1/owner/revenue/export-csv', '_blank');
  };

  const metrics = data?.metrics || {};
  const categories = data?.categories || {};
  const transactions: any[] = data?.transactions || [];
  const trend: any[] = data?.monthly_trend || [];
  const pgRates: any[] = data?.pg_rates || [];

  const filteredTx = transactions.filter((tx) => {
    const matchesSearch =
      tx.institution_name?.toLowerCase().includes(search.toLowerCase()) ||
      tx.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      tx.gateway_payment_id?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[rgba(7,53,51,0.06)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#063331]">
            Platform Revenue & Commercial Billing
          </h1>
          <p className="text-xs text-[#6c8f89] mt-0.5">
            SaaS subscriptions, Jodo Flex mandate/debit charges, advance security adjustments, and
            PG commercial rates.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportCsv}
            className="pharmacy-pill-light h-9 px-4 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <svg
              className="w-4 h-4 text-[#6c8f89]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export Billing CSV
          </button>
          <button
            onClick={() => setManualPayModalOpen(true)}
            className="pharmacy-pill-dark h-9 px-4 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            + Record Offline / Wire Payment
          </button>
        </div>
      </div>

      {/* Critical Tenant Separation Alert */}
      <div className="pharmacy-card p-4 sm:p-5 flex items-start gap-3">
        <span className="w-8 h-8 rounded-full bg-[#063331] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
          ⓘ
        </span>
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#063331]">
            Strict Isolation: Platform SaaS Earnings vs. Institutional Tuition Collections
          </h4>
          <p className="text-xs text-[#244a45] mt-0.5 leading-relaxed">
            Revenue displayed here is <strong>Platform Gross Revenue</strong> earned by your company
            (SaaS fees, Flex mandate creation fees, 1% debit convenience fees, and payment gateway
            margins). Gross institutional fee collections (₹4.28+ Cr) belong solely to educational
            institutions and are kept strictly isolated.
          </p>
        </div>
      </div>

      {/* Primary Revenue KPI Metrics Breakdown (Pastel Themes Matching Inspiration) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card-lime p-5 min-h-[140px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#4a6834]">
                Gross Commercial Revenue
              </span>
              <span className="w-6 h-6 rounded-full bg-white/40 flex items-center justify-center text-xs font-bold text-[#1f480b]">
                ₹
              </span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#1f480b] tracking-tight">
              ₹{(metrics.total_collected_inr || 248500).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-[#1f480b]/15 flex items-center justify-between text-xs">
            <span className="text-[#4a6834] font-medium">Active MRR</span>
            <span className="font-extrabold text-[#1f480b]">
              ₹{(metrics.mrr_inr || 0).toLocaleString('en-IN')}/mo
            </span>
          </div>
        </div>

        <div className="stat-card-aqua p-5 min-h-[140px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#2b6d63]">
                Flex Registration Fees
              </span>
              <span className="w-6 h-6 rounded-full bg-white/40 flex items-center justify-center text-xs font-bold text-[#064840]">
                ⚡
              </span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#064840] tracking-tight">
              ₹{(categories.flex_registration_inr || 45000).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-[#064840]/15 flex items-center justify-between text-xs">
            <span className="text-[#2b6d63] font-medium">Mandates registered</span>
            <span className="font-extrabold text-[#064840]">225 @ ₹200</span>
          </div>
        </div>

        <div className="stat-card-lavender p-5 min-h-[140px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#4a538c]">
                Flex Convenience Fees
              </span>
              <span className="w-6 h-6 rounded-full bg-white/40 flex items-center justify-center text-xs font-bold text-[#202967]">
                %
              </span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#202967] tracking-tight">
              ₹{(categories.flex_transaction_inr || 89000).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-[#202967]/15 flex items-center justify-between text-xs">
            <span className="text-[#4a538c] font-medium">Realized debits</span>
            <span className="font-extrabold text-[#202967]">1.0% avg rate</span>
          </div>
        </div>

        <div className="stat-card-coral p-5 min-h-[140px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8a434a]">
                Outstanding Renewals
              </span>
              <span className="w-6 h-6 rounded-full bg-white/40 flex items-center justify-center text-xs font-bold text-[#611a21]">
                🧾
              </span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#611a21] tracking-tight">
              ₹{(metrics.outstanding_inr || 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-[#611a21]/15 flex items-center justify-between text-xs text-[#812933] font-semibold">
            <span>Pending or expired accounts</span>
            <span>1 Tenant</span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Navigation Tabs (Pill Buttons) - Hidden Native Scrollbar */}
      <div className="flex space-x-2 sm:space-x-3 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setActiveTab('saas')}
          className={`h-9 px-4 text-xs font-semibold rounded-full transition cursor-pointer whitespace-nowrap ${
            activeTab === 'saas' ? 'pharmacy-pill-dark' : 'pharmacy-pill-light text-[#476863]'
          }`}
        >
          Institution Commercial Revenue
        </button>
        <button
          onClick={() => setActiveTab('flex')}
          className={`h-9 px-4 text-xs font-semibold rounded-full transition cursor-pointer whitespace-nowrap ${
            activeTab === 'flex' ? 'pharmacy-pill-dark' : 'pharmacy-pill-light text-[#476863]'
          }`}
        >
          Jodo Flex Commercials & Advance Ledger
        </button>
        <button
          onClick={() => setActiveTab('pg_rates')}
          className={`h-9 px-4 text-xs font-semibold rounded-full transition cursor-pointer whitespace-nowrap ${
            activeTab === 'pg_rates' ? 'pharmacy-pill-dark' : 'pharmacy-pill-light text-[#476863]'
          }`}
        >
          Payment Gateway Commercial Rates
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`h-9 px-4 text-xs font-semibold rounded-full transition cursor-pointer whitespace-nowrap ${
            activeTab === 'invoices' ? 'pharmacy-pill-dark' : 'pharmacy-pill-light text-[#476863]'
          }`}
        >
          Invoices & Billing Statements
        </button>
      </div>

      {/* TAB 1: SAAS SUBSCRIPTION REVENUE */}
      {activeTab === 'saas' && (
        <div className="space-y-6">
          {/* Monthly Realization Trend */}
          {trend.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Monthly SaaS Collection Trend (INR)
                </h3>
                <span className="text-[11px] text-slate-500">B2B Platform Subscriptions</span>
              </div>
              <div className="flex items-end gap-6 h-36 pt-4 border-b border-slate-100">
                {trend.map((m) => {
                  const maxVal = Math.max(...trend.map((t) => t.total_inr), 10000);
                  const heightPct = Math.round((m.total_inr / maxVal) * 100);
                  return (
                    <div
                      key={m.month}
                      className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"
                    >
                      <span className="text-[10px] font-bold text-slate-700">
                        ₹{m.total_inr.toLocaleString('en-IN')}
                      </span>
                      <div
                        style={{ height: `${Math.max(heightPct, 15)}%` }}
                        className="w-full max-w-[44px] bg-teal-600 hover:bg-teal-700 rounded-t-md transition shadow-2xs"
                      />
                      <span className="text-[10px] text-slate-400 font-medium mt-1">{m.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Institution Commercials Summary */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Educational Institution Commercial Billing Summary
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Institutional commercial fee structures, contract agreement terms, and monthly
                  billing models.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Institution</th>
                    <th className="px-4 py-3">Commercial Model</th>
                    <th className="px-4 py-3">Billing Rate</th>
                    <th className="px-4 py-3">Frequency</th>
                    <th className="px-4 py-3">Agreement</th>
                    <th className="px-4 py-3 text-right">Est. Monthly Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {institutions.map((inst) => {
                    const comm = inst.commercials || {};
                    const rev = comm.estimated_revenue_inr || 25000;
                    return (
                      <tr key={inst.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">{inst.display_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {inst.code} • {inst.student_count || 0} students
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#eafbf4] text-[#075e47] border border-[#a3ebce] capitalize">
                            {comm.model ? comm.model.replace(/_/g, ' ') : 'Hybrid Pricing'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-800">
                          {comm.billing_rate_label || '1.0% + ₹200 / reg'}
                        </td>
                        <td className="px-4 py-3.5 capitalize font-medium text-slate-600">
                          {comm.billing_frequency || 'monthly'}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              comm.agreement_status === 'signed_active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {comm.agreement_status === 'signed_active'
                              ? 'Signed & Active'
                              : 'Under Review'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-extrabold text-[#063331]">
                          ₹{rev.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: JODO FLEX COMMERCIALS & ADVANCE LEDGER */}
      {activeTab === 'flex' && (
        <div className="space-y-6">
          {/* Flex Commercials Architecture Card */}
          <div className="bg-slate-900 text-white rounded-xl p-5 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Jodo Flex Commercial Engine
              </span>
              <h3 className="text-base font-bold">Standard Commercial Structure</h3>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Institutions using Jodo Flex eNACH & UPI AutoPay deposit an initial advance (₹50,000
                baseline). Mandate registrations (₹200/student) and convenience fees (1% per debit)
                are charged or deducted from the advance ledger.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center w-full md:w-auto">
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  eNACH Reg
                </span>
                <div className="text-sm font-extrabold text-teal-400 mt-0.5">₹200</div>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  UPI AutoPay
                </span>
                <div className="text-sm font-extrabold text-cyan-400 mt-0.5">₹140</div>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  One-Time UPI
                </span>
                <div className="text-sm font-extrabold text-emerald-400 mt-0.5">0.0% MDR</div>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  Debit Fee
                </span>
                <div className="text-sm font-extrabold text-indigo-400 mt-0.5">1.0%</div>
              </div>
            </div>
          </div>

          {/* Institutions Advance Ledger Table */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Institution Advance Balances & Commercial Overrides
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Monitor live advance balances, debit charge deductions, and top-up deposits per
                  institution.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Institution</th>
                    <th className="px-4 py-3">Reg. Fee (INR)</th>
                    <th className="px-4 py-3">Debit Fee (%)</th>
                    <th className="px-4 py-3">Total Advance Received</th>
                    <th className="px-4 py-3">Charges Deducted</th>
                    <th className="px-4 py-3">Current Balance</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {institutions.map((inst) => {
                    const comm = inst.commercials || {};
                    const adv = comm.advance_balance || {};
                    const bal = adv.advance_balance_inr || 0;
                    return (
                      <tr key={inst.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">{inst.display_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Effective: {comm.effective_date || '2026-08-01'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-700">
                          ₹{(comm.registration_fee_inr || 200).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-700">
                          {comm.convenience_fee_percentage || 1.0}%
                        </td>
                        <td className="px-4 py-3.5 text-slate-900 font-semibold">
                          ₹{(adv.advance_received_inr || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3.5 text-rose-600 font-medium">
                          -₹{(adv.charges_applied_inr || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3.5 font-bold">
                          <span
                            className={
                              bal > 20000
                                ? 'text-emerald-700 font-extrabold'
                                : bal > 0
                                  ? 'text-amber-700 font-extrabold'
                                  : 'text-rose-700 font-extrabold'
                            }
                          >
                            ₹{bal.toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleOpenAdvanceAdjust(inst)}
                            className="h-7.5 px-3 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 transition shadow-2xs cursor-pointer whitespace-nowrap"
                          >
                            Adjust Balance
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PAYMENT GATEWAY COMMERCIAL RATES */}
      {activeTab === 'pg_rates' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Payment Gateway Commercial Rate Schedule
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pricing configuration applied to student transactions. Mandated RBI zero-MDR on
                RuPay/UPI is strictly preserved.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Payment Method</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Rate Type</th>
                    <th className="px-4 py-3">Base Commercial Rate</th>
                    <th className="px-4 py-3">GST Applied</th>
                    <th className="px-4 py-3">Effective Date</th>
                    <th className="px-4 py-3 text-right">Configure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pgRates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                        No PG rates loaded.
                      </td>
                    </tr>
                  ) : (
                    pgRates.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">
                            {r.method || r.payment_method || 'Payment Method'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{r.id}</div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 capitalize">
                          {(r.method || r.payment_method || '').toLowerCase().includes('rupay') ||
                          (r.method || r.payment_method || '').toLowerCase().includes('upi')
                            ? 'Zero MDR Mandated'
                            : 'Standard Processing'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 uppercase font-mono text-[10px]">
                          {r.fee_type}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-900">
                          {r.fee_type === 'percentage' ? `${r.rate}%` : `₹${r.rate}`}
                          {r.rate === 0 && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                              0% MDR
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">
                          {r.gst_percentage}% (SAC 998313)
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                          {r.effective_date}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleOpenEditRate(r)}
                            className="h-7 px-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                          >
                            Edit Rate
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: INVOICES & BILLING STATEMENTS */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by invoice # or institution…"
                  className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white transition"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 transition cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Invoice #</th>
                    <th className="px-4 py-3">Institution</th>
                    <th className="px-4 py-3">Plan / Description</th>
                    <th className="px-4 py-3">Amount (INR)</th>
                    <th className="px-4 py-3">GST (18%)</th>
                    <th className="px-4 py-3">Total (INR)</th>
                    <th className="px-4 py-3">Payment Method</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTx.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-xs text-slate-500">
                        No transactions found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTx.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3.5 font-mono font-medium text-slate-800">
                          {tx.invoice_number}
                        </td>

                        <td className="px-4 py-3.5 font-semibold text-slate-900">
                          {tx.institution_name}
                        </td>

                        <td className="px-4 py-3.5 text-slate-700 font-medium">
                          {tx.plan_name || 'Software Subscription'}
                        </td>

                        <td className="px-4 py-3.5 font-bold text-slate-900">
                          ₹{(tx.price_inr || tx.amount_minor / 100).toLocaleString('en-IN')}
                        </td>

                        <td className="px-4 py-3.5 text-slate-500">
                          ₹
                          {(
                            tx.gst_inr || Math.round((tx.price_inr || tx.amount_minor / 100) * 0.18)
                          ).toLocaleString('en-IN')}
                        </td>

                        <td className="px-4 py-3.5 font-extrabold text-teal-800">
                          ₹
                          {(
                            tx.total_inr ||
                            Math.round((tx.price_inr || tx.amount_minor / 100) * 1.18)
                          ).toLocaleString('en-IN')}
                        </td>

                        <td className="px-4 py-3.5 text-slate-600">
                          <span className="capitalize">{tx.payment_method?.replace('_', ' ')}</span>
                          <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                            {tx.gateway_payment_id}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          {tx.status === 'paid' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Paid
                            </span>
                          ) : tx.status === 'failed' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              Failed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              Pending
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                          {new Date(tx.recorded_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>

                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleOpenInvoice(tx)}
                            className="h-7.5 px-3 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 transition shadow-2xs cursor-pointer whitespace-nowrap"
                          >
                            View Invoice
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: B2B SaaS Tax Invoice View */}
      <OwnerModal
        isOpen={invoiceModalOpen && !!selectedInvoice}
        onClose={() => setInvoiceModalOpen(false)}
        title={selectedInvoice ? `Platform Tax Invoice: ${selectedInvoice.invoice_number}` : ''}
        subtitle="Computer-generated B2B SaaS tax invoice for institutional software licensing"
        maxWidth="max-w-lg"
      >
        {selectedInvoice && (
          <div className="space-y-4">
            {/* B2B SaaS Header */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-[20px] text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Service Provider:</span>
                <span className="font-bold text-slate-900">Jodo SaaS Platform Pvt Ltd</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">SAC Code:</span>
                <span className="font-mono text-slate-800">998313 (IT & SaaS Hosting)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Client Institution:</span>
                <span className="font-semibold text-slate-900">
                  {selectedInvoice.institution_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date Issued:</span>
                <span className="text-slate-800">
                  {new Date(selectedInvoice.recorded_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Gateway Ref:</span>
                <span className="font-mono text-slate-800">
                  {selectedInvoice.gateway_payment_id}
                </span>
              </div>
            </div>

            {/* Itemized Line */}
            <div className="border border-slate-200/80 rounded-[20px] overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Item Description</th>
                    <th className="p-3 text-right">Amount (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">
                        {selectedInvoice.plan_name || 'Software Subscription'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Monthly recurring institutional software licensing
                      </div>
                    </td>
                    <td className="p-3 text-right font-bold text-slate-900">
                      ₹
                      {(
                        selectedInvoice.price_inr || selectedInvoice.amount_minor / 100
                      )?.toLocaleString('en-IN')}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 text-slate-500">GST @ 18% (CGST 9% + SGST 9%)</td>
                    <td className="p-3 text-right text-slate-700 font-medium">
                      ₹
                      {(
                        selectedInvoice.gst_inr ||
                        Math.round(
                          (selectedInvoice.price_inr || selectedInvoice.amount_minor / 100) * 0.18,
                        )
                      )?.toLocaleString('en-IN')}
                    </td>
                  </tr>
                  <tr className="bg-slate-50 font-semibold border-t border-slate-200">
                    <td className="p-3 font-bold text-slate-900">Total Invoice Amount</td>
                    <td className="p-3 text-right text-teal-800 font-bold">
                      ₹
                      {(
                        selectedInvoice.total_inr ||
                        Math.round(
                          (selectedInvoice.price_inr || selectedInvoice.amount_minor / 100) * 1.18,
                        )
                      )?.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="text-[11px] text-slate-400 text-center italic">
              Computer-generated SaaS tax invoice for institutional software licensing. No physical
              signature required.
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => window.print()}
                className="pharmacy-pill-light h-9 px-4 text-xs font-bold text-[#063331] rounded-full cursor-pointer"
              >
                🖨 Print Invoice
              </button>
              <button
                onClick={() => setInvoiceModalOpen(false)}
                className="pharmacy-pill-dark h-9 px-5 text-xs font-bold text-white rounded-full shadow-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </OwnerModal>

      {/* Modal 2: Record Offline / Manual Payment */}
      <OwnerModal
        isOpen={manualPayModalOpen}
        onClose={() => setManualPayModalOpen(false)}
        title="Record Subscription Payment"
        subtitle="Manually credit an offline bank NEFT, wire transfer, or cheque receipt"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleRecordManualPayment} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Institution</label>
            <select
              value={manualPayForm.tenant_id}
              onChange={(e) => setManualPayForm({ ...manualPayForm, tenant_id: e.target.value })}
              className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white cursor-pointer"
            >
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.display_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount Paid (₹)
              </label>
              <input
                type="number"
                required
                min={100}
                value={manualPayForm.amount_inr}
                onChange={(e) =>
                  setManualPayForm({ ...manualPayForm, amount_inr: Number(e.target.value) })
                }
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Method</label>
              <select
                value={manualPayForm.payment_method}
                onChange={(e) =>
                  setManualPayForm({ ...manualPayForm, payment_method: e.target.value })
                }
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white cursor-pointer"
              >
                <option value="bank_neft">Bank NEFT / RTGS</option>
                <option value="upi_direct">Direct UPI Wire</option>
                <option value="razorpay">Razorpay Order ID</option>
                <option value="cheque">Bank Demand Draft / Cheque</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Transaction UTR / Reference ID
            </label>
            <input
              type="text"
              required
              value={manualPayForm.reference_id}
              onChange={(e) => setManualPayForm({ ...manualPayForm, reference_id: e.target.value })}
              placeholder="e.g. HDFCN26295018491 or pay_rzp_..."
              className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setManualPayModalOpen(false)}
              className="pharmacy-pill-light h-9 px-4 text-xs font-bold text-[#063331] rounded-full cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="pharmacy-pill-dark h-9 px-5 text-xs font-bold text-white rounded-full shadow-xs cursor-pointer"
            >
              {submitting ? 'Recording…' : 'Record & Extend Period'}
            </button>
          </div>
        </form>
      </OwnerModal>

      {/* Modal 3: Adjust Institution Advance Balance */}
      <OwnerModal
        isOpen={advanceAdjustModalOpen && !!selectedInstForAdvance}
        onClose={() => setAdvanceAdjustModalOpen(false)}
        title="Adjust Advance Balance"
        subtitle={selectedInstForAdvance ? selectedInstForAdvance.display_name : ''}
        maxWidth="max-w-md"
      >
        {selectedInstForAdvance && (
          <form onSubmit={handleSaveAdvanceAdjustment} className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
              <span className="text-slate-600">Current Balance:</span>
              <span className="font-bold text-slate-900 text-sm">
                ₹
                {(
                  selectedInstForAdvance.commercials?.advance_balance?.advance_balance_inr || 0
                ).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adjustment Type
                </label>
                <select
                  value={advanceForm.type}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, type: e.target.value })}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white cursor-pointer"
                >
                  <option value="credit">Credit (Top-Up / Deposit)</option>
                  <option value="debit">Debit (Deduct Fees / Charges)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={advanceForm.amount_inr}
                  onChange={(e) =>
                    setAdvanceForm({ ...advanceForm, amount_inr: Number(e.target.value) })
                  }
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason / Description
              </label>
              <input
                type="text"
                required
                value={advanceForm.description}
                onChange={(e) => setAdvanceForm({ ...advanceForm, description: e.target.value })}
                placeholder="e.g. Additional security deposit for Q4 debits"
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdvanceAdjustModalOpen(false)}
                className="pharmacy-pill-light h-9 px-4 text-xs font-bold text-[#063331] rounded-full cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="pharmacy-pill-dark h-9 px-5 text-xs font-bold text-white rounded-full shadow-xs cursor-pointer"
              >
                {submitting ? 'Applying…' : 'Apply Adjustment'}
              </button>
            </div>
          </form>
        )}
      </OwnerModal>

      {/* Modal 4: Edit PG Commercial Rate */}
      <OwnerModal
        isOpen={editRateModalOpen && !!selectedRate}
        onClose={() => setEditRateModalOpen(false)}
        title="Configure Commercial Rate"
        subtitle={selectedRate ? selectedRate.method || selectedRate.payment_method || '' : ''}
        maxWidth="max-w-md"
      >
        {selectedRate && (
          <form onSubmit={handleSaveRate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rate ({selectedRate.fee_type === 'percentage' ? '%' : '₹'})
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min={0}
                  value={rateEditForm.rate}
                  onChange={(e) =>
                    setRateEditForm({ ...rateEditForm, rate: Number(e.target.value) })
                  }
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  GST Applicable (%)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  max={28}
                  value={rateEditForm.gst_percentage}
                  onChange={(e) =>
                    setRateEditForm({ ...rateEditForm, gst_percentage: Number(e.target.value) })
                  }
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
              Note: Changes take effect immediately across all newly initiated payment transactions.
              Zero-MDR on RuPay Debit and UPI must comply with RBI guidelines.
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditRateModalOpen(false)}
                className="pharmacy-pill-light h-9 px-4 text-xs font-bold text-[#063331] rounded-full cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="pharmacy-pill-dark h-9 px-5 text-xs font-bold text-white rounded-full shadow-xs cursor-pointer"
              >
                {submitting ? 'Updating…' : 'Save Rate Configuration'}
              </button>
            </div>
          </form>
        )}
      </OwnerModal>
    </div>
  );
}
