import type { Circuit, Guide, GuideStatus } from "@/lib/types/domain"
import { normalizeSpokenLanguages } from "@/lib/utils/language-options"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"

type Translate = (key: UiTranslationKey, variables?: Record<string, string | number>) => string

export const guideBulkImportColumns = [
  "full_name",
  "authorized_login_email",
  "phone",
  "preferred_language",
  "spoken_languages",
  "circuits",
  "status",
  "internal_notes",
] as const

type GuideBulkImportColumn = (typeof guideBulkImportColumns)[number]

export type GuideBulkImportIssue = {
  severity: "warning" | "error"
  message: string
}

export type GuideBulkImportPreviewRow = {
  rowNumber: number
  fullName: string
  authorizedLoginEmail: string
  phone: string
  preferredLanguage: string
  spokenLanguages: string[]
  circuitNames: string[]
  matchedCircuitIds: string[]
  hasCircuitValues: boolean
  hasUnknownCircuits: boolean
  status: GuideStatus
  internalNotes: string
  existingGuideId: string | null
  action: "create" | "update" | "blocked"
  issues: GuideBulkImportIssue[]
  state: "ready" | "warning" | "error"
}

export type GuideBulkImportParseResult = {
  rows: GuideBulkImportPreviewRow[]
  fileErrors: string[]
}

const supportedLanguages = new Set(["EN", "FR", "ES", "TR"])

const statusByNormalizedValue: Record<string, GuideStatus> = {
  active: "active",
  inactive: "inactive",
  blocked: "blocked",
  invited: "invited",
  "pending invitation": "pending-invitation",
  "pending-invitation": "pending-invitation",
  pending_invitation: "pending-invitation",
}

function parseCsv(text: string, t?: Translate) {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ""
  let isQuoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const nextCharacter = text[index + 1]

    if (character === '"') {
      if (isQuoted && nextCharacter === '"') {
        currentValue += '"'
        index += 1
      } else {
        isQuoted = !isQuoted
      }
      continue
    }

    if (character === "," && !isQuoted) {
      currentRow.push(currentValue)
      currentValue = ""
      continue
    }

    if ((character === "\n" || character === "\r") && !isQuoted) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1
      }
      currentRow.push(currentValue)
      rows.push(currentRow)
      currentRow = []
      currentValue = ""
      continue
    }

    currentValue += character
  }

  if (isQuoted) {
    return { rows, error: t?.("validation.csv_unclosed_quote") ?? "CSV contains an unclosed quoted value." }
  }

  if (currentValue || currentRow.length > 0) {
    currentRow.push(currentValue)
    rows.push(currentRow)
  }

  return { rows, error: null }
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase()
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function parseLanguage(value: string) {
  const normalizedValue = value.trim().toUpperCase()
  return supportedLanguages.has(normalizedValue) ? normalizedValue : null
}

function parseLanguageList(value: string) {
  return value
    .split(",")
    .map((language) => language.trim())
    .filter(Boolean)
}

function parseCircuitValues(value: string) {
  return value
    .split(",")
    .map((circuit) => circuit.trim())
    .filter(Boolean)
}

function getGuideEmails(guide: Guide) {
  return [
    guide.email,
    ...(guide.authorizedEmails ?? [])
      .filter((email) => email.status !== "revoked")
      .map((email) => email.email),
  ].map(normalizeEmail)
}

function getRowState(issues: GuideBulkImportIssue[]) {
  if (issues.some((issue) => issue.severity === "error")) {
    return "error" as const
  }

  if (issues.length > 0) {
    return "warning" as const
  }

  return "ready" as const
}

export function getGuideBulkImportTemplate() {
  return [
    guideBulkImportColumns.join(","),
    'Example Guide,guide@example.com,+33123456789,FR,"FR,EN",PAR-LOR,Active,"Optional internal note"',
  ].join("\n")
}

export function parseGuideBulkImportCsv({
  csv,
  guides,
  circuits,
  t,
}: {
  csv: string
  guides: Guide[]
  circuits: Circuit[]
  t?: Translate
}): GuideBulkImportParseResult {
  const parsed = parseCsv(csv, t)
  const message = (key: UiTranslationKey, fallback: string, variables?: Record<string, string | number>) => t?.(key, variables) ?? fallback

  if (parsed.error) {
    return { rows: [], fileErrors: [parsed.error] }
  }

  const [headerRow, ...dataRows] = parsed.rows

  if (!headerRow) {
    return { rows: [], fileErrors: [message("validation.csv_empty", "CSV is empty.")] }
  }

  const columnIndexes = new Map(
    headerRow.map((header, index) => [normalizeHeader(header), index])
  )
  const missingColumns = guideBulkImportColumns.filter(
    (column) => !columnIndexes.has(column)
  )

  if (missingColumns.length > 0) {
    return {
      rows: [],
      fileErrors: [
        message("validation.csv_missing_columns", `Missing required CSV columns: ${missingColumns.join(", ")}.`, { columns: missingColumns.join(", ") }),
      ],
    }
  }

  const emailCounts = new Map<string, number>()

  dataRows.forEach((row) => {
    const email = normalizeEmail(
      row[columnIndexes.get("authorized_login_email") ?? -1] ?? ""
    )

    if (email) {
      emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1)
    }
  })

  const existingGuideByEmail = new Map<string, Guide>()
  const existingGuidesByName = new Map<string, Guide[]>()
  guides.forEach((guide) => {
    getGuideEmails(guide).forEach((email) => {
      existingGuideByEmail.set(email, guide)
    })

    const normalizedName = normalizeName(guide.name)
    const matches = existingGuidesByName.get(normalizedName) ?? []
    existingGuidesByName.set(normalizedName, [...matches, guide])
  })

  const circuitByNormalizedValue = new Map<string, Circuit>()
  circuits.forEach((circuit) => {
    [circuit.code, circuit.name, ...(circuit.aliases ?? [])].forEach((value) => {
      const normalizedValue = value.trim().toLowerCase()
      if (normalizedValue) {
        circuitByNormalizedValue.set(normalizedValue, circuit)
      }
    })
  })

  const previewRows = dataRows
      .map((row, index) => {
        const getValue = (column: GuideBulkImportColumn) =>
          (row[columnIndexes.get(column) ?? -1] ?? "").trim()
        const issues: GuideBulkImportIssue[] = []
        const fullName = getValue("full_name")
        const authorizedLoginEmail = normalizeEmail(
          getValue("authorized_login_email")
        )
        const preferredLanguageValue = getValue("preferred_language")
        const preferredLanguage = parseLanguage(preferredLanguageValue)
        const providedSpokenLanguages = parseLanguageList(
          getValue("spoken_languages")
        )
        const normalizedSpokenLanguages = providedSpokenLanguages.map(parseLanguage)
        const rawCircuitValues = parseCircuitValues(getValue("circuits"))
        const statusValue = getValue("status")
        const normalizedStatusValue = statusValue
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ")
        const status = statusValue
          ? statusByNormalizedValue[normalizedStatusValue]
          : "active"
        let existingGuide: Guide | undefined

        if (!fullName) {
          issues.push({ severity: "error", message: message("validation.guide_name_required", "Full name is required.") })
        }

        if (!authorizedLoginEmail) {
          issues.push({
            severity: "error",
            message: message("validation.guide_login_email_required", "Authorized login email is required."),
          })
        } else if (!isValidEmail(authorizedLoginEmail)) {
          issues.push({
            severity: "error",
            message: message("validation.guide_login_email_invalid", "Authorized login email is invalid."),
          })
        } else if ((emailCounts.get(authorizedLoginEmail) ?? 0) > 1) {
          issues.push({
            severity: "error",
            message: message("validation.guide_login_email_duplicate", "Authorized login email is duplicated in this CSV."),
          })
        } else {
          existingGuide = existingGuideByEmail.get(authorizedLoginEmail)

          if (existingGuide) {
            if (normalizeName(existingGuide.name) === normalizeName(fullName)) {
              issues.push({
                severity: "warning",
                message: message("validation.guide_existing_same_login", "Existing guide with the same name and login email. This is an update candidate."),
              })
            } else {
              issues.push({
                severity: "error",
                message: message("validation.guide_login_email_owned", `Login email already belongs to ${existingGuide.name}.`, { name: existingGuide.name }),
              })
            }
          }
        }

        if (!existingGuide && fullName) {
          const sameNameGuides = existingGuidesByName.get(
            normalizeName(fullName)
          )

          if (sameNameGuides?.length === 1) {
            existingGuide = sameNameGuides[0]
            issues.push({
              severity: "warning",
              message: message("validation.guide_existing_other_login", "Existing guide with the same name but a different login email. This is an update candidate."),
            })
          } else if ((sameNameGuides?.length ?? 0) > 1) {
            issues.push({
              severity: "error",
              message: message("validation.guide_multiple_name_matches", "Multiple existing guides have the same name. Use a unique authorized login email."),
            })
          }
        }

        if (!preferredLanguage) {
          issues.push({
            severity: "error",
            message: preferredLanguageValue
              ? message("validation.guide_preferred_language_invalid", "Preferred language must be EN, FR, ES, or TR.")
              : message("validation.guide_preferred_language_required", "Preferred language is required."),
          })
        }

        const invalidSpokenLanguages = providedSpokenLanguages.filter(
          (_, languageIndex) => !normalizedSpokenLanguages[languageIndex]
        )

        if (invalidSpokenLanguages.length > 0) {
          issues.push({
            severity: "error",
            message: message("validation.guide_unknown_spoken_language", `Unknown spoken language: ${invalidSpokenLanguages.join(", ")}.`, { languages: invalidSpokenLanguages.join(", ") }),
          })
        }

        if (!providedSpokenLanguages.length && !preferredLanguage) {
          issues.push({
            severity: "warning",
            message: message("validation.guide_spoken_languages_missing", "Spoken languages are not configured."),
          })
        }

        if (!status) {
          issues.push({
            severity: "error",
            message: message("validation.guide_status_invalid", "Status must be Active, Inactive, Blocked, Invited, or Pending invitation."),
          })
        }

        const matchedCircuits = rawCircuitValues
          .map((value) => ({
            rawValue: value,
            circuit: circuitByNormalizedValue.get(value.toLowerCase()),
          }))
        const unknownCircuits = matchedCircuits
          .filter((match) => !match.circuit)
          .map((match) => match.rawValue)

        if (rawCircuitValues.length === 0) {
          issues.push({
            severity: "warning",
            message: message("validation.guide_circuits_missing", "No circuits provided."),
          })
        } else if (unknownCircuits.length > 0) {
          issues.push({
            severity: "warning",
            message: message("validation.guide_unknown_circuits", `Unknown circuits: ${unknownCircuits.join(", ")}.`, { circuits: unknownCircuits.join(", ") }),
          })
        }

        const spokenLanguages = normalizeSpokenLanguages(
          normalizedSpokenLanguages.filter(
            (language): language is string => Boolean(language)
          ),
          preferredLanguage
        )

        const action: GuideBulkImportPreviewRow["action"] = issues.some(
          (issue) => issue.severity === "error"
        )
          ? "blocked"
          : existingGuide
            ? "update"
            : "create"

        return {
          rowNumber: index + 2,
          fullName,
          authorizedLoginEmail,
          phone: getValue("phone"),
          preferredLanguage: preferredLanguage ?? "",
          spokenLanguages,
          circuitNames: Array.from(
            new Set(
              matchedCircuits
                .flatMap((match) => (match.circuit ? [match.circuit.name] : []))
            )
          ),
          matchedCircuitIds: Array.from(
            new Set(
              matchedCircuits.flatMap((match) =>
                match.circuit ? [match.circuit.id] : []
              )
            )
          ),
          hasCircuitValues: rawCircuitValues.length > 0,
          hasUnknownCircuits: unknownCircuits.length > 0,
          status: status ?? "active",
          internalNotes: getValue("internal_notes"),
          existingGuideId: existingGuide?.id ?? null,
          action,
          issues,
          state: getRowState(issues),
        }
      })
    .filter((row) =>
      Boolean(
        row.fullName ||
          row.authorizedLoginEmail ||
          row.phone ||
          row.preferredLanguage ||
          row.spokenLanguages.length ||
          row.circuitNames.length ||
          row.internalNotes
      )
    )
  const rowsByExistingGuideId = new Map<string, GuideBulkImportPreviewRow[]>()

  previewRows.forEach((row) => {
    if (!row.existingGuideId || row.action === "blocked") {
      return
    }

    const matches = rowsByExistingGuideId.get(row.existingGuideId) ?? []
    rowsByExistingGuideId.set(row.existingGuideId, [...matches, row])
  })

  rowsByExistingGuideId.forEach((matchingRows) => {
    if (matchingRows.length < 2) {
      return
    }

    matchingRows.forEach((row) => {
      row.issues.push({
        severity: "error",
        message: message("validation.guide_duplicate_existing_row", "Multiple CSV rows resolve to the same existing guide. Keep one row per guide."),
      })
      row.state = "error"
      row.action = "blocked"
    })
  })

  return {
    rows: previewRows,
    fileErrors: [],
  }
}
