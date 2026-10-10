import { AppShell } from '@/customer/components/app-shell'

// The web version (/bazar, /orders/…): the desktop layout from 1024px, the phone layout below it.
// The layout stays mounted while the customer moves between services, which is what keeps
// half-filled forms (see lib/drafts.tsx) alive.
export default function WebLayout({ children }: { children: React.ReactNode }) {
  return <AppShell mode="web">{children}</AppShell>
}
