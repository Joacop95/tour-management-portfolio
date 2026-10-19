"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import type { CSSProperties } from "react"
import { AlertTriangle, CalendarRange, Rows3 } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Circuit, Guide, TourGroup } from "@/lib/types/domain"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import type { PlanningDate } from "@/lib/types/planning"
import { cn } from "@/lib/utils"
import {
  formatDateDisplay,
  formatMonthYearDisplay,
} from "@/lib/utils/date-format"

const leftColumnWidth = 224
const laneHeight = 32
const rowVerticalPadding = 4

type PlanningTimelineSection = {
  title: string
  description: string
  emptyMessage: string
  leftLabel: string
  variant: "circuit" | "guide"
  rows: PlanningTimelineRow[]
}

type PlanningTimelineRow = {
  id: string
  label: string
  meta: string
  items: PlanningTimelineItem[]
}

type PlanningTimelineItem = {
  group: TourGroup
  circuit: Circuit | null
  circuitAbbreviation?: string
  guide: Guide | null
  lane: number
  restLabel?: string
  restTone?: "neutral" | "warning" | "danger"
}

type PlanningMonthSegment = {
  dayCount: number
  key: string
  label: string
  startIndex: number
}

type PlanningCircuitSort = "custom" | "most-tours" | "alphabetical"
type PlanningGuideSort =
  | "alphabetical"
  | "most-tours-year"
  | "next-assignment"

type PlanningTimelineProps = {
  circuitSort: PlanningCircuitSort
  circuitsExpanded: boolean
  dates: PlanningDate[]
  dayWidth: number
  endDateIso: string
  guidesExpanded: boolean
  guideSort: PlanningGuideSort
  onCircuitsExpandedChange: (expanded: boolean) => void
  onCircuitSortChange: (sort: PlanningCircuitSort) => void
  onGuideSortChange: (sort: PlanningGuideSort) => void
  onItemSelect: (item: PlanningTimelineItem) => void
  onGuidesExpandedChange: (expanded: boolean) => void
  sections: PlanningTimelineSection[]
  startDateIso: string
}

function toUtcDate(dateIso: string) {
  return new Date(`${dateIso}T00:00:00.000Z`)
}

function daysBetween(startDateIso: string, endDateIso: string) {
  const start = toUtcDate(startDateIso).getTime()
  const end = toUtcDate(endDateIso).getTime()

  return Math.round((end - start) / 86_400_000)
}

function maxDateIso(firstDateIso: string, secondDateIso: string) {
  return firstDateIso > secondDateIso ? firstDateIso : secondDateIso
}

function minDateIso(firstDateIso: string, secondDateIso: string) {
  return firstDateIso < secondDateIso ? firstDateIso : secondDateIso
}

function getPlanningMonthSegments(
  dates: PlanningDate[],
  locale: string
): PlanningMonthSegment[] {
  return dates.reduce<PlanningMonthSegment[]>((segments, date, index) => {
    const monthKey = date.iso.slice(0, 7)
    const currentSegment = segments.at(-1)

    if (currentSegment?.key === monthKey) {
      currentSegment.dayCount += 1
      return segments
    }

    segments.push({
      dayCount: 1,
      key: monthKey,
      label: formatMonthYearDisplay(monthKey, locale),
      startIndex: index,
    })
    return segments
  }, [])
}

function getBarStyle({
  dayWidth,
  group,
  lane,
  timelineEndDateIso,
  timelineStartDateIso,
}: {
  dayWidth: number
  group: TourGroup
  lane: number
  timelineEndDateIso: string
  timelineStartDateIso: string
}): CSSProperties | null {
  const visibleStart = maxDateIso(group.startDateIso, timelineStartDateIso)
  const visibleEnd = minDateIso(group.endDateIso, timelineEndDateIso)

  if (visibleStart > visibleEnd) {
    return null
  }

  const startOffset = daysBetween(timelineStartDateIso, visibleStart)
  const durationDays = daysBetween(visibleStart, visibleEnd) + 1

  return {
    left: startOffset * dayWidth + 4,
    top: lane * laneHeight + 3,
    width: Math.max(durationDays * dayWidth - 10, 42),
  }
}

function getGroupTone(group: TourGroup) {
  if (group.assignmentStatus === "without-guide") {
    return "without-guide"
  }

  if (group.confirmationStatus === "pending-confirmation") {
    return "pending"
  }

  return group.groupStatus
}

function getGroupBarClassName(group: TourGroup) {
  const tone = getGroupTone(group)

  return cn(
    "absolute flex h-7 min-w-10 items-center gap-1.5 overflow-hidden rounded-md border px-2 text-left text-xs font-medium shadow-sm transition hover:z-20 hover:shadow-md focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    tone === "without-guide" &&
      "border-rose-300 bg-rose-50 text-rose-800 ring-1 ring-rose-200",
    tone === "pending" &&
      "border-amber-300 bg-amber-50 text-amber-900 ring-1 ring-amber-200",
    tone === "active" &&
      "border-emerald-200 bg-emerald-50 text-emerald-800",
    tone === "finalized" &&
      "border-blue-200 bg-blue-50 text-blue-800",
    tone === "cxl" &&
      "border-zinc-200 bg-zinc-50 text-zinc-600 opacity-85 line-through",
    tone === "fusionado" &&
      "border-orange-200 bg-orange-50 text-orange-800"
  )
}

function getGuideName(guide: Guide | null, t: ReturnType<typeof useI18n>["t"]) {
  return guide?.name ?? t("status.without_guide")
}

const groupStatusLabelKeys: Record<TourGroup["groupStatus"], UiTranslationKey> = {
  active: "status.active",
  cxl: "status.cxl",
  finalized: "status.finalized",
  fusionado: "status.fusionado",
}

function getConfirmationLabel(group: TourGroup, t: ReturnType<typeof useI18n>["t"]) {
  if (group.assignmentStatus === "without-guide") {
    return t("planning.timeline.no_guide")
  }

  if (group.confirmationStatus === "pending-confirmation") {
    return t("status.pending")
  }

  if (group.confirmationStatus === "confirmed") {
    return t("status.confirmed")
  }

  return t("status.assigned")
}

function getTooltipText(item: PlanningTimelineItem, t: ReturnType<typeof useI18n>["t"]) {
  const guideName = getGuideName(item.guide, t)

  return [
    t("planning.timeline.tooltip.group", { group: item.group.code }),
    t("planning.timeline.tooltip.circuit", {
      circuit: item.circuit?.name ?? t("planning.timeline.unknown_circuit"),
    }),
    t("planning.timeline.tooltip.dates", {
      start: formatDateDisplay(item.group.startDateIso),
      end: formatDateDisplay(item.group.endDateIso),
    }),
    t("planning.timeline.tooltip.guide", { guide: guideName }),
    t("planning.timeline.tooltip.status", {
      status: t(groupStatusLabelKeys[item.group.groupStatus]),
    }),
    t("planning.timeline.tooltip.confirmation", {
      confirmation: getConfirmationLabel(item.group, t),
    }),
    item.restLabel
      ? t("planning.timeline.tooltip.rest", { rest: item.restLabel })
      : null,
  ]
    .filter(Boolean)
    .join("\n")
}

function getRowHeight(items: PlanningTimelineItem[]) {
  const laneCount =
    items.length > 0 ? Math.max(...items.map((item) => item.lane)) + 1 : 1

  return laneCount * laneHeight + rowVerticalPadding
}

function RestBadge({ item }: { item: PlanningTimelineItem }) {
  if (!item.restLabel) {
    return null
  }

  return (
    <span
      className={cn(
        "hidden shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] leading-none lg:inline",
        item.restTone === "danger" && "border-red-200 bg-white/70 text-red-700",
        item.restTone === "warning" &&
          "border-amber-200 bg-white/70 text-amber-800",
        (!item.restTone || item.restTone === "neutral") &&
          "border-border/70 bg-white/60 text-muted-foreground"
      )}
    >
      {item.restLabel}
    </span>
  )
}

function TimelineSection({
  circuitSort,
  circuitsExpanded,
  dayWidth,
  dates,
  endDateIso,
  guidesExpanded,
  guideSort,
  monthSegments,
  onCircuitsExpandedChange,
  onCircuitSortChange,
  onGuideSortChange,
  onGuidesExpandedChange,
  onItemSelect,
  section,
  startDateIso,
}: {
  circuitSort: PlanningCircuitSort
  circuitsExpanded: boolean
  dayWidth: number
  dates: PlanningDate[]
  endDateIso: string
  guidesExpanded: boolean
  guideSort: PlanningGuideSort
  monthSegments: PlanningMonthSegment[]
  onCircuitsExpandedChange: (expanded: boolean) => void
  onCircuitSortChange: (sort: PlanningCircuitSort) => void
  onGuideSortChange: (sort: PlanningGuideSort) => void
  onGuidesExpandedChange: (expanded: boolean) => void
  onItemSelect: (item: PlanningTimelineItem) => void
  section: PlanningTimelineSection
  startDateIso: string
}) {
  const { t } = useI18n()
  const timelineWidth = dates.length * dayWidth

  return (
    <Card>
      <CardHeader className="flex-col items-start justify-between gap-3 border-b py-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <CardTitle>{section.title}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {section.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {section.variant === "guide" ? (
            <>
              <Select
                value={guideSort}
                onValueChange={(value) =>
                  onGuideSortChange(value as PlanningGuideSort)
                }
              >
                <SelectTrigger aria-label={t("planning.planning_timeline.aria_label_sort_guide_rows")} className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alphabetical"><T i18nKey="planning.planning_timeline.alphabetical" /></SelectItem>
                  <SelectItem value="most-tours-year">
                    <T i18nKey="planning.planning_timeline.most_tours_this_year" />
                  </SelectItem>
                  <SelectItem value="next-assignment">
                    <T i18nKey="planning.planning_timeline.next_assignment_soonest" />
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                aria-expanded={guidesExpanded}
                onClick={() => onGuidesExpandedChange(!guidesExpanded)}
              >
                <Rows3 className="size-3.5" />
                {guidesExpanded
                  ? t("planning.timeline.show_assigned_guides")
                  : t("planning.timeline.show_all_guides")}
              </Button>
            </>
          ) : (
            <>
              <Select
                value={circuitSort}
                onValueChange={(value) =>
                  onCircuitSortChange(value as PlanningCircuitSort)
                }
              >
                <SelectTrigger aria-label={t("planning.planning_timeline.aria_label_sort_circuit_rows")} className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom"><T i18nKey="planning.planning_timeline.custom_order" /></SelectItem>
                  <SelectItem value="most-tours"><T i18nKey="planning.planning_timeline.most_tours" /></SelectItem>
                  <SelectItem value="alphabetical"><T i18nKey="planning.planning_timeline.alphabetical" /></SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                aria-expanded={circuitsExpanded}
                onClick={() => onCircuitsExpandedChange(!circuitsExpanded)}
              >
                <Rows3 className="size-3.5" />
                {circuitsExpanded
                  ? t("planning.timeline.show_circuits_with_groups")
                  : t("planning.timeline.show_all_circuits")}
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {section.rows.length === 0 ? (
          <div className="flex min-h-28 items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {section.emptyMessage}
          </div>
        ) : (
          <div
            data-planning-scroll={section.variant}
            className={cn(
              "max-h-[70vh] overflow-auto overscroll-contain",
              section.variant === "guide" &&
                (guidesExpanded ? "max-h-[85vh]" : "max-h-[640px]")
            )}
          >
            <div className="min-w-max">
              <div className="sticky top-0 z-20 bg-background shadow-sm">
                <div
                  data-planning-month-row={section.variant}
                  className="grid h-6 border-b bg-muted/50"
                  style={{
                    gridTemplateColumns: `${leftColumnWidth}px repeat(${dates.length}, ${dayWidth}px)`,
                  }}
                >
                  <div className="sticky left-0 z-30 flex items-center border-r bg-muted px-3 text-[10px] font-medium text-muted-foreground">
                    <T i18nKey="planning.planning_timeline.month" />
                  </div>
                  {monthSegments.map((month) => (
                    <div
                      key={month.key}
                      data-month-key={month.key}
                      data-visible-days={month.dayCount}
                      className="flex min-w-0 items-center justify-center overflow-hidden border-r px-2 text-center text-[11px] font-semibold text-muted-foreground"
                      style={{
                        gridColumn: `${month.startIndex + 2} / span ${month.dayCount}`,
                      }}
                      title={month.label}
                    >
                      <span className="truncate">{month.label}</span>
                    </div>
                  ))}
                </div>
                <div
                  data-planning-day-row={section.variant}
                  className="grid border-b bg-background"
                  style={{
                    gridTemplateColumns: `${leftColumnWidth}px repeat(${dates.length}, ${dayWidth}px)`,
                  }}
                >
                  <div className="sticky left-0 z-30 flex h-9 items-center border-r bg-background px-3 text-xs font-medium">
                    {section.leftLabel}
                  </div>
                  {dates.map((date) => (
                    <div
                      key={date.iso}
                      data-date-iso={date.iso}
                      className="flex h-9 flex-col items-center justify-center border-r px-1 text-center"
                      title={formatDateDisplay(date.iso)}
                    >
                      <span className="text-[10px] text-muted-foreground">
                        {date.weekday}
                      </span>
                      <span className="text-xs font-medium">{date.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {section.rows.map((row) => {
                const rowHeight = getRowHeight(row.items)

                return (
                  <div
                    key={row.id}
                    className="grid border-b bg-card"
                    style={{
                      gridTemplateColumns: `${leftColumnWidth}px ${timelineWidth}px`,
                    }}
                  >
                    <div
                      className="sticky left-0 z-20 flex flex-col justify-center border-r bg-card px-3"
                      style={{ height: rowHeight }}
                    >
                      <span className="truncate text-xs font-medium">
                        {row.label}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {row.meta}
                      </span>
                    </div>

                    <div
                      className="relative"
                      style={{
                        width: timelineWidth,
                        height: rowHeight,
                        backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${
                          dayWidth - 1
                        }px, var(--border) ${dayWidth}px)`,
                      }}
                    >
                      {row.items.map((item) => {
                        const barStyle = getBarStyle({
                          dayWidth,
                          group: item.group,
                          lane: item.lane,
                          timelineEndDateIso: endDateIso,
                          timelineStartDateIso: startDateIso,
                        })

                        if (!barStyle) {
                          return null
                        }

                        return (
                          <button
                            type="button"
                            key={`${row.id}-${item.group.id}`}
                            className={getGroupBarClassName(item.group)}
                            style={barStyle}
                            title={getTooltipText(item, t)}
                            onClick={() => onItemSelect(item)}
                          >
                            {item.group.assignmentStatus === "without-guide" ? (
                              <AlertTriangle className="size-3.5 shrink-0" />
                            ) : (
                              <CalendarRange className="size-3.5 shrink-0" />
                            )}
                            <span className="shrink-0">{item.group.code}</span>
                            <span className="truncate opacity-90">
                              {section.variant === "guide"
                                ? `${item.circuitAbbreviation ?? item.circuit?.code ?? "—"} · ${getConfirmationLabel(item.group, t)}`
                                : getGuideName(item.guide, t)}
                            </span>
                            <RestBadge item={item} />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function PlanningTimeline({
  circuitSort,
  circuitsExpanded,
  dates,
  dayWidth,
  endDateIso,
  guidesExpanded,
  guideSort,
  onCircuitsExpandedChange,
  onCircuitSortChange,
  onGuideSortChange,
  onItemSelect,
  onGuidesExpandedChange,
  sections,
  startDateIso,
}: PlanningTimelineProps) {
  const { locale } = useI18n()
  const monthSegments = getPlanningMonthSegments(dates, locale)

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <TimelineSection
          key={section.title}
          circuitSort={circuitSort}
          circuitsExpanded={circuitsExpanded}
          dayWidth={dayWidth}
          dates={dates}
          endDateIso={endDateIso}
          guidesExpanded={guidesExpanded}
          guideSort={guideSort}
          monthSegments={monthSegments}
          onCircuitsExpandedChange={onCircuitsExpandedChange}
          onCircuitSortChange={onCircuitSortChange}
          onGuideSortChange={onGuideSortChange}
          onGuidesExpandedChange={onGuidesExpandedChange}
          onItemSelect={onItemSelect}
          section={section}
          startDateIso={startDateIso}
        />
      ))}
    </div>
  )
}

export type {
  PlanningCircuitSort,
  PlanningGuideSort,
  PlanningTimelineItem,
  PlanningTimelineRow,
  PlanningTimelineSection,
}
