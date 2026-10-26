import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PayerTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect('/student/?token=' + encodeURIComponent(token));
}
