/**
 * DODO.FINANCE — Future-Ready eNACH Provider Abstraction
 * Currently adapts exclusively to `sandbox_enach`. Live providers remain strictly disabled.
 */

import type {
  SandboxMandate,
  SandboxDebitAttempt,
  MandateStatus,
  DebitStatus,
  AuthMethod,
} from './types';

export interface CreateMandateRequest {
  tenantId: string;
  studentId: string;
  studentName: string;
  accountReference: string;
  payerName: string;
  payerPhone: string;
  payerEmail: string;
  payerVpa?: string;
  preferredUpiApp?: string;
  bankName: string;
  maskedAccount: string;
  ifscCode: string;
  feePlan: string;
  maxAmountMinor: number;
  frequency: 'monthly' | 'bi-monthly' | 'quarterly' | 'as_presented';
  startDate: string;
  endDate: string;
  authMode: AuthMethod;
  rail?: 'UPI AutoPay (Sandbox)' | 'eNACH (Sandbox)';
}

export interface CreateMandateResponse {
  success: boolean;
  mandateReference: string;
  status: MandateStatus;
  authUrl?: string;
  error?: string;
}

export interface SubmitDebitRequest {
  tenantId: string;
  mandateId: string;
  mandateReference: string;
  studentId: string;
  studentName: string;
  accountReference: string;
  payerName: string;
  payerPhone: string;
  installmentId: string;
  installmentName: string;
  amountMinor: number;
  scheduledDate: string;
  simulationOutcome?: 'auto' | 'force_fail' | 'force_success';
}

export interface SubmitDebitResponse {
  success: boolean;
  debitAttemptId: string;
  providerReference: string;
  status: DebitStatus;
  failureCode?: string;
  failureReason?: string;
}

export interface ProviderCapabilityMatrix {
  providerId: 'sandbox_autopay' | 'sandbox_enach' | 'live_npci_enach' | 'razorpay';
  displayName: string;
  isLive: boolean;
  capabilities: {
    createMandate: boolean;
    simulateAuthorization: boolean;
    submitScheduledDebit: boolean;
    instantDebitInquiry: boolean;
    cancelMandate: boolean;
    webhookCallbacks: boolean;
    liveBankClearing: boolean;
  };
  railVersion: string;
  clearingCycle: string;
  operationalStatus: 'operational' | 'degraded' | 'maintenance' | 'disabled';
  liveActivationPrerequisites: string[];
}

export const CURRENT_PROVIDER_METRICS: ProviderCapabilityMatrix = {
  providerId: 'sandbox_autopay',
  displayName: 'NPCI UPI AutoPay 2.0 & eNACH Recurring Collections Rail',
  isLive: false,
  capabilities: {
    createMandate: true,
    simulateAuthorization: true,
    submitScheduledDebit: true,
    instantDebitInquiry: true,
    cancelMandate: true,
    webhookCallbacks: true,
    liveBankClearing: false, // Strictly simulation
  },
  railVersion: 'NPCI UPI AutoPay Spec v2.0 / eNACH API (Sandbox Mode)',
  clearingCycle: 'Instant UPI 2.0 Real-Time Auto-Debit Clearing',
  operationalStatus: 'operational',
  liveActivationPrerequisites: [
    'Approved NPCI / RBI Sponsoring Member Bank or Aggregator Agreement (Razorpay / Cashfree / PayU)',
    'Certified Production Merchant VPA & Key Whitelisting',
    'Configured RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET in environment',
    'Automated 24-Hour Pre-Debit SMS/WhatsApp Webhook Notification Gateway',
    'Hardware Security Module (HSM) or secure Vault token storage for mandate tokens',
    'Dual-factor cryptographic signature on mandate authorization webhooks',
    'Formal Board-level authorization for live payment collection',
  ],
};

/**
 * Adapter interface required for any future live eNACH provider
 */
export interface EnachProviderAdapter {
  providerId: string;
  getCapabilities(): ProviderCapabilityMatrix;
  createMandate(req: CreateMandateRequest): Promise<CreateMandateResponse>;
  simulateAuthorization(
    mandateReference: string,
    action: 'approve' | 'reject',
    method: AuthMethod,
    bankName: string,
  ): Promise<{ status: MandateStatus; reason?: string }>;
  submitDebit(req: SubmitDebitRequest): Promise<SubmitDebitResponse>;
  cancelMandate(mandateReference: string, reason: string): Promise<{ success: boolean }>;
  verifyWebhook(payload: unknown, signature: string): Promise<boolean>;
}

/**
 * Sandbox Adapter Implementation
 */
export class SandboxEnachAdapter implements EnachProviderAdapter {
  readonly providerId = 'sandbox_autopay';

  getCapabilities(): ProviderCapabilityMatrix {
    return CURRENT_PROVIDER_METRICS;
  }

  async createMandate(req: CreateMandateRequest): Promise<CreateMandateResponse> {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const isUpi = Boolean(req.payerVpa || req.rail?.includes('UPI') || req.authMode.includes('UPI'));
    const mandateReference = isUpi ? `UMN-UPI-2026-${randomSuffix}` : `UMRN-SBX-2026-${randomSuffix}`;

    return {
      success: true,
      mandateReference,
      status: 'pending_authorization',
      authUrl: isUpi
        ? `upi://mandate?pa=institution@yesbank&pn=DelhiPublicSchool&tr=${mandateReference}&am=${req.maxAmountMinor / 100}&cu=INR`
        : undefined,
    };
  }

  async simulateAuthorization(
    mandateReference: string,
    action: 'approve' | 'reject',
    method: AuthMethod,
    bankName: string,
  ): Promise<{ status: MandateStatus; reason?: string }> {
    if (action === 'approve') {
      return { status: 'active' };
    }
    return {
      status: 'rejected',
      reason: `Customer declined sandbox authorization via ${method} (${bankName})`,
    };
  }

  async submitDebit(req: SubmitDebitRequest): Promise<SubmitDebitResponse> {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const debitAttemptId = `deb-sbx-${Date.now().toString().slice(-6)}`;
    const providerReference = `DEB-UPI-2026-${randomSuffix}`;

    if (req.simulationOutcome === 'force_fail') {
      return {
        success: false,
        debitAttemptId,
        providerReference,
        status: 'failed',
        failureCode: 'U69',
        failureReason: 'Insufficient funds in customer UPI account (NPCI Code U69)',
      };
    }

    return {
      success: true,
      debitAttemptId,
      providerReference,
      status: 'succeeded',
    };
  }

  async cancelMandate(mandateReference: string, reason: string): Promise<{ success: boolean }> {
    return { success: true };
  }

  async verifyWebhook(payload: unknown, signature: string): Promise<boolean> {
    return Boolean(signature && (signature.startsWith('sbx_sig_') || signature.length >= 32));
  }
}

export const sandboxEnachProvider = new SandboxEnachAdapter();
