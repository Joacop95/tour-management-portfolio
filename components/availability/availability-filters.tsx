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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AvailabilityStatus, Circuit } from "@/lib/types/domain"
import { normalizeLanguageOptions } from "@/lib/utils/language-options"

export type AvailabilityFilterValues = {
  search: string
  dateFrom: string
  dateTo: string
  years: string[]
  status: AvailabilityStatus | "all"
  preferredLanguage: string
  circuitIds: string[]
}

type AvailabilityFiltersProps = {
  circuits: Circuit[]
  languages: string[]
  values: AvailabilityFilterValues
  onChange: (values: AvailabilityFilterValues) => void
  onClear: () => void
  resultCount: number
  totalCount: number
}

export function AvailabilityFilters({
  circuits,
  languages,
  values,
  onChange,
  onClear,
  resultCount,
  totalCount,
}: AvailabilityFiltersProps) {
  const { t } = useI18n()
  function updateFilter<Key extends keyof AvailabilityFilterValues>(
    key: Key,
    value: AvailabilityFilterValues[Key]
  ) {
    onChange({ ...values, [key]: value })
  }

  const circuitOptions: MultiSelectOption[] = circuits.map((circuit) => ({
    value: circuit.id,
    label: circuit.name,
  }))
  const yearOptions: MultiSelectOption[] = Array.from(
    { length: 2040 - 2026 + 1 },
    (_, index) => {
      const year = String(2026 + index)

      return {
        value: year,
        label: year,
      }
    }
  )
  const languageOptions = normalizeLanguageOptions(languages)

  return (
    <Card size="sm" className="gap-2">
      <CardHeader className="border-b pb-2">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="size-4" />
            <T i18nKey="availability.availability_filters.filters" />
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            <T i18nKey="availability.availability_filters.showing" /> {resultCount} <T i18nKey="availability.availability_filters.of" /> {totalCount} <T i18nKey="availability.availability_filters.availability_records" />
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(180px,1.25fr)_repeat(6,minmax(120px,1fr))_auto]">
          <div className="grid gap-1">
            <Label htmlFor="availability-search" className="text-xs">
              <T i18nKey="availability.availability_filters.guide_name" />
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
              <Input
                id="availability-search"
                placeholder={t("availability.annual_availability_submissions.search_guide")}
                className="pl-8"
                value={values.search}
                onChange={(event) =>
                  updateFilter("search", event.target.value)
                }
              />
            </div>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs"><T i18nKey="availability.availability_filters.years" /></Label>
            <MultiSelect
              label={t("common.year")}
              values={values.years}
              options={yearOptions}
              emptyText={t("availability.availability_filters.empty_text_no_year_found")}
              searchPlaceholder={t("common.search_years")}
              allText="2026"
              onValuesChange={(value) =>
                updateFilter("years", value.length === 0 ? ["2026"] : value)
              }
            />
          </div>

          <div className="grid gap-1">
            <Label htmlFor="availability-date-from" className="text-xs">
              <T i18nKey="availability.availability_filters.date_from" />
            </Label>
            <DatePickerInput
              id="availability-date-from"
              value={values.dateFrom}
              onChange={(value) => updateFilter("dateFrom", value)}
            />
          </div>

          <div className="grid gap-1">
            <Label htmlFor="availability-date-to" className="text-xs">
              <T i18nKey="availability.availability_filters.date_to" />
            </Label>
            <DatePickerInput
              id="availability-date-to"
              value={values.dateTo}
              onChange={(value) => updateFilter("dateTo", value)}
            />
          </div>

          <div className="grid gap-1">
            <Label className="text-xs"><T i18nKey="availability.availability_filters.availability_status" /></Label>
            <Select
              value={values.status}
              onValueChange={(value) =>
                updateFilter(
                  "status",
                  value as AvailabilityFilterValues["status"]
                )
              }
            >
              <SelectTrigger
                aria-label={t("availability.availability_filters.aria_label_filter_by_availability_status")}
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><T i18nKey="availability.annual_availability_submissions.all_statuses" /></SelectItem>
                <SelectItem value="available"><T i18nKey="availability.status.available" /></SelectItem>
                <SelectItem value="not-available"><T i18nKey="common.not_available" /></SelectItem>
                <SelectItem value="occupied-by-assignment">
                  <T i18nKey="availability.status.occupied_by_assignment" />
                </SelectItem>
                <SelectItem value="pending-review"><T i18nKey="status.pending_review" /></SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs"><T i18nKey="availability.availability_filters.preferred_language" /></Label>
            <Select
              value={values.preferredLanguage}
              onValueChange={(value) =>
                updateFilter("preferredLanguage", value)
              }
            >
              <SelectTrigger
                aria-label={t("availability.availability_filters.aria_label_filter_by_preferred_language")}
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><T i18nKey="availability.availability_filters.all_languages" /></SelectItem>
                {languageOptions.map((language) => (
                  <SelectItem key={language} value={language}>
                    {language}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs"><T i18nKey="availability.availability_filters.circuit_capability" /></Label>
            <MultiSelect
              label={t("common.circuit")}
              values={values.circuitIds}
              options={circuitOptions}
              emptyText={t("availability.availability_filters.empty_text_no_circuit_found")}
              searchPlaceholder={t("common.search_circuits")}
              allText={t("common.all_circuits")}
              onValuesChange={(value) => updateFilter("circuitIds", value)}
            />
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onClear}
            className="self-end"
          >
            <T i18nKey="availability.availability_filters.clear_filters" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
