import { AppShell } from '@/customer/components/app-shell'

// Every signed-in screen shares this layout. It stays mounted while the customer moves between
// services, which is what keeps half-filled forms (see lib/drafts.tsx) alive.
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
