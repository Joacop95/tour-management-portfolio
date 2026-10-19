import { T } from "@/components/i18n/i18n-provider"
import { StackedTableHeader } from "@/components/common/stacked-table-header"
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
import type { Circuit, Guide, TourGroup } from "@/lib/types/domain"
import type { ExportColumn, ExportColumnId } from "@/lib/types/import-export"
import { formatDateDisplay } from "@/lib/utils/date-format"

type ExportPreviewTableProps = {
  groups: TourGroup[]
  circuits: Circuit[]
  guides: Guide[]
  columns: ExportColumn[]
  selectedColumnIds: ExportColumnId[]
}

function getCircuit(circuits: Circuit[], circuitId: string) {
  return circuits.find((circuit) => circuit.id === circuitId)
}

function getGuide(guides: Guide[], guideId: string | null) {
  if (!guideId) return undefined

  return guides.find((guide) => guide.id === guideId)
}

function formatStatus(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function getMockInternalNotes(group: TourGroup) {
  if (group.groupStatus === "cxl") return "Cancelled group history."
  if (group.groupStatus === "fusionado") return "Merged group review."
  if (!group.guideId) return "Needs guide assignment."
  if (group.confirmationStatus === "pending-confirmation") {
    return "Guide confirmation pending."
  }

  return "Ready for operations export."
}

function getColumnValue({
  columnId,
  group,
  circuits,
  guides,
}: {
  columnId: ExportColumnId
  group: TourGroup
  circuits: Circuit[]
  guides: Guide[]
}) {
  const circuit = getCircuit(circuits, group.circuitId)
  const guide = getGuide(guides, group.guideId)

  const values: Record<ExportColumnId, string | number> = {
    groupCode: group.code,
    circuit: circuit?.name ?? "Unknown",
    startDate: formatDateDisplay(group.startDateIso),
    endDate: formatDateDisplay(group.endDateIso),
    guide: guide?.name ?? "Without guide",
    groupStatus: formatStatus(group.groupStatus),
    confirmation: group.guideId
      ? formatStatus(group.confirmationStatus)
      : "Without guide",
    language: guide?.preferredLanguage ?? "-",
    estimatedPassengers: group.travelers,
    internalNotes: getMockInternalNotes(group),
    lastModified: formatDateDisplay("2026-06-01"),
    modifiedBy: "Super Admin",
  }

  return values[columnId]
}

export function ExportPreviewTable({
  groups,
  circuits,
  guides,
  columns,
  selectedColumnIds,
}: ExportPreviewTableProps) {
  const selectedColumns = columns.filter((column) =>
    selectedColumnIds.includes(column.id)
  )

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <div>
          <CardTitle><T i18nKey="import_export.export_preview_table.export_preview" /></CardTitle>
          <CardDescription>
            <T i18nKey="import_export.export_filters.showing" /> {groups.length} <T i18nKey="import_export.export_preview_table.groups_for_export_from_the_active_data_source" />
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {selectedColumns.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            <T i18nKey="import_export.export_preview_table.select_columns_to_preview_export_data" />
          </div>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                {selectedColumns.map((column, index) => (
                  <TableHead
                    key={column.id}
                    className={`h-8 px-1.5 ${index === 0 ? "pl-3" : ""}`}
                  >
                    {column.header ? (
                      <StackedTableHeader
                        top={column.header.top}
                        bottom={column.header.bottom}
                      />
                    ) : (
                      column.label
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={selectedColumns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    <T i18nKey="import_export.export_preview_table.no_groups_match_the_selected_export_filters" />
                  </TableCell>
                </TableRow>
              ) : null}
              {groups.map((group) => (
                <TableRow key={group.id}>
                  {selectedColumns.map((column, index) => (
                    <TableCell
                      key={column.id}
                      className={`max-w-48 px-1.5 py-1.5 ${
                        index === 0 ? "pl-3 font-medium" : ""
                      } ${
                        column.id === "internalNotes"
                          ? "whitespace-normal text-muted-foreground"
                          : ""
                      }`}
                    >
                      {column.id === "internalNotes" ? (
                        <span
                          className="overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                          title={String(
                            getColumnValue({
                              columnId: column.id,
                              group,
                              circuits,
                              guides,
                            })
                          )}
                        >
                          {getColumnValue({
                            columnId: column.id,
                            group,
                            circuits,
                            guides,
                          })}
                        </span>
                      ) : (
                        getColumnValue({
                          columnId: column.id,
                          group,
                          circuits,
                          guides,
                        })
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
