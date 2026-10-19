import type { CircuitAliasMatchStatus } from "@/lib/types/circuit-equivalence"

export type ImportPreviewStatus =
  | "new-group"
  | "new-group-with-guide"
  | "no-changes"
  | "date-change"
  | "circuit-change"
  | "protected-assigned"
  | "protected-confirmed"
  | "guide-ignored"
  | "guide-not-found"
  | "cxl-confirmation"
  | "fusionado-confirmation"
  | "missing-from-file"
  | "error"

export type ImportPreviewRow = {
  id: string
  rowNumber: number
  groupCode: string
  circuit: string
  startDate: string
  endDate: string
  importedGuide: string
  currentAppGuide: string
  status: ImportPreviewStatus
  confirmationState: "no" | "yes" | "protected"
  mockAction: string
  notes: string
}

export type ImportPreviewDisplayRow = ImportPreviewRow & {
  rawCircuitValue: string
  matchedAppCircuitName: string
  circuitMatchStatus: CircuitAliasMatchStatus
  circuitMatchNotes: string
}

export type ImportSummaryMetric = {
  label: string
  value: number
  tone: "emerald" | "blue" | "red" | "amber"
}

export type ExportColumnId =
  | "groupCode"
  | "circuit"
  | "startDate"
  | "endDate"
  | "guide"
  | "groupStatus"
  | "confirmation"
  | "language"
  | "estimatedPassengers"
  | "internalNotes"
  | "lastModified"
  | "modifiedBy"

export type ExportConfirmationFilter =
  | "without-guide"
  | "assigned"
  | "pending-confirmation"
  | "confirmed"

export type ExportColumn = {
  id: ExportColumnId
  label: string
  description?: string
  header?: {
    top: string
    bottom: string
  }
}
