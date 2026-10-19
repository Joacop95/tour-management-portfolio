"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import {
  CalendarCheck,
  CalendarClock,
  CalendarMinus,
  CalendarX,
  Route,
  Users,
} from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { AvailabilityFilterValues } from "@/components/availability/availability-filters"
import type { Guide, GuideAvailability } from "@/lib/types/domain"

type AvailabilitySummaryCardsProps = {
  availability: GuideAvailability[]
  guides: Guide[]
  filters: AvailabilityFilterValues
}

function getFilteredActiveGuides(
  guides: Guide[],
  filters: AvailabilityFilterValues
) {
  const search = filters.search.trim().toLowerCase()

  return guides.filter((guide) => {
    const matchesStatus = guide.status === "active"
    const matchesSearch = search
      ? guide.name.toLowerCase().includes(search)
      : true
    const matchesPreferredLanguage =
      filters.preferredLanguage === "all" ||
      guide.preferredLanguage === filters.preferredLanguage
    const matchesCircuit =
      filters.circuitIds.length === 0 ||
      filters.circuitIds.some((circuitId) =>
        guide.circuitIds.includes(circuitId)
      )

    return (
      matchesStatus &&
      matchesSearch &&
      matchesPreferredLanguage &&
      matchesCircuit
    )
  })
}

function getGuideCountByStatus(
  guideIds: Set<string>,
  availability: GuideAvailability[],
  status: GuideAvailability["status"]
) {
  return new Set(
    availability
      .filter((record) => record.status === status && guideIds.has(record.guideId))
      .map((record) => record.guideId)
  ).size
}

export function AvailabilitySummaryCards({
  availability,
  guides,
  filters,
}: AvailabilitySummaryCardsProps) {
  const { t } = useI18n()
  const activeGuides = getFilteredActiveGuides(guides, filters)
  const activeGuideIds = new Set(activeGuides.map((guide) => guide.id))
  const loadedGuideIds = new Set(
    availability
      .filter((record) => activeGuideIds.has(record.guideId))
      .map((record) => record.guideId)
  )
  const unavailableGuideIds = new Set(
    availability
      .filter(
        (record) =>
          record.status === "not-available" && activeGuideIds.has(record.guideId)
      )
      .map((record) => record.guideId)
  )
  const availableGuideIds = new Set(
    availability
      .filter(
        (record) =>
          record.status === "available" && activeGuideIds.has(record.guideId)
      )
      .map((record) => record.guideId)
  )
  const fullyAvailableGuides = Array.from(availableGuideIds).filter(
    (guideId) => !unavailableGuideIds.has(guideId)
  ).length
  const pendingReviewRecords = availability.filter(
    (record) =>
      record.status === "pending-review" && activeGuideIds.has(record.guideId)
  ).length
  const summaries = [
    {
      label: t("availability.summary.loaded"),
      value: loadedGuideIds.size,
      icon: Users,
      tone: "text-sky-700 bg-sky-50 ring-sky-200",
    },
    {
      label: t("availability.summary.fully_available"),
      value: fullyAvailableGuides,
      icon: CalendarCheck,
      tone: "text-emerald-700 bg-emerald-50 ring-emerald-200",
    },
    {
      label: t("availability.summary.with_exceptions"),
      value: unavailableGuideIds.size,
      icon: CalendarX,
      tone: "text-red-700 bg-red-50 ring-red-200",
    },
    {
      label: t("availability.status.occupied_by_assignment"),
      value: getGuideCountByStatus(
        activeGuideIds,
        availability,
        "occupied-by-assignment"
      ),
      icon: Route,
      tone: "text-blue-700 bg-blue-50 ring-blue-200",
    },
    {
      label: t("status.pending_review"),
      value: pendingReviewRecords,
      icon: CalendarClock,
      tone: "text-amber-800 bg-amber-50 ring-amber-200",
    },
    {
      label: t("availability.summary.missing"),
      value: activeGuides.filter((guide) => !loadedGuideIds.has(guide.id))
        .length,
      icon: CalendarMinus,
      tone: "text-zinc-700 bg-zinc-50 ring-zinc-200",
    },
  ]

  return (
    <section className="space-y-1.5">
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {summaries.map((summary) => {
          const Icon = summary.icon

          return (
            <Card key={summary.label} size="sm" className="gap-1 py-2">
              <CardHeader className="gap-0">
                <CardTitle className="text-xs leading-tight text-muted-foreground">
                  {summary.label}
                </CardTitle>
                <CardAction>
                  <div
                    className={`flex size-7 items-center justify-center rounded-md ring-1 ${summary.tone}`}
                  >
                    <Icon className="size-3.5" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xl font-semibold leading-none">
                  {summary.value}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        <T i18nKey="availability.availability_summary_cards.summary_is_based_on_the_selected_year_s" />
      </p>
    </section>
  )
}
