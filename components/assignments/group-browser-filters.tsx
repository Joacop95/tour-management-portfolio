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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Circuit, GroupStatus } from "@/lib/types/domain"

export type AssignmentGroupFilter = {
  search: string
  circuitIds: string[]
  assignmentStatuses: string[]
  groupStatuses: GroupStatus[]
  dateFrom: string
  dateTo: string
  sort: string
  quickFilter: string
}

type GroupBrowserFiltersProps = {
  circuits: Circuit[]
  values: AssignmentGroupFilter
  onChange: (values: AssignmentGroupFilter) => void
  onClear: () => void
}

export function GroupBrowserFilters({
  circuits,
  values,
  onChange,
  onClear,
}: GroupBrowserFiltersProps) {
  const { t } = useI18n()
  function updateFilter<Key extends keyof AssignmentGroupFilter>(
    key: Key,
    value: AssignmentGroupFilter[Key]
  ) {
    onChange({ ...values, [key]: value })
  }

  const circuitOptions: MultiSelectOption[] = circuits.map((circuit) => ({
    value: circuit.id,
    label: circuit.name,
  }))
  const assignmentStatusOptions: MultiSelectOption[] = [
    { value: "without-guide", label: t("status.without_guide") },
    { value: "assigned", label: t("status.assigned") },
    { value: "pending-confirmation", label: t("assignments.status.pending_guide_confirmation") },
    { value: "confirmed", label: t("status.confirmed") },
  ]
  const groupStatusOptions: MultiSelectOption[] = [
    { value: "active", label: t("status.active") },
    { value: "cxl", label: t("status.cxl") },
    { value: "fusionado", label: t("status.fusionado") },
    { value: "finalized", label: t("status.finalized") },
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {[
          ["upcoming", t("assignments.filters.upcoming_groups")],
          ["without-guide", t("status.without_guide")],
          ["pending-confirmation", t("status.pending_confirmation")],
          ["assigned", t("status.assigned")],
        ].map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={values.quickFilter === value ? "secondary" : "outline"}
            size="sm"
            onClick={() => updateFilter("quickFilter", value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        <div className="grid gap-1">
          <Label htmlFor="assignment-group-search"><T i18nKey="assignments.group_browser_filters.group_code" /></Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
            <Input
              id="assignment-group-search"
              placeholder={t("assignments.group_browser_filters.placeholder_search_by_group_code")}
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
            emptyText={t("assignments.group_browser_filters.empty_text_no_circuit_found")}
            searchPlaceholder={t("common.search_circuits")}
            allText={t("common.all_circuits")}
            onValuesChange={(value) => updateFilter("circuitIds", value)}
          />
        </div>

        <div className="grid gap-1">
          <Label><T i18nKey="assignments.group_browser_filters.assignment_status" /></Label>
          <MultiSelect
            label={t("assignments.group_browser_filters.label_assignment")}
            values={values.assignmentStatuses}
            options={assignmentStatusOptions}
            emptyText={t("assignments.group_browser_filters.empty_text_no_assignment_status_found")}
            searchPlaceholder={t("assignments.filters.search_assignment_statuses")}
            allText={t("assignments.filters.all_groups")}
            onValuesChange={(value) =>
              updateFilter("assignmentStatuses", value)
            }
          />
        </div>

        <div className="grid gap-1">
          <Label><T i18nKey="assignments.group_browser_filters.group_status" /></Label>
          <MultiSelect
            label={t("common.status")}
            values={values.groupStatuses}
            options={groupStatusOptions}
            emptyText={t("assignments.group_browser_filters.empty_text_no_group_status_found")}
            searchPlaceholder={t("assignments.filters.search_group_statuses")}
            allText={t("common.all_statuses")}
            onValuesChange={(value) =>
              updateFilter(
                "groupStatuses",
                value as AssignmentGroupFilter["groupStatuses"]
              )
            }
          />
        </div>

        <div className="grid gap-1">
          <Label><T i18nKey="assignments.group_browser_filters.sort_by" /></Label>
          <Select
            value={values.sort}
            onValueChange={(value) => updateFilter("sort", value)}
          >
            <SelectTrigger aria-label={t("assignments.group_browser_filters.aria_label_sort_groups")} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="start-asc"><T i18nKey="assignments.group_browser_filters.start_date_ascending" /></SelectItem>
              <SelectItem value="start-desc"><T i18nKey="assignments.group_browser_filters.start_date_descending" /></SelectItem>
              <SelectItem value="code-asc"><T i18nKey="assignments.group_browser_filters.group_code_ascending" /></SelectItem>
              <SelectItem value="circuit-asc"><T i18nKey="assignments.group_browser_filters.circuit_name_ascending" /></SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <Label htmlFor="assignment-date-from"><T i18nKey="assignments.group_browser_filters.start_date_from" /></Label>
          <DatePickerInput
            id="assignment-date-from"
            value={values.dateFrom}
            onChange={(value) => updateFilter("dateFrom", value)}
          />
        </div>

        <div className="grid gap-1">
          <Label htmlFor="assignment-date-to"><T i18nKey="assignments.group_browser_filters.start_date_to" /></Label>
          <DatePickerInput
            id="assignment-date-to"
            value={values.dateTo}
            onChange={(value) => updateFilter("dateTo", value)}
          />
        </div>
      </div>

      <Button type="button" variant="outline" onClick={onClear}>
        <T i18nKey="assignments.group_browser_filters.clear_group_filters" />
      </Button>
    </div>
  )
}
