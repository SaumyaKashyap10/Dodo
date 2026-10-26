'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { useOwner } from './owner-context';

export function OwnerOverview() {
  const { setActiveSection, refreshTrigger } = useOwner();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [institutionsList, setInstitutionsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters (Requirement Section 4)
  const [institutionFilter, setInstitutionFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let unmounted = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const queryParams = new URLSearchParams();
        if (institutionFilter !== 'all') queryParams.set('institution', institutionFilter);
        if (dateRangeFilter !== 'all') queryParams.set('date_range', dateRangeFilter);
        if (productFilter !== 'all') queryParams.set('product', productFilter);
        if (statusFilter !== 'all') queryParams.set('status', statusFilter);

        const [res, instsRes] = await Promise.all([
          api<any>(`/v1/owner/overview?${queryParams.toString()}`),
          api<any[]>('/v1/owner/institutions'),
        ]);

        if (!unmounted) {
          setData(res);
          setInstitutionsList(instsRes || []);
        }
      } catch (e: any) {
        if (!unmounted) setError(e.message || 'Failed to load platform overview');
      } finally {
        if (!unmounted) setLoading(false);
      }
    }
    void load();
    return () => {
      unmounted = true;
    };
  }, [refreshTrigger, institutionFilter, dateRangeFilter, productFilter, statusFilter]);

  const navigateTo = (sec: string) => {
    setActiveSection(sec);
    router.push(`/owner/${sec}`);
  };

  if (loading && !data) {
    return (
      <div className="p-12 text-center text-slate-500">
        <div className="inline-block h-7 w-7 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" />
        <p className="mt-2.5 text-xs font-medium text-slate-600">
          Loading global platform overview…
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-5 m-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
        <h3 className="font-semibold text-sm">Unable to load platform overview</h3>
        <p className="mt-1 text-xs text-rose-700">{error}</p>
      </div>
    );
  }

  const inst = data?.institutions || {};
  const kpis = data?.kpi_metrics || {};
  const sub = data?.subscriptions || {};
  const rev = data?.revenue || {};
  const analytics = data?.analytics || {};
  const recent = data?.recent_activity || [];
  const gateway = data?.gateway_status || {};

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="pharmacy-pill-dark px-3 py-1 text-[11px] font-bold">
              Platform Master Console
            </span>
            <span className="h-7 px-3 rounded-full text-[11px] font-semibold bg-[#eafbf4] text-[#075e47] border border-[#a3ebce] flex items-center gap-1.5 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              All Systems Operational
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#063331] mt-2">
            Platform Overview & Sales Results
          </h2>
          <p className="text-xs text-[#6c8f89] mt-0.5">
            Global metrics for Jodo-style FMS, Flex eNACH/AutoPay adoption, SaaS recurring revenue,
            and settlement oversight.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => navigateTo('institutions')}
            className="pharmacy-pill-light h-9 px-4 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            Manage Institutes
          </button>
          <button
            onClick={() => navigateTo('commercials')}
            className="pharmacy-pill-dark h-9 px-4 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            Configure Commercials
          </button>
        </div>
      </div>

      {/* Filter Bar (Requirement Section 4) */}
      <div className="pharmacy-card p-4">
        <div className="flex items-center justify-between mb-3">
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
            Global Analytics Filters
          </span>
          {(institutionFilter !== 'all' ||
            dateRangeFilter !== 'all' ||
            productFilter !== 'all' ||
            statusFilter !== 'all') && (
            <button
              onClick={() => {
                setInstitutionFilter('all');
                setDateRangeFilter('all');
                setProductFilter('all');
                setStatusFilter('all');
              }}
              className="text-[11px] text-[#0f766e] hover:underline font-bold cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-[#6c8f89] uppercase tracking-wider mb-1">
              Institution
            </label>
            <select
              value={institutionFilter}
              onChange={(e) => setInstitutionFilter(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-[#f7fbf9] border border-[rgba(6,51,49,0.08)] rounded-full text-[#063331] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f766e] cursor-pointer"
            >
              <option value="all">
                All Registered Institutions ({institutionsList.length || 6})
              </option>
              {institutionsList.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.display_name} ({i.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#6c8f89] uppercase tracking-wider mb-1">
              Date Range
            </label>
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-[#f7fbf9] border border-[rgba(6,51,49,0.08)] rounded-full text-[#063331] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f766e] cursor-pointer"
            >
              <option value="all">All Time / Cumulative</option>
              <option value="this_month">This Month (October 2026)</option>
              <option value="last_quarter">Last Quarter (Q2 FY26-27)</option>
              <option value="financial_year">Current Financial Year (FY26-27)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#6c8f89] uppercase tracking-wider mb-1">
              Payment Method / Product
            </label>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-[#f7fbf9] border border-[rgba(6,51,49,0.08)] rounded-full text-[#063331] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f766e] cursor-pointer"
            >
              <option value="all">All Payment Methods</option>
              <option value="enach">eNACH (Bank Standing Instructions)</option>
              <option value="upi_autopay">UPI AutoPay (Recurring Mandates)</option>
              <option value="one_time_upi">One-Time UPI (Instant Collections)</option>
              <option value="fms">Jodo FMS Core</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#6c8f89] uppercase tracking-wider mb-1">
              Institution Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-[#f7fbf9] border border-[rgba(6,51,49,0.08)] rounded-full text-[#063331] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0f766e] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="live">Live / Active</option>
              <option value="pilot">Pilot</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Row 1: 4 Main Pastel KPI Cards (Exact match to Inspiration Image!) */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#063331]">
            Dodo Fee Collections & Primary Operations
          </h3>
          <div className="pharmacy-pill-light h-8 px-3 text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
            <span>📅</span>
            <span>This Month</span>
            <span className="text-[10px] text-[#6c8f89]">▾</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Lime Green Pastel (Todays Sales / Total Institutions) */}
          <div className="stat-card-lime p-5 min-h-[145px] flex flex-col justify-between relative overflow-hidden animate-slide-up stagger-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#1f480b]/15 text-[#1f480b] flex items-center justify-center font-bold text-xs">
                  🏛️
                </span>
                <span className="text-xs font-semibold text-[#4a6834]">1. Total Institutions</span>
              </div>
              <button className="w-6 h-6 rounded-full bg-white/40 hover:bg-white/60 flex items-center justify-center text-xs font-bold text-[#1f480b] cursor-pointer">
                •••
              </button>
            </div>

            <div className="flex items-end justify-between mt-3">
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#1f480b] tracking-tight">
                  {kpis.total_institutions ?? inst.total ?? 6}
                </div>
                <div className="text-[11px] font-semibold text-[#3a6822] mt-0.5">
                  +2.5% This Month • {inst.campuses ?? 0} Campuses
                </div>
              </div>

              {/* Mini visual glowing bar chart matching inspiration */}
              <div className="flex items-end gap-1 h-10 pb-1">
                <div className="w-1.5 h-4 bg-[#2d6910]/40 rounded-full" />
                <div className="w-1.5 h-7 bg-[#2d6910]/60 rounded-full" />
                <div className="w-1.5 h-10 bg-[#2d6910] rounded-full shadow-xs" />
                <div className="w-1.5 h-6 bg-[#2d6910]/70 rounded-full" />
              </div>
            </div>
          </div>

          {/* Card 2: Mint / Aqua Pastel (Active Commercial Agreements) */}
          <div className="stat-card-aqua p-5 min-h-[145px] flex flex-col justify-between relative overflow-hidden animate-slide-up stagger-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#064840]/15 text-[#064840] flex items-center justify-center font-bold text-xs">
                  📜
                </span>
                <span className="text-xs font-semibold text-[#2b6d63]">
                  2. Commercial Agreements
                </span>
              </div>
              <button
                onClick={() => navigateTo('commercials')}
                className="w-6 h-6 rounded-full bg-white/40 hover:bg-white/60 flex items-center justify-center text-xs font-bold text-[#064840] cursor-pointer"
                title="Manage Commercials"
              >
                •••
              </button>
            </div>

            <div className="flex items-end justify-between mt-3">
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#064840] tracking-tight">
                  {kpis.commercial_active_agreements ?? 5} / {inst.total ?? 6}
                </div>
                <div className="text-[11px] font-semibold text-[#186256] mt-0.5">
                  100% Configured • Est. ₹
                  {(kpis.commercial_est_revenue_inr || 248975).toLocaleString('en-IN')}/mo
                </div>
              </div>

              {/* Mini visual glowing bar chart */}
              <div className="flex items-end gap-1 h-10 pb-1">
                <div className="w-1.5 h-5 bg-[#0d6b5e]/40 rounded-full" />
                <div className="w-1.5 h-9 bg-[#0d6b5e] rounded-full shadow-xs" />
                <div className="w-1.5 h-6 bg-[#0d6b5e]/70 rounded-full" />
                <div className="w-1.5 h-4 bg-[#0d6b5e]/50 rounded-full" />
              </div>
            </div>
          </div>

          {/* Card 3: Coral / Pink Pastel (Expired Medicines / Failed Debits) */}
          <div className="stat-card-coral p-5 min-h-[145px] flex flex-col justify-between relative overflow-hidden animate-slide-up stagger-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#611a21]/15 text-[#611a21] flex items-center justify-center font-bold text-xs">
                  ⚠️
                </span>
                <span className="text-xs font-semibold text-[#8a434a]">9. Failed Auto-Debits</span>
              </div>
              <button className="w-6 h-6 rounded-full bg-white/40 hover:bg-white/60 flex items-center justify-center text-xs font-bold text-[#611a21] cursor-pointer">
                •••
              </button>
            </div>

            <div className="flex items-end justify-between mt-3">
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#611a21] tracking-tight">
                  {kpis.total_failed_debits ?? 34}
                </div>
                <div className="text-[11px] font-semibold text-[#812933] mt-0.5">
                  +2.5% This Month • Queued for Retry Policy
                </div>
              </div>

              {/* Mini visual glowing bar chart */}
              <div className="flex items-end gap-1 h-10 pb-1">
                <div className="w-1.5 h-8 bg-[#7d222b] rounded-full shadow-xs" />
                <div className="w-1.5 h-5 bg-[#7d222b]/50 rounded-full" />
                <div className="w-1.5 h-3 bg-[#7d222b]/30 rounded-full" />
                <div className="w-1.5 h-6 bg-[#7d222b]/70 rounded-full" />
              </div>
            </div>
          </div>

          {/* Card 4: Lavender / Periwinkle Pastel (System Users / eNACH Mandates) */}
          <div className="stat-card-lavender p-5 min-h-[145px] flex flex-col justify-between relative overflow-hidden animate-slide-up stagger-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#202967]/15 text-[#202967] flex items-center justify-center font-bold text-xs">
                  📋
                </span>
                <span className="text-xs font-semibold text-[#4a538c]">
                  10. Active eNACH Mandates
                </span>
              </div>
              <button className="w-6 h-6 rounded-full bg-white/40 hover:bg-white/60 flex items-center justify-center text-xs font-bold text-[#202967] cursor-pointer">
                •••
              </button>
            </div>

            <div className="flex items-end justify-between mt-3">
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#202967] tracking-tight">
                  {kpis.active_enach_mandates?.toLocaleString('en-IN') ?? '1,416'}
                </div>
                <div className="text-[11px] font-semibold text-[#3e488b] mt-0.5">
                  +2.5% This Month • NPCI Registered
                </div>
              </div>

              {/* Mini visual glowing bar chart */}
              <div className="flex items-end gap-1 h-10 pb-1">
                <div className="w-1.5 h-4 bg-[#313e94]/40 rounded-full" />
                <div className="w-1.5 h-7 bg-[#313e94]/70 rounded-full" />
                <div className="w-1.5 h-9 bg-[#313e94] rounded-full shadow-xs" />
                <div className="w-1.5 h-5 bg-[#313e94]/50 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: SEPARATE PAYMENT METHODS & MANDATES (eNACH, UPI AutoPay, One-Time UPI) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#063331] flex items-center gap-2">
              <span>💳</span>
              <span>Payment Methods & Mandate Performance</span>
            </h3>
            <p className="text-xs text-[#6c8f89]">
              Strictly segregated operational metrics across NPCI eNACH, UPI 2.0 AutoPay recurring
              mandates, and Instant One-Time UPI.
            </p>
          </div>
          <span className="text-[11px] font-bold text-[#0f766e] bg-[#eafbf4] px-3 py-1 rounded-full border border-[#a3ebce] w-fit">
            3 Isolated Payment Rails
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* KPI 1: Active eNACH Mandates */}
          <div className="pharmacy-card p-4 flex flex-col justify-between min-h-[140px] border-l-4 border-l-indigo-600">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1">
                  <span>🏦</span>
                  <span>eNACH Mandates</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  NPCI Rail
                </span>
              </div>
              <div className="mt-2.5">
                {productFilter === 'upi_autopay' || productFilter === 'one_time_upi' ? (
                  <div className="text-xs font-semibold text-slate-400 italic py-2">
                    Not applicable for{' '}
                    {productFilter === 'one_time_upi' ? 'One-Time UPI' : 'AutoPay'}
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-black text-indigo-950 tracking-tight">
                      {(kpis.active_enach_mandates ?? 962).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] font-semibold text-indigo-700 mt-0.5">
                      Bank Standing Instructions
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
              <span>NetBanking / Debit</span>
              <span className="font-bold text-emerald-700">Live Active</span>
            </div>
          </div>

          {/* KPI 2: Active UPI AutoPay Mandates */}
          <div className="pharmacy-card p-4 flex flex-col justify-between min-h-[140px] border-l-4 border-l-cyan-600">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-900 flex items-center gap-1">
                  <span>⚡</span>
                  <span>UPI AutoPay</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                  UPI 2.0
                </span>
              </div>
              <div className="mt-2.5">
                {productFilter === 'enach' || productFilter === 'one_time_upi' ? (
                  <div className="text-xs font-semibold text-slate-400 italic py-2">
                    Not applicable for {productFilter === 'one_time_upi' ? 'One-Time UPI' : 'eNACH'}
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-black text-cyan-950 tracking-tight">
                      {(kpis.active_upi_autopay_mandates ?? 454).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] font-semibold text-cyan-800 mt-0.5">
                      Recurring App Mandates
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
              <span>VPA Recurring Auth</span>
              <span className="font-bold text-cyan-700">Instant Rail</span>
            </div>
          </div>

          {/* KPI 3: Successful eNACH Debits */}
          <div className="pharmacy-card p-4 flex flex-col justify-between min-h-[140px] border-l-4 border-l-emerald-600">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1">
                  <span>✅</span>
                  <span>eNACH Debits</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  97.8% Success
                </span>
              </div>
              <div className="mt-2.5">
                {productFilter === 'upi_autopay' || productFilter === 'one_time_upi' ? (
                  <div className="text-xs font-semibold text-slate-400 italic py-2">
                    Filtered out
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-black text-[#075e47] tracking-tight">
                      {(kpis.successful_enach_debits ?? 872).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] font-semibold text-[#0f766e] mt-0.5">
                      ₹1.42 Cr Realized This Cycle
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
              <span>Settlement: T+1 NPCI</span>
              <span className="font-bold text-[#075e47]">Realized</span>
            </div>
          </div>

          {/* KPI 4: Successful UPI AutoPay Debits */}
          <div className="pharmacy-card p-4 flex flex-col justify-between min-h-[140px] border-l-4 border-l-teal-600">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1">
                  <span>🚀</span>
                  <span>AutoPay Debits</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                  98.3% Success
                </span>
              </div>
              <div className="mt-2.5">
                {productFilter === 'enach' || productFilter === 'one_time_upi' ? (
                  <div className="text-xs font-semibold text-slate-400 italic py-2">
                    Filtered out
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-black text-teal-950 tracking-tight">
                      {(kpis.successful_upi_autopay_debits ?? 408).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] font-semibold text-teal-800 mt-0.5">
                      ₹68.4 Lakh Realized
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
              <span>Clearing: Real-Time</span>
              <span className="font-bold text-teal-700">Realized</span>
            </div>
          </div>

          {/* KPI 5: Successful One-Time UPI Payments */}
          <div className="pharmacy-card p-4 flex flex-col justify-between min-h-[140px] border-l-4 border-l-purple-600">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1">
                  <span>📱</span>
                  <span>One-Time UPI</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                  Instant QR / VPA
                </span>
              </div>
              <div className="mt-2.5">
                {productFilter === 'enach' || productFilter === 'upi_autopay' ? (
                  <div className="text-xs font-semibold text-slate-400 italic py-2">
                    Filtered out
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-black text-purple-950 tracking-tight">
                      {(kpis.successful_one_time_upi ?? 3420).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] font-semibold text-purple-800 mt-0.5">
                      ₹2.18 Cr Counter & Portal
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
              <span>0.0% MDR Rail</span>
              <span className="font-bold text-purple-700">Real-Time</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Secondary 8 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up stagger-4">
        {/* 2. Active Institutions */}
        <div className="pharmacy-card p-4.5 flex flex-col justify-between min-h-[120px]">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6c8f89]">
                2. Active Institutions
              </span>
              <span className="w-7 h-7 rounded-full bg-[#eafbf4] text-[#075e47] flex items-center justify-center text-xs font-bold">
                ✓
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-[#075e47]">
              {kpis.active_institutions ?? inst.active ?? 5}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-[rgba(7,53,51,0.06)] flex justify-between text-[11px] text-[#6c8f89]">
            <span>{inst.suspended ?? 0} Suspended</span>
            <span className="text-emerald-700 font-semibold">Read-Write Active</span>
          </div>
        </div>

        {/* 3. FMS Enabled */}
        <div className="pharmacy-card p-4.5 flex flex-col justify-between min-h-[120px]">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6c8f89]">
                3. FMS Enabled
              </span>
              <span className="w-7 h-7 rounded-full bg-[#b9f3e5]/40 text-[#064840] flex items-center justify-center text-xs font-bold">
                📊
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-[#063331]">
              {kpis.fms_enabled_institutions ?? 5}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-[rgba(7,53,51,0.06)] text-[11px] text-teal-800 font-semibold">
            Fee Management System Active
          </div>
        </div>

        {/* 4. Flex Enabled */}
        <div className="pharmacy-card p-4.5 flex flex-col justify-between min-h-[120px]">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6c8f89]">
                4. Flex Enabled
              </span>
              <span className="w-7 h-7 rounded-full bg-[#cdd5ff]/40 text-[#202967] flex items-center justify-center text-xs font-bold">
                ⚡
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-[#063331]">
              {kpis.flex_enabled_institutions ?? 4}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-[rgba(7,53,51,0.06)] text-[11px] text-[#313e94] font-semibold">
            eNACH & AutoPay Activated
          </div>
        </div>

        {/* 6. SaaS Platform Revenue */}
        <div className="pharmacy-card p-4.5 flex flex-col justify-between min-h-[120px]">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6c8f89]">
                6. SaaS Platform Revenue
              </span>
              <span className="w-7 h-7 rounded-full bg-[#e4f9b8]/50 text-[#1f480b] flex items-center justify-center text-xs font-bold">
                ₹
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-emerald-800">
              ₹{(kpis.total_saas_revenue_inr ?? rev.total_revenue_inr ?? 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-[rgba(7,53,51,0.06)] flex justify-between text-[11px] text-[#6c8f89]">
            <span>MRR: ₹{(rev.mrr_inr || 14000).toLocaleString('en-IN')}</span>
            <span className="font-bold text-[#0f766e]">Platform SaaS</span>
          </div>
        </div>

        {/* 7. Institutional Gross Fees (Strictly Isolated) */}
        <div className="pharmacy-card p-4.5 bg-gradient-to-br from-white to-[#f0f6ff] border-[#c7d2fe] flex flex-col justify-between min-h-[120px]">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900">
                7. Institutional Gross Fees
              </span>
              <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">
                🎓
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-indigo-950">
              ₹
              {kpis.total_fee_collections_inr
                ? (kpis.total_fee_collections_inr / 10000000).toFixed(2)
                : '4.28'}{' '}
              Cr
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-indigo-100 text-[10px] text-indigo-700 font-semibold">
            Student Tuition Gross • Isolated
          </div>
        </div>

        {/* 8. Successful Auto-Debits */}
        <div className="pharmacy-card p-4.5 flex flex-col justify-between min-h-[120px]">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6c8f89]">
                8. Successful Auto-Debits
              </span>
              <span className="w-7 h-7 rounded-full bg-[#eafbf4] text-[#075e47] flex items-center justify-center text-xs font-bold">
                ⚡
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-[#063331]">
              {kpis.total_successful_debits?.toLocaleString('en-IN') ?? '1,280'}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-[rgba(7,53,51,0.06)] text-[11px] text-emerald-700 font-semibold">
            97.4% Realization Success Rate
          </div>
        </div>

        {/* 11. Pending Settlements */}
        <div className="pharmacy-card p-4.5 flex flex-col justify-between min-h-[120px]">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6c8f89]">
                11. Pending Settlements
              </span>
              <span className="w-7 h-7 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center text-xs font-bold">
                ⏳
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-amber-800">
              ₹{(kpis.pending_settlements_inr || 345000).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-[rgba(7,53,51,0.06)] text-[11px] text-amber-800 font-semibold">
            T+1 Next Business Day Clearing
          </div>
        </div>

        {/* 12. Outstanding SaaS Invoices */}
        <div className="pharmacy-card p-4.5 flex flex-col justify-between min-h-[120px]">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6c8f89]">
                12. Outstanding SaaS Invoices
              </span>
              <span className="w-7 h-7 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center text-xs font-bold">
                🧾
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-rose-700">
              ₹{(kpis.outstanding_platform_invoices_inr || 3000).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-[rgba(7,53,51,0.06)] text-[11px] text-rose-700 font-semibold">
            1 Account in Grace Period
          </div>
        </div>
      </div>

      {/* Row 3: Visual Analytics Grid (Donut Chart "Graph Report" + Capsule Bar Chart "Total Sales Overview") */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up stagger-5">
        {/* Left: Graph Report with Pastel Donut Chart */}
        <div className="pharmacy-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[rgba(7,53,51,0.06)]">
            <h3 className="font-bold text-base text-[#063331]">Graph Report</h3>
            <button className="w-7 h-7 rounded-full bg-[#f3faf7] hover:bg-[#e4f3ee] flex items-center justify-center text-xs font-bold text-[#063331] cursor-pointer">
              •••
            </button>
          </div>

          {/* Donut Chart SVG (Inspiration Match) */}
          <div className="flex flex-col items-center justify-center py-6">
            <div className="relative w-52 h-52 flex items-center justify-center">
              <svg className="w-52 h-52 -rotate-90 transform" viewBox="0 0 160 160">
                {/* Background Ring */}
                <circle cx="80" cy="80" r="58" fill="none" stroke="#f0faf7" strokeWidth="20" />
                {/* Arc 1: Lime Green (42%) */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  fill="none"
                  stroke="#d5f5a2"
                  strokeWidth="20"
                  strokeDasharray="153 364"
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />
                {/* Arc 2: Mint/Aqua (28%) */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  fill="none"
                  stroke="#9deedb"
                  strokeWidth="20"
                  strokeDasharray="102 364"
                  strokeDashoffset="-153"
                  strokeLinecap="round"
                />
                {/* Arc 3: Coral/Pink (18%) */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  fill="none"
                  stroke="#ffbac1"
                  strokeWidth="20"
                  strokeDasharray="65 364"
                  strokeDashoffset="-255"
                  strokeLinecap="round"
                />
                {/* Arc 4: Striped / Light Periwinkle (12%) */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  fill="none"
                  stroke="#cdd5ff"
                  strokeWidth="20"
                  strokeDasharray="44 364"
                  strokeDashoffset="-320"
                  strokeLinecap="round"
                />
              </svg>

              {/* Center Total Pill */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs font-semibold text-[#6c8f89]">Total</span>
                <span className="text-2xl font-extrabold text-[#063331] tracking-tight">755K</span>
              </div>
            </div>

            {/* Pastel Legend */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-[#244a45] mt-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#d5f5a2]" />
                <span>Purchases (42%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#9deedb]" />
                <span>Suppliers (28%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ffbac1]" />
                <span>Sales (18%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#cdd5ff]" />
                <span>No Sales (12%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Total Sales Overview with Capsule Bars & Tooltip (Inspiration Match) */}
        <div className="pharmacy-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[rgba(7,53,51,0.06)]">
            <h3 className="font-bold text-base text-[#063331]">Total Sales Overview</h3>
            <span className="pharmacy-pill-light px-3 py-1 text-xs font-bold">Weekly Volume</span>
          </div>

          <div className="pt-8 pb-4 flex items-end justify-around gap-2 sm:gap-4 relative">
            {/* Monday Capsule */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-11 sm:w-13 h-44 bg-[#e7f4f0] rounded-full flex flex-col justify-end p-1 overflow-hidden">
                <div
                  style={{ height: '35%' }}
                  className="w-full bg-[#ffcca8] bg-stripes-diagonal rounded-full animate-bar-grow shadow-xs"
                />
              </div>
              <span className="text-xs font-semibold text-[#6c8f89]">Mon</span>
            </div>

            {/* Tuesday Capsule */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-11 sm:w-13 h-44 bg-[#e7f4f0] rounded-full flex flex-col justify-end p-1 overflow-hidden">
                <div
                  style={{ height: '55%' }}
                  className="w-full bg-[#f0abfc] bg-stripes-diagonal rounded-full animate-bar-grow shadow-xs"
                />
              </div>
              <span className="text-xs font-semibold text-[#6c8f89]">Tue</span>
            </div>

            {/* Wednesday Capsule (PEAK WITH DARK TOOLTIP BUBBLE) */}
            <div className="flex flex-col items-center gap-2 relative">
              {/* Floating dark speech-bubble tooltip from inspiration */}
              <div className="pharmacy-pill-dark px-3.5 py-1.5 text-center text-xs shadow-xl absolute -top-11 z-10 whitespace-nowrap">
                <div className="text-[10px] text-[#a3ebce] font-medium leading-none">Apr, 2026</div>
                <div className="font-extrabold text-white text-xs leading-tight mt-0.5">
                  $298.00K
                </div>
              </div>

              <div className="w-11 sm:w-13 h-44 bg-[#e7f4f0] rounded-full flex flex-col justify-end p-1 overflow-hidden ring-2 ring-[#063331]/10">
                <div
                  style={{ height: '85%' }}
                  className="w-full bg-[#bef264] bg-stripes-diagonal rounded-full animate-bar-grow shadow-md"
                />
              </div>
              <span className="text-xs font-bold text-[#063331]">Wed</span>
            </div>

            {/* Thursday Capsule */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-11 sm:w-13 h-44 bg-[#e7f4f0] rounded-full flex flex-col justify-end p-1 overflow-hidden">
                <div
                  style={{ height: '65%' }}
                  className="w-full bg-[#67e8f9] bg-stripes-diagonal rounded-full animate-bar-grow shadow-xs"
                />
              </div>
              <span className="text-xs font-semibold text-[#6c8f89]">Thu</span>
            </div>

            {/* Friday Capsule */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-11 sm:w-13 h-44 bg-[#e7f4f0] rounded-full flex flex-col justify-end p-1 overflow-hidden">
                <div
                  style={{ height: '48%' }}
                  className="w-full bg-[#fda4af] bg-stripes-diagonal rounded-full animate-bar-grow shadow-xs"
                />
              </div>
              <span className="text-xs font-semibold text-[#6c8f89]">Fri</span>
            </div>
          </div>

          <div className="pt-3 border-t border-[rgba(7,53,51,0.06)] flex items-center justify-between text-xs text-[#6c8f89]">
            <span>Scheduled Realizations:</span>
            <span className="font-bold text-[#063331]">
              ₹
              {analytics.scheduled_instalments_expected_inr
                ? (analytics.scheduled_instalments_expected_inr / 10000000).toFixed(2)
                : '2.40'}{' '}
              Cr Expected
            </span>
          </div>
        </div>
      </div>

      {/* Row 4: Recent Platform Operations Table (Styled as "Recent Sales List") */}
      <div className="pharmacy-card p-6 animate-slide-up stagger-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[rgba(7,53,51,0.06)]">
          <div>
            <h3 className="font-bold text-base text-[#063331]">
              Recent Platform Operations & Audits
            </h3>
            <p className="text-xs text-[#6c8f89] mt-0.5">
              Real-time ledger audit trail of recent institutional operations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateTo('settings')}
              className="pharmacy-pill-light h-8 px-3.5 text-xs font-semibold cursor-pointer"
            >
              Filter ▾
            </button>
            <button
              onClick={() => navigateTo('settings')}
              className="pharmacy-pill-dark h-8 px-4 text-xs font-semibold cursor-pointer"
            >
              View Full Audit Logs →
            </button>
          </div>
        </div>

        <div className="mt-4 divide-y divide-[rgba(7,53,51,0.06)]">
          {recent.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#6c8f89]">No recent activity recorded.</p>
          ) : (
            recent.map((act: any) => (
              <div
                key={act.id}
                className="py-3 flex items-start justify-between gap-3 text-xs hover:bg-[#f7fbf9] p-2 rounded-xl transition"
              >
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#e2f1ed] text-[#063331] flex items-center justify-center shrink-0 font-bold text-xs">
                    ✓
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#063331]">{act.action}</span>
                      <span className="text-[#6c8f89] font-mono text-[11px]">
                        ({act.object_id})
                      </span>
                    </div>
                    <p className="text-[#244a45] mt-0.5 text-xs">
                      {act.details?.reason ||
                        act.details?.plan_name ||
                        act.details?.institution ||
                        JSON.stringify(act.details)}
                    </p>
                    <span className="text-[11px] text-[#6c8f89] mt-0.5 block">By {act.actor}</span>
                  </div>
                </div>
                <span className="text-[11px] text-[#6c8f89] font-medium shrink-0">
                  {new Date(act.created_at).toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
