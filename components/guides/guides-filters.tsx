"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { Filter, Search } from "lucide-react"

import {
  MultiSelect,
  type MultiSelectOption,
} from "@/components/common/multi-select"
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
import type { Circuit, GuideStatus } from "@/lib/types/domain"
import { normalizeLanguageOptions } from "@/lib/utils/language-options"

export type GuidesFilterValues = {
  search: string
  status: GuideStatus | "all"
  preferredLanguage: string
  circuitIds: string[]
}

type GuidesFiltersProps = {
  circuits: Circuit[]
  languages: string[]
  values: GuidesFilterValues
  onChange: (values: GuidesFilterValues) => void
  onClear: () => void
  resultCount: number
  totalCount: number
}

export function GuidesFilters({
  circuits,
  languages,
  values,
  onChange,
  onClear,
  resultCount,
  totalCount,
}: GuidesFiltersProps) {
  const { t } = useI18n()
  function updateFilter<Key extends keyof GuidesFilterValues>(
    key: Key,
    value: GuidesFilterValues[Key]
  ) {
    onChange({ ...values, [key]: value })
  }

  const circuitOptions: MultiSelectOption[] = circuits.map((circuit) => ({
    value: circuit.id,
    label: circuit.name,
  }))
  const languageOptions = normalizeLanguageOptions(languages)

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="size-4" />
            <T i18nKey="guides.guides_filters.filters" />
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            <T i18nKey="guides.guides_filters.showing" /> {resultCount} <T i18nKey="guides.guides_filters.of" /> {totalCount} <T i18nKey="guides.guides_filters.guides" />
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_repeat(3,minmax(180px,1fr))_auto]">
          <div className="grid gap-1">
            <Label htmlFor="guide-search"><T i18nKey="guides.guides_filters.guide_name_or_email" /></Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
              <Input
                id="guide-search"
                placeholder={t("guides.guides_filters.placeholder_search_guide")}
                className="pl-8"
                value={values.search}
                onChange={(event) =>
                  updateFilter("search", event.target.value)
                }
              />
            </div>
          </div>

          <div className="grid gap-1">
            <Label><T i18nKey="common.status" /></Label>
            <Select
              value={values.status}
              onValueChange={(value) =>
                updateFilter("status", value as GuidesFilterValues["status"])
              }
            >
              <SelectTrigger aria-label={t("guides.guides_filters.aria_label_filter_by_status")} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><T i18nKey="guides.guides_filters.all_statuses" /></SelectItem>
                <SelectItem value="pending-invitation">
                  <T i18nKey="guides.guides_filters.pending_invitation" />
                </SelectItem>
                <SelectItem value="invited"><T i18nKey="guides.guides_filters.invited" /></SelectItem>
                <SelectItem value="active"><T i18nKey="status.active" /></SelectItem>
                <SelectItem value="inactive"><T i18nKey="status.inactive" /></SelectItem>
                <SelectItem value="blocked"><T i18nKey="guides.guides_filters.blocked" /></SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label><T i18nKey="guides.guide_form_dialog.preferred_language" /></Label>
            <Select
              value={values.preferredLanguage}
              onValueChange={(value) =>
                updateFilter("preferredLanguage", value)
              }
            >
              <SelectTrigger
                aria-label={t("guides.guides_filters.aria_label_filter_by_preferred_language")}
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><T i18nKey="guides.guides_filters.all_languages" /></SelectItem>
                {languageOptions.map((language) => (
                  <SelectItem key={language} value={language}>
                    {language}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label><T i18nKey="common.circuit" /></Label>
            <MultiSelect
              label={t("common.circuit")}
              values={values.circuitIds}
              options={circuitOptions}
              emptyText={t("guides.guide_form_dialog.empty_text_no_circuit_found")}
              searchPlaceholder={t("common.search_circuits")}
              allText={t("common.all_circuits")}
              onValuesChange={(value) => updateFilter("circuitIds", value)}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={onClear}
            className="self-end"
          >
            <T i18nKey="guides.guides_filters.clear_filters" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
