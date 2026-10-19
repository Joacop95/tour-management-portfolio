import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import type { Guide } from "@/lib/types/domain"
import { parseDateDisplayToIso } from "@/lib/utils/date-format"

export const guideImportColumns = ["Nombre completo guia", "Telefono", "Fecha de nacimiento", "Ciudad", "Email"] as const
export type GuideImportRow = {
  rowNumber: number
  name: string
  phone: string
  birthDateIso: string
  city: string
  email: string
  existingGuideId: string | null
  state: "ready" | "warning" | "error"
  action: "create" | "update" | "blocked"
  issues: string[]
}

type Translate = (key: UiTranslationKey, variables?: Record<string, string | number>) => string
const norm = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase()
const emailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

function csv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let value = ""
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const next = text[index + 1]
    if (character === '"') {
      if (quoted && next === '"') {
        value += '"'
        index += 1
      } else quoted = !quoted
      continue
    }
    if (character === "," && !quoted) {
      row.push(value)
      value = ""
      continue
    }
    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1
      row.push(value)
      rows.push(row)
      row = []
      value = ""
      continue
    }
    value += character
  }
  if (value || row.length) {
    row.push(value)
    rows.push(row)
  }
  return rows
}

export function getGuideImportTemplate() {
  return `${guideImportColumns.join(",")}\nTEST GUIDE IMPORT,,,,`
}

export function parseGuideImportCsv(text: string, guides: Guide[], t?: Translate) {
  const message = (key: UiTranslationKey, fallback: string, variables?: Record<string, string | number>) => t?.(key, variables) ?? fallback
  const [head, ...data] = csv(text)
  if (!head) return { rows: [] as GuideImportRow[], fileErrors: [message("validation.csv_empty", "CSV is empty.")] }
  const indexes = new Map(head.map((header, index) => [norm(header), index]))
  const missing = guideImportColumns.filter((column) => !indexes.has(norm(column)))
  if (missing.length) return {
    rows: [] as GuideImportRow[],
    fileErrors: [message("validation.csv_missing_columns", `Missing required CSV columns: ${missing.join(", ")}.`, { columns: missing.join(", ") })],
  }
  const byEmail = new Map<string, Guide>()
  guides.forEach((guide) => {
    if (guide.email) byEmail.set(norm(guide.email), guide)
    guide.authorizedEmails?.filter((entry) => entry.status !== "revoked").forEach((entry) => byEmail.set(entry.normalizedEmail, guide))
  })
  const byName = new Map<string, Guide[]>()
  guides.forEach((guide) => byName.set(norm(guide.name), [...(byName.get(norm(guide.name)) ?? []), guide]))

  const rows = data.map((row, index): GuideImportRow => {
    const get = (column: typeof guideImportColumns[number]) => (row[indexes.get(norm(column)) ?? -1] ?? "").trim()
    const name = get("Nombre completo guia")
    const email = norm(get("Email"))
    const birthRaw = get("Fecha de nacimiento")
    const birth = birthRaw ? (parseDateDisplayToIso(birthRaw) ?? "") : ""
    const issues: string[] = []
    if (!name) issues.push(message("validation.guide_import_name_required", "Guide name is required."))
    if (email && !emailValid(email)) issues.push(message("validation.guide_import_email_invalid", "Invalid email format."))
    if (birthRaw && !birth) issues.push(message("validation.guide_import_birth_invalid", "Invalid birth date. Use dd/mm/yyyy."))
    const existing = email ? byEmail.get(email) : undefined
    const sameNames = name ? (byName.get(norm(name)) ?? []) : []
    if (!existing && sameNames.length) issues.push(message("validation.guide_import_duplicate_name", "Possible duplicate: a guide with this name already exists. Review manually."))
    const state = issues.length ? "error" : existing ? "warning" : "ready"
    return {
      rowNumber: index + 2,
      name,
      phone: get("Telefono"),
      birthDateIso: birth,
      city: get("Ciudad"),
      email,
      existingGuideId: existing?.id ?? null,
      state,
      action: state === "error" ? "blocked" : existing ? "update" : "create",
      issues,
    }
  }).filter((row) => row.name || row.phone || row.birthDateIso || row.city || row.email)
  return { rows, fileErrors: [] as string[] }
}
