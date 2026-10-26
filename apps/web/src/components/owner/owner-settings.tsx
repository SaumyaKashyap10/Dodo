'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/client';
import { useOwner } from './owner-context';
import { OwnerModal } from './owner-modal';

export function OwnerSettings() {
  const { refreshTrigger, refreshData } = useOwner();
  const [tab, setTab] = useState<'admins' | 'roles' | 'config' | 'audit'>('admins');
  const [data, setData] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  // Modals & form states
  const [addAdminModalOpen, setAddAdminModalOpen] = useState(false);
  const [createdAdminResult, setCreatedAdminResult] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit and Revoke Operator State
  const [editingAdmin, setEditingAdmin] = useState<any | null>(null);
  const [editRoleForm, setEditRoleForm] = useState({ role: 'platform_admin' });
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Form for adding admin
  const [adminForm, setAdminForm] = useState({
    email: '',
    password: '',
    role: 'platform_admin',
  });

  // Global platform configuration state
  const [platformConfig, setPlatformConfig] = useState({
    platform_name: 'Dodo Fee Platform',
    support_email: 'saumya@gmail.com',
    session_timeout_hours: 8,
    rate_limit_per_minute: 300,
    maintenance_mode: false,
    retention_years: 7,
    default_gst_percentage: 18,
    sac_code: '998313',
    default_settlement_policy: 'T+1',
    dual_control_approvals_required: true,
  });

  useEffect(() => {
    let unmounted = false;
    async function loadSettings() {
      setLoading(true);
      setError('');
      try {
        const [settingsRes, auditRes] = await Promise.all([
          api<any>('/v1/owner/settings'),
          api<any[]>(`/v1/owner/audit-logs${auditActionFilter ? `?action=${auditActionFilter}` : ''}`),
        ]);
        if (!unmounted) {
          setData(settingsRes);
          if (settingsRes?.settings) {
            setPlatformConfig((prev) => ({
              ...prev,
              ...settingsRes.settings,
            }));
          }
          setAuditLogs(auditRes || []);
        }
      } catch (e: any) {
        if (!unmounted) setError(e.message || 'Failed to load platform settings');
      } finally {
        if (!unmounted) setLoading(false);
      }
    }
    void loadSettings();
    return () => {
      unmounted = true;
    };
  }, [refreshTrigger, auditActionFilter]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.email || !adminForm.password || adminForm.password.length < 16) {
      alert('Password must be at least 16 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api<any>('/v1/owner/admins', {
        method: 'POST',
        body: JSON.stringify(adminForm),
      });
      setCreatedAdminResult(res);
      setAddAdminModalOpen(false);
      setAdminForm({ email: '', password: '', role: 'platform_admin' });
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Failed to create platform administrator');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditModal = (admin: any) => {
    setEditingAdmin(admin);
    setEditRoleForm({ role: admin.role || 'platform_admin' });
    setEditModalOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setSubmitting(true);
    try {
      await api('/v1/owner/admins', {
        method: 'PATCH',
        body: JSON.stringify({
          id: editingAdmin.id,
          email: editingAdmin.email,
          role: editRoleForm.role,
        }),
      });
      setEditModalOpen(false);
      setEditingAdmin(null);
      refreshData();
    } catch (err: any) {
      alert(err.message || 'Failed to update operator role');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleRevoke = async (admin: any) => {
    const willRevoke = admin.active !== false;
    const confirmMsg = willRevoke
      ? `Are you sure you want to REVOKE platform access for ${admin.email}?`
      : `Restore platform access for ${admin.email}?`;
    if (!confirm(confirmMsg)) return;

    try {
      await api('/v1/owner/admins', {
        method: 'PATCH',
        body: JSON.stringify({
          id: admin.id,
          email: admin.email,
          active: !willRevoke,
        }),
      });
      refreshData();
    } catch (err: any) {
      alert(err.message || 'Failed to update operator status');
    }
  };

  const handleSavePlatformConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api('/v1/owner/settings', {
        method: 'POST',
        body: JSON.stringify(platformConfig),
      });
      alert('Platform configuration saved successfully.');
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Failed to update platform settings');
    } finally {
      setSubmitting(false);
    }
  };

  const platformRoles = [
    {
      role: 'owner',
      title: 'Platform Owner',
      description: 'Full unrestricted governance across all institutions, financial ledgers, and operator accounts.',
      restrictions: 'Only role capable of modifying Owner credentials.',
      badge_color: 'bg-rose-100 text-rose-900 border-rose-200',
    },
    {
      role: 'platform_admin',
      title: 'Platform Admin',
      description: 'Full day-to-day platform operations, institution approvals, and product toggles.',
      restrictions: 'Cannot modify Owner credentials or root encryption keys.',
      badge_color: 'bg-blue-100 text-blue-900 border-blue-200',
    },
    {
      role: 'billing_manager',
      title: 'Billing Manager',
      description: 'SaaS subscription billing, Jodo Flex commercial pricing overrides, and advance security ledger adjustments.',
      restrictions: 'Cannot activate/suspend institutions or alter security settings.',
      badge_color: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    },
    {
      role: 'finance_operator',
      title: 'Finance Operator',
      description: 'T+1 settlement execution, fee reconciliation, penny-drop verifications, and dispute handling.',
      restrictions: 'Read-only access to commercial configurations; cannot modify plans.',
      badge_color: 'bg-purple-100 text-purple-900 border-purple-200',
    },
    {
      role: 'support_operator',
      title: 'Support Operator',
      description: 'Read-only institution diagnostics, webhook log examination, and parent payment link lookups.',
      restrictions: 'Non-destructive operations only; zero access to banking credentials.',
      badge_color: 'bg-amber-100 text-amber-900 border-amber-200',
    },
    {
      role: 'read_only_auditor',
      title: 'Read-Only Auditor',
      description: 'Compliance verification, cryptographic HMAC audit trail examination, and financial export access.',
      restrictions: 'Strictly zero write/modify permissions platform-wide.',
      badge_color: 'bg-slate-100 text-slate-800 border-slate-200',
    },
  ];

  const institutionRoles = [
    {
      role: 'institute_owner',
      title: 'Institute Owner / Trust Trustee',
      description: 'Ultimate institution authority, bank settlement designation, and campus license administration.',
      governance: 'Dual-control required for changing bank payout account.',
    },
    {
      role: 'campus_director',
      title: 'Campus Director / Principal',
      description: 'Oversees campus-level fee structures, student admissions, and instalment batch schedules.',
      governance: 'Approver for fee concessions exceeding ₹10,000.',
    },
    {
      role: 'finance_officer',
      title: 'Finance Officer (Maker)',
      description: 'Drafts student fee schedules, records cheque/NEFT receipts, and prepares refund requests.',
      governance: 'Maker in Maker-Checker dual control segregation.',
    },
    {
      role: 'cashier_staff',
      title: 'Cashier / Counter Staff',
      description: 'Front-desk point-of-sale fee collection, offline receipt generation, and student verification.',
      governance: 'Restricted to assigned campus cash counter.',
    },
    {
      role: 'academic_coordinator',
      title: 'Academic Coordinator',
      description: 'Student course enrolment, section allocation, and transport/hostel optional fee assignment.',
      governance: 'Zero access to institution bank accounts or settlement ledgers.',
    },
    {
      role: 'read_only_checker',
      title: 'Read-Only Staff (Checker / Auditor)',
      description: 'Independent audit of student fee ledgers, waiver authorizations, and bank reconciliation.',
      governance: 'Checker in Maker-Checker dual control segregation.',
    },
    {
      role: 'payer_student_parent',
      title: 'Student / Parent Payer',
      description: 'Self-service fee portal, eNACH mandate authorization, UPI AutoPay enrolment, and receipt downloads.',
      governance: 'Isolated strictly to own student fee ledger.',
    },
  ];

  const filteredAuditLogs = auditLogs.filter((log) => {
    if (!auditSearch) return true;
    const q = auditSearch.toLowerCase();
    return (
      log.action?.toLowerCase().includes(q) ||
      log.actor?.toLowerCase().includes(q) ||
      log.object_id?.toLowerCase().includes(q) ||
      JSON.stringify(log.details)?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[rgba(7,53,51,0.06)]">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#063331]">
            Permissions & Platform Settings
          </h1>
          <p className="text-xs text-[#6c8f89] mt-0.5 max-w-3xl leading-relaxed">
            Platform-wide governance, operator accounts, institution role models, and cryptographic audit ledger.
          </p>
        </div>
      </div>

      {/* Tabs - Smooth with Hidden Scrollbar */}
      <div className="flex space-x-2 sm:space-x-3 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'admins', label: `Platform Operators & Roles (${data?.admins?.length || 5})` },
          { id: 'roles', label: 'Institution Governance (7 Roles)' },
          { id: 'config', label: 'Global Parameters & GST' },
          { id: 'audit', label: `Cryptographic Audit Ledger (${auditLogs.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`h-9 px-4 text-xs font-semibold rounded-full transition cursor-pointer whitespace-nowrap shrink-0 ${
              tab === t.id
                ? 'pharmacy-pill-dark'
                : 'pharmacy-pill-light text-[#476863]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Platform Operators & Roles */}
      {tab === 'admins' && (
        <div className="space-y-6">
          {/* Active Admins Table */}
          <div className="pharmacy-card rounded-[28px] bg-white border border-[#073533]/[0.06] shadow-xs overflow-hidden">
            <div className="p-5 border-b border-[#073533]/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-[#063331] text-sm">Authorized Platform Operators</h3>
                <p className="text-xs text-[#063331]/60 mt-0.5 font-medium">Enforced MFA TOTP for all platform accounts</p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-xs text-emerald-800 font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  Active Owner: saumya@gmail.com
                </span>
                <button
                  type="button"
                  onClick={() => setAddAdminModalOpen(true)}
                  className="pharmacy-pill-dark h-8 px-3.5 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shrink-0 transition shadow-2xs"
                >
                  <span className="text-sm font-bold">+</span>
                  <span>Add Operator</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8fbf9] text-[#063331]/70 text-[11px] font-bold uppercase tracking-wider border-b border-[#073533]/[0.06]">
                  <tr>
                    <th className="px-5 py-3.5">Email / Account</th>
                    <th className="px-5 py-3.5">Platform Role</th>
                    <th className="px-5 py-3.5">MFA Status</th>
                    <th className="px-5 py-3.5">Account Status</th>
                    <th className="px-5 py-3.5">Created Date</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#073533]/[0.04]">
                  {(data?.admins || []).map((admin: any) => (
                    <tr key={admin.id} className="hover:bg-[#f8fbf9]/70 transition">
                      <td className="px-5 py-4">
                        <span className={`font-bold ${admin.active === false ? 'line-through text-slate-400' : 'text-[#063331]'}`}>
                          {admin.email}
                        </span>
                        {admin.email === 'saumya@gmail.com' && (
                          <span className="ml-2 px-2 py-0.5 text-[10px] bg-rose-50 text-rose-800 border border-rose-200 font-black rounded-full">
                            Root Owner
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-slate-100 text-slate-700">
                          {admin.role_title || admin.role?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center text-xs font-semibold text-emerald-800">
                          ✓ Authenticator TOTP Enrolled
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {admin.active !== false ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            Revoked
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-[#063331]/50">
                        {admin.created_at ? new Date(admin.created_at).toLocaleDateString() : '2026-04-01'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {admin.email === 'saumya@gmail.com' ? (
                          <span className="text-[11px] text-slate-400 font-semibold italic">Protected Root</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(admin)}
                              className="pharmacy-pill-light h-7 px-3 text-[11px] font-bold text-[#063331] hover:bg-white rounded-full transition cursor-pointer"
                              title="Edit operator role & privileges"
                            >
                              Edit
                            </button>
                            {admin.active !== false ? (
                              <button
                                type="button"
                                onClick={() => handleToggleRevoke(admin)}
                                className="h-7 px-3 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-full transition cursor-pointer"
                                title="Revoke platform access"
                              >
                                Revoke
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleRevoke(admin)}
                                className="h-7 px-3 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-full transition cursor-pointer"
                                title="Restore platform access"
                              >
                                Restore
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Platform Role Matrix Breakdown */}
          <div className="pharmacy-card rounded-[28px] bg-white border border-[#073533]/[0.06] p-6 shadow-xs space-y-4">
            <h3 className="font-black text-[#063331] text-xs uppercase tracking-wider">
              6 Platform Roles & Authorization Matrix
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {platformRoles.map((pr) => (
                <div key={pr.role} className="p-4 bg-[#f8fbf9] rounded-[22px] border border-[#073533]/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-[#063331]">{pr.title}</h4>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${pr.badge_color}`}>
                      {pr.role}
                    </span>
                  </div>
                  <p className="text-[#063331]/70 text-[11px] leading-relaxed font-medium">{pr.description}</p>
                  <div className="pt-2 border-t border-[#073533]/[0.06] text-[10px] text-[#063331]/60 font-medium">
                    <strong className="text-[#063331]">Boundary:</strong> {pr.restrictions}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Institution Governance (7 Roles) */}
      {tab === 'roles' && (
        <div className="space-y-4">
          <div className="pharmacy-card rounded-[22px] bg-white border border-[#073533]/[0.06] p-5 text-xs text-[#063331]/80 leading-relaxed font-medium shadow-xs">
            These standardized role templates govern institutional staff inside their private tenant workspaces. Dual-control segregation of duties (e.g. Maker-Checker for waivers, bank account modifications, and refunds) is enforced platform-wide.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {institutionRoles.map((r) => (
              <div key={r.role} className="pharmacy-card rounded-[24px] bg-white border border-[#073533]/[0.06] p-5 sm:p-6 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-[#063331] text-xs sm:text-sm">{r.title}</h4>
                  <span className="text-[11px] font-mono px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full font-bold">
                    {r.role}
                  </span>
                </div>
                <p className="text-xs text-[#063331]/70 font-medium">{r.description}</p>
                <div className="pt-2 border-t border-[#073533]/[0.06] flex items-center justify-between text-xs">
                  <span className="text-[11px] font-bold text-[#063331]">Governance Rule:</span>
                  <span className="text-[11px] text-[#063331]/70 font-semibold">{r.governance}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Global Parameters & GST */}
      {tab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleSavePlatformConfig}
            className="lg:col-span-2 pharmacy-card rounded-[28px] bg-white border border-[#073533]/[0.06] p-6 sm:p-7 shadow-xs space-y-4"
          >
            <h3 className="font-black text-[#063331] text-sm pb-3 border-b border-[#073533]/[0.06]">
              Platform Global Parameters & Commercial Defaults
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#063331] mb-1">Platform Brand Name</label>
                <input
                  type="text"
                  required
                  value={platformConfig.platform_name}
                  onChange={(e) => setPlatformConfig({ ...platformConfig, platform_name: e.target.value })}
                  className="w-full h-10 px-3.5 text-xs bg-[#f8fbf9] border border-[#073533]/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#063331]/20 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#063331] mb-1">
                  Official Platform Support Email
                </label>
                <input
                  type="email"
                  required
                  value={platformConfig.support_email}
                  onChange={(e) => setPlatformConfig({ ...platformConfig, support_email: e.target.value })}
                  className="w-full h-10 px-3.5 text-xs bg-[#f8fbf9] border border-[#073533]/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#063331]/20 font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#063331] mb-1">Default GST Rate (%)</label>
                <input
                  type="number"
                  min={0}
                  max={28}
                  value={platformConfig.default_gst_percentage}
                  onChange={(e) => setPlatformConfig({ ...platformConfig, default_gst_percentage: Number(e.target.value) })}
                  className="w-full h-10 px-3.5 text-xs bg-[#f8fbf9] border border-[#073533]/[0.1] rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-[#063331]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#063331] mb-1">Service SAC Code</label>
                <input
                  type="text"
                  value={platformConfig.sac_code}
                  onChange={(e) => setPlatformConfig({ ...platformConfig, sac_code: e.target.value })}
                  className="w-full h-10 px-3.5 text-xs bg-[#f8fbf9] border border-[#073533]/[0.1] rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#063331]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#063331] mb-1">Default Settlement Cycle</label>
                <select
                  value={platformConfig.default_settlement_policy}
                  onChange={(e) => setPlatformConfig({ ...platformConfig, default_settlement_policy: e.target.value })}
                  className="w-full h-10 px-3.5 text-xs bg-[#f8fbf9] border border-[#073533]/[0.1] rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-[#063331]/20 cursor-pointer"
                >
                  <option value="T+1">T+1 (Next business day)</option>
                  <option value="T+2">T+2 (Two business days)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#063331] mb-1">
                  Session Timeout (Hours)
                </label>
                <input
                  type="number"
                  min={1}
                  max={72}
                  value={platformConfig.session_timeout_hours}
                  onChange={(e) => setPlatformConfig({ ...platformConfig, session_timeout_hours: Number(e.target.value) })}
                  className="w-full h-10 px-3.5 text-xs bg-[#f8fbf9] border border-[#073533]/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#063331]/20 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#063331] mb-1">
                  Rate Limit (Req/Min/IP)
                </label>
                <input
                  type="number"
                  min={60}
                  max={10000}
                  value={platformConfig.rate_limit_per_minute}
                  onChange={(e) => setPlatformConfig({ ...platformConfig, rate_limit_per_minute: Number(e.target.value) })}
                  className="w-full h-10 px-3.5 text-xs bg-[#f8fbf9] border border-[#073533]/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#063331]/20 font-bold"
                />
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-[#073533]/[0.06]">
              <label className="flex items-center gap-2.5 text-xs font-bold text-[#063331] cursor-pointer">
                <input
                  type="checkbox"
                  checked={platformConfig.dual_control_approvals_required}
                  onChange={(e) => setPlatformConfig({ ...platformConfig, dual_control_approvals_required: e.target.checked })}
                  className="rounded text-[#063331] focus:ring-[#063331] w-4 h-4"
                />
                <span>Enforce Maker-Checker Dual Control on sensitive financial operations</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs font-bold text-rose-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={platformConfig.maintenance_mode}
                  onChange={(e) => setPlatformConfig({ ...platformConfig, maintenance_mode: e.target.checked })}
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span>Enable Global Maintenance Mode (Freezes external student checkout)</span>
              </label>
            </div>

            <div className="pt-3 border-t border-[#073533]/[0.06] flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="pharmacy-pill-dark h-10 px-6 text-xs font-bold text-white rounded-full shadow-xs transition cursor-pointer"
              >
                {submitting ? 'Saving…' : 'Save Platform Parameters'}
              </button>
            </div>
          </form>

          {/* Commercial Defaults Summary Card */}
          <div className="pharmacy-card rounded-[28px] bg-[#f8fbf9] border border-[#073533]/[0.06] p-6 space-y-4 text-xs shadow-xs">
            <h4 className="font-black text-[#063331] text-xs uppercase tracking-wider">
              Default Jodo Flex Commercials
            </h4>
            <div className="space-y-3">
              <div className="p-4 bg-white rounded-[20px] border border-[#073533]/[0.06] shadow-2xs">
                <span className="text-[10px] text-[#063331]/50 font-bold uppercase">Mandate Creation Fee</span>
                <div className="text-base font-black text-teal-800 mt-0.5">₹200 per student</div>
                <p className="text-[11px] text-[#063331]/60 mt-0.5 font-medium">Applied on verified eNACH / AutoPay registration</p>
              </div>

              <div className="p-4 bg-white rounded-[20px] border border-[#073533]/[0.06] shadow-2xs">
                <span className="text-[10px] text-[#063331]/50 font-bold uppercase">Debit Convenience Fee</span>
                <div className="text-base font-black text-indigo-800 mt-0.5">1.0% per transaction</div>
                <p className="text-[11px] text-[#063331]/60 mt-0.5 font-medium">Deducted from realized scheduled debit</p>
              </div>

              <div className="p-4 bg-white rounded-[20px] border border-[#073533]/[0.06] shadow-2xs">
                <span className="text-[10px] text-[#063331]/50 font-bold uppercase">Initial Security Deposit</span>
                <div className="text-base font-black text-amber-800 mt-0.5">₹50,000 Advance</div>
                <p className="text-[11px] text-[#063331]/60 mt-0.5 font-medium">Baseline security balance for automated debits</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Cryptographic Audit Ledger */}
      {tab === 'audit' && (
        <div className="pharmacy-card rounded-[28px] bg-white border border-[#073533]/[0.06] shadow-xs overflow-hidden space-y-3">
          <div className="p-5 border-b border-[#073533]/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-[#063331] text-sm">Cryptographically Chained Audit Ledger</h3>
              <p className="text-xs text-[#063331]/60 mt-0.5 font-medium">
                Immutable records with HMAC-SHA256 previous hash link validation.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search audit trail…"
                className="h-9 px-3 text-xs bg-[#f8fbf9] border border-[#073533]/[0.1] rounded-full focus:outline-none focus:ring-2 focus:ring-[#063331]/20 font-medium"
              />
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="h-9 px-3 text-xs bg-[#f8fbf9] border border-[#073533]/[0.1] rounded-full font-bold text-[#063331] focus:outline-none focus:ring-2 focus:ring-[#063331]/20 cursor-pointer"
              >
                <option value="">All Actions</option>
                <option value="tenant">Tenant Changes</option>
                <option value="subscription">Subscriptions</option>
                <option value="commercials">Commercials / Advance</option>
                <option value="provider">Provider Updates</option>
                <option value="auth">Auth Events</option>
                <option value="revenue">Revenue Records</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8fbf9] text-[#063331]/70 text-[11px] font-bold uppercase tracking-wider border-b border-[#073533]/[0.06]">
                <tr>
                  <th className="px-5 py-3.5">ID</th>
                  <th className="px-5 py-3.5">Action</th>
                  <th className="px-5 py-3.5">Actor</th>
                  <th className="px-5 py-3.5">Object</th>
                  <th className="px-5 py-3.5">Details</th>
                  <th className="px-5 py-3.5">Hash Integrity</th>
                  <th className="px-5 py-3.5">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#073533]/[0.04]">
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-[#063331]/50">
                      No audit entries found.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#f8fbf9]/70 transition text-xs">
                      <td className="px-5 py-4 font-mono text-[#063331]/50">{log.id}</td>
                      <td className="px-5 py-4 font-bold text-[#063331]">{log.action}</td>
                      <td className="px-5 py-4 text-[#063331]/80 font-medium">{log.actor}</td>
                      <td className="px-5 py-4 font-mono text-[#063331]/60">{log.object_id}</td>
                      <td className="px-5 py-4 text-[#063331]/80 max-w-xs truncate">
                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-bold">
                          ✓ {log.hash?.slice(0, 8)}…
                        </span>
                      </td>
                      <td className="px-5 py-4 text-[#063331]/50 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add Platform Admin */}
      <OwnerModal
        isOpen={addAdminModalOpen}
        onClose={() => setAddAdminModalOpen(false)}
        title="Provision Platform Administrator"
        subtitle="Create a new operator account with role-based platform access"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateAdmin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#063331] mb-1">Operator Email</label>
            <input
              type="email"
              required
              value={adminForm.email}
              onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
              placeholder="operator@platform.example.com"
              className="w-full h-10 px-3.5 text-xs bg-[#f8fbf9] border border-[#073533]/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#063331]/20 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#063331] mb-1">
              Initial Password (Min 16 chars)
            </label>
            <input
              type="password"
              required
              minLength={16}
              value={adminForm.password}
              onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
              placeholder="••••••••••••••••"
              className="w-full h-10 px-3.5 text-xs bg-[#f8fbf9] border border-[#073533]/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#063331]/20 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#063331] mb-1">Platform Role</label>
            <select
              value={adminForm.role}
              onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}
              className="w-full h-10 px-3.5 text-xs bg-[#f8fbf9] border border-[#073533]/[0.1] rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-[#063331]/20 cursor-pointer"
            >
              <option value="platform_admin">Platform Admin</option>
              <option value="billing_manager">Billing Manager</option>
              <option value="finance_operator">Finance Operator</option>
              <option value="support_operator">Support Operator</option>
              <option value="read_only_auditor">Read-Only Auditor</option>
            </select>
          </div>

          <div className="pt-3 border-t border-[#073533]/[0.06] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddAdminModalOpen(false)}
              className="pharmacy-pill-light h-9 px-4 text-xs font-bold text-[#063331] rounded-full cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="pharmacy-pill-dark h-9 px-5 text-xs font-bold text-white rounded-full shadow-xs cursor-pointer"
            >
              {submitting ? 'Provisioning…' : 'Create & Generate MFA Secret'}
            </button>
          </div>
        </form>
      </OwnerModal>

      {/* Modal: 1-Time TOTP Authenticator Display */}
      <OwnerModal
        isOpen={!!createdAdminResult}
        onClose={() => setCreatedAdminResult(null)}
        title="MFA Setup for New Admin"
        subtitle="One-time enrollment secret for Google Authenticator or 1Password"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#063331]/70 font-medium">
            Account created for <strong>{createdAdminResult?.email}</strong>. Scan or enter this one-time secret into Google Authenticator or 1Password. It will never be shown again:
          </p>

          <div className="p-4 bg-[#f8fbf9] rounded-[20px] border border-[#073533]/[0.08] font-mono text-center text-xs font-black text-[#063331] tracking-widest select-all shadow-inner">
            {createdAdminResult?.totp_enrollment_secret}
          </div>

          <div className="pt-3 border-t border-[#073533]/[0.06] flex justify-end">
            <button
              onClick={() => setCreatedAdminResult(null)}
              className="pharmacy-pill-dark h-9 px-5 bg-[#063331] text-white rounded-full text-xs font-bold transition shadow-xs cursor-pointer"
            >
              I Have Saved This Secret
            </button>
          </div>
        </div>
      </OwnerModal>

      {/* Modal: Edit Operator Role & Permissions */}
      <OwnerModal
        isOpen={editModalOpen && !!editingAdmin}
        onClose={() => {
          setEditModalOpen(false);
          setEditingAdmin(null);
        }}
        title="Edit Operator Role"
        subtitle={editingAdmin ? `Update platform role and privileges for ${editingAdmin.email}` : ''}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveRole} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#063331] mb-1">Operator Account</label>
            <input
              type="text"
              readOnly
              value={editingAdmin?.email || ''}
              className="w-full h-10 px-3.5 text-xs bg-[#f8fbf9] border border-[#073533]/[0.1] rounded-xl text-slate-500 font-mono cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#063331] mb-1">Assigned Platform Role</label>
            <select
              value={editRoleForm.role}
              onChange={(e) => setEditRoleForm({ role: e.target.value })}
              className="w-full h-10 px-3.5 text-xs bg-[#f8fbf9] border border-[#073533]/[0.1] rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-[#063331]/20 cursor-pointer"
            >
              <option value="platform_admin">Platform Admin (Full Configuration & Ops)</option>
              <option value="billing_manager">Billing Manager (SaaS Billing & Invoices)</option>
              <option value="finance_operator">Finance Operator (Flex Settlements & Advances)</option>
              <option value="support_operator">Support Operator (Tenants & Lead Helpdesk)</option>
              <option value="read_only_auditor">Read-Only Auditor (Cryptographic Logs & Compliance)</option>
            </select>
          </div>

          <div className="pt-3 border-t border-[#073533]/[0.06] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditModalOpen(false);
                setEditingAdmin(null);
              }}
              className="pharmacy-pill-light h-9 px-4 text-xs font-bold text-[#063331] rounded-full cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="pharmacy-pill-dark h-9 px-5 text-xs font-bold text-white rounded-full shadow-xs cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Saving Changes…' : 'Save Role Changes'}
            </button>
          </div>
        </form>
      </OwnerModal>
    </div>
  );
}
