import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PayerPortalView } from '@/components/payer-portal-view';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Dodo – Fee Account & Payer Portal',
  description: 'Review your installments, payments and receipts from one protected view.',
  robots: { index: false, follow: false, noarchive: true },
};

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ checkout?: string; mandate?: string; ref?: string; reset?: string }>;
};

import { getDemoPayerData, resetDemoPayerData } from '@/lib/payer-store';

async function load(token: string) {
  if (
    token.startsWith('demo-') ||
    token.startsWith('sec-') ||
    token.startsWith('access-') ||
    token.startsWith('DPS-') ||
    process.env.DEPLOYMENT_MODE === 'demo' ||
    process.env.JODO_READONLY_PREVIEW === 'true'
  ) {
    const data = getDemoPayerData(token);
    if (data) return data;
  }
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(token)) return null;
  const base = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
  try {
    const r = await fetch(base + '/v1/payer/' + encodeURIComponent(token), {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (r.ok) return await r.json();
  } catch {}
  return getDemoPayerData(token);
}

export default async function PayerPortal({ params, searchParams }: Props) {
  const { token } = await params;
  const cleanToken = decodeURIComponent(token || '').replace(/\/+$/, '').trim();
  const sp = (await searchParams) || {};
  if (sp.reset) {
    resetDemoPayerData(cleanToken);
  }
  const data = await load(cleanToken);
  if (!data) {
    return (
      <main
        id="main"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F0F7F6',
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          padding: '2rem 1rem',
        }}
      >
        <div
          role="alert"
          style={{
            maxWidth: '520px',
            width: '100%',
            background: '#FFFFFF',
            borderRadius: '24px',
            border: '1px solid #E1ECE9',
            boxShadow: '0 12px 36px rgba(6, 43, 40, 0.06)',
            padding: '2.5rem 2rem',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#FEE2E2',
              color: '#DC2626',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
              fontWeight: 800,
              marginBottom: '1.25rem',
            }}
          >
            !
          </div>
          <h1
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: '#062B28',
              margin: '0 0 0.5rem',
              letterSpacing: '-0.02em',
            }}
          >
            Invalid or Expired Access Link
          </h1>
          <p
            style={{
              color: '#5C736E',
              fontSize: '0.95rem',
              lineHeight: 1.6,
              margin: '0 0 1.75rem',
            }}
          >
            This fee account access link is invalid, expired, or references an account that does not
            exist. For security reasons, access has been denied. Please request a new access link
            from your educational institution finance office.
          </p>
          <a
            href="/login"
            style={{
              display: 'inline-block',
              background: '#062B28',
              color: '#FFFFFF',
              padding: '0.75rem 1.75rem',
              borderRadius: '9999px',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              transition: 'background 0.15s ease',
            }}
          >
            Return to Portal Login
          </a>
        </div>
      </main>
    );
  }

  return (
    <PayerPortalView
      data={data}
      token={cleanToken}
      mandateParam={sp.mandate}
      mandateRefParam={sp.ref}
    />
  );
}
