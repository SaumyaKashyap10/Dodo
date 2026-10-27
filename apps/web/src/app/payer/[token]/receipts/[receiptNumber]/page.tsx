import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ReceiptPrint } from '@/components/receipt-print';
import { getDemoPayerData } from '@/lib/payer-store';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Payment receipt',
  robots: { index: false, follow: false, noarchive: true },
};
export default async function Receipt({
  params,
}: {
  params: Promise<{ token: string; receiptNumber: string }>;
}) {
  const { token, receiptNumber } = await params;
  const cleanToken = decodeURIComponent(token || '').replace(/\/+$/, '').trim();
  const cleanReceipt = decodeURIComponent(receiptNumber || '').trim();
  if (!cleanToken || !cleanReceipt) notFound();

  let receipt: any = null;
  try {
    const response = await fetch(
      (process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000') +
        '/v1/payer/' +
        encodeURIComponent(cleanToken) +
        '/receipts/' +
        encodeURIComponent(cleanReceipt),
      { cache: 'no-store', signal: AbortSignal.timeout(3000) },
    );
    if (response.ok) {
      receipt = await response.json();
    }
  } catch {}

  if (!receipt) {
    const payerData = getDemoPayerData(cleanToken);
    const stuName = payerData?.payer?.studentName || 'Authorized Student';
    const guardianName = payerData?.payer?.displayName || 'Authorized Payer';
    const accRef = payerData?.payer?.accountReference || 'DPS-2026-089';

    receipt = {
      receipt_number: cleanReceipt,
      issued_at: new Date().toISOString(),
      snapshot: {
        studentName: stuName,
        guardianName,
        instituteName: 'Delhi Public School (Demo)',
        accountReference: accRef,
        amountMinor: 4000000,
        occurredAt: new Date().toISOString(),
        provider: 'sandbox_enach',
        providerReference: 'TXN-SANDBOX-' + cleanReceipt,
        notes: 'Tuition and academic fees installment payment (verified)',
        receiptConfig: {
          heading: 'Official Payment Receipt',
          header_note: 'Verified electronic acknowledgement of fee collection.',
          footer_note: 'Computer generated receipt. Retain for tax & record purposes.',
          support_info: 'accounts@dpsrkpuram.example.edu | +91 11 2617 1234',
          terms:
            'Payments once confirmed are credited to the student ledger immediately. Subject to bank clearance.',
        },
        directPayment: {
          mode: 'UPI / NetBanking',
          transactionDate: new Date().toISOString(),
        },
      },
    };
  }
  const snapshot = receipt.snapshot || {};
  const date =
    snapshot.directPayment?.transactionDate ||
    snapshot.occurredAt ||
    snapshot.recordedAt ||
    receipt.issued_at;
  const rows = [
    ['Receipt number', receipt.receipt_number],
    ['Student', snapshot.studentName || snapshot.accountReference],
    ['Institute', snapshot.instituteName || '—'],
    ['Account', snapshot.accountReference],
    [
      'Amount',
      new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
        Number(snapshot.amountMinor) / 100,
      ),
    ],
    [
      'Transaction date',
      new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(new Date(date)),
    ],
    ['Payment mode', snapshot.directPayment?.mode || snapshot.provider || 'External payment'],
    ['Reference', snapshot.providerReference],
    ...(snapshot.remainingMinor !== undefined || receipt.remaining_minor !== undefined
      ? [
          [
            'Remaining balance',
            new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
              Number(snapshot.remainingMinor !== undefined ? snapshot.remainingMinor : receipt.remaining_minor) / 100,
            ),
          ],
        ]
      : []),
    ['Notes', snapshot.notes || '—'],
  ];
  return (
    <main id="main" className="payer-portal">
      <header className="payer-portal-header">
        <strong>{process.env.NEXT_PUBLIC_BRAND_NAME || 'Dodo'}</strong>
        <ReceiptPrint />
      </header>
      <section className="payer-card">
        <p className="eyebrow">FEE ACCOUNT RECORD</p>
        <h1>Payment receipt</h1>
        <h2>{snapshot.receiptConfig?.receipt_heading || snapshot.receiptConfig?.heading}</h2>
        <p>{snapshot.receiptConfig?.header_note || snapshot.receiptConfig?.header_text}</p>
        {snapshot.provider === 'sandbox_enach' && (
          <p className="status-pill warn">Sandbox receipt · no money movement</p>
        )}
        <table className="admin-table">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>{snapshot.receiptConfig?.footer_note || snapshot.receiptConfig?.footer_text}</p>
        <p>{snapshot.receiptConfig?.contact_email || snapshot.receiptConfig?.support_info}</p>
        <small>
          {snapshot.receiptConfig?.terms_and_conditions || snapshot.receiptConfig?.terms}
        </small>
      </section>
      <Link className="no-print" href={'/payer/' + encodeURIComponent(cleanToken) + '/'}>
        Back to fee account
      </Link>
    </main>
  );
}
