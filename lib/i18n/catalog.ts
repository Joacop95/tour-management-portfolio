import { parseCsv, type CsvValue } from "@/lib/utils/csv"
import { uiCatalog, type UiTranslator } from "@/lib/i18n/ui-catalog"

export const translationLanguageCodes = ["en", "es", "fr", "tr"] as const
export const editableTranslationLanguageCodes = ["es", "fr", "tr"] as const

export type TranslationLanguage = (typeof translationLanguageCodes)[number]
export type EditableTranslationLanguage =
  (typeof editableTranslationLanguageCodes)[number]

export const translationLanguageNames: Record<TranslationLanguage, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  tr: "Türkçe",
}

export type TranslationCatalogEntry = {
  key: string
  context: string
  description: string
  en: string
  es: string
  fr: string
  tr: string
  emailTemplateType: string | null
  emailTemplateField: "subject" | "body" | null
}

export type TranslationImportIssue = {
  severity: "warning" | "error"
  message: string
  code?: "unknown_key" | "placeholder_mismatch"
}

export type TranslationImportRow = {
  rowNumber: number
  key: string
  context: string
  english: string
  values: Record<EditableTranslationLanguage, string>
  changedLanguages: EditableTranslationLanguage[]
  missingLanguages: EditableTranslationLanguage[]
  issues: TranslationImportIssue[]
  state: "ready" | "unchanged" | "warning" | "invalid"
}

export const translationCsvColumns = [
  "Key",
  "Context",
  "Description",
  "English",
  "Spanish",
  "French",
  "Turkish",
] as const

const csvLanguageColumns: Record<
  EditableTranslationLanguage,
  (typeof translationCsvColumns)[number]
> = {
  es: "Spanish",
  fr: "French",
  tr: "Turkish",
}

function normalizeNewlines(value: string) {
  return value.replaceAll("\r\n", "\n").replaceAll("\r", "\n")
}

export function extractTranslationPlaceholders(value: string) {
  const placeholders = new Set<string>()
  for (const match of value.matchAll(/\{\{([A-Za-z0-9_]+)\}\}/g)) {
    placeholders.add(match[1])
  }
  return [...placeholders].sort()
}

function placeholderSetsMatch(source: string, translation: string) {
  const sourcePlaceholders = extractTranslationPlaceholders(source)
  const translatedPlaceholders = extractTranslationPlaceholders(translation)
  return (
    sourcePlaceholders.length === translatedPlaceholders.length &&
    sourcePlaceholders.every((placeholder, index) => placeholder === translatedPlaceholders[index])
  )
}

export function createTranslationCsvRows(
  catalog: TranslationCatalogEntry[],
  missingOnly = false
) {
  return catalog
    .filter(
      (entry) =>
        !missingOnly || editableTranslationLanguageCodes.some((language) => !entry[language].trim())
    )
    .map(
      (entry) =>
        ({
          Key: entry.key,
          Context: entry.context,
          Description: entry.description,
          English: entry.en,
          Spanish: entry.es,
          French: entry.fr,
          Turkish: entry.tr,
        }) satisfies Record<(typeof translationCsvColumns)[number], CsvValue>
    )
}

export function parseTranslationCsv(
  csv: string,
  catalog: TranslationCatalogEntry[],
  translate?: UiTranslator
): { rows: TranslationImportRow[]; fileErrors: string[] } {
  const tr: UiTranslator = translate ?? ((key, variables) =>
    interpolateTranslation(uiCatalog[key].english, variables)
  )
  const parsed = parseCsv(csv)
  if (parsed.error) return { rows: [], fileErrors: [tr("validation.csv_unclosed_quote")] }

  const [headers, ...dataRows] = parsed.rows
  if (!headers) return { rows: [], fileErrors: [tr("validation.csv_empty")] }

  const indexes = new Map(headers.map((header, index) => [header.trim(), index]))
  const missingColumns = translationCsvColumns.filter((column) => !indexes.has(column))
  if (missingColumns.length) {
    return {
      rows: [],
      fileErrors: [tr("validation.csv_missing_columns", { columns: missingColumns.join(", ") })],
    }
  }

  const catalogByKey = new Map(catalog.map((entry) => [entry.key, entry]))
  const keyCounts = new Map<string, number>()
  for (const row of dataRows) {
    const key = (row[indexes.get("Key") ?? -1] ?? "").trim()
    if (key) keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1)
  }

  const rows = dataRows
    .map((row, index) => {
      const get = (column: (typeof translationCsvColumns)[number]) =>
        row[indexes.get(column) ?? -1] ?? ""
      const key = get("Key").trim()
      const entry = catalogByKey.get(key)
      const issues: TranslationImportIssue[] = []
      const values = Object.fromEntries(
        editableTranslationLanguageCodes.map((language) => [
          language,
          normalizeNewlines(get(csvLanguageColumns[language])),
        ])
      ) as Record<EditableTranslationLanguage, string>

      if (!key) issues.push({ severity: "error", message: tr("validation.translation_key_required") })
      else if (!entry) issues.push({ severity: "error", code: "unknown_key", message: tr("validation.translation_unknown_key") })
      if (key && (keyCounts.get(key) ?? 0) > 1) {
        issues.push({ severity: "error", message: tr("validation.translation_duplicate_key") })
      }

      if (entry && normalizeNewlines(get("English")) !== normalizeNewlines(entry.en)) {
        issues.push({
          severity: "warning",
          message: tr("validation.translation_source_differs"),
        })
      }

      const changedLanguages: EditableTranslationLanguage[] = []
      const missingLanguages: EditableTranslationLanguage[] = []
      if (entry) {
        for (const language of editableTranslationLanguageCodes) {
          const value = values[language]
          if (value.trim()) {
            if (!entry.en.trim()) {
              issues.push({
                severity: "error",
                message: tr("validation.translation_source_missing", { language: translationLanguageNames[language] }),
              })
            } else if (!placeholderSetsMatch(entry.en, value)) {
              issues.push({
                severity: "error",
                code: "placeholder_mismatch",
                message: tr("validation.translation_placeholders_mismatch", { language: translationLanguageNames[language] }),
              })
            } else if (normalizeNewlines(value) !== normalizeNewlines(entry[language])) {
              changedLanguages.push(language)
            }
          }

          const resultingValue = value.trim() ? value : entry[language]
          if (!resultingValue.trim()) missingLanguages.push(language)
        }
      }

      const hasError = issues.some((issue) => issue.severity === "error")
      const hasWarning = issues.some((issue) => issue.severity === "warning")
      const state = hasError
        ? "invalid"
        : hasWarning
          ? "warning"
          : changedLanguages.length
            ? "ready"
            : "unchanged"

      return {
        rowNumber: index + 2,
        key,
        context: entry?.context ?? get("Context").trim(),
        english: entry?.en ?? get("English"),
        values,
        changedLanguages,
        missingLanguages,
        issues,
        state,
      } satisfies TranslationImportRow
    })
    .filter((row) => row.key || row.english || Object.values(row.values).some(Boolean))

  return { rows, fileErrors: [] }
}

export function interpolateTranslation(
  value: string,
  variables: Record<string, string | number> = {}
) {
  return value.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (placeholder, key: string) =>
    Object.hasOwn(variables, key) ? String(variables[key]) : placeholder
  )
}

export function createTranslator(
  catalog: TranslationCatalogEntry[],
  language: TranslationLanguage
) {
  const catalogByKey = new Map(catalog.map((entry) => [entry.key, entry]))

  return function t(
    key: string,
    variables?: Record<string, string | number>,
    defaultValue = ""
  ) {
    const entry = catalogByKey.get(key)
    if (!entry) return interpolateTranslation(defaultValue, variables)
    const translated = language === "en" ? entry.en : entry[language].trim() ? entry[language] : entry.en
    return interpolateTranslation(translated || defaultValue, variables)
  }
}
