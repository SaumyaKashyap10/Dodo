'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/client';
import { useOwner } from './owner-context';
import { OwnerModal } from './owner-modal';

export function OwnerSubscriptions() {
  const { refreshTrigger, refreshData } = useOwner();
  const [plans, setPlans] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [paymentLinkModalOpen, setPaymentLinkModalOpen] = useState(false);
  const [paymentLinkResult, setPaymentLinkResult] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states for Plan Creation/Edit (with Product-Level Entitlements Matrix, Section 6)
  const [planForm, setPlanForm] = useState({
    name: '',
    slug: '',
    price_inr: 2000,
    interval: 'monthly',
    student_limit: 1000,
    campus_limit: 1,
    description: '',
    features: ['direct_payments', 'standard_receipts', 'installments_tracker'],
    product_entitlements: {
      fms: true,
      flex_enach: false,
      flex_autopay: false,
      payment_gateway: true,
      reporting_exports: true,
      advanced_analytics: false,
      advanced_reconciliation: false,
      virtual_accounts: false,
      split_settlements: false,
    },
  });

  // Form states for Assigning Plan
  const [assignForm, setAssignForm] = useState({
    tenant_id: '',
    plan_id: '',
    interval: 'monthly',
    auto_renew: true,
    apply_payment: true,
  });

  useEffect(() => {
    let unmounted = false;
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [plansRes, instRes] = await Promise.all([
          api<any[]>('/v1/owner/subscriptions/plans'),
          api<any[]>('/v1/owner/institutions'),
        ]);
        if (!unmounted) {
          setPlans(plansRes || []);
          setInstitutions(instRes || []);
        }
      } catch (e: any) {
        if (!unmounted) setError(e.message || 'Failed to load subscription data');
      } finally {
        if (!unmounted) setLoading(false);
      }
    }
    void loadData();
    return () => {
      unmounted = true;
    };
  }, [refreshTrigger]);

  const handleOpenPlanModal = (plan?: any) => {
    if (plan) {
      setEditingPlan(plan);
      setPlanForm({
        name: plan.name,
        slug: plan.slug,
        price_inr: plan.price_inr,
        interval: plan.interval || 'monthly',
        student_limit: plan.student_limit,
        campus_limit: plan.campus_limit,
        description: plan.description || '',
        features: plan.features || [],
        product_entitlements: plan.product_entitlements || {
          fms: true,
          flex_enach: plan.features?.includes('enach_autopay') ?? false,
          flex_autopay: plan.features?.includes('enach_autopay') ?? false,
          payment_gateway: true,
          reporting_exports: true,
          advanced_analytics: plan.features?.includes('advanced_analytics') ?? false,
          advanced_reconciliation: plan.features?.includes('advanced_analytics') ?? false,
          virtual_accounts: false,
          split_settlements: false,
        },
      });
    } else {
      setEditingPlan(null);
      setPlanForm({
        name: '',
        slug: '',
        price_inr: 3000,
        interval: 'monthly',
        student_limit: 2000,
        campus_limit: 2,
        description: '',
        features: ['direct_payments', 'standard_receipts', 'installments_tracker', 'enach_autopay'],
        product_entitlements: {
          fms: true,
          flex_enach: true,
          flex_autopay: true,
          payment_gateway: true,
          reporting_exports: true,
          advanced_analytics: false,
          advanced_reconciliation: true,
          virtual_accounts: false,
          split_settlements: false,
        },
      });
    }
    setPlanModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api('/v1/owner/subscriptions/plans', {
        method: 'POST',
        body: JSON.stringify({
          ...(editingPlan ? { id: editingPlan.id } : {}),
          ...planForm,
          price_inr: Number(planForm.price_inr),
          student_limit: Number(planForm.student_limit),
          campus_limit: Number(planForm.campus_limit),
        }),
      });
      setPlanModalOpen(false);
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Failed to save subscription plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAssignModal = (inst?: any) => {
    setAssignForm({
      tenant_id: inst?.id || (institutions[0]?.id || ''),
      plan_id: inst?.subscription?.plan_id || (plans[0]?.id || 'plan_growth'),
      interval: 'monthly',
      auto_renew: true,
      apply_payment: true,
    });
    setAssignModalOpen(true);
  };

  const handleConfirmAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.tenant_id || !assignForm.plan_id) return;
    setSubmitting(true);
    try {
      await api(`/v1/owner/institutions/${assignForm.tenant_id}/subscription`, {
        method: 'POST',
        body: JSON.stringify(assignForm),
      });
      setAssignModalOpen(false);
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Failed to assign subscription plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGeneratePaymentLink = async (inst: any) => {
    setSubmitting(true);
    try {
      const res = await api<any>('/v1/owner/subscriptions/create-payment-link', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: inst.id,
          plan_id: inst.subscription?.plan_id || 'plan_growth',
        }),
      });
      setPaymentLinkResult(res);
      setPaymentLinkModalOpen(true);
    } catch (e: any) {
      alert(e.message || 'Failed to generate Razorpay payment link');
    } finally {
      setSubmitting(false);
    }
  };

  const productEntitlementLabels = [
    { key: 'fms', label: 'Jodo-Style Fee Management System (FMS)' },
    { key: 'flex_enach', label: 'Flex — eNACH Mandates' },
    { key: 'flex_autopay', label: 'Flex — UPI AutoPay' },
    { key: 'payment_gateway', label: 'Standard Payment Gateway' },
    { key: 'reporting_exports', label: 'Reporting & Data Exports' },
    { key: 'advanced_analytics', label: 'Advanced Cashflow Analytics' },
    { key: 'advanced_reconciliation', label: 'Multi-Branch Reconciliation' },
    { key: 'virtual_accounts', label: 'Smart Virtual Accounts' },
    { key: 'split_settlements', label: 'Multi-Entity Split Settlements' },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[rgba(7,53,51,0.06)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#063331]">
            Subscription & Product Entitlements
          </h1>
          <p className="text-xs text-[#6c8f89] mt-0.5">
            Configure platform SaaS pricing tiers (₹2,000, ₹3,000, ₹4,000), assign FMS and Flex entitlements, and manage Razorpay billing.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => handleOpenAssignModal()}
            className="pharmacy-pill-light h-9 px-4 text-xs font-semibold flex items-center justify-center cursor-pointer whitespace-nowrap shrink-0"
          >
            Assign Plan to Institute
          </button>
          <button
            onClick={() => handleOpenPlanModal()}
            className="pharmacy-pill-dark h-9 px-4 text-xs font-semibold flex items-center justify-center cursor-pointer whitespace-nowrap shrink-0"
          >
            + Create New Plan
          </button>
        </div>
      </div>

      {/* Critical Commercial Principle Banner */}
      <div className="pharmacy-card p-4 sm:p-5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-[#063331] text-white flex items-center justify-center font-bold text-xs shrink-0">
            ⓘ
          </span>
          <div>
            <strong className="text-[#063331]">Commercial Architecture Separation:</strong>
            <span className="text-[#244a45] ml-1">
              SaaS monthly subscription fees (e.g. ₹2,000–₹4,000/mo) and Jodo Flex per-student transaction fees (₹200/reg + 1% debit) are distinct financial concepts. They are tracked independently on separate invoices.
            </span>
          </div>
        </div>
      </div>

      {/* Subscription Plans Showcase Cards with Product Entitlements Matrix */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#063331]">Platform Subscription Tiers</h2>
          <span className="text-xs text-[#6c8f89]">Configurable tiers: ₹2,000, ₹3,000, ₹4,000</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((p) => {
            const isDefault = p.is_default;
            const entitlements = p.product_entitlements || {};
            return (
              <div
                key={p.id}
                className={`relative pharmacy-card p-6 flex flex-col justify-between transition-all ${
                  isDefault ? 'ring-2 ring-[#0f766e] shadow-xl' : ''
                }`}
              >
                {isDefault && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 pharmacy-pill-dark text-[10px] font-bold uppercase tracking-wider shadow-md">
                    Most Popular
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-extrabold text-[#063331]">{p.name}</h3>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#f0faf7] text-[#063331] border border-[rgba(6,51,49,0.08)] font-mono">
                      {p.slug}
                    </span>
                  </div>

                  <p className="text-xs text-[#6c8f89] mt-1.5 min-h-[30px] leading-relaxed">{p.description}</p>

                  <div className="mt-3.5 pt-3 border-t border-[rgba(7,53,51,0.06)] flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-[#063331] tracking-tight">
                      ₹{p.price_inr.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-[#6c8f89]">/ {p.interval}</span>
                  </div>

                  {/* Limits */}
                  <div className="mt-3.5 p-3 pharmacy-card-subtle space-y-1.5 text-xs text-[#244a45]">
                    <div className="flex justify-between">
                      <span className="text-[#6c8f89]">Student Capacity:</span>
                      <span className="font-bold text-[#063331]">
                        {p.student_limit >= 10000 ? 'Unlimited' : `Up to ${p.student_limit.toLocaleString('en-IN')}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6c8f89]">Campuses / Branches:</span>
                      <span className="font-bold text-[#063331]">
                        {p.campus_limit >= 10 ? 'Unlimited' : `${p.campus_limit} Campus`}
                      </span>
                    </div>
                  </div>

                  {/* Product-Level Entitlements Matrix (Requirement Section 6) */}
                  <div className="mt-4 space-y-1.5">
                    <div className="text-[10px] font-bold text-[#6c8f89] uppercase tracking-wider">
                      Product-Level Entitlements
                    </div>
                    {productEntitlementLabels.map((ent) => {
                      const enabled = !!entitlements[ent.key];
                      return (
                        <div
                          key={ent.key}
                          className={`flex items-center gap-2 text-xs ${
                            enabled ? 'text-[#063331] font-semibold' : 'text-[#8dafa9] line-through'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
                              enabled ? 'bg-[#eafbf4] text-[#075e47] font-bold' : 'bg-slate-100 text-slate-300'
                            }`}
                          >
                            {enabled ? '✓' : '×'}
                          </span>
                          <span className="truncate">{ent.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-[rgba(7,53,51,0.06)]">
                  <button
                    onClick={() => handleOpenPlanModal(p)}
                    className="pharmacy-pill-light h-9 w-full px-3 text-xs font-bold text-center text-[#063331] cursor-pointer"
                  >
                    Edit Plan & Entitlements
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Institution Subscriptions Table */}
      <div className="pharmacy-card overflow-hidden">
        <div className="p-5 border-b border-[rgba(7,53,51,0.06)] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[#063331] text-sm">Institution Subscription Assignments</h3>
            <p className="text-xs text-[#6c8f89] mt-0.5">
              Live status, renewal deadlines, auto-renewals, and Razorpay checkout link generator.
            </p>
          </div>
          <span className="pharmacy-pill-light px-3 py-1 text-xs font-bold text-[#063331]">
            {institutions.length} Subscribed Institutes
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f0faf7] text-[#063331] text-[11px] font-bold uppercase tracking-wider border-b border-[rgba(7,53,51,0.06)]">
              <tr>
                <th className="px-4 py-3">Institution</th>
                <th className="px-4 py-3">Assigned Plan</th>
                <th className="px-4 py-3">Subscription Status</th>
                <th className="px-4 py-3">Current Period Ends</th>
                <th className="px-4 py-3">Auto-Renew</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(7,53,51,0.06)]">
              {institutions.map((inst) => {
                const sub = inst.subscription || {};
                const isActive = sub.status === 'active';
                const isExpired = sub.status === 'expired';

                return (
                  <tr key={inst.id} className="hover:bg-[#f7fbf9] transition">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-[#063331]">{inst.display_name}</div>
                      <div className="text-[11px] text-[#6c8f89] font-mono mt-0.5">{inst.slug}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-[#063331]">{sub.plan_name || 'Standard Tier'}</div>
                      <div className="text-[11px] text-[#0f766e] font-bold mt-0.5">
                        ₹{(sub.price_inr || 2000).toLocaleString('en-IN')}/{sub.interval || 'mo'}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      {isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#eafbf4] text-[#075e47] border border-[#a3ebce]">
                          Active
                        </span>
                      ) : isExpired ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fff0f1] text-[#8e1f2b] border border-[#fecdd3]">
                          Expired
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fffbeb] text-[#92400e] border border-[#fde68a]">
                          {sub.status || 'Pending'}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-[#244a45] font-medium">
                      {sub.current_period_end
                        ? new Date(sub.current_period_end).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>

                    <td className="px-4 py-3.5 font-semibold text-[#063331]">
                      {sub.auto_renew ? 'Enabled' : 'Manual'}
                    </td>

                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleGeneratePaymentLink(inst)}
                          className="pharmacy-pill-dark h-7.5 px-3 text-xs font-semibold cursor-pointer whitespace-nowrap"
                        >
                          Razorpay Link
                        </button>

                        <button
                          onClick={() => handleOpenAssignModal(inst)}
                          className="pharmacy-pill-light h-7.5 px-3 text-xs font-semibold text-[#063331] cursor-pointer whitespace-nowrap"
                        >
                          Upgrade / Change
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Create or Edit Plan with Product Entitlements */}
      <OwnerModal
        isOpen={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        title={editingPlan ? 'Edit Subscription Plan & Entitlements' : 'Create Subscription Plan'}
        subtitle="Configure commercial price, capacity limits, and enabled feature modules"
        maxWidth="max-w-lg"
      >
        <form
          onSubmit={handleSavePlan}
          className="space-y-4"
        >

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Plan Name</label>
                <input
                  type="text"
                  required
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  placeholder="e.g. Growth Plan"
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Slug Identifier</label>
                <input
                  type="text"
                  required
                  value={planForm.slug}
                  onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                  placeholder="e.g. growth"
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Price in INR (₹)</label>
                <input
                  type="number"
                  required
                  min={500}
                  step={100}
                  value={planForm.price_inr}
                  onChange={(e) => setPlanForm({ ...planForm, price_inr: Number(e.target.value) })}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Interval</label>
                <select
                  value={planForm.interval}
                  onChange={(e) => setPlanForm({ ...planForm, interval: e.target.value })}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white cursor-pointer"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Student Capacity Limit</label>
                <input
                  type="number"
                  required
                  min={50}
                  value={planForm.student_limit}
                  onChange={(e) => setPlanForm({ ...planForm, student_limit: Number(e.target.value) })}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Campus Limit</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={planForm.campus_limit}
                  onChange={(e) => setPlanForm({ ...planForm, campus_limit: Number(e.target.value) })}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Plan Description</label>
              <textarea
                value={planForm.description}
                onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                rows={2}
                placeholder="Brief summary of included benefits…"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
              />
            </div>

            {/* Product Entitlements Toggles (Requirement Section 6) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Product-Level Entitlements
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                {productEntitlementLabels.map((ent) => {
                  const isChecked = !!(planForm.product_entitlements as any)?.[ent.key];
                  return (
                    <label key={ent.key} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          setPlanForm({
                            ...planForm,
                            product_entitlements: {
                              ...planForm.product_entitlements,
                              [ent.key]: e.target.checked,
                            },
                          });
                        }}
                        className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                      />
                      <span>{ent.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPlanModalOpen(false)}
              className="pharmacy-pill-light h-9 px-4 text-xs font-bold text-[#063331] rounded-full cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="pharmacy-pill-dark h-9 px-5 text-xs font-bold text-white rounded-full shadow-xs cursor-pointer"
            >
              {submitting ? 'Saving…' : 'Save Plan'}
            </button>
          </div>
        </form>
      </OwnerModal>

      {/* Modal 2: Assign Plan to Institution */}
      <OwnerModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Assign Subscription Plan"
        subtitle="Assign commercial plan and feature privileges to institution"
        maxWidth="max-w-md"
      >
        <form
          onSubmit={handleConfirmAssignment}
          className="space-y-4"
        >

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Institution</label>
              <select
                value={assignForm.tenant_id}
                onChange={(e) => setAssignForm({ ...assignForm, tenant_id: e.target.value })}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white cursor-pointer"
              >
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.display_name} ({inst.slug})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Subscription Plan</label>
              <select
                value={assignForm.plan_id}
                onChange={(e) => setAssignForm({ ...assignForm, plan_id: e.target.value })}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white cursor-pointer"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ₹{p.price_inr.toLocaleString('en-IN')}/{p.interval}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignForm.auto_renew}
                  onChange={(e) => setAssignForm({ ...assignForm, auto_renew: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                />
                <span>Enable recurring automatic renewal</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignForm.apply_payment}
                  onChange={(e) => setAssignForm({ ...assignForm, apply_payment: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                />
                <span>Record invoice & mark period paid immediately</span>
              </label>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="pharmacy-pill-light h-9 px-4 text-xs font-bold text-[#063331] rounded-full cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="pharmacy-pill-dark h-9 px-5 text-xs font-bold text-white rounded-full shadow-xs cursor-pointer"
              >
                {submitting ? 'Applying…' : 'Confirm Assignment'}
              </button>
            </div>
          </form>
        </OwnerModal>

      {/* Modal 3: Razorpay Payment Link Result */}
      <OwnerModal
        isOpen={paymentLinkModalOpen && !!paymentLinkResult}
        onClose={() => setPaymentLinkModalOpen(false)}
        title="Razorpay Payment Link"
        subtitle="Share this link with the institution management to complete subscription payment"
        maxWidth="max-w-md"
      >
        {paymentLinkResult && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-[20px] space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Institution:</span>
                <span className="font-semibold text-slate-900">{paymentLinkResult.institution}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Subscription Tier:</span>
                <span className="font-semibold text-teal-700">{paymentLinkResult.plan_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Order Amount:</span>
                <span className="font-bold text-slate-900">₹{paymentLinkResult.amount_inr?.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1.5">
                Sharable Razorpay Checkout URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={paymentLinkResult.payment_link_url}
                  className="flex-1 h-10 px-3.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-[11px] text-slate-800"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(paymentLinkResult.payment_link_url);
                    alert('Payment link copied to clipboard!');
                  }}
                  className="pharmacy-pill-dark h-10 px-4 text-white font-bold rounded-full text-xs cursor-pointer shrink-0"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setPaymentLinkModalOpen(false)}
                className="pharmacy-pill-light h-9 px-5 text-slate-700 rounded-full text-xs font-bold transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </OwnerModal>
    </div>
  );
}
