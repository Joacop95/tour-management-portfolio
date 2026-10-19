import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import type { TranslationCatalogEntry } from "@/lib/i18n/catalog"

type TranslationCatalogRpcRow = {
  key: string
  context: string
  description: string
  english: string
  spanish: string
  french: string
  turkish: string
  email_template_type: string | null
  email_template_field: "subject" | "body" | null
}

export async function getTranslationCatalog(): Promise<{
  data: TranslationCatalogEntry[]
  error: string | null
}> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return { data: [], error: "Supabase is unavailable." }

  const pageSize = 500
  const rows: TranslationCatalogRpcRow[] = []
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .rpc("get_translation_catalog")
      .range(start, start + pageSize - 1)
    if (error) return { data: [], error: "Unable to load translations." }
    const page = (data ?? []) as TranslationCatalogRpcRow[]
    rows.push(...page)
    if (page.length < pageSize) break
  }

  return {
    data: rows.map((row) => ({
      key: row.key,
      context: row.context,
      description: row.description,
      en: row.english,
      es: row.spanish,
      fr: row.french,
      tr: row.turkish,
      emailTemplateType: row.email_template_type,
      emailTemplateField: row.email_template_field,
    })),
    error: null,
  }
}
