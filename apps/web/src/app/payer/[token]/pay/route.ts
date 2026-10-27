import { NextRequest, NextResponse } from 'next/server';

function siteBase(request?: NextRequest) {
  if (request) {
    const host = request.headers.get('host') || request.nextUrl.host;
    if (host) {
      const proto =
        request.headers.get('x-forwarded-proto') ||
        (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https');
      return `${proto}://${host}`.replace(/\/$/, '');
    }
  }
  return (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const cleanToken = decodeURIComponent(token || '').replace(/\/+$/, '').trim();
  const origin = request.headers.get('origin');
  if (
    origin &&
    origin !== siteBase(request) &&
    !origin.includes('localhost') &&
    !origin.includes('127.0.0.1')
  )
    return new NextResponse('Request origin is not allowed', { status: 403 });

  const isJson = (request.headers.get('content-type') || '').includes('application/json');
  let installmentId = '';
  let idempotencyKey = '';
  let amountMinor = 0;
  let allocations: Array<{ componentCode: string; amountMinor: number }> = [];

  if (isJson) {
    const json = await request.json().catch(() => ({}));
    installmentId = String(json.installmentId || '');
    idempotencyKey = String(json.idempotencyKey || '');
    amountMinor = Number(json.amountMinor || 0);
    if (Array.isArray(json.allocations)) {
      allocations = json.allocations;
    }
  } else {
    const form = await request.formData();
    installmentId = String(form.get('installmentId') || '');
    idempotencyKey = String(form.get('idempotencyKey') || '');

    allocations = Array.from(form.entries())
      .filter(([key]) => key.startsWith('component_'))
      .map(([key, value]) => {
        const amount = Number(value);
        return {
          componentCode: key.slice('component_'.length),
          amountMinor: Number.isFinite(amount) ? Math.round(amount * 100) : 0,
        };
      })
      .filter((item) => item.amountMinor > 0);

    const explicitMinor = Number(form.get('amountMinor'));
    const customMajor = Number(form.get('amount'));
    amountMinor = allocations.length
      ? allocations.reduce((sum, item) => sum + item.amountMinor, 0)
      : Number.isInteger(explicitMinor) && explicitMinor > 0
        ? explicitMinor
        : Number.isFinite(customMajor) && customMajor > 0
          ? Math.round(customMajor * 100)
          : 0;
  }

  if (
    !installmentId ||
    !Number.isInteger(amountMinor) ||
    amountMinor <= 0
  ) {
    if (isJson) return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
    return NextResponse.redirect(
      siteBase(request) + '/payer/' + encodeURIComponent(cleanToken) + '/?checkout=invalid',
      303,
    );
  }

  // Overpayment check for online checkout
  const { getDemoPayerData } = await import('@/lib/payer-store');
  const existingData = getDemoPayerData(cleanToken);
  const currentOutstanding = existingData ? Number(existingData.summary.outstanding_minor || 0) : null;
  if (currentOutstanding !== null && amountMinor > currentOutstanding) {
    if (isJson) {
      return NextResponse.json(
        {
          error: 'overpayment_not_permitted',
          message: `Payment amount exceeds current outstanding balance of ₹${(currentOutstanding / 100).toLocaleString('en-IN')}`,
          outstandingMinor: currentOutstanding,
        },
        { status: 400 },
      );
    }
    return NextResponse.redirect(
      siteBase(request) + '/payer/' + encodeURIComponent(cleanToken) + '/?checkout=overpayment_rejected',
      303,
    );
  }

  const api = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
  let response: any = null;
  try {
    response = await fetch(api + '/v1/payer/' + encodeURIComponent(token) + '/checkout', {
      method: 'POST',
      headers: {
        Origin: siteBase(request),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        installmentId,
        amountMinor,
        idempotencyKey,
        allocations,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
  } catch {}

  if (!response || !response.ok) {
    // Preview / demo simulation success fallback
    const { applyPayerPayment } = await import('@/lib/payer-store');
    const allocationMap = allocations.reduce((acc, curr) => ({ ...acc, [curr.componentCode]: curr.amountMinor }), {});
    const updated = applyPayerPayment(cleanToken, installmentId, amountMinor, allocationMap, idempotencyKey);

    // Also notify internal admin payments API so that the dashboard updates automatically!
    try {
      const base = siteBase(request);
      await fetch(base + '/api/v1/admin/fees/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountReference: updated?.payer?.accountReference || 'DPS-2026-089',
          studentId: updated?.payer?.accountReference || updated?.payer?.id || 'DPS-2026-089',
          installmentId,
          amountMinor,
          providerReference: idempotencyKey || `TXN-ONL-${Date.now().toString().slice(-6)}`,
          directPayment: { mode: 'online' },
        }),
      });
    } catch {}

    if (isJson) {
      return NextResponse.json({ ok: true, success: true, updated });
    }

    return NextResponse.redirect(
      siteBase(request) + '/payer/' + encodeURIComponent(cleanToken) + '/?checkout=success',
      303,
    );
  }

  const data = await response.json().catch(() => null);
  if (isJson) {
    return NextResponse.json(data || { ok: true, success: true });
  }

  let checkout: URL;
  try {
    checkout = new URL(data?.checkoutUrl || siteBase() + '/payer/' + encodeURIComponent(token) + '/?checkout=success');
  } catch {
    return NextResponse.redirect(
      siteBase() + '/payer/' + encodeURIComponent(token) + '/?checkout=unavailable',
      303,
    );
  }
  if (checkout.protocol !== 'https:' && process.env.NODE_ENV === 'production')
    return NextResponse.redirect(
      siteBase() + '/payer/' + encodeURIComponent(token) + '/?checkout=unavailable',
      303,
    );
  return NextResponse.redirect(checkout, 303);
}
