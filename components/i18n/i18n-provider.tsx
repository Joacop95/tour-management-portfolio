"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"

import { useUiLanguage } from "@/components/settings/settings-client-store"
import { interpolateTranslation, type TranslationLanguage } from "@/lib/i18n/catalog"
import { uiCatalog, type UiTranslationKey } from "@/lib/i18n/ui-catalog"
import {
  getApplicationTranslations,
  type ApplicationTranslation,
} from "@/lib/supabase/queries/application-translations"

const localeByLanguage: Record<TranslationLanguage, string> = {
  en: "en-US",
  es: "es",
  fr: "fr",
  tr: "tr",
}

type I18nContextValue = {
  language: TranslationLanguage
  locale: string
  t: (
    key: UiTranslationKey,
    variables?: Record<string, string | number>
  ) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useUiLanguage()
  const [translations, setTranslations] = useState<ApplicationTranslation[]>([])

  useEffect(() => {
    let isMounted = true
    void getApplicationTranslations().then((result) => {
      if (isMounted) setTranslations(result)
    })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const value = useMemo<I18nContextValue>(() => {
    const translationsByKey = new Map(translations.map((entry) => [entry.key, entry]))
    return {
      language,
      locale: localeByLanguage[language],
      t(key, variables) {
        const source = uiCatalog[key].english
        const persisted = translationsByKey.get(key)
        const translated = persisted?.[language]?.trim()
        return interpolateTranslation(translated || persisted?.en || source, variables)
      },
    }
  }, [language, translations])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error("useI18n must be used within I18nProvider.")
  return value
}

export function T({
  i18nKey,
  variables,
}: {
  i18nKey: UiTranslationKey
  variables?: Record<string, string | number>
}) {
  const { t } = useI18n()
  return <>{t(i18nKey, variables)}</>
}
