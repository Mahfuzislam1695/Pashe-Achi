'use client'

import { ADMIN_ROLE_LABELS, APP_LOGO, APP_NAME } from '@/shared'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, ClipboardList, History, LayoutDashboard, LogOut, Megaphone, Menu, RotateCw, Settings2, ShieldCheck, UserRound, Users, Volume2, VolumeX, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { api } from '@/admin/lib/api'
import { useLang } from '@/admin/lib/i18n'
import { useAdmin, useUnreadCount } from '@/admin/lib/queries'
import { RealtimeProvider, useOrderSound } from '@/admin/lib/realtime'
import { canManage, cn, isSuperAdmin } from '@/admin/lib/utils'
import { Button, ErrorNote, LangSwitch, Loading } from './ui'

/** Waits for the signed-in admin, then renders the panel frame with live updates. */
export function PanelShell({ children }: { children: React.ReactNode }) {
  const admin = useAdmin()
  const { t } = useLang()
  if (admin.isSuccess) {
    return (
      <RealtimeProvider>
        <Frame>{children}</Frame>
      </RealtimeProvider>
    )
  }
  return (
    <main className="grid min-h-screen place-items-center p-6">
      {admin.isError ? (
        <div className="grid w-full max-w-xs gap-3">
          <ErrorNote code="network" />
          <Button variant="secondary" onClick={() => void admin.refetch()}>
            <RotateCw className="size-4" />
            {t('আবার চেষ্টা করুন', 'Try again')}
          </Button>
        </div>
      ) : (
        <Loading />
      )}
    </main>
  )
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src={APP_LOGO} alt="" className="size-9 rounded-full bg-white object-cover ring-1 ring-line" />
      <div className={cn('leading-tight', compact && 'hidden sm:block')}>
        <strong className="block text-sm">{APP_NAME.en}</strong>
        <span className="text-xs text-muted">Admin</span>
      </div>
    </div>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  const { t, text, digits } = useLang()
  const admin = useAdmin().data!
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const unread = useUnreadCount().data?.count ?? 0
  const sound = useOrderSound()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => setMenuOpen(false), [pathname])

  const nav = [
    { href: '/admin', label: t('ড্যাশবোর্ড', 'Dashboard'), icon: LayoutDashboard },
    { href: '/admin/orders', label: t('অর্ডার', 'Orders'), icon: ClipboardList },
    { href: '/admin/customers', label: t('গ্রাহক', 'Customers'), icon: Users },
    { href: '/admin/catalog', label: t('দাম ও গাড়ী', 'Pricing & vehicles'), icon: Settings2 },
    { href: '/admin/notifications', label: t('নোটিফিকেশন', 'Notifications'), icon: Megaphone },
    ...(canManage(admin.role) ? [{ href: '/admin/history', label: t('ইতিহাস', 'History'), icon: History }] : []),
    ...(isSuperAdmin(admin.role) ? [{ href: '/admin/staff', label: t('স্টাফ', 'Staff'), icon: ShieldCheck }] : []),
  ]
  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`))

  const signOut = async () => {
    await api.auth.logout().catch(() => undefined)
    queryClient.clear()
    router.replace('/admin/login')
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <Brand />
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('মেনু বন্ধ করুন', 'Close menu')} onClick={() => setMenuOpen(false)}>
          <X className="size-5" />
        </Button>
      </div>
      <nav className="grid gap-1" aria-label={t('প্রধান মেনু', 'Main navigation')}>
        {nav.map(item => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
              isActive(item.href) ? 'bg-brand-50 text-brand-700' : 'text-muted hover:bg-canvas hover:text-ink',
            )}
          >
            <item.icon className="size-4.5" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto grid gap-2 border-t border-line pt-4">
        <Link href="/admin/profile" className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-canvas">
          <div className="grid size-8 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{admin.name[0]}</div>
          <div className="min-w-0 leading-tight">
            <strong className="block truncate text-sm">{admin.name}</strong>
            <span className="text-xs text-muted">{text(ADMIN_ROLE_LABELS[admin.role])}</span>
          </div>
        </Link>
        <Button variant="ghost" className="justify-start" onClick={() => void signOut()}>
          <LogOut className="size-4" />
          {t('সাইন আউট', 'Sign out')}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-surface lg:block">{sidebar}</aside>
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-ink/30" aria-label={t('মেনু বন্ধ করুন', 'Close menu')} onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-xl">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('মেনু খুলুন', 'Open menu')} onClick={() => setMenuOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <div className="lg:hidden">
            <Brand compact />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <LangSwitch />
            <Button
              variant="ghost"
              size="icon"
              aria-pressed={sound.enabled}
              aria-label={sound.enabled ? t('নতুন অর্ডারের শব্দ বন্ধ করুন', 'Mute new-order sound') : t('নতুন অর্ডারের শব্দ চালু করুন', 'Unmute new-order sound')}
              title={sound.enabled ? t('শব্দ চালু', 'Sound on') : t('শব্দ বন্ধ', 'Sound off')}
              onClick={sound.toggle}
            >
              {sound.enabled ? <Volume2 className="size-4.5" /> : <VolumeX className="size-4.5" />}
            </Button>
            <Link
              href="/admin/notifications"
              className="relative grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
              aria-label={unread ? t(`নোটিফিকেশন, ${digits(unread)}টি নতুন`, `Notifications, ${unread} unread`) : t('নোটিফিকেশন', 'Notifications')}
            >
              <Bell className="size-4.5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {unread > 99 ? '99+' : digits(unread)}
                </span>
              )}
            </Link>
            <Link href="/admin/profile" className="grid size-9 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700" aria-label={t('প্রোফাইল', 'Profile')}>
              <UserRound className="size-4" />
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
