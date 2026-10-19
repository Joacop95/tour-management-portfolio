"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { Search } from "lucide-react"

import {
  MultiSelect,
  type MultiSelectOption,
} from "@/components/common/multi-select"
import { DatePickerInput } from "@/components/common/date-picker-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type {
  Circuit,
  GroupStatus,
  Guide,
} from "@/lib/types/domain"
import type { ExportConfirmationFilter } from "@/lib/types/import-export"

export type ExportFilterValues = {
  search: string
  circuitIds: string[]
  guideIds: string[]
  groupStatuses: GroupStatus[]
  confirmationStatuses: ExportConfirmationFilter[]
  dateFrom: string
  dateTo: string
}

type ExportFiltersProps = {
  circuits: Circuit[]
  guides: Guide[]
  values: ExportFilterValues
  resultCount: number
  onChange: (values: ExportFilterValues) => void
  onReset: () => void
}

export function ExportFilters({
  circuits,
  guides,
  values,
  resultCount,
  onChange,
  onReset,
}: ExportFiltersProps) {
  const { t } = useI18n()
  function updateFilter<Key extends keyof ExportFilterValues>(
    key: Key,
    value: ExportFilterValues[Key]
  ) {
    onChange({ ...values, [key]: value })
  }

  const circuitOptions: MultiSelectOption[] = circuits.map((circuit) => ({
    value: circuit.id,
    label: circuit.name,
  }))
  const guideOptions: MultiSelectOption[] = [
    { value: "without-guide", label: t("status.without_guide") },
    ...guides.map((guide) => ({
      value: guide.id,
      label: guide.name,
    })),
  ]
  const groupStatusOptions: MultiSelectOption[] = [
    { value: "active", label: t("status.active") },
    { value: "cxl", label: t("status.cxl") },
    { value: "fusionado", label: t("status.fusionado") },
    { value: "finalized", label: t("status.finalized") },
  ]
  const confirmationStatusOptions: MultiSelectOption[] = [
    { value: "without-guide", label: t("status.without_guide") },
    { value: "assigned", label: t("status.assigned") },
    { value: "pending-confirmation", label: t("status.pending_confirmation") },
    { value: "confirmed", label: t("status.confirmed") },
  ]

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-medium"><T i18nKey="import_export.export_filters.export_filters" /></h3>
          <p className="text-sm text-muted-foreground">
            <T i18nKey="import_export.export_filters.showing" /> {resultCount} <T i18nKey="import_export.export_filters.groups_for_export" />
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onReset}>
          <T i18nKey="import_export.export_filters.reset_export_filters" />
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="grid gap-1">
          <Label htmlFor="export-group-search"><T i18nKey="import_export.export_filters.group_code" /></Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
            <Input
              id="export-group-search"
              placeholder={t("import_export.export_filters.placeholder_search_group_code")}
              className="pl-8"
              value={values.search}
              onChange={(event) => updateFilter("search", event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-1">
          <Label><T i18nKey="common.circuit" /></Label>
          <MultiSelect
            label={t("common.circuit")}
            values={values.circuitIds}
            options={circuitOptions}
            emptyText={t("import_export.export_filters.empty_text_no_circuit_found")}
            searchPlaceholder={t("common.search_circuits")}
            allText={t("common.all_circuits")}
            onValuesChange={(value) => updateFilter("circuitIds", value)}
          />
        </div>

        <div className="grid gap-1">
          <Label><T i18nKey="common.guide" /></Label>
          <MultiSelect
            label={t("common.guide")}
            values={values.guideIds}
            options={guideOptions}
            emptyText={t("import_export.export_filters.empty_text_no_guide_found")}
            searchPlaceholder={t("common.search_guides")}
            allText={t("common.all_guides")}
            onValuesChange={(value) => updateFilter("guideIds", value)}
          />
        </div>

        <div className="grid gap-1">
          <Label><T i18nKey="import_export.export_filters.group_status" /></Label>
          <MultiSelect
            label={t("common.status")}
            values={values.groupStatuses}
            options={groupStatusOptions}
            emptyText={t("import_export.export_filters.empty_text_no_group_status_found")}
            searchPlaceholder={t("common.search_statuses")}
            allText={t("common.all_statuses")}
            onValuesChange={(value) =>
              updateFilter(
                "groupStatuses",
                value as ExportFilterValues["groupStatuses"]
              )
            }
          />
        </div>

        <div className="grid gap-1">
          <Label><T i18nKey="import_export.export_filters.confirmation" /></Label>
          <MultiSelect
            label={t("import_export.export_filters.confirmation")}
            values={values.confirmationStatuses}
            options={confirmationStatusOptions}
            emptyText={t("import_export.export_filters.empty_text_no_confirmation_status_found")}
            searchPlaceholder={t("common.search_confirmations")}
            allText={t("common.all_confirmations")}
            onValuesChange={(value) =>
              updateFilter(
                "confirmationStatuses",
                value as ExportFilterValues["confirmationStatuses"]
              )
            }
          />
        </div>

        <div className="grid gap-1">
          <Label htmlFor="export-date-from"><T i18nKey="import_export.export_filters.start_date_from" /></Label>
          <DatePickerInput
            id="export-date-from"
            value={values.dateFrom}
            onChange={(value) => updateFilter("dateFrom", value)}
          />
        </div>

        <div className="grid gap-1">
          <Label htmlFor="export-date-to"><T i18nKey="import_export.export_filters.start_date_to" /></Label>
          <DatePickerInput
            id="export-date-to"
            value={values.dateTo}
            onChange={(value) => updateFilter("dateTo", value)}
          />
        </div>
      </div>
    </div>
  )
}
