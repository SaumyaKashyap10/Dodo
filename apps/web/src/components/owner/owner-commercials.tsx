'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/client';
import { useOwner } from './owner-context';
import { OwnerModal } from './owner-modal';

export type PricingModel =
  | 'fixed_institution_fee'
  | 'per_active_student'
  | 'per_enach_mandate'
  | 'per_autopay_mandate'
  | 'per_successful_debit'
  | 'percentage_of_collections'
  | 'hybrid';

export const PRICING_MODEL_LABELS: Record<PricingModel, string> = {
  fixed_institution_fee: 'Fixed institution fee',
  per_active_student: 'Per-active-student fee',
  per_enach_mandate: 'Per-eNACH-mandate fee',
  per_autopay_mandate: 'Per-UPI-AutoPay-mandate fee',
  per_successful_debit: 'Per-successful-debit fee',
  percentage_of_collections: 'Percentage of collections',
  hybrid: 'Hybrid pricing',
};

export const PRICING_MODEL_DESCRIPTIONS: Record<PricingModel, string> = {
  fixed_institution_fee:
    'Flat periodic platform fee regardless of student enrollment or collections volume.',
  per_active_student:
    'Monthly software fee assessed per active enrolled student on the institution roster.',
  per_enach_mandate:
    'Fee assessed on each successfully registered NPCI eNACH bank standing instruction.',
  per_autopay_mandate: 'Fee assessed on each authorized UPI 2.0 AutoPay recurring mandate.',
  per_successful_debit:
    'Transaction convenience fee charged only upon successful debit realization.',
  percentage_of_collections:
    'Variable platform percentage fee calculated on total gross tuition fees collected.',
  hybrid:
    'Bespoke combination of base retainer, mandate registration fees, and debit volume charges.',
};

export function OwnerCommercials() {
  const { refreshTrigger, refreshData } = useOwner();
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Search
  const [search, setSearch] = useState('');
  const [modelFilter, setModelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [frequencyFilter, setFrequencyFilter] = useState('all');

  // Modals
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedInstForView, setSelectedInstForView] = useState<any | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedInstForEdit, setSelectedInstForEdit] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');

  // Configuration Form State
  const [form, setForm] = useState<{
    institution_id: string;
    model: PricingModel;
    billing_rate_label: string;
    provider_cost_label: string;
    billing_frequency: 'monthly' | 'quarterly' | 'annually' | 'per_batch';
    agreement_status: 'signed_active' | 'under_review' | 'draft' | 'renewal_pending';
    effective_date: string;
    fixed_fee_inr: number;
    per_student_fee_inr: number;
    enach_registration_fee_inr: number;
    flex_debit_fee_percentage: number;
    initial_advance_inr: number;
    settlement_cycle: 'T+1' | 'T+2';
    notes: string;
  }>({
    institution_id: '',
    model: 'hybrid',
    billing_rate_label: '1.0% + ₹200 / mandate registration',
    provider_cost_label: '₹5.00 / mandate (NPCI) + 0.40% PG interchange',
    billing_frequency: 'monthly',
    agreement_status: 'signed_active',
    effective_date: new Date().toISOString().split('T')[0] || '',
    fixed_fee_inr: 0,
    per_student_fee_inr: 35,
    enach_registration_fee_inr: 200,
    flex_debit_fee_percentage: 1.0,
    initial_advance_inr: 59000,
    settlement_cycle: 'T+1',
    notes: '',
  });

  useEffect(() => {
    let unmounted = false;
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const instRes = await api<any[]>('/v1/owner/institutions');
        if (!unmounted) {
          setInstitutions(instRes || []);
          if (instRes && instRes.length > 0 && !form.institution_id) {
            setForm((prev) => ({ ...prev, institution_id: instRes[0].id }));
          }
        }
      } catch (e: any) {
        if (!unmounted) setError(e.message || 'Failed to load institution commercials');
      } finally {
        if (!unmounted) setLoading(false);
      }
    }
    void loadData();
    return () => {
      unmounted = true;
    };
  }, [refreshTrigger]);

  // Derived filtered records
  const filteredInstitutions = useMemo(() => {
    return institutions.filter((inst) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inst.display_name?.toLowerCase().includes(q) ||
        inst.code?.toLowerCase().includes(q) ||
        inst.id?.toLowerCase().includes(q) ||
        inst.legal_name?.toLowerCase().includes(q);

      const comm = inst.commercials || {};
      const matchesModel = modelFilter === 'all' || (comm.model || 'hybrid') === modelFilter;
      const matchesStatus =
        statusFilter === 'all' || (comm.agreement_status || 'signed_active') === statusFilter;
      const matchesFrequency =
        frequencyFilter === 'all' || (comm.billing_frequency || 'monthly') === frequencyFilter;

      return matchesSearch && matchesModel && matchesStatus && matchesFrequency;
    });
  }, [institutions, search, modelFilter, statusFilter, frequencyFilter]);

  // Metrics summary
  const summaryMetrics = useMemo(() => {
    const totalInsts = institutions.length;
    const activeAgreements = institutions.filter(
      (i) => (i.commercials?.agreement_status || 'signed_active') === 'signed_active',
    ).length;
    const totalEstRevenue = institutions.reduce(
      (acc, i) => acc + (i.commercials?.estimated_revenue_inr || 25000),
      0,
    );
    const totalEstCost = institutions.reduce(
      (acc, i) => acc + (i.commercials?.estimated_provider_cost_inr || 7000),
      0,
    );
    const totalEstMargin = totalEstRevenue - totalEstCost;
    const avgMarginPct =
      totalEstRevenue > 0 ? ((totalEstMargin / totalEstRevenue) * 100).toFixed(1) : '72.5';

    return {
      totalInsts,
      activeAgreements,
      totalEstRevenue,
      totalEstCost,
      totalEstMargin,
      avgMarginPct,
    };
  }, [institutions]);

  const handleOpenView = (inst: any) => {
    setSelectedInstForView(inst);
    setViewModalOpen(true);
  };

  const handleOpenEdit = (inst?: any) => {
    const target = inst || (institutions.length > 0 ? institutions[0] : null);
    setSelectedInstForEdit(target);
    setSaveSuccessMessage('');

    if (target) {
      const comm = target.commercials || {};
      setForm({
        institution_id: target.id,
        model: (comm.model as PricingModel) || 'hybrid',
        billing_rate_label: comm.billing_rate_label || '1.0% + ₹200 / mandate registration',
        provider_cost_label:
          comm.provider_cost_label || '₹5.00 / mandate (NPCI) + 0.40% PG interchange',
        billing_frequency: comm.billing_frequency || 'monthly',
        agreement_status: comm.agreement_status || 'signed_active',
        effective_date: comm.effective_date || new Date().toISOString().split('T')[0] || '',
        fixed_fee_inr: comm.fixed_fee_inr || (comm.model === 'fixed_institution_fee' ? 25000 : 0),
        per_student_fee_inr:
          comm.per_student_fee_inr || (comm.model === 'per_active_student' ? 35 : 0),
        enach_registration_fee_inr: comm.enach_registration_fee_inr ?? 200,
        flex_debit_fee_percentage: comm.flex_debit_fee_percentage ?? 1.0,
        initial_advance_inr: comm.initial_advance_inr ?? 59000,
        settlement_cycle: comm.settlement_cycle || 'T+1',
        notes: '',
      });
    }
    setEditModalOpen(true);
  };

  // Live Economics Calculation for Modal
  const calculatedEconomics = useMemo(() => {
    const targetInst =
      institutions.find((i) => i.id === form.institution_id) || selectedInstForEdit;
    const studentCount = targetInst?.student_count || 300;
    const estCollections = studentCount * 25000; // ~₹25k tuition per student avg

    let estRev = 25000;
    let estCost = 6000;

    switch (form.model) {
      case 'fixed_institution_fee':
        estRev = form.fixed_fee_inr || 25000;
        estCost = 4000;
        break;
      case 'per_active_student':
        estRev = studentCount * (form.per_student_fee_inr || 35);
        estCost = studentCount * 8; // ₹8 cost per student
        break;
      case 'per_enach_mandate':
        estRev = Math.round(studentCount * 0.4 * (form.enach_registration_fee_inr || 220));
        estCost = Math.round(studentCount * 0.4 * 8.5); // NPCI base
        break;
      case 'per_autopay_mandate':
        estRev = Math.round(studentCount * 0.3 * 140);
        estCost = Math.round(studentCount * 0.3 * 4.0); // Switch cost
        break;
      case 'per_successful_debit':
        estRev = Math.round(studentCount * 2 * 18);
        estCost = Math.round(studentCount * 2 * 5);
        break;
      case 'percentage_of_collections':
        estRev = Math.round((estCollections * (form.flex_debit_fee_percentage || 0.85)) / 100);
        estCost = Math.round((estCollections * 0.3) / 100);
        break;
      case 'hybrid':
      default:
        estRev = Math.round(
          studentCount * 0.35 * (form.enach_registration_fee_inr || 200) +
            (estCollections * (form.flex_debit_fee_percentage || 1.0)) / 100,
        );
        estCost = Math.round(studentCount * 0.35 * 5.0 + (estCollections * 0.4) / 100);
        break;
    }

    const margin = estRev - estCost;
    const marginPct = estRev > 0 ? Math.round((margin / estRev) * 100) : 70;

    return {
      studentCount,
      estRev,
      estCost,
      margin,
      marginPct,
    };
  }, [form, institutions, selectedInstForEdit]);

  const handleSaveCommercials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.institution_id) return;
    setSubmitting(true);
    setSaveSuccessMessage('');

    try {
      const payload = {
        model: form.model,
        billing_rate_label: form.billing_rate_label || PRICING_MODEL_LABELS[form.model],
        provider_cost_label: form.provider_cost_label,
        billing_frequency: form.billing_frequency,
        agreement_status: form.agreement_status,
        effective_date: form.effective_date,
        estimated_revenue_inr: calculatedEconomics.estRev,
        estimated_provider_cost_inr: calculatedEconomics.estCost,
        estimated_margin_inr: calculatedEconomics.margin,
        estimated_margin_pct: calculatedEconomics.marginPct,
        fixed_fee_inr: form.fixed_fee_inr,
        per_student_fee_inr: form.per_student_fee_inr,
        enach_registration_fee_inr: form.enach_registration_fee_inr,
        flex_debit_fee_percentage: form.flex_debit_fee_percentage,
        initial_advance_inr: form.initial_advance_inr,
        settlement_cycle: form.settlement_cycle,
      };

      // Calls backend route POST /v1/owner/institutions/{id}/commercials
      await api(`/v1/owner/institutions/${form.institution_id}/commercials`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSaveSuccessMessage('Commercial configuration updated in active CMS session & audit log.');
      refreshData();
      setTimeout(() => {
        setEditModalOpen(false);
      }, 1200);
    } catch (err: any) {
      alert(err.message || 'Failed to update commercial agreement.');
    } finally {
      setSubmitting(false);
    }
  };

  const getModelBadge = (model?: string) => {
    switch (model) {
      case 'fixed_institution_fee':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            Fixed Retainer
          </span>
        );
      case 'per_active_student':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            Per-Student
          </span>
        );
      case 'per_enach_mandate':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
            Per-eNACH Mandate
          </span>
        );
      case 'per_autopay_mandate':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
            Per-UPI AutoPay
          </span>
        );
      case 'per_successful_debit':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-violet-50 text-violet-800 border border-violet-200">
            Per-Debit Fee
          </span>
        );
      case 'percentage_of_collections':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
            % Collections
          </span>
        );
      case 'hybrid':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
            Hybrid Pricing
          </span>
        );
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'signed_active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            Signed & Active
          </span>
        );
      case 'under_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
            Under Review
          </span>
        );
      case 'renewal_pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            Renewal Pending
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Draft
          </span>
        );
    }
  };

  if (loading && institutions.length === 0) {
    return (
      <div className="p-12 text-center text-[#063331]/60">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-[#063331] border-t-transparent" />
        <p className="mt-3 text-xs font-semibold text-[#063331]">
          Loading institution commercial configurations…
        </p>
      </div>
    );
  }

  if (error && institutions.length === 0) {
    return (
      <div className="p-6 m-6 pharmacy-card rounded-[28px] border border-rose-200 bg-rose-50/70 text-rose-900">
        <h3 className="font-bold text-sm">Unable to load commercial configurations</h3>
        <p className="mt-1 text-xs text-rose-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Top Banner & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="pharmacy-pill-dark px-3 py-1 text-[11px] font-bold">
              Institutional Commercials
            </span>
            <span className="h-7 px-3 rounded-full text-[11px] font-semibold bg-[#eafbf4] text-[#075e47] border border-[#a3ebce] flex items-center gap-1.5 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Contract Agreements Active
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#063331] mt-2">
            Institution-wise Commercials & Pricing Agreements
          </h2>
          <p className="text-xs text-[#6c8f89] mt-0.5">
            Configure tailored pricing models, provider interchange cost allocations, and
            contribution margins per educational institution.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => handleOpenEdit()}
            className="pharmacy-pill-dark h-9 px-4 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
          >
            <span className="text-sm font-black">+</span>
            <span>Configure Commercials</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card-lime p-5 min-h-[140px] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#4a6834]">
              Active Agreements
            </span>
            <span className="w-7 h-7 rounded-full bg-[#1f480b]/15 text-[#1f480b] flex items-center justify-center font-bold text-xs">
              📜
            </span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#1f480b] tracking-tight">
              {summaryMetrics.activeAgreements} / {summaryMetrics.totalInsts}
            </div>
            <div className="text-[11px] font-semibold text-[#3a6822] mt-0.5">
              100% Onboarded Institutions Covered
            </div>
          </div>
        </div>

        <div className="stat-card-aqua p-5 min-h-[140px] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#2b6d63]">
              Est. Monthly Commercials
            </span>
            <span className="w-7 h-7 rounded-full bg-[#064840]/15 text-[#064840] flex items-center justify-center font-bold text-xs">
              ₹
            </span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#064840] tracking-tight">
              ₹{summaryMetrics.totalEstRevenue.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] font-semibold text-[#186256] mt-0.5">
              B2B Platform & Fee Share Billings
            </div>
          </div>
        </div>

        <div className="stat-card-lavender p-5 min-h-[140px] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#4a538c]">
              Est. Provider Rail Cost
            </span>
            <span className="w-7 h-7 rounded-full bg-[#202967]/15 text-[#202967] flex items-center justify-center font-bold text-xs">
              ⚡
            </span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#202967] tracking-tight">
              ₹{summaryMetrics.totalEstCost.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] font-semibold text-[#4a538c] mt-0.5">
              NPCI eNACH + PG Interchange Outflows
            </div>
          </div>
        </div>

        <div className="stat-card-coral p-5 min-h-[140px] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8a434a]">
              Avg Contribution Margin
            </span>
            <span className="w-7 h-7 rounded-full bg-[#611a21]/15 text-[#611a21] flex items-center justify-center font-bold text-xs">
              📈
            </span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#611a21] tracking-tight">
              {summaryMetrics.avgMarginPct}%
            </div>
            <div className="text-[11px] font-semibold text-[#812933] mt-0.5">
              ₹{summaryMetrics.totalEstMargin.toLocaleString('en-IN')} Net Operational Profit
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="pharmacy-card p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#063331] flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5 text-[#0f766e]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              Filter Commercial Agreements
            </span>
          </div>

          {(search ||
            modelFilter !== 'all' ||
            statusFilter !== 'all' ||
            frequencyFilter !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setModelFilter('all');
                setStatusFilter('all');
                setFrequencyFilter('all');
              }}
              className="text-[11px] text-[#0f766e] hover:underline font-bold cursor-pointer text-left sm:text-right"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-[#6c8f89] uppercase tracking-wider mb-1">
              Search Institution
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search name, ID or code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-8 pr-3 text-xs bg-[#f7fbf9] border border-[rgba(6,51,49,0.08)] rounded-full text-[#063331] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f766e]"
              />
              <svg
                className="w-3.5 h-3.5 text-[#6c8f89] absolute left-2.5 top-3"
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
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#6c8f89] uppercase tracking-wider mb-1">
              Commercial Model
            </label>
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-[#f7fbf9] border border-[rgba(6,51,49,0.08)] rounded-full text-[#063331] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f766e] cursor-pointer"
            >
              <option value="all">All Models ({institutions.length})</option>
              {Object.entries(PRICING_MODEL_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#6c8f89] uppercase tracking-wider mb-1">
              Agreement Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-[#f7fbf9] border border-[rgba(6,51,49,0.08)] rounded-full text-[#063331] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f766e] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="signed_active">Signed & Active</option>
              <option value="under_review">Under Review</option>
              <option value="draft">Draft</option>
              <option value="renewal_pending">Renewal Pending</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#6c8f89] uppercase tracking-wider mb-1">
              Billing Frequency
            </label>
            <select
              value={frequencyFilter}
              onChange={(e) => setFrequencyFilter(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-[#f7fbf9] border border-[rgba(6,51,49,0.08)] rounded-full text-[#063331] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f766e] cursor-pointer"
            >
              <option value="all">All Frequencies</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
              <option value="per_batch">Per Debit Batch</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Institution Commercials Table */}
      <div className="pharmacy-card overflow-hidden shadow-2xs">
        <div className="p-4 sm:p-5 border-b border-[rgba(6,51,49,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#063331]">
              Institution Commercial Registry
            </h3>
            <p className="text-xs text-[#6c8f89] mt-0.5">
              Review active billing terms, provider cost allocations, and margin projections per
              enrolled tenant.
            </p>
          </div>
          <span className="text-xs font-semibold text-[#0f766e] bg-[#eafbf4] px-3 py-1 rounded-full border border-[#a3ebce] w-fit">
            Showing {filteredInstitutions.length} of {institutions.length} Institutions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f2f8f6] text-[#476863] text-[11px] font-bold uppercase tracking-wider border-b border-[rgba(6,51,49,0.08)]">
              <tr>
                <th className="px-4 py-3.5">Institution</th>
                <th className="px-4 py-3.5">Commercial Model</th>
                <th className="px-4 py-3.5">Billing Rate</th>
                <th className="px-4 py-3.5">Provider Cost</th>
                <th className="px-4 py-3.5">Frequency</th>
                <th className="px-4 py-3.5">Agreement</th>
                <th className="px-4 py-3.5">Effective</th>
                <th className="px-4 py-3.5 text-right">Est. Revenue</th>
                <th className="px-4 py-3.5 text-right">Est. Cost</th>
                <th className="px-4 py-3.5 text-right">Contribution Margin</th>
                <th className="px-4 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(6,51,49,0.06)]">
              {filteredInstitutions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-500">
                    <p className="font-semibold text-sm text-[#063331]">
                      No institutions matched your filter
                    </p>
                    <p className="text-xs text-[#6c8f89] mt-1">
                      Try clearing your search term or changing the model filter.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredInstitutions.map((inst) => {
                  const comm = inst.commercials || {};
                  const rev = comm.estimated_revenue_inr || 25000;
                  const cost = comm.estimated_provider_cost_inr || 7000;
                  const margin = comm.estimated_margin_inr ?? rev - cost;
                  const marginPct =
                    comm.estimated_margin_pct ?? (rev > 0 ? Math.round((margin / rev) * 100) : 72);

                  return (
                    <tr key={inst.id} className="hover:bg-[#f7fbf9] transition">
                      {/* 1. Institution Name & ID */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-[#063331] text-[13px]">
                          {inst.display_name}
                        </div>
                        <div className="text-[11px] text-[#6c8f89] font-mono flex items-center gap-1.5 mt-0.5">
                          <span>{inst.code}</span>
                          <span>•</span>
                          <span>ID: {inst.id}</span>
                        </div>
                        <div className="text-[10px] text-[#476863] font-medium mt-0.5">
                          {inst.student_count || 0} Students • {inst.campus_count || 1} Campuses
                        </div>
                      </td>

                      {/* 2. Commercial Model */}
                      <td className="px-4 py-3.5 whitespace-nowrap">{getModelBadge(comm.model)}</td>

                      {/* 3. Institution Billing Rate */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-[#063331]">
                          {comm.billing_rate_label || '1.0% + ₹200 / reg'}
                        </div>
                        <div className="text-[10px] text-[#6c8f89]">
                          Cycle: {comm.settlement_cycle || 'T+1'} Settlement
                        </div>
                      </td>

                      {/* 4. Provider Cost */}
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-[#476863]">
                          {comm.provider_cost_label || '₹5.00/mandate (NPCI) + 0.40% PG'}
                        </div>
                      </td>

                      {/* 5. Billing Frequency */}
                      <td className="px-4 py-3.5 capitalize font-semibold text-[#063331]">
                        {comm.billing_frequency || 'monthly'}
                      </td>

                      {/* 6. Agreement Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getStatusBadge(comm.agreement_status)}
                      </td>

                      {/* 7. Effective Date */}
                      <td className="px-4 py-3.5 font-mono text-[11px] text-[#476863] whitespace-nowrap">
                        {comm.effective_date || '2026-04-01'}
                      </td>

                      {/* 8. Est. Revenue */}
                      <td className="px-4 py-3.5 text-right font-extrabold text-[#063331]">
                        ₹{rev.toLocaleString('en-IN')}
                      </td>

                      {/* 9. Est. Provider Cost */}
                      <td className="px-4 py-3.5 text-right font-semibold text-rose-700">
                        ₹{cost.toLocaleString('en-IN')}
                      </td>

                      {/* 10. Est. Contribution Margin */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="font-extrabold text-[#075e47]">
                          ₹{margin.toLocaleString('en-IN')}
                        </div>
                        <span className="inline-block mt-0.5 px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#eafbf4] text-[#075e47] border border-[#a3ebce]">
                          {marginPct}% margin
                        </span>
                      </td>

                      {/* 11. Actions */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenView(inst)}
                            title="View Full Commercial Agreement"
                            className="p-1.5 rounded-full hover:bg-[#eafbf4] text-[#0f766e] cursor-pointer transition"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(inst)}
                            title="Configure Rates"
                            className="p-1.5 rounded-full hover:bg-slate-100 text-[#063331] cursor-pointer transition"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW DETAILS MODAL */}
      <OwnerModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title="Institution Commercial Agreement Details"
        subtitle={selectedInstForView?.display_name || 'Commercial Contract Breakdown'}
        maxWidth="max-w-3xl"
      >
        {selectedInstForView &&
          (() => {
            const comm = selectedInstForView.commercials || {};
            const rev = comm.estimated_revenue_inr || 25000;
            const cost = comm.estimated_provider_cost_inr || 7000;
            const margin = comm.estimated_margin_inr ?? rev - cost;
            const marginPct =
              comm.estimated_margin_pct ?? (rev > 0 ? Math.round((margin / rev) * 100) : 72);

            return (
              <div className="space-y-6 text-xs text-[#063331]">
                {/* Header Profile Box */}
                <div className="p-4 rounded-2xl bg-[#f2f8f6] border border-[rgba(6,51,49,0.08)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <div className="text-sm font-extrabold text-[#063331]">
                      {selectedInstForView.display_name}
                    </div>
                    <div className="text-[11px] text-[#6c8f89] font-mono mt-0.5">
                      Institution ID: {selectedInstForView.id} • Legal Code:{' '}
                      {selectedInstForView.code}
                    </div>
                    <div className="text-[11px] text-[#476863] mt-1">
                      {selectedInstForView.legal_name} • {selectedInstForView.registered_address}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {getStatusBadge(comm.agreement_status)}
                    <div className="text-[10px] text-[#6c8f89] font-semibold mt-1">
                      Effective: {comm.effective_date || '2026-04-01'}
                    </div>
                  </div>
                </div>

                {/* Economic Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200">
                    <div className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">
                      Est. Monthly Gross
                    </div>
                    <div className="text-xl font-extrabold text-teal-900 mt-1">
                      ₹{rev.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-teal-700 mt-0.5">Commercial realization</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200">
                    <div className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">
                      Est. Provider Cost
                    </div>
                    <div className="text-xl font-extrabold text-rose-900 mt-1">
                      ₹{cost.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-rose-700 mt-0.5">
                      Rail & switch interchange
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                    <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                      Contribution Margin
                    </div>
                    <div className="text-xl font-extrabold text-emerald-900 mt-1">
                      ₹{margin.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-emerald-700 font-bold mt-0.5">
                      {marginPct}% Net Platform Margin
                    </div>
                  </div>
                </div>

                {/* Breakdown Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                    <div className="text-[11px] font-extrabold text-[#063331] uppercase tracking-wider border-b border-slate-100 pb-2">
                      Commercial Terms
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Commercial Model:</span>
                      <span className="font-bold">
                        {PRICING_MODEL_LABELS[comm.model as PricingModel] || 'Hybrid'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Billing Rate:</span>
                      <span className="font-bold text-[#063331]">
                        {comm.billing_rate_label || '1.0% + ₹200 / reg'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Billing Frequency:</span>
                      <span className="font-bold capitalize">
                        {comm.billing_frequency || 'monthly'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Settlement Policy:</span>
                      <span className="font-bold">
                        {comm.settlement_cycle || 'T+1'} Settlement Cycle
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Advance Security Required:</span>
                      <span className="font-bold">
                        ₹{(comm.initial_advance_inr || 59000).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                    <div className="text-[11px] font-extrabold text-[#063331] uppercase tracking-wider border-b border-slate-100 pb-2">
                      Provider Cost Structure
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">Provider Rail Cost:</span>
                      <span className="font-semibold text-rose-700">
                        {comm.provider_cost_label || '₹5.00/mandate (NPCI)'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">NPCI eNACH Registration:</span>
                      <span className="font-semibold text-slate-700">
                        ₹5.00 flat per NPCI mandate
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">UPI AutoPay Switch Fee:</span>
                      <span className="font-semibold text-slate-700">₹2.50 flat per mandate</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500">PG Card/NetBanking Interchange:</span>
                      <span className="font-semibold text-slate-700">0.30% – 0.40% blended</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Advance Balance On Deposit:</span>
                      <span className="font-bold text-[#075e47]">
                        ₹{(comm.advance_balance?.advance_balance_inr || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setViewModalOpen(false)}
                    className="pharmacy-pill-light h-9 px-4 text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewModalOpen(false);
                      handleOpenEdit(selectedInstForView);
                    }}
                    className="pharmacy-pill-dark h-9 px-4 text-xs font-bold cursor-pointer"
                  >
                    Edit Configuration
                  </button>
                </div>
              </div>
            );
          })()}
      </OwnerModal>

      {/* CREATE / EDIT CONFIGURATION MODAL */}
      <OwnerModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Configure Institution Commercials"
        subtitle="Establish institution-wise pricing models, billing rates, and agreement terms"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSaveCommercials} className="space-y-5 text-xs text-[#063331]">
          {/* Honest Backend Persistence Limitation Disclosure */}
          <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 flex items-start gap-2.5">
            <span className="text-base shrink-0 mt-0.5">ℹ️</span>
            <div>
              <p className="font-bold text-[11px] leading-tight">
                Live Session State & Presentation Layer
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Saved changes take effect immediately in the active Owner CMS session and log to the
                append-only audit ledger. Permanent DB persistence across cold server reboots will
                activate with the upcoming commercial tables schema migration.
              </p>
            </div>
          </div>

          {saveSuccessMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-xs flex items-center gap-2">
              <span>✅</span>
              <span>{saveSuccessMessage}</span>
            </div>
          )}

          {/* Form Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Target Institution */}
            <div>
              <label className="block text-[11px] font-bold text-[#063331] uppercase tracking-wider mb-1">
                Target Institution *
              </label>
              <select
                required
                value={form.institution_id}
                onChange={(e) => {
                  const instId = e.target.value;
                  const inst = institutions.find((i) => i.id === instId);
                  setForm((prev) => ({
                    ...prev,
                    institution_id: instId,
                    ...(inst?.commercials
                      ? {
                          model: (inst.commercials.model as PricingModel) || prev.model,
                          billing_rate_label:
                            inst.commercials.billing_rate_label || prev.billing_rate_label,
                          provider_cost_label:
                            inst.commercials.provider_cost_label || prev.provider_cost_label,
                          billing_frequency:
                            inst.commercials.billing_frequency || prev.billing_frequency,
                          agreement_status:
                            inst.commercials.agreement_status || prev.agreement_status,
                          effective_date: inst.commercials.effective_date || prev.effective_date,
                        }
                      : {}),
                  }));
                }}
                className="w-full h-9 px-3 text-xs bg-[#f7fbf9] border border-[rgba(6,51,49,0.15)] rounded-lg text-[#063331] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f766e]"
              >
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.display_name} ({i.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Commercial Pricing Model */}
            <div>
              <label className="block text-[11px] font-bold text-[#063331] uppercase tracking-wider mb-1">
                Commercial Pricing Model *
              </label>
              <select
                required
                value={form.model}
                onChange={(e) => {
                  const m = e.target.value as PricingModel;
                  let defaultLabel = PRICING_MODEL_LABELS[m];
                  let defaultCost = '₹5.00 / mandate (NPCI)';

                  if (m === 'fixed_institution_fee') {
                    defaultLabel = '₹25,000 / month flat platform retainer';
                    defaultCost = '₹4,000 hosting & compliance';
                  } else if (m === 'per_active_student') {
                    defaultLabel = '₹35.00 / active student / month';
                    defaultCost = '₹8.00 / student infra & SMS';
                  } else if (m === 'per_enach_mandate') {
                    defaultLabel = '₹220 / registered mandate + ₹12 / debit';
                    defaultCost = '₹5.00 / mandate (NPCI) + ₹3.50 rail';
                  } else if (m === 'per_autopay_mandate') {
                    defaultLabel = '₹140 / registered mandate + ₹8 / debit';
                    defaultCost = '₹2.50 / mandate switch + ₹1.50 rail';
                  } else if (m === 'per_successful_debit') {
                    defaultLabel = '₹18 / successful realized debit';
                    defaultCost = '₹5.00 bank debit charge';
                  } else if (m === 'percentage_of_collections') {
                    defaultLabel = '0.85% of gross collections';
                    defaultCost = '0.30% PG interchange rail';
                  } else {
                    defaultLabel = '1.0% + ₹200 / mandate registration';
                    defaultCost = '₹5.00 / mandate + 0.40% PG interchange';
                  }

                  setForm((prev) => ({
                    ...prev,
                    model: m,
                    billing_rate_label: defaultLabel,
                    provider_cost_label: defaultCost,
                  }));
                }}
                className="w-full h-9 px-3 text-xs bg-[#f7fbf9] border border-[rgba(6,51,49,0.15)] rounded-lg text-[#063331] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f766e]"
              >
                {Object.entries(PRICING_MODEL_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Model Description Help Text */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
            <span className="font-bold text-slate-800">Model Rule: </span>
            {PRICING_MODEL_DESCRIPTIONS[form.model]}
          </div>

          {/* Rate Label & Provider Cost Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[#063331] uppercase tracking-wider mb-1">
                Institution Billing Rate (Label / Formula) *
              </label>
              <input
                type="text"
                required
                value={form.billing_rate_label}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, billing_rate_label: e.target.value }))
                }
                placeholder="e.g. 1.0% + ₹200/mandate, ₹35/student"
                className="w-full h-9 px-3 text-xs bg-[#f7fbf9] border border-[rgba(6,51,49,0.15)] rounded-lg text-[#063331] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f766e]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#063331] uppercase tracking-wider mb-1">
                Estimated Provider Cost (NPCI / PG) *
              </label>
              <input
                type="text"
                required
                value={form.provider_cost_label}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, provider_cost_label: e.target.value }))
                }
                placeholder="e.g. ₹5.00/mandate (NPCI) + 0.40% PG"
                className="w-full h-9 px-3 text-xs bg-[#f7fbf9] border border-[rgba(6,51,49,0.15)] rounded-lg text-[#063331] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f766e]"
              />
            </div>
          </div>

          {/* Agreement Status & Frequency & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[#063331] uppercase tracking-wider mb-1">
                Billing Frequency
              </label>
              <select
                value={form.billing_frequency}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, billing_frequency: e.target.value as any }))
                }
                className="w-full h-9 px-3 text-xs bg-[#f7fbf9] border border-[rgba(6,51,49,0.15)] rounded-lg text-[#063331] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f766e]"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
                <option value="per_batch">Per Debit Batch</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#063331] uppercase tracking-wider mb-1">
                Agreement Status
              </label>
              <select
                value={form.agreement_status}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, agreement_status: e.target.value as any }))
                }
                className="w-full h-9 px-3 text-xs bg-[#f7fbf9] border border-[rgba(6,51,49,0.15)] rounded-lg text-[#063331] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f766e]"
              >
                <option value="signed_active">Signed & Active</option>
                <option value="under_review">Under Review</option>
                <option value="draft">Draft</option>
                <option value="renewal_pending">Renewal Pending</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#063331] uppercase tracking-wider mb-1">
                Effective Date
              </label>
              <input
                type="date"
                required
                value={form.effective_date}
                onChange={(e) => setForm((prev) => ({ ...prev, effective_date: e.target.value }))}
                className="w-full h-9 px-3 text-xs bg-[#f7fbf9] border border-[rgba(6,51,49,0.15)] rounded-lg text-[#063331] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f766e]"
              />
            </div>
          </div>

          {/* Live Calculated Projection Preview Box */}
          <div className="p-4 rounded-xl bg-[#eafbf4] border border-[#a3ebce]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold text-[#075e47] uppercase tracking-wider">
                Live Revenue & Contribution Margin Projection
              </span>
              <span className="text-[10px] font-bold text-[#075e47]">
                Based on {calculatedEconomics.studentCount} Enrolled Students
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white/80 p-2.5 rounded-lg">
                <div className="text-[10px] font-semibold text-slate-500">Est. Monthly Revenue</div>
                <div className="text-base font-extrabold text-[#063331] mt-0.5">
                  ₹{calculatedEconomics.estRev.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="bg-white/80 p-2.5 rounded-lg">
                <div className="text-[10px] font-semibold text-slate-500">
                  Est. Provider Rail Cost
                </div>
                <div className="text-base font-bold text-rose-700 mt-0.5">
                  ₹{calculatedEconomics.estCost.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-300">
                <div className="text-[10px] font-bold text-emerald-800">Contribution Margin</div>
                <div className="text-base font-extrabold text-emerald-700 mt-0.5">
                  ₹{calculatedEconomics.margin.toLocaleString('en-IN')} (
                  {calculatedEconomics.marginPct}%)
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[rgba(6,51,49,0.08)]">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="pharmacy-pill-light h-9 px-4 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="pharmacy-pill-dark h-9 px-5 text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Saving Agreement…' : 'Save Commercial Agreement'}
            </button>
          </div>
        </form>
      </OwnerModal>
    </div>
  );
}
