import { AppShell } from '@/customer/components/app-shell'

// The app version (/app/bazar, /app/orders/…): the phone design at every width. The layout stays
// mounted while the customer moves between services, which is what keeps half-filled forms
// (see lib/drafts.tsx) alive.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell mode="app">{children}</AppShell>
}
