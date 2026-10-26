'use client';

import React, { useState } from 'react';
import { api } from '@/lib/client';
import { useOwner } from './owner-context';
import { OwnerModal } from './owner-modal';

interface AddTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddTeamMemberModal({ isOpen, onClose }: AddTeamMemberModalProps) {
  const { refreshData } = useOwner();
  const [submitting, setSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<any | null>(null);

  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'platform_admin',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || form.password.length < 16) {
      alert('Password must be at least 16 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api<any>('/v1/owner/admins', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setCreatedResult(res);
      setForm({ email: '', password: '', role: 'platform_admin' });
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Failed to provision platform team member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setCreatedResult(null);
    onClose();
  };

  return (
    <OwnerModal
      isOpen={isOpen}
      onClose={handleClose}
      title={createdResult ? 'MFA Security Setup' : 'Provision Platform Team Member'}
      subtitle={
        createdResult
          ? 'One-time cryptographic enrollment key for Google Authenticator or 1Password'
          : 'Create a new operator account with role-based platform access'
      }
      maxWidth="max-w-md"
    >
      {createdResult ? (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 rounded-[20px] border border-emerald-200 flex items-start gap-3">
            <span className="text-xl">🔐</span>
            <div>
              <h4 className="font-bold text-xs text-emerald-950 uppercase tracking-wider">
                Operator Account Created
              </h4>
              <p className="text-xs text-emerald-900 mt-0.5">
                Account created for <strong>{createdResult.email}</strong>. Scan or save this secret into your authenticator app now:
              </p>
            </div>
          </div>

          <div className="p-4 bg-[#f8fbf9] rounded-[20px] border border-[#073533]/[0.08] font-mono text-center text-xs font-black text-[#063331] tracking-widest select-all shadow-inner">
            {createdResult.totp_enrollment_secret}
          </div>

          <p className="text-[11px] text-[#063331]/60 italic text-center">
            This enrollment key is shown only once and cannot be retrieved later.
          </p>

          <div className="pt-3 border-t border-[#073533]/[0.06] flex justify-end">
            <button
              onClick={handleClose}
              className="pharmacy-pill-dark h-9 px-6 bg-[#063331] text-white rounded-full text-xs font-bold transition shadow-xs cursor-pointer"
            >
              I Have Saved This Key
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#063331] mb-1.5">
              Operator Email Address
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="operator@platform.example.com"
              className="w-full h-10 px-3.5 text-xs bg-[#f8fbf9] border border-[#073533]/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#063331]/20 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#063331] mb-1.5">
              Initial Password (Min 16 characters)
            </label>
            <input
              type="password"
              required
              minLength={16}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••••••••••"
              className="w-full h-10 px-3.5 text-xs bg-[#f8fbf9] border border-[#073533]/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#063331]/20 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#063331] mb-1.5">
              Platform Role Assignment
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full h-10 px-3.5 text-xs bg-[#f8fbf9] border border-[#073533]/[0.1] rounded-xl font-bold text-[#063331] focus:outline-none focus:ring-2 focus:ring-[#063331]/20 cursor-pointer"
            >
              <option value="platform_admin">Platform Admin (Full operations)</option>
              <option value="billing_manager">Billing Manager (Subscriptions & Flex)</option>
              <option value="finance_operator">Finance Operator (Settlements & T+1)</option>
              <option value="support_operator">Support Operator (Read-only diagnostics)</option>
              <option value="read_only_auditor">Read-Only Auditor (Compliance logs)</option>
            </select>
          </div>

          <div className="pt-3 border-t border-[#073533]/[0.06] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
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
      )}
    </OwnerModal>
  );
}
