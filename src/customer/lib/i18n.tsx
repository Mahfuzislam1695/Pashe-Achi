'use client'

import { type Lang, type Text, toBnDigits } from '@/shared'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { LANG_COOKIE } from './constants'

const LangContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void }>({ lang: 'bn', setLang: () => {} })

export function LangProvider({ initialLang, children }: { initialLang: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
  }, [])

  // Keeps <html lang> in sync: Bangla rules in globals.css (letter-spacing 0) key on it.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang])
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

/**
 * Every visible string is written as t('বাংলা', 'English') where it is used.
 * Amounts keep Latin digits in both languages ("760 টাকা" / "Tk 760"), as in the sketches;
 * row numbers and counts use Bengali digits in Bangla mode.
 */
export function useLang() {
  const { lang, setLang } = useContext(LangContext)
  const digits = (n: number) => (lang === 'bn' ? toBnDigits(n) : String(n))
  return {
    lang,
    setLang,
    t: (bn: string, en: string) => (lang === 'bn' ? bn : en),
    text: (value: Text) => value[lang],
    taka: (amount: number) => (lang === 'bn' ? `${amount} টাকা` : `Tk ${amount}`),
    digits,
    rowNumber: (index: number) => (lang === 'bn' ? `${digits(index + 1)}।` : `${index + 1}.`),
    formatDate: (iso: string, withTime = false) =>
      new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
        timeZone: 'Asia/Dhaka',
      }),
  }
}
