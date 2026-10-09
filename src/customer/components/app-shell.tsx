'use client'

import { SERVICE_IDS, SERVICE_LABELS } from '@/shared'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, ChevronRight, ClipboardList, Menu, RotateCw, UserRound, X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { SERVICE_ICONS } from '@/customer/features/orders'
import { api } from '@/customer/lib/api'
import { DraftsProvider } from '@/customer/lib/drafts'
import { useLang } from '@/customer/lib/i18n'
import { useCatalog, useMe, useUnreadCount } from '@/customer/lib/queries'
import { RealtimeProvider } from '@/customer/lib/realtime'
import { ContactDock, FormError, LangToggle, Logo } from './ui'

/**
 * The signed-in frame: drawer, top bar (language, bell, avatar), page body and the bottom nav of
 * the four services. Renders nothing but a splash until the customer and the catalog are loaded,
 * so every screen below can rely on useSession().
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const me = useMe()
  const catalog = useCatalog()
  const { t } = useLang()

  if (me.isSuccess && catalog.isSuccess) {
    return (
      <DraftsProvider>
        <RealtimeProvider>
          <Frame>{children}</Frame>
        </RealtimeProvider>
      </DraftsProvider>
    )
  }

  const failed = (me.isError && me.error) || (catalog.isError && catalog.error)
  return (
    <main className="app-shell splash">
      <Logo />
      {failed && (
        <div className="confirm splash-error">
          <FormError code="network" />
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              void me.refetch()
              void catalog.refetch()
            }}
          >
            <RotateCw size={16} />
            {t('আবার চেষ্টা করুন', 'Try again')}
          </button>
        </div>
      )}
    </main>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  const { t, text, lang, setLang, digits } = useLang()
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const user = useMe().data!
  const unread = useUnreadCount().data?.count ?? 0
  const [menuOpen, setMenuOpen] = useState(false)

  // Service tabs switch instantly: their routes are prefetched once.
  useEffect(() => {
    for (const service of SERVICE_IDS) router.prefetch(`/${service}`)
  }, [router])

  const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`)
  const go = (path: string) => {
    setMenuOpen(false)
    router.push(path)
    window.scrollTo({ top: 0 })
  }
  const signOut = async () => {
    setMenuOpen(false)
    await api.auth.logout().catch(() => undefined)
    queryClient.clear()
    router.replace('/')
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-top">
          <Logo />
          <button className="icon-button close-menu" aria-label={t('মেনু বন্ধ করুন', 'Close menu')} onClick={() => setMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <button type="button" className="workspace" onClick={() => go('/profile')}>
          <div className="avatar">{user.name[0]}</div>
          <div>
            <strong>{user.name}</strong>
            <span>
              {user.mobile} · {t('point', 'Points')} {user.points}
            </span>
          </div>
          <ChevronRight size={16} />
        </button>
        <nav className="side-nav" aria-label={t('প্রধান মেনু', 'Main navigation')}>
          <p className="nav-label">{t('সেবাসমূহ', 'SERVICES')}</p>
          {SERVICE_IDS.map(service => {
            const Icon = SERVICE_ICONS[service]
            return (
              <button key={service} className={`nav-item ${isActive(`/${service}`) ? 'active' : ''}`} onClick={() => go(`/${service}`)}>
                <Icon size={19} />
                <span>{text(SERVICE_LABELS[service])}</span>
              </button>
            )
          })}
          <p className="nav-label account-label">{t('অ্যাকাউন্ট', 'ACCOUNT')}</p>
          <button className={`nav-item ${isActive('/orders') ? 'active' : ''}`} onClick={() => go('/orders')}>
            <ClipboardList size={19} />
            <span>{t('অর্ডার হিস্ট্রি', 'Order history')}</span>
          </button>
          <button className={`nav-item ${isActive('/notifications') ? 'active' : ''}`} onClick={() => go('/notifications')}>
            <Bell size={19} />
            <span>{t('নোটিফিকেশন', 'Notifications')}</span>
          </button>
          <button className={`nav-item ${isActive('/profile') ? 'active' : ''}`} onClick={() => go('/profile')}>
            <UserRound size={19} />
            <span>{t('প্রোফাইল', 'Profile')}</span>
          </button>
        </nav>
        <button className="logout" onClick={() => void signOut()}>
          {t('সাইন আউট', 'Sign out')}
        </button>
      </aside>
      {menuOpen && <button className="scrim" aria-label={t('মেনু বন্ধ করুন', 'Close menu')} onClick={() => setMenuOpen(false)} />}
      <section className="content">
        <header className="topbar">
          <button className="icon-button menu-trigger" aria-label={t('মেনু খুলুন', 'Open menu')} onClick={() => setMenuOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="mobile-logo">
            <Logo />
          </div>
          <div className="topbar-right">
            <LangToggle compact lang={lang} onChange={setLang} />
            <button
              type="button"
              className="icon-button bell-button"
              aria-label={unread ? t(`নোটিফিকেশন, ${digits(unread)}টি নতুন`, `Notifications, ${unread} new`) : t('নোটিফিকেশন', 'Notifications')}
              onClick={() => go('/notifications')}
            >
              <Bell size={20} />
              {unread > 0 && <span className="bell-badge">{unread > 99 ? '99+' : digits(unread)}</span>}
            </button>
            <button type="button" className="top-avatar" aria-label={t('প্রোফাইল', 'Profile')} onClick={() => go('/profile')}>
              {user.name[0]}
            </button>
          </div>
        </header>
        <div className="page-body">{children}</div>
        <ContactDock raised />
        <nav className="bottom-nav" aria-label={t('সেবাসমূহ', 'Services')}>
          {SERVICE_IDS.map(service => {
            const Icon = SERVICE_ICONS[service]
            const active = isActive(`/${service}`)
            return (
              <button key={service} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} onClick={() => go(`/${service}`)}>
                <Icon size={20} />
                <span>{text(SERVICE_LABELS[service])}</span>
              </button>
            )
          })}
        </nav>
      </section>
    </main>
  )
}
