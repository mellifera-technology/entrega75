import { DashboardShell } from '@/components/dashboard-shell';
import { requireViewer } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireViewer();
  return (
    <DashboardShell role={profile.role} fullName={profile.full_name} email={profile.email}>
      {children}
    </DashboardShell>
  );
}
