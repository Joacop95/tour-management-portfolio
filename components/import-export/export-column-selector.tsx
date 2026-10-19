"use client"

import { T } from "@/components/i18n/i18n-provider"
import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { ExportColumn, ExportColumnId } from "@/lib/types/import-export"

type ExportColumnSelectorProps = {
  columns: ExportColumn[]
  selectedColumnIds: ExportColumnId[]
  onChange: (columnIds: ExportColumnId[]) => void
}

export function ExportColumnSelector({
  columns,
  selectedColumnIds,
  onChange,
}: ExportColumnSelectorProps) {
  function toggleColumn(columnId: ExportColumnId) {
    if (selectedColumnIds.includes(columnId)) {
      onChange(selectedColumnIds.filter((item) => item !== columnId))
      return
    }

    onChange([...selectedColumnIds, columnId])
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle><T i18nKey="import_export.export_column_selector.export_columns" /></CardTitle>
            <p className="text-sm text-muted-foreground">
              <T i18nKey="import_export.export_column_selector.choose_which_fields_appear_in_the_mock_excel" />
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange(columns.map((column) => column.id))}
            >
              <T i18nKey="import_export.export_column_selector.select_all_columns" />
            </Button>
            <Button type="button" variant="outline" onClick={() => onChange([])}>
              <T i18nKey="import_export.export_column_selector.clear_columns" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {columns.map((column) => (
            <Label
              key={column.id}
              className="flex items-center gap-2 rounded-lg border p-2 text-sm"
            >
              <Checkbox
                checked={selectedColumnIds.includes(column.id)}
                onCheckedChange={() => toggleColumn(column.id)}
              />
              <span className="grid gap-0.5">
                <span>{column.label}</span>
                {column.description ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    {column.description}
                  </span>
                ) : null}
              </span>
            </Label>
          ))}
        </div>

        {selectedColumnIds.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="size-4 shrink-0" />
            <T i18nKey="import_export.export_column_selector.select_at_least_one_column_to_preview_and" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
