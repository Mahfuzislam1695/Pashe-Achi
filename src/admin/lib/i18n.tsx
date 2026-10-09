'use client'

import { type Lang, type Text, toBnDigits } from '@/shared'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { LANG_COOKIE } from './constants'

const LangContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void }>({ lang: 'en', setLang: () => {} })

export function LangProvider({ initialLang, children }: { initialLang: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
  }, [])
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang])
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

/** Same convention as the customer app: every visible string is written as t('বাংলা', 'English'). */
export function useLang() {
  const { lang, setLang } = useContext(LangContext)
  const digits = (n: number) => (lang === 'bn' ? toBnDigits(n) : n.toLocaleString('en-US'))
  return {
    lang,
    setLang,
    t: (bn: string, en: string) => (lang === 'bn' ? bn : en),
    text: (value: Text) => value[lang],
    digits,
    taka: (amount: number) => (lang === 'bn' ? `${amount.toLocaleString('en-US')} টাকা` : `Tk ${amount.toLocaleString('en-US')}`),
    formatDate: (iso: string, withTime = false) =>
      new Date(iso.length === 10 ? `${iso}T00:00:00+06:00` : iso).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
        day: 'numeric',
        month: 'short',
        ...(withTime ? { hour: 'numeric', minute: '2-digit' } : { year: 'numeric' }),
        timeZone: 'Asia/Dhaka',
      }),
  }
}
