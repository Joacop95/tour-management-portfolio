import type { TranslationLanguage } from "@/lib/i18n/catalog"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export type ApplicationTranslation = {
  key: string
  en: string
  es: string
  fr: string
  tr: string
}

type ApplicationTranslationRow = {
  key: string
  english: string
  spanish: string
  french: string
  turkish: string
}

export async function getApplicationTranslations(): Promise<ApplicationTranslation[]> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return []

  const pageSize = 500
  const rows: ApplicationTranslationRow[] = []
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .rpc("get_application_translation_catalog")
      .range(start, start + pageSize - 1)
    if (error) return []
    const page = (data ?? []) as ApplicationTranslationRow[]
    rows.push(...page)
    if (page.length < pageSize) break
  }

  return rows.map((row) => ({
    key: row.key,
    en: row.english,
    es: row.spanish,
    fr: row.french,
    tr: row.turkish,
  }))
}

export function translationValueForLanguage(
  entry: ApplicationTranslation,
  language: TranslationLanguage
) {
  return entry[language]
}
