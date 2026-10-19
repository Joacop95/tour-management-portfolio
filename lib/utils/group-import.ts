import type { Circuit, GroupStatus, Guide, TourGroup } from "@/lib/types/domain"
import type { GroupCodeCircuitMapping } from "@/lib/supabase/queries/import-configuration"
import { formatDateDisplay } from "@/lib/utils/date-format"
import { getGroupImportStatus } from "@/lib/utils/group-import-status"
import { interpolateTranslation } from "@/lib/i18n/catalog"
import { uiCatalog, type UiTranslator } from "@/lib/i18n/ui-catalog"

export const groupImportColumns = ["Circuito", "Grupo", "Guia", "Fecha de inicio", "Fecha de fin"] as const
export type GroupImportIssue = { severity: "warning" | "error"; message: string }
export type GroupImportRow = { rowNumber: number; groupCode: string; circuitId: string | null; circuitName: string; circuitDerived: boolean; guideId: string | null; guideName: string; groupStatus: Extract<GroupStatus, "active" | "cxl" | "fusionado">; startDateIso: string; endDateIso: string; endDateDerived: boolean; existingGroupId: string | null; issues: GroupImportIssue[]; state: "ready" | "warning" | "error"; action: "create" | "existing" | "blocked" }

function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let value = ""; let quoted = false
  for (let i=0;i<text.length;i+=1) { const ch=text[i], next=text[i+1]; if(ch==='"'){if(quoted&&next==='"'){value+='"';i+=1}else quoted=!quoted;continue} if(ch===','&&!quoted){row.push(value);value="";continue} if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i+=1;row.push(value);rows.push(row);row=[];value="";continue} value+=ch }
  if (quoted) return { rows, error: "CSV contains an unclosed quoted value." }
  if (value || row.length) { row.push(value); rows.push(row) }
  return { rows, error: null }
}
const normalize = (value: string) => value.trim().replace(/\s+/g," ").toLowerCase()
const stateFor = (issues: GroupImportIssue[]) => issues.some((i)=>i.severity==="error") ? "error" as const : issues.length ? "warning" as const : "ready" as const
export function extractGroupPrefix(code: string) {
  return /^(\d+)-.+$/.exec(code.trim())?.[1] ?? null
}
export function getGroupImportTemplate() { return `${groupImportColumns.join(",")}\n,12504-9,,,` }

export function parseGroupImportDateToIso(value: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim())

  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ]

  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth[month - 1]
  ) {
    return null
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function parseGroupImportCsv({
  csv,
  circuits,
  guides,
  groups,
  mappings,
  translate,
}: {
  csv: string
  circuits: Circuit[]
  guides: Guide[]
  groups: TourGroup[]
  mappings: GroupCodeCircuitMapping[]
  translate?: UiTranslator
}) {
  const tr: UiTranslator =
    translate ??
    ((key, variables) => interpolateTranslation(uiCatalog[key].english, variables))
  const parsed = parseCsv(csv)
  if (parsed.error) {
    return {
      rows: [] as GroupImportRow[],
      fileErrors: [tr("validation.csv_unclosed_quote")],
    }
  }

  const [headers, ...data] = parsed.rows
  if (!headers) return { rows: [], fileErrors: [tr("validation.csv_empty")] }

  const indexes = new Map(headers.map((header, index) => [normalize(header), index]))
  const missing = groupImportColumns.filter((column) => !indexes.has(normalize(column)))
  if (missing.length) {
    return {
      rows: [],
      fileErrors: [
        tr("validation.csv_missing_columns", { columns: missing.join(", ") }),
      ],
    }
  }

  const circuitValues = new Map<string, Circuit>()
  circuits.forEach((circuit) =>
    [circuit.name, circuit.code, ...(circuit.aliases ?? [])].forEach((value) => {
      if (value) circuitValues.set(normalize(value), circuit)
    })
  )
  const guidesByName = new Map<string, Guide[]>()
  guides.forEach((guide) =>
    guidesByName.set(normalize(guide.name), [
      ...(guidesByName.get(normalize(guide.name)) ?? []),
      guide,
    ])
  )
  const groupByCode = new Map(groups.map((group) => [group.code.trim(), group]))
  const mappingByPrefix = new Map(
    mappings
      .filter((mapping) => mapping.isActive && mapping.circuitId)
      .map((mapping) => [mapping.prefix, mapping])
  )

  const rows = data
    .map((raw, index) => {
      const get = (name: (typeof groupImportColumns)[number]) =>
        (raw[indexes.get(normalize(name)) ?? -1] ?? "").trim()
      const issues: GroupImportIssue[] = []
      const groupCode = get("Grupo")
      const prefix = extractGroupPrefix(groupCode)
      if (!groupCode) {
        issues.push({ severity: "error", message: tr("validation.group_code_required") })
      }

      const suppliedCircuit = get("Circuito")
      const suppliedMatch = suppliedCircuit
        ? circuitValues.get(normalize(suppliedCircuit))
        : undefined
      if (suppliedCircuit && !suppliedMatch) {
        issues.push({
          severity: "error",
          message: tr("validation.unknown_circuit", { circuit: suppliedCircuit }),
        })
      }
      const mapping = prefix ? mappingByPrefix.get(prefix) : undefined
      const mappedCircuit = mapping?.circuitId
        ? circuits.find((circuit) => circuit.id === mapping.circuitId)
        : undefined
      if (suppliedMatch && mappedCircuit && suppliedMatch.id !== mappedCircuit.id) {
        issues.push({
          severity: "error",
          message: tr("validation.group_prefix_circuit_mismatch", {
            prefix: prefix ?? "",
            expected: mappedCircuit.name,
            supplied: suppliedMatch.name,
          }),
        })
      }
      const circuit = suppliedMatch ?? mappedCircuit
      const circuitDerived = !suppliedMatch && Boolean(mappedCircuit)
      if (circuitDerived) {
        issues.push({
          severity: "warning",
          message: tr("validation.circuit_inferred", {
            circuit: circuit?.name ?? "",
            prefix: prefix ?? "",
          }),
        })
      }
      if (!mapping && prefix) {
        issues.push({
          severity: "warning",
          message: tr("validation.no_circuit_mapping", { prefix }),
        })
      }
      if (!prefix && suppliedMatch) {
        issues.push({
          severity: "warning",
          message: tr("validation.no_prefix_supplied_circuit"),
        })
      } else if (!prefix && !suppliedCircuit) {
        issues.push({
          severity: "warning",
          message: tr("validation.circuit_not_derived"),
        })
      }

      const guideValue = get("Guia")
      const groupStatus = getGroupImportStatus(guideValue)
      const isStatusMarker = groupStatus !== "active"
      const guideMatches =
        guideValue && !isStatusMarker
          ? (guidesByName.get(normalize(guideValue)) ?? [])
          : []
      let guide = guideMatches.length === 1 ? guideMatches[0] : undefined
      if (guideMatches.length > 1) {
        guide = undefined
        issues.push({ severity: "error", message: tr("validation.multiple_guides_match") })
      } else if (guideValue && !guide && !isStatusMarker) {
        issues.push({ severity: "warning", message: tr("validation.guide_not_matched") })
      }

      const startRaw = get("Fecha de inicio")
      const endRaw = get("Fecha de fin")
      const start = startRaw ? (parseGroupImportDateToIso(startRaw) ?? "") : ""
      let end = endRaw ? (parseGroupImportDateToIso(endRaw) ?? "") : ""
      if (startRaw && !start) {
        issues.push({ severity: "error", message: tr("validation.invalid_start_date") })
      }
      if (endRaw && !end) {
        issues.push({ severity: "error", message: tr("validation.invalid_end_date") })
      }
      let endDateDerived = false
      if (start && !end && !endRaw && circuit?.defaultEndDateOffsetDays != null) {
        const date = new Date(`${start}T00:00:00Z`)
        date.setUTCDate(date.getUTCDate() + circuit.defaultEndDateOffsetDays)
        end = date.toISOString().slice(0, 10)
        endDateDerived = true
        issues.push({
          severity: "warning",
          message: tr("validation.end_date_calculated", {
            date: formatDateDisplay(end),
            circuit: circuit.name,
            days: circuit.defaultEndDateOffsetDays,
          }),
        })
      } else if (start && !end && !endRaw) {
        issues.push({ severity: "warning", message: tr("validation.end_date_not_calculated") })
      }
      if (start && end && end < start) {
        issues.push({ severity: "error", message: tr("validation.end_before_start") })
      }

      const existing = groupByCode.get(groupCode)
      if (existing) {
        issues.push({ severity: "error", message: tr("validation.existing_group_no_overwrite") })
      }
      const state = stateFor(issues)
      return {
        rowNumber: index + 2,
        groupCode,
        circuitId: circuit?.id ?? null,
        circuitName: circuit?.name ?? "—",
        circuitDerived,
        guideId: guide?.id ?? null,
        guideName: isStatusMarker
          ? guideValue.toUpperCase()
          : (guide?.name ?? (guideValue ? tr("status.unmatched") : tr("status.without_guide"))),
        groupStatus,
        startDateIso: start,
        endDateIso: end,
        endDateDerived,
        existingGroupId: existing?.id ?? null,
        issues,
        state,
        action: state === "error" ? "blocked" : existing ? "existing" : "create",
      } satisfies GroupImportRow
    })
    .filter(
      (row) =>
        row.groupCode ||
        row.circuitName !== "—" ||
        row.guideName !== tr("status.without_guide") ||
        row.startDateIso ||
        row.endDateIso
    )

  return { rows, fileErrors: [] as string[] }
}
