'use client'

import { APP_LOGO, APP_NAME, can } from '@/shared'
import { useQueryClient } from '@tanstack/react-query'
import { BadgePercent, Bell, BellOff, BellRing, ClipboardList, History, LayoutDashboard, LogOut, Megaphone, Menu, RotateCw, Settings2, ShieldCheck, UserCog, UserRound, Users, Volume2, VolumeX, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { api } from '@/admin/lib/api'
import { useLang } from '@/admin/lib/i18n'
import { forgetAdminPush, PushProvider, usePush } from '@/admin/lib/push'
import { useAdmin, useUnreadCount } from '@/admin/lib/queries'
import { RealtimeProvider, useOrderSound } from '@/admin/lib/realtime'
import { cn } from '@/admin/lib/utils'
import { DeveloperCredit } from './developer-credit'
import { Button, ErrorNote, LangSwitch, Loading } from './ui'

/** Waits for the signed-in admin, then renders the panel frame with live updates. */
export function PanelShell({ children }: { children: React.ReactNode }) {
  const admin = useAdmin()
  const { t } = useLang()
  if (admin.isSuccess) {
    // Phone and desktop push belongs to the inbox: only for roles that can see notifications.
    return (
      <RealtimeProvider>
        {can(admin.data, 'notifications.view') ? (
          <PushProvider>
            <Frame>{children}</Frame>
          </PushProvider>
        ) : (
          <Frame>{children}</Frame>
        )}
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
      <img src={APP_LOGO} alt="" className="size-11 object-contain drop-shadow-sm" />
      <div className={cn('leading-tight', compact && 'hidden sm:block')}>
        <strong className="block text-[15px] font-bold text-navy">{APP_NAME.en}</strong>
        <span className="text-xs font-medium text-brand-600">Admin</span>
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
  const inbox = can(admin, 'notifications.view')
  const unread = useUnreadCount(inbox).data?.count ?? 0
  const sound = useOrderSound()
  const push = usePush()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => setMenuOpen(false), [pathname])

  // Each page shows in the menu only when the role can view it.
  const nav = [
    can(admin, 'dashboard.view') && { href: '/admin', label: t('ড্যাশবোর্ড', 'Dashboard'), icon: LayoutDashboard },
    can(admin, 'orders.view') && { href: '/admin/orders', label: t('অর্ডার', 'Orders'), icon: ClipboardList },
    can(admin, 'customers.view') && { href: '/admin/customers', label: t('গ্রাহক', 'Customers'), icon: Users },
    can(admin, 'catalog.view') && { href: '/admin/catalog', label: t('দাম ও গাড়ী', 'Pricing & vehicles'), icon: Settings2 },
    can(admin, 'offers.view') && { href: '/admin/offers', label: t('আজকের অফার', "Today's offers"), icon: BadgePercent },
    inbox && { href: '/admin/notifications', label: t('নোটিফিকেশন', 'Notifications'), icon: Megaphone },
    can(admin, 'history.view') && { href: '/admin/history', label: t('ইতিহাস', 'History'), icon: History },
    can(admin, 'staff.view') && { href: '/admin/staff', label: t('স্টাফ', 'Staff'), icon: ShieldCheck },
    can(admin, 'roles.view') && { href: '/admin/roles', label: t('রোল ও অনুমতি', 'Roles & permissions'), icon: UserCog },
  ].filter(item => !!item)
  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`))

  const signOut = async () => {
    if (inbox) await forgetAdminPush()
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
              'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              isActive(item.href)
                ? 'bg-brand-50 font-semibold text-brand-700 before:absolute before:inset-y-2.5 before:left-0 before:w-0.75 before:rounded-r-full before:bg-linear-to-b before:from-teal before:to-brand-600'
                : 'text-muted hover:bg-canvas hover:text-navy',
            )}
          >
            <item.icon className="size-4.5" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto grid gap-2 border-t border-line pt-4">
        <Link href="/admin/profile" className="flex items-center gap-3 rounded-xl border border-line bg-canvas/60 px-2.5 py-2 transition-colors hover:border-brand-200">
          <div className="grid size-8 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{admin.name[0]}</div>
          <div className="min-w-0 leading-tight">
            <strong className="block truncate text-sm text-navy">{admin.name}</strong>
            <span className="text-xs text-muted">{text(admin.role.name)}</span>
          </div>
        </Link>
        <Button variant="ghost" className="justify-start" onClick={() => void signOut()}>
          <LogOut className="size-4" />
          {t('সাইন আউট', 'Sign out')}
        </Button>
        <DeveloperCredit className="justify-self-center" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-surface lg:block">{sidebar}</aside>
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-navy/40" aria-label={t('মেনু বন্ধ করুন', 'Close menu')} onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-raised">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
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
            <PushToggle push={push} />
            {inbox && (
            <Link
              href="/admin/notifications"
              className="relative grid size-9 place-items-center rounded-xl text-muted transition-colors hover:bg-canvas hover:text-brand-700"
              aria-label={unread ? t(`নোটিফিকেশন, ${digits(unread)}টি নতুন`, `Notifications, ${unread} unread`) : t('নোটিফিকেশন', 'Notifications')}
            >
              <Bell className="size-4.5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-surface">
                  {unread > 99 ? '99+' : digits(unread)}
                </span>
              )}
            </Link>
            )}
            <Link href="/admin/profile" className="grid size-9 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white transition-colors hover:bg-brand-700" aria-label={t('প্রোফাইল', 'Profile')}>
              <UserRound className="size-4" />
            </Link>
          </div>
        </header>
        <main className="w-full p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}

/**
 * Desktop or phone notifications on this device (Web Push): new orders, confirms and cancels reach
 * staff even with the panel closed. Hidden where the browser or the server can't do it.
 */
function PushToggle({ push }: { push: ReturnType<typeof usePush> }) {
  const { t } = useLang()
  if (!push.status || push.status === 'unavailable' || push.status === 'unsupported') return null
  const on = push.status === 'on'
  const help =
    push.status === 'blocked'
      ? t('এই ব্রাউজারে নোটিফিকেশন বন্ধ করা আছে। ঠিকানার বারের আইকন থেকে Allow করে পেজটি রিফ্রেশ করুন।', 'Notifications are blocked in this browser. Allow them from the address bar icon, then refresh.')
      : push.status === 'ios-install'
        ? t('iPhone/iPad-এ: Share → Add to Home Screen, তারপর সেখান থেকে খুলে চালু করুন।', 'On iPhone/iPad: Share → Add to Home Screen, then open it from there and turn them on.')
        : null
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-pressed={on}
      aria-label={on ? t('এই ডিভাইসে নোটিফিকেশন বন্ধ করুন', 'Turn off notifications on this device') : t('এই ডিভাইসে নোটিফিকেশন চালু করুন', 'Turn on notifications on this device')}
      title={help ?? (on ? t('এই ডিভাইসে নোটিফিকেশন চালু', 'Notifications on this device: on') : t('এই ডিভাইসে নোটিফিকেশন বন্ধ', 'Notifications on this device: off'))}
      loading={push.busy}
      onClick={() => {
        if (help) return void toast(help)
        if (on) push.disable()
        else push.enable()
      }}
    >
      {push.busy ? null : on ? <BellRing className="size-4.5 text-brand-700" /> : <BellOff className="size-4.5" />}
    </Button>
  )
}
