import { OwnerProvider } from '@/components/owner/owner-context';
import { OwnerShell } from '@/components/owner/owner-shell';

export const metadata = {
  title: 'Dodo Owner Dashboard | CMS Platform Console',
  description: 'Production-ready Owner CMS dashboard for platform institutions, subscriptions, and revenue.',
  robots: { index: false, follow: false },
};

export default async function OwnerPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  const section = path?.[0] || 'overview';

  return (
    <OwnerProvider initialSection={section}>
      <OwnerShell initialSection={section} />
    </OwnerProvider>
  );
}
