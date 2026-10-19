import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import type { TranslationImportRow } from "@/lib/i18n/catalog"

type ImportTranslationsRpcRow = {
  success: boolean
  code: string
  message: string
  updated_count: number
}

export async function importTranslationRows(rows: TranslationImportRow[]) {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    return { success: false, updatedCount: 0, message: "Supabase is unavailable." }
  }

  const { data, error } = await supabase.rpc("import_translation_values", {
    p_rows: rows.map((row) => ({
      key: row.key,
      es: row.values.es,
      fr: row.values.fr,
      tr: row.values.tr,
    })),
  })
  if (error) {
    return {
      success: false,
      updatedCount: 0,
      message: "Translations could not be imported.",
    }
  }

  const result = (Array.isArray(data) ? data[0] : null) as
    | ImportTranslationsRpcRow
    | undefined
  return {
    success: Boolean(result?.success),
    updatedCount: result?.updated_count ?? 0,
    message: result?.message ?? "Translations could not be imported.",
  }
}
