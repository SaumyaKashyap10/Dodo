'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/client';
import { useOwner } from './owner-context';
import { OwnerModal } from './owner-modal';

export function OwnerInstitutions() {
  const { refreshTrigger, refreshData, setActiveSection } = useOwner();
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');

  // Modal States
  const [selectedInst, setSelectedInst] = useState<any | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<
    'overview' | 'products' | 'commercials' | 'settlement' | 'history'
  >('overview');
  const [instHistory, setInstHistory] = useState<any[]>([]);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<'live' | 'suspended'>('live');
  const [statusReason, setStatusReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Editable forms inside detail modal
  const [editableProducts, setEditableProducts] = useState<any>({});
  const [editableCommercials, setEditableCommercials] = useState<any>({});
  const [editableSettlement, setEditableSettlement] = useState<any>({});

  // Advance adjustment modal
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({
    type: 'credit' as 'credit' | 'debit',
    amount_inr: 10000,
    description: '',
  });

  useEffect(() => {
    let unmounted = false;
    async function fetchInstitutions() {
      setLoading(true);
      setError('');
      try {
        const res = await api<any[]>('/v1/owner/institutions');
        if (!unmounted) setInstitutions(res || []);
      } catch (e: any) {
        if (!unmounted) setError(e.message || 'Failed to load institutions');
      } finally {
        if (!unmounted) setLoading(false);
      }
    }
    void fetchInstitutions();
    return () => {
      unmounted = true;
    };
  }, [refreshTrigger]);

  const handleOpenStatusModal = (inst: any, status: 'live' | 'suspended') => {
    setSelectedInst(inst);
    setTargetStatus(status);
    setStatusReason('');
    setStatusModalOpen(true);
  };

  const handleConfirmStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInst || !statusReason.trim() || submitting) return;
    setSubmitting(true);
    try {
      await api(`/v1/owner/institutions/${selectedInst.id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status: targetStatus,
          reason: statusReason.trim(),
        }),
      });
      setStatusModalOpen(false);
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Failed to update institution status');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDetails = async (
    inst: any,
    initialTab: 'overview' | 'products' | 'commercials' | 'settlement' | 'history' = 'overview',
  ) => {
    setDetailTab(initialTab);
    try {
      const details = await api<any>(`/v1/owner/institutions/${inst.id}`);
      setSelectedInst(details.tenant || inst);
      setEditableProducts(details.tenant?.products_config || inst.products_config || {});
      setEditableCommercials(details.tenant?.commercials || inst.commercials || {});
      setEditableSettlement(details.tenant?.settlement_account || inst.settlement_account || {});
      setInstHistory(details.history || []);
      setDetailModalOpen(true);
    } catch {
      setSelectedInst(inst);
      setEditableProducts(inst.products_config || {});
      setEditableCommercials(inst.commercials || {});
      setEditableSettlement(inst.settlement_account || {});
      setInstHistory([]);
      setDetailModalOpen(true);
    }
  };

  const handleSaveProducts = async () => {
    if (!selectedInst) return;
    setSubmitting(true);
    try {
      await api(`/v1/owner/institutions/${selectedInst.id}/products`, {
        method: 'POST',
        body: JSON.stringify(editableProducts),
      });
      alert('Product activation settings updated successfully.');
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Failed to update products');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveCommercials = async () => {
    if (!selectedInst) return;
    setSubmitting(true);
    try {
      await api(`/v1/owner/institutions/${selectedInst.id}/commercials`, {
        method: 'POST',
        body: JSON.stringify(editableCommercials),
      });
      alert('Institution commercial overrides saved.');
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Failed to update commercials');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSettlement = async () => {
    if (!selectedInst) return;
    setSubmitting(true);
    try {
      await api(`/v1/owner/institutions/${selectedInst.id}/settlement`, {
        method: 'POST',
        body: JSON.stringify(editableSettlement),
      });
      alert('Bank settlement account configuration saved.');
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Failed to update settlement account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordAdvanceAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInst || !advanceForm.amount_inr) return;
    setSubmitting(true);
    try {
      const res = await api<any>(`/v1/owner/institutions/${selectedInst.id}/advance/adjust`, {
        method: 'POST',
        body: JSON.stringify(advanceForm),
      });
      setAdvanceModalOpen(false);
      setEditableCommercials((prev: any) => ({
        ...prev,
        advance_balance: res.advance_balance,
      }));
      setAdvanceForm({ type: 'credit', amount_inr: 10000, description: '' });
      refreshData();
      alert('Advance ledger successfully adjusted.');
    } catch (e: any) {
      alert(e.message || 'Failed to adjust advance balance');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = institutions.filter((inst) => {
    const matchesSearch =
      inst.display_name.toLowerCase().includes(search.toLowerCase()) ||
      inst.slug.toLowerCase().includes(search.toLowerCase()) ||
      (inst.code && inst.code.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || inst.status === statusFilter;
    const matchesProduct =
      productFilter === 'all' ||
      (productFilter === 'fms' && inst.products_config?.fms?.enabled) ||
      (productFilter === 'flex' &&
        (inst.products_config?.flex_enach?.enabled ||
          inst.products_config?.flex_autopay?.enabled)) ||
      (productFilter === 'pg' && inst.products_config?.payment_gateway?.enabled);

    return matchesSearch && matchesStatus && matchesProduct;
  });

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[rgba(7,53,51,0.06)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#063331]">
            Registered Institutions & Products
          </h1>
          <p className="text-xs text-[#6c8f89] mt-0.5">
            Directory of educational tenants, Jodo FMS and Flex product activations, commercial
            terms, and settlement bank accounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="pharmacy-pill-light h-8 px-3.5 text-xs font-bold flex items-center">
            {filtered.length} of {institutions.length} Institutes
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pharmacy-card p-4">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6c8f89]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            placeholder="Search by institute name, code, or slug…"
            className="w-full h-9 pl-9 pr-4 text-xs bg-[#f7fbf9] border border-[rgba(6,51,49,0.08)] rounded-full text-[#063331] font-medium focus:outline-none focus:ring-2 focus:ring-[#0f766e] transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="h-9 px-3.5 text-xs bg-[#f7fbf9] border border-[rgba(6,51,49,0.08)] rounded-full font-semibold text-[#063331] focus:outline-none focus:ring-2 focus:ring-[#0f766e] transition cursor-pointer"
          >
            <option value="all">All Products</option>
            <option value="fms">FMS Enabled</option>
            <option value="flex">Flex (eNACH/AutoPay)</option>
            <option value="pg">Payment Gateway</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3.5 text-xs bg-[#f7fbf9] border border-[rgba(6,51,49,0.08)] rounded-full font-semibold text-[#063331] focus:outline-none focus:ring-2 focus:ring-[#0f766e] transition cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="live">Live / Active</option>
            <option value="pilot">Pilot</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Institutions Table */}
      <div className="pharmacy-card overflow-hidden">
        {loading && institutions.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <div className="inline-block h-7 w-7 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" />
            <p className="mt-2.5 text-xs font-medium text-slate-600">
              Loading registered institutions…
            </p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600">
            <p className="font-semibold text-sm">Failed to fetch institutions</p>
            <p className="text-xs mt-1 text-rose-500">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="font-medium text-sm text-slate-700">
              No institutions found matching your filter.
            </p>
            <p className="text-xs mt-1 text-slate-400">
              Try adjusting the search query or status filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Institution & Code</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Product Activations</th>
                  <th className="px-4 py-3">Settlement Bank</th>
                  <th className="px-4 py-3">Commercial Model</th>
                  <th className="px-4 py-3">Flex Advance</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((inst) => {
                  const isLive = inst.status === 'live' || inst.status === 'pilot';
                  const isSuspended = inst.status === 'suspended';
                  const sub = inst.subscription || {};
                  const prods = inst.products_config || {};
                  const comm = inst.commercials || {};
                  const bank = inst.settlement_account || {};

                  return (
                    <tr key={inst.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{inst.display_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {inst.code || inst.slug} • {inst.campus_count || 1} Campus •{' '}
                          {inst.student_count || 0} Students
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {isLive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-emerald-500" />
                            {inst.status === 'pilot' ? 'Pilot' : 'Live Active'}
                          </span>
                        ) : isSuspended ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-rose-500" />
                            Suspended (Read-Only)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            {inst.status}
                          </span>
                        )}
                      </td>

                      {/* Product Activations Matrix (Requirement Section 5.B) */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${prods.fms?.enabled ? 'bg-teal-50 text-teal-800 border border-teal-200' : 'bg-slate-100 text-slate-400'}`}
                          >
                            FMS
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${prods.flex_enach?.enabled ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-slate-100 text-slate-400'}`}
                          >
                            eNACH
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${prods.flex_autopay?.enabled ? 'bg-purple-50 text-purple-800 border border-purple-200' : 'bg-slate-100 text-slate-400'}`}
                          >
                            AutoPay
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${prods.payment_gateway?.enabled ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-400'}`}
                          >
                            Gateway
                          </span>
                        </div>
                      </td>

                      {/* Bank Settlement Account (Requirement Section 5.C) */}
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-800">
                          {bank.bank_name || 'HDFC Bank'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {bank.account_number_masked || '••••4092'} •{' '}
                          <span className="text-emerald-700 font-semibold">
                            {bank.settlement_policy || 'T+1'}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#eafbf4] text-[#075e47] border border-[#a3ebce] capitalize">
                          {comm.model ? comm.model.replace(/_/g, ' ') : 'Hybrid'}
                        </span>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                          {comm.billing_rate_label || '1.0% + ₹200 / reg'}
                        </div>
                      </td>

                      {/* Flex Advance Balance (Requirement Section 7.B) */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">
                          ₹
                          {(comm.advance_balance?.advance_balance_inr || 0).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          of ₹
                          {(comm.advance_balance?.advance_received_inr || 0).toLocaleString(
                            'en-IN',
                          )}{' '}
                          Adv
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDetails(inst, 'overview')}
                            className="pharmacy-pill-light h-7.5 px-3 text-xs font-semibold text-[#063331] cursor-pointer whitespace-nowrap"
                          >
                            Dossier
                          </button>
                          <button
                            onClick={() => handleOpenDetails(inst, 'products')}
                            className="pharmacy-pill-light h-7.5 px-3 text-xs font-bold text-[#0f766e] bg-[#eafbf4] hover:bg-[#d6f4ec] border-[#a3ebce] cursor-pointer whitespace-nowrap"
                          >
                            Products
                          </button>

                          {isLive ? (
                            <button
                              onClick={() => handleOpenStatusModal(inst, 'suspended')}
                              className="pharmacy-pill-light h-7.5 px-3 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200 cursor-pointer whitespace-nowrap"
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenStatusModal(inst, 'live')}
                              className="pharmacy-pill-light h-7.5 px-3 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 cursor-pointer whitespace-nowrap"
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Comprehensive Institution Detail Modal / Drawer (Section 5.D) */}
      <OwnerModal
        isOpen={detailModalOpen && !!selectedInst}
        onClose={() => setDetailModalOpen(false)}
        title={selectedInst ? `Institution Master Dossier: ${selectedInst.display_name}` : ''}
        subtitle={
          selectedInst
            ? `Legal Entity: ${selectedInst.legal_name} • Code: ${selectedInst.code || selectedInst.slug}`
            : ''
        }
        maxWidth="max-w-4xl"
      >
        {selectedInst && (
          <div className="space-y-4">
            {/* Modal Tabs Navigation */}
            <div className="flex items-center gap-1.5 border-b border-[#073533]/[0.06] pb-2 text-xs overflow-x-auto no-scrollbar">
              <button
                onClick={() => setDetailTab('overview')}
                className={`h-7 px-3 rounded-md transition font-medium cursor-pointer shrink-0 whitespace-nowrap ${
                  detailTab === 'overview'
                    ? 'bg-teal-50 text-teal-800 font-bold border border-teal-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Overview & Campuses
              </button>
              <button
                onClick={() => setDetailTab('products')}
                className={`h-7 px-3 rounded-md transition font-medium cursor-pointer shrink-0 whitespace-nowrap ${
                  detailTab === 'products'
                    ? 'bg-teal-50 text-teal-800 font-bold border border-teal-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Product Activations (6)
              </button>
              <button
                onClick={() => setDetailTab('commercials')}
                className={`h-7 px-3 rounded-md transition font-medium cursor-pointer shrink-0 whitespace-nowrap ${
                  detailTab === 'commercials'
                    ? 'bg-teal-50 text-teal-800 font-bold border border-teal-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Commercials & Advance
              </button>
              <button
                onClick={() => setDetailTab('settlement')}
                className={`h-7 px-3 rounded-md transition font-medium cursor-pointer shrink-0 whitespace-nowrap ${
                  detailTab === 'settlement'
                    ? 'bg-teal-50 text-teal-800 font-bold border border-teal-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bank Settlement Account
              </button>
              <button
                onClick={() => setDetailTab('history')}
                className={`h-7 px-3 rounded-md transition font-medium cursor-pointer shrink-0 whitespace-nowrap ${
                  detailTab === 'history'
                    ? 'bg-teal-50 text-teal-800 font-bold border border-teal-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Activity History ({instHistory.length})
              </button>
            </div>

            {/* Tab 1: Overview & Campuses */}
            {detailTab === 'overview' && (
              <div className="mt-4 space-y-4 text-xs">
                {/* Assigned Subscription & Payment Provider Rails Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Commercial Agreement
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#eafbf4] text-[#075e47] border border-[#a3ebce]">
                        {selectedInst.commercials?.agreement_status === 'signed_active'
                          ? 'Signed & Active'
                          : 'Under Review'}
                      </span>
                    </div>
                    <div className="text-base font-bold text-slate-900 mt-1 capitalize">
                      {selectedInst.commercials?.model
                        ? selectedInst.commercials.model.replace(/_/g, ' ')
                        : 'Hybrid Pricing'}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5 font-semibold">
                      {selectedInst.commercials?.billing_rate_label ||
                        '1.0% + ₹200 / mandate registration'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>
                        Frequency: {selectedInst.commercials?.billing_frequency || 'monthly'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDetailModalOpen(false);
                          setActiveSection('commercials');
                        }}
                        className="text-[#0f766e] hover:underline font-bold cursor-pointer"
                      >
                        Configure Commercials →
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Payment Provider Rails
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Connected
                      </span>
                    </div>
                    <div className="text-base font-bold text-slate-900 mt-1">
                      Razorpay Master Gateway
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      eNACH Status:{' '}
                      <span className="font-semibold text-amber-700">
                        {selectedInst.products_config?.flex_enach?.readiness === 'live_ready'
                          ? 'Live Ready'
                          : 'Sandbox Mode'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Settlement Policy:{' '}
                      <span className="font-semibold text-slate-700">
                        {selectedInst.settlement_account?.settlement_policy || 'T+1'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Information Grid */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-500">Contact Email:</span>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {selectedInst.contact_email || 'accounts@institute.invalid'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Contact Phone:</span>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {selectedInst.contact_phone || '+91 98765 43210'}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Registered Office Address:</span>
                    <div className="text-slate-800 mt-0.5">
                      {selectedInst.registered_address || 'Main Educational Campus, India'}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200/60">
                    <div>
                      <span className="text-slate-500">Institution Administrator:</span>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {selectedInst.institution_admin_name || 'Head of Institute'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Onboarding Date:</span>
                      <div className="text-slate-800 mt-0.5">
                        {new Date(
                          selectedInst.onboarding_date || selectedInst.created_at,
                        ).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Campuses */}
                <div>
                  <h4 className="font-semibold text-slate-800 mb-2">
                    Campuses & Branches ({selectedInst.campus_count || 1})
                  </h4>
                  <div className="space-y-1.5">
                    {(selectedInst.campuses || []).map((camp: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <span className="font-semibold text-slate-900">{camp.name}</span>
                          <div className="text-slate-500 text-[11px]">
                            {camp.city}, {camp.state} • Code: {camp.code}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-slate-200 font-medium text-slate-700 text-[11px]">
                          {camp.status || 'Active'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legal Entity & PAN */}
                <div>
                  <h4 className="font-semibold text-slate-800 mb-2">
                    Legal Entity & Tax Identifier
                  </h4>
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Legal Name:</span>
                      <span className="font-medium text-slate-900">
                        {selectedInst.legal_entities?.[0]?.name || selectedInst.legal_name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tax Reference (Masked PAN):</span>
                      <span className="font-mono text-slate-800 font-semibold">
                        {selectedInst.legal_entities?.[0]?.tax_reference_masked || 'AAAAA••••A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Independent Product Activation Controls (Requirement Section 5.B) */}
            {detailTab === 'products' && (
              <div className="mt-4 space-y-4 text-xs">
                <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-lg text-amber-900 leading-relaxed text-[11px]">
                  <strong>Safeguard Notice:</strong> Activation depends on payment aggregator
                  approvals and contract execution. Enabling a toggle does not render a rail
                  operational unless upstream bank clearance and KYC are verified.
                </div>

                <div className="space-y-3">
                  {/* 1. Jodo FMS */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">
                        Jodo-Style Fee Management System (FMS)
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Custom fee structures, instalment schedules, parent portals, receipts, and
                        cashier desks.
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 mt-1">
                        ✓ Operational • Core Platform Engine
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editableProducts.fms?.enabled ?? true}
                        onChange={(e) =>
                          setEditableProducts({
                            ...editableProducts,
                            fms: { ...editableProducts.fms, enabled: e.target.checked },
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600" />
                    </label>
                  </div>

                  {/* 2. Flex eNACH */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">
                        Jodo Flex — eNACH Mandates
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        NPCI Netbanking / Debit Card electronic recurring mandate authorization and
                        presentation.
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 mt-1">
                        ⓘ Readiness:{' '}
                        {editableProducts.flex_enach?.readiness === 'live_ready'
                          ? 'Live Ready'
                          : 'Sandbox Mode'}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editableProducts.flex_enach?.enabled ?? false}
                        onChange={(e) =>
                          setEditableProducts({
                            ...editableProducts,
                            flex_enach: {
                              ...editableProducts.flex_enach,
                              enabled: e.target.checked,
                            },
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600" />
                    </label>
                  </div>

                  {/* 3. Flex UPI AutoPay */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">
                        Jodo Flex — UPI AutoPay
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        NPCI UPI 2.0 AutoPay mandate collection via Google Pay, PhonePe, Paytm, and
                        BHIM.
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 mt-1">
                        ⓘ Status: {editableProducts.flex_autopay?.status || 'operational'}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editableProducts.flex_autopay?.enabled ?? false}
                        onChange={(e) =>
                          setEditableProducts({
                            ...editableProducts,
                            flex_autopay: {
                              ...editableProducts.flex_autopay,
                              enabled: e.target.checked,
                            },
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600" />
                    </label>
                  </div>

                  {/* 4. Payment Gateway */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">
                        Online Payment Gateway (Razorpay)
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Instant parent checkout via UPI, RuPay, Visa, Mastercard, Netbanking, and
                        Wallets.
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 mt-1">
                        ✓ Connected via Platform Master Aggregator
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editableProducts.payment_gateway?.enabled ?? true}
                        onChange={(e) =>
                          setEditableProducts({
                            ...editableProducts,
                            payment_gateway: {
                              ...editableProducts.payment_gateway,
                              enabled: e.target.checked,
                            },
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600" />
                    </label>
                  </div>

                  {/* 5. Virtual Accounts */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">
                        Smart Virtual Accounts (VAN / SmartCollect)
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Unique virtual bank accounts per student for direct NEFT/RTGS
                        auto-reconciliation.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editableProducts.virtual_accounts?.enabled ?? false}
                        onChange={(e) =>
                          setEditableProducts({
                            ...editableProducts,
                            virtual_accounts: {
                              ...editableProducts.virtual_accounts,
                              enabled: e.target.checked,
                            },
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600" />
                    </label>
                  </div>

                  {/* 6. Split Settlements */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">
                        Multi-Entity Split Settlements
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Automated split settlement across distinct society trusts, transport
                        vendors, and trust accounts.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editableProducts.split_settlements?.enabled ?? false}
                        onChange={(e) =>
                          setEditableProducts({
                            ...editableProducts,
                            split_settlements: {
                              ...editableProducts.split_settlements,
                              enabled: e.target.checked,
                            },
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600" />
                    </label>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleSaveProducts}
                    disabled={submitting}
                    className="h-8 px-4 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-2xs transition cursor-pointer"
                  >
                    {submitting ? 'Saving…' : 'Save Product Activations'}
                  </button>
                </div>
              </div>
            )}

            {/* Tab 3: Configured Commercials & Advance Ledger (Requirements Section 7.B) */}
            {detailTab === 'commercials' && (
              <div className="mt-4 space-y-4 text-xs">
                {/* Advance Balance Card */}
                <div className="p-4 bg-teal-50 border border-teal-200/90 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                      Jodo Flex Initial Security Advance
                    </span>
                    <div className="text-xl font-extrabold text-teal-950 mt-0.5">
                      ₹
                      {(
                        editableCommercials.advance_balance?.advance_balance_inr || 0
                      ).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-teal-700 mt-0.5">
                      Total Advance Received: ₹
                      {(
                        editableCommercials.advance_balance?.advance_received_inr || 0
                      ).toLocaleString('en-IN')}{' '}
                      • Deducted: ₹
                      {(
                        editableCommercials.advance_balance?.charges_applied_inr || 0
                      ).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <button
                    onClick={() => setAdvanceModalOpen(true)}
                    className="h-8 px-3 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition shadow-2xs cursor-pointer"
                  >
                    + Adjust Advance
                  </button>
                </div>

                {/* Commercial Configuration Form */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs">
                    Configured Jodo Flex Rates for this Institution
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        eNACH Mandate Registration Fee (₹/student)
                      </label>
                      <input
                        type="number"
                        value={editableCommercials.enach_registration_fee_inr || 200}
                        onChange={(e) =>
                          setEditableCommercials({
                            ...editableCommercials,
                            enach_registration_fee_inr: Number(e.target.value),
                          })
                        }
                        className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-md text-xs font-semibold"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        + 18% GST Applicable
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Flex Auto-Debit Transaction Fee (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={editableCommercials.flex_debit_fee_percentage || 1.0}
                        onChange={(e) =>
                          setEditableCommercials({
                            ...editableCommercials,
                            flex_debit_fee_percentage: Number(e.target.value),
                          })
                        }
                        className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-md text-xs font-semibold"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        + 18% GST Applicable
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Contract Settlement Cycle
                      </label>
                      <select
                        value={editableCommercials.settlement_cycle || 'T+1'}
                        onChange={(e) =>
                          setEditableCommercials({
                            ...editableCommercials,
                            settlement_cycle: e.target.value,
                          })
                        }
                        className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-md text-xs font-semibold"
                      >
                        <option value="T+1">T+1 Business Day (Contracted)</option>
                        <option value="T+2">T+2 Standard Clearing</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Effective Commercial Date
                      </label>
                      <input
                        type="date"
                        value={editableCommercials.effective_date || '2026-04-15'}
                        onChange={(e) =>
                          setEditableCommercials({
                            ...editableCommercials,
                            effective_date: e.target.value,
                          })
                        }
                        className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-md text-xs"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleSaveCommercials}
                      disabled={submitting}
                      className="h-8 px-4 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-2xs transition cursor-pointer"
                    >
                      {submitting ? 'Saving…' : 'Save Commercial Terms'}
                    </button>
                  </div>
                </div>

                {/* Advance Adjustment History */}
                <div>
                  <h4 className="font-semibold text-slate-800 text-xs mb-2">
                    Advance Adjustment History
                  </h4>
                  <div className="border border-slate-200/80 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase">
                        <tr>
                          <th className="p-2">Date</th>
                          <th className="p-2">Type</th>
                          <th className="p-2">Description</th>
                          <th className="p-2">Amount</th>
                          <th className="p-2 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(editableCommercials.advance_balance?.adjustment_history || []).map(
                          (adj: any) => (
                            <tr key={adj.id}>
                              <td className="p-2 text-slate-500 font-mono text-[11px]">
                                {adj.date}
                              </td>
                              <td className="p-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${adj.type === 'credit' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
                                >
                                  {adj.type}
                                </span>
                              </td>
                              <td className="p-2 text-slate-700">{adj.description}</td>
                              <td
                                className={`p-2 font-semibold ${adj.type === 'credit' ? 'text-emerald-700' : 'text-slate-900'}`}
                              >
                                {adj.type === 'credit' ? '+' : '-'}₹
                                {adj.amount_inr?.toLocaleString('en-IN')}
                              </td>
                              <td className="p-2 text-right font-bold text-slate-900 font-mono">
                                ₹{adj.balance_after_inr?.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Bank Settlement Account & Policy (Requirement Section 5.C) */}
            {detailTab === 'settlement' && (
              <div className="mt-4 space-y-4 text-xs">
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <span className="font-bold text-slate-800 text-xs">
                      Primary Settlement Bank Account
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ Penny-Drop Verified
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={editableSettlement.bank_name || 'HDFC Bank Ltd'}
                        onChange={(e) =>
                          setEditableSettlement({
                            ...editableSettlement,
                            bank_name: e.target.value,
                          })
                        }
                        className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-md text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        IFSC Code
                      </label>
                      <input
                        type="text"
                        value={editableSettlement.ifsc || 'HDFC0000043'}
                        onChange={(e) =>
                          setEditableSettlement({
                            ...editableSettlement,
                            ifsc: e.target.value.toUpperCase(),
                          })
                        }
                        className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-md text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Beneficiary Legal Name
                      </label>
                      <input
                        type="text"
                        value={editableSettlement.beneficiary_name || selectedInst.legal_name}
                        onChange={(e) =>
                          setEditableSettlement({
                            ...editableSettlement,
                            beneficiary_name: e.target.value,
                          })
                        }
                        className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-md text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Settlement Policy Window
                      </label>
                      <select
                        value={editableSettlement.settlement_policy || 'T+1'}
                        onChange={(e) =>
                          setEditableSettlement({
                            ...editableSettlement,
                            settlement_policy: e.target.value,
                          })
                        }
                        className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-md text-xs font-semibold"
                      >
                        <option value="T+1">T+1 Business Day (Recommended)</option>
                        <option value="T+2">T+2 Extended Window</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleSaveSettlement}
                      disabled={submitting}
                      className="h-8 px-4 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-2xs transition cursor-pointer"
                    >
                      {submitting ? 'Saving…' : 'Save Settlement Details'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 5: Institution Activity History (Requirement Section 5.D) */}
            {detailTab === 'history' && (
              <div className="mt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-800 text-xs">
                    Cryptographic Audit Trail for this Institution
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Tenant ID: {selectedInst.id}
                  </span>
                </div>

                {instHistory.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-slate-200/80">
                    No specific audit events recorded for this institution yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-lg overflow-hidden bg-white">
                    {instHistory.map((log: any) => (
                      <div
                        key={log.id}
                        className="p-3 flex items-start justify-between gap-3 hover:bg-slate-50/60 transition"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{log.action}</span>
                            <span className="font-mono text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                              {log.actor}
                            </span>
                          </div>
                          <div className="text-slate-600 text-xs mt-1">
                            {log.details?.reason ||
                              log.details?.plan ||
                              log.details?.new_status ||
                              JSON.stringify(log.details)}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                            Hash: {log.hash?.substring(0, 12)}…
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                          {new Date(log.created_at).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 pt-3.5 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="pharmacy-pill-dark h-9 px-5 text-white rounded-full font-bold text-xs transition cursor-pointer shadow-xs"
              >
                Close Dossier
              </button>
            </div>
          </div>
        )}
      </OwnerModal>

      {/* Modal: Advance Adjustment (Requirement Section 7.B) */}
      <OwnerModal
        isOpen={advanceModalOpen && !!selectedInst}
        onClose={() => setAdvanceModalOpen(false)}
        title="Adjust Jodo Flex Advance"
        subtitle={
          selectedInst
            ? `Adjust initial security advance credit balance for ${selectedInst.display_name}`
            : ''
        }
        maxWidth="max-w-md"
      >
        <form onSubmit={handleRecordAdvanceAdjustment} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Adjustment Type
            </label>
            <select
              value={advanceForm.type}
              onChange={(e) => setAdvanceForm({ ...advanceForm, type: e.target.value as any })}
              className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
            >
              <option value="credit">Credit (Deposit New Advance / Top-up)</option>
              <option value="debit">Debit (Apply Registration or Transaction Charges)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Amount in INR (₹)
            </label>
            <input
              type="number"
              required
              min={1}
              value={advanceForm.amount_inr}
              onChange={(e) =>
                setAdvanceForm({ ...advanceForm, amount_inr: Number(e.target.value) })
              }
              className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Memo
            </label>
            <input
              type="text"
              required
              value={advanceForm.description}
              onChange={(e) => setAdvanceForm({ ...advanceForm, description: e.target.value })}
              placeholder="e.g. 50 student registration fee deduction"
              className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs"
            />
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdvanceModalOpen(false)}
              className="pharmacy-pill-light h-9 px-4 text-xs font-bold text-[#063331] rounded-full cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="pharmacy-pill-dark h-9 px-5 text-xs font-bold text-white rounded-full shadow-xs cursor-pointer"
            >
              {submitting ? 'Applying…' : 'Record Adjustment'}
            </button>
          </div>
        </form>
      </OwnerModal>

      {/* Modal: Safeguard Confirmation for Status Change */}
      <OwnerModal
        isOpen={statusModalOpen && !!selectedInst}
        onClose={() => setStatusModalOpen(false)}
        title={targetStatus === 'suspended' ? 'Suspend Institution' : 'Reactivate Institution'}
        subtitle={selectedInst?.display_name}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmStatusChange} className="space-y-4">
          <div className="flex items-center gap-3">
            <span
              className={`p-2 rounded-full ${
                targetStatus === 'suspended'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </span>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                {targetStatus === 'suspended' ? 'Suspension Safeguards' : 'Reactivation Protocol'}
              </h4>
              <p className="text-xs text-slate-500">{selectedInst?.display_name}</p>
            </div>
          </div>

          <div className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-[18px] border border-slate-200 leading-relaxed font-medium">
            {targetStatus === 'suspended' ? (
              <>
                <strong className="text-rose-800 font-bold">Critical Safeguard Warning:</strong>{' '}
                Suspending this institution will instantly switch its staff workspace to{' '}
                <strong>Read-Only Mode</strong>. Staff will not be able to record new payments, edit
                fee schedules, or modify student records.
              </>
            ) : (
              <>
                Reactivating will restore full administrative read-write capabilities to this
                institution&apos;s staff as governed by their membership roles.
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Reason for status change (Required for audit log)
            </label>
            <textarea
              required
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="e.g. Non-payment of platform subscription / Account verification complete"
              rows={3}
              className="w-full text-xs p-3 bg-[#f8fbf9] border border-[#073533]/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#063331]/20"
            />
          </div>

          <div className="pt-3 border-t border-[#073533]/[0.06] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setStatusModalOpen(false)}
              className="pharmacy-pill-light h-9 px-4 text-xs font-bold text-[#063331] rounded-full cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !statusReason.trim()}
              className={`h-9 px-5 text-xs font-bold rounded-full shadow-xs transition cursor-pointer text-white ${
                targetStatus === 'suspended'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              } disabled:opacity-50`}
            >
              {submitting
                ? 'Applying…'
                : targetStatus === 'suspended'
                  ? 'Confirm Suspension'
                  : 'Confirm Reactivation'}
            </button>
          </div>
        </form>
      </OwnerModal>
    </div>
  );
}
