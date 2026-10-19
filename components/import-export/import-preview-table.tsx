"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StackedTableHeader } from "@/components/common/stacked-table-header"
import { cn } from "@/lib/utils"
import { formatDateDisplay } from "@/lib/utils/date-format"
import type {
  ImportPreviewDisplayRow,
  ImportPreviewStatus,
} from "@/lib/types/import-export"
import type { CircuitAliasMatchStatus } from "@/lib/types/circuit-equivalence"

type ImportPreviewTableProps = {
  rows: ImportPreviewDisplayRow[]
}

const statusConfig: Record<
  ImportPreviewStatus,
  { labelKey: UiTranslationKey; tone: StatusTone }
> = {
  "new-group": {
    labelKey: "import_export.preview.new_group",
    tone: "success",
  },
  "new-group-with-guide": {
    labelKey: "import_export.preview.new_group_with_guide",
    tone: "success",
  },
  "no-changes": {
    labelKey: "import_export.preview.no_changes",
    tone: "info",
  },
  "date-change": {
    labelKey: "import_export.preview.date_change_confirmation",
    tone: "warning",
  },
  "circuit-change": {
    labelKey: "import_export.preview.circuit_change_confirmation",
    tone: "warning",
  },
  "protected-assigned": {
    labelKey: "import_export.preview.protected_assigned",
    tone: "destructive",
  },
  "protected-confirmed": {
    labelKey: "import_export.preview.protected_confirmed",
    tone: "destructive",
  },
  "guide-ignored": {
    labelKey: "import_export.preview.guide_ignored",
    tone: "info",
  },
  "guide-not-found": {
    labelKey: "import_export.preview.guide_not_found",
    tone: "warning",
  },
  "cxl-confirmation": {
    labelKey: "import_export.preview.cxl_confirmation",
    tone: "destructive",
  },
  "fusionado-confirmation": {
    labelKey: "import_export.preview.fusionado_confirmation",
    tone: "warning",
  },
  "missing-from-file": {
    labelKey: "import_export.preview.missing_from_file",
    tone: "warning",
  },
  error: {
    labelKey: "status.error",
    tone: "destructive",
  },
}

function ImportStatusBadge({ status }: { status: ImportPreviewStatus }) {
  const { t } = useI18n()
  const config = statusConfig[status]

  return (
    <StatusBadge
      tone={config.tone}
      className="h-auto max-w-44 justify-start px-1.5 py-0 text-left text-[11px] leading-tight whitespace-normal"
    >
      {t(config.labelKey)}
    </StatusBadge>
  )
}

function getConfirmationLabel(
  state: ImportPreviewDisplayRow["confirmationState"],
  t: ReturnType<typeof useI18n>["t"]
) {
  if (state === "protected") return t("status.protected")
  if (state === "yes") return t("common.yes")

  return t("common.no")
}

const circuitMatchConfig: Record<
  CircuitAliasMatchStatus,
  { labelKey: UiTranslationKey; tone: StatusTone }
> = {
  matched: {
    labelKey: "status.matched",
    tone: "success",
  },
  "unknown-circuit": {
    labelKey: "import_export.preview.unknown_circuit",
    tone: "destructive",
  },
  "duplicate-alias-conflict": {
    labelKey: "import_export.preview.duplicate_alias_conflict",
    tone: "warning",
  },
}

function CircuitMatchBadge({ status }: { status: CircuitAliasMatchStatus }) {
  const { t } = useI18n()
  const config = circuitMatchConfig[status]

  return (
    <StatusBadge
      tone={config.tone}
      className="h-auto px-1.5 py-0 text-[11px] leading-tight"
    >
      {t(config.labelKey)}
    </StatusBadge>
  )
}

export function ImportPreviewTable({ rows }: ImportPreviewTableProps) {
  const { t } = useI18n()
  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <div>
          <CardTitle><T i18nKey="import_export.import_preview_table.import_preview" /></CardTitle>
          <CardDescription>
            <T i18nKey="import_export.import_preview_table.mock_validation_results_before_any_data_would_be" />
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="h-8 px-1.5 pl-3"><T i18nKey="import_export.guide_bulk_import_section.row" /></TableHead>
              <TableHead className="h-8 px-1.5">
                <StackedTableHeader top="Group" bottom="code" />
              </TableHead>
              <TableHead className="h-8 px-1.5">
                <StackedTableHeader top="Raw" bottom="circuit" />
              </TableHead>
              <TableHead className="h-8 px-1.5">
                <StackedTableHeader top="Matched app" bottom="circuit" />
              </TableHead>
              <TableHead className="h-8 px-1.5">
                <StackedTableHeader top="Circuit" bottom="match" />
              </TableHead>
              <TableHead className="h-8 px-1.5">
                <StackedTableHeader top="Start" bottom="date" />
              </TableHead>
              <TableHead className="h-8 px-1.5">
                <StackedTableHeader top="End" bottom="date" />
              </TableHead>
              <TableHead className="h-8 px-1.5">
                <StackedTableHeader top="Imported" bottom="guide" />
              </TableHead>
              <TableHead className="h-8 px-1.5">
                <StackedTableHeader top="Current app" bottom="guide" />
              </TableHead>
              <TableHead className="h-8 px-1.5">
                <StackedTableHeader top="Import" bottom="decision" />
              </TableHead>
              <TableHead className="h-8 px-1.5">
                <StackedTableHeader top="Needs" bottom="confirmation" />
              </TableHead>
              <TableHead className="h-8 px-1.5">
                <StackedTableHeader top="Mock" bottom="decision" />
              </TableHead>
              <TableHead className="h-8 px-1.5 pr-3"><T i18nKey="common.notes" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  row.status === "error" && "bg-red-50/60 hover:bg-red-50",
                  row.confirmationState === "yes" &&
                    row.status !== "error" &&
                    "bg-amber-50/60 hover:bg-amber-50",
                  row.confirmationState === "protected" &&
                    "bg-red-50/60 hover:bg-red-50",
                  row.status === "guide-not-found" &&
                    "bg-amber-50/60 hover:bg-amber-50",
                  row.circuitMatchStatus === "unknown-circuit" &&
                    "bg-red-50/60 hover:bg-red-50",
                  row.circuitMatchStatus === "duplicate-alias-conflict" &&
                    "bg-amber-50/60 hover:bg-amber-50"
                )}
              >
                <TableCell className="px-1.5 py-1.5 pl-3">
                  {row.rowNumber === 0 ? t("import_export.import.app_origin") : row.rowNumber}
                </TableCell>
                <TableCell className="px-1.5 py-1.5 font-medium">
                  {row.groupCode}
                </TableCell>
                <TableCell className="px-1.5 py-1.5">
                  {row.rawCircuitValue || "-"}
                </TableCell>
                <TableCell className="px-1.5 py-1.5">
                  {row.matchedAppCircuitName}
                </TableCell>
                <TableCell className="px-1.5 py-1.5">
                  <CircuitMatchBadge status={row.circuitMatchStatus} />
                </TableCell>
                <TableCell className="px-1.5 py-1.5">
                  {formatDateDisplay(row.startDate)}
                </TableCell>
                <TableCell className="px-1.5 py-1.5">
                  {formatDateDisplay(row.endDate)}
                </TableCell>
                <TableCell className="px-1.5 py-1.5">
                  {row.importedGuide}
                </TableCell>
                <TableCell className="px-1.5 py-1.5">
                  {row.currentAppGuide}
                </TableCell>
                <TableCell className="px-1.5 py-1.5">
                  <ImportStatusBadge status={row.status} />
                </TableCell>
                <TableCell className="px-1.5 py-1.5">
                  {getConfirmationLabel(row.confirmationState, t)}
                </TableCell>
                <TableCell className="max-w-36 px-1.5 py-1.5 whitespace-normal">
                  <span
                    className="overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                    title={row.mockAction}
                  >
                    {row.mockAction}
                  </span>
                </TableCell>
                <TableCell className="max-w-60 px-1.5 py-1.5 pr-3 text-muted-foreground whitespace-normal">
                  <span
                    className="overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                    title={row.notes}
                  >
                    {row.notes} {row.circuitMatchNotes}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
