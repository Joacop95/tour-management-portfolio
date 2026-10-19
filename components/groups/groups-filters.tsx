"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { Filter, Search } from "lucide-react"

import {
  MultiSelect,
  type MultiSelectOption,
} from "@/components/common/multi-select"
import { DatePickerInput } from "@/components/common/date-picker-input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Circuit, Guide } from "@/lib/types/domain"

export type GroupsAttentionFilter =
  | "all"
  | "without-guide"
  | "pending-guide-confirmation"

export type ConfirmationFilterValue =
  | "without-guide"
  | "assigned"
  | "pending-confirmation"
  | "confirmed"

export type GroupsFilterValues = {
  search: string
  circuitIds: string[]
  guideIds: string[]
  groupStatuses: string[]
  confirmationStatuses: ConfirmationFilterValue[]
  dateFrom: string
  dateTo: string
  attention: GroupsAttentionFilter
}

type GroupsFiltersProps = {
  circuits: Circuit[]
  guides: Guide[]
  values: GroupsFilterValues
  onChange: (values: GroupsFilterValues) => void
  onClear: () => void
  resultCount: number
  totalCount: number
}

export function GroupsFilters({
  circuits,
  guides,
  values,
  onChange,
  onClear,
  resultCount,
  totalCount,
}: GroupsFiltersProps) {
  const { t } = useI18n()
  function updateFilter<Key extends keyof GroupsFilterValues>(
    key: Key,
    value: GroupsFilterValues[Key]
  ) {
    onChange({ ...values, [key]: value })
  }

  const circuitOptions: MultiSelectOption[] = [
    ...circuits.map((circuit) => ({
      value: circuit.id,
      label: circuit.name,
    })),
  ]
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
  const confirmationOptions: MultiSelectOption[] = [
    { value: "without-guide", label: t("status.without_guide") },
    { value: "assigned", label: t("status.assigned") },
    { value: "pending-confirmation", label: t("status.pending_confirmation") },
    { value: "confirmed", label: t("status.confirmed") },
  ]

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="size-4" />
            <T i18nKey="groups.groups_filters.filters" />
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            <T i18nKey="groups.groups_filters.showing" /> {resultCount} <T i18nKey="groups.groups_filters.of" /> {totalCount} <T i18nKey="groups.groups_filters.groups" />
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={values.attention === "all" ? "secondary" : "outline"}
            onClick={() => updateFilter("attention", "all")}
          >
            <T i18nKey="groups.groups_filters.all_groups" />
          </Button>
          <Button
            type="button"
            variant={
              values.attention === "without-guide" ? "destructive" : "outline"
            }
            onClick={() => updateFilter("attention", "without-guide")}
          >
            <T i18nKey="status.without_guide" />
          </Button>
          <Button
            type="button"
            variant={
              values.attention === "pending-guide-confirmation"
                ? "secondary"
                : "outline"
            }
            onClick={() =>
              updateFilter("attention", "pending-guide-confirmation")
            }
          >
            <T i18nKey="groups.groups_filters.pending_guide_confirmation" />
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(210px,1.2fr)_repeat(6,minmax(150px,1fr))_auto]">
          <div className="grid gap-1">
            <Label htmlFor="group-search"><T i18nKey="groups.create_group_dialog.group_code" /></Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
              <Input
                id="group-search"
                placeholder={t("groups.groups_filters.placeholder_search_group_code")}
                className="pl-8"
                value={values.search}
                onChange={(event) =>
                  updateFilter("search", event.target.value)
                }
              />
            </div>
          </div>

          <div className="grid gap-1">
            <Label><T i18nKey="common.circuit" /></Label>
            <MultiSelect
              label={t("common.circuit")}
              values={values.circuitIds}
              options={circuitOptions}
              emptyText={t("groups.create_group_dialog.empty_text_no_circuit_found")}
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
              emptyText={t("groups.create_group_dialog.empty_text_no_guide_found")}
              searchPlaceholder={t("common.search_guides")}
              allText={t("common.all_guides")}
              onValuesChange={(value) => updateFilter("guideIds", value)}
            />
          </div>

          <div className="grid gap-1">
            <Label><T i18nKey="groups.edit_group_dialog.group_status" /></Label>
            <MultiSelect
              label={t("common.status")}
              values={values.groupStatuses}
              options={groupStatusOptions}
              emptyText={t("groups.groups_filters.empty_text_no_status_found")}
              searchPlaceholder={t("common.search_statuses")}
              allText={t("common.all_statuses")}
              onValuesChange={(value) => updateFilter("groupStatuses", value)}
            />
          </div>

          <div className="grid gap-1">
            <Label><T i18nKey="groups.groups_filters.confirmation" /></Label>
            <MultiSelect
              label={t("groups.groups_filters.confirmation")}
              values={values.confirmationStatuses}
              options={confirmationOptions}
              emptyText={t("groups.groups_filters.empty_text_no_confirmation_found")}
              searchPlaceholder={t("common.search_confirmations")}
              allText={t("common.all_confirmations")}
              onValuesChange={(value) =>
                updateFilter(
                  "confirmationStatuses",
                  value as GroupsFilterValues["confirmationStatuses"]
                )
              }
            />
          </div>

          <div className="grid gap-1">
            <Label htmlFor="date-from"><T i18nKey="groups.groups_filters.operational_date_from" /></Label>
            <DatePickerInput
              id="date-from"
              value={values.dateFrom}
              onChange={(value) => updateFilter("dateFrom", value)}
            />
          </div>

          <div className="grid gap-1">
            <Label htmlFor="date-to"><T i18nKey="groups.groups_filters.operational_date_to" /></Label>
            <DatePickerInput
              id="date-to"
              value={values.dateTo}
              onChange={(value) => updateFilter("dateTo", value)}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={onClear}
            className="self-end"
          >
            <T i18nKey="groups.groups_filters.clear_filters" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
