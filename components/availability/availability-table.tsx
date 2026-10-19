"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import { Fragment, useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit,
  ShieldCheck,
} from "lucide-react"

import { AvailabilityStatusBadge } from "@/components/availability/availability-status-badges"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"
import { overlapsYear } from "@/lib/utils/availability-conflicts"
import {
  formatDateDisplay,
  formatDateTimeDisplay,
} from "@/lib/utils/date-format"
import type { Circuit, Guide, GuideAvailability } from "@/lib/types/domain"

type DisplayGuideAvailability = GuideAvailability & {
  assignmentGroupCode?: string
  assignmentGroupStartDateIso?: string
  assignmentGroupEndDateIso?: string
  assignmentCircuitName?: string
}

type AvailabilityTableProps = {
  availability: DisplayGuideAvailability[]
  totalRecords: number
  guides: Guide[]
  circuits: Circuit[]
  selectedYears: string[]
  onEditAvailability: (availability: DisplayGuideAvailability) => void
  onDeleteAvailability: (availability: DisplayGuideAvailability) => void
  canCreateAvailability?: boolean
  canEditAvailability?: boolean
  canDeleteAvailability?: boolean
  createPermissionMessage?: string
  editPermissionMessage?: string
  deletePermissionMessage?: string
}

type GuideAvailabilityGroup = {
  guide: Guide
  records: DisplayGuideAvailability[]
  availableRecords: DisplayGuideAvailability[]
  notAvailableRecords: DisplayGuideAvailability[]
  occupiedRecords: DisplayGuideAvailability[]
  pendingRecords: DisplayGuideAvailability[]
}

type VisualPeriodGroup = {
  key: string
  status: GuideAvailability["status"]
  startDateIso: string
  endDateIso: string
  records: DisplayGuideAvailability[]
  sourceValues: GuideAvailability["source"][]
  notesSummary: string
  latestModifiedRecord?: DisplayGuideAvailability
  hasExactDuplicates: boolean
}

const sourceLabel = {
  "guide-submitted": "availability.source.guide_submitted",
  "admin-updated": "availability.source.admin_updated",
  "assignment-generated": "availability.source.assignment_generated",
} as const

const availabilityVisualConfig: Record<
  GuideAvailability["status"],
  {
    labelKey: UiTranslationKey
    dotClassName: string
    barClassName: string
    rowClassName: string
  }
> = {
  available: {
    labelKey: "availability.status.available",
    dotClassName: "bg-emerald-500",
    barClassName:
      "border-emerald-300 bg-emerald-100 text-emerald-950 hover:bg-emerald-200",
    rowClassName: "border-emerald-100 bg-emerald-50/35",
  },
  "not-available": {
    labelKey: "availability.status.not_available",
    dotClassName: "bg-rose-500",
    barClassName:
      "border-rose-300 bg-rose-100 text-rose-950 hover:bg-rose-200",
    rowClassName: "border-rose-100 bg-rose-50/40",
  },
  "occupied-by-assignment": {
    labelKey: "availability.status.occupied_by_assignment",
    dotClassName: "bg-sky-500",
    barClassName:
      "border-sky-300 bg-sky-100 text-sky-950 hover:bg-sky-200",
    rowClassName: "border-sky-100 bg-sky-50/40",
  },
  "pending-review": {
    labelKey: "status.pending_review",
    dotClassName: "bg-amber-500",
    barClassName:
      "border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-200",
    rowClassName: "border-amber-100 bg-amber-50/45",
  },
}

function getCircuitName(circuits: Circuit[], circuitId: string, t: ReturnType<typeof useI18n>["t"]) {
  return circuits.find((circuit) => circuit.id === circuitId)?.name ?? t("common.unknown")
}

function buildGroups(
  availability: DisplayGuideAvailability[],
  guides: Guide[],
  selectedYears: string[]
) {
  return guides
    .map<GuideAvailabilityGroup | null>((guide) => {
      const records = availability
        .filter(
          (record) =>
            record.guideId === guide.id &&
            selectedYears.some((year) =>
              overlapsYear(record.startDateIso, record.endDateIso, year)
            )
        )
        .sort((a, b) => a.startDateIso.localeCompare(b.startDateIso))

      if (records.length === 0) {
        return null
      }

      return {
        guide,
        records,
        availableRecords: records.filter((record) => record.status === "available"),
        notAvailableRecords: records.filter(
          (record) => record.status === "not-available"
        ),
        occupiedRecords: records.filter(
          (record) => record.status === "occupied-by-assignment"
        ),
        pendingRecords: records.filter(
          (record) => record.status === "pending-review"
        ),
      }
    })
    .filter((group): group is GuideAvailabilityGroup => group !== null)
}

function getLatestModifiedRecord(records: DisplayGuideAvailability[]) {
  return records
    .filter((record) => record.updatedAtIso)
    .sort((a, b) =>
      (b.updatedAtIso ?? "").localeCompare(a.updatedAtIso ?? "")
    )[0]
}

function buildVisualPeriodGroups(records: DisplayGuideAvailability[]) {
  const groupedRecords = new Map<string, DisplayGuideAvailability[]>()

  records.forEach((record) => {
    const key = `${record.status}|${record.startDateIso}|${record.endDateIso}`
    groupedRecords.set(key, [...(groupedRecords.get(key) ?? []), record])
  })

  return Array.from(groupedRecords.entries()).map<VisualPeriodGroup>(
    ([key, groupedPeriodRecords]) => {
      const [status, startDateIso, endDateIso] = key.split("|") as [
        GuideAvailability["status"],
        string,
        string,
      ]
      const sourceValues = Array.from(
        new Set(groupedPeriodRecords.map((record) => record.source))
      )
      const notes = Array.from(
        new Set(
          groupedPeriodRecords
            .map((record) => record.notes.trim())
            .filter(Boolean)
        )
      )
      const exactDuplicateKeys = new Set(
        groupedPeriodRecords.map(
          (record) =>
            `${record.guideId}|${record.status}|${record.startDateIso}|${record.endDateIso}|${record.source}`
        )
      )

      return {
        key,
        status,
        startDateIso,
        endDateIso,
        records: groupedPeriodRecords,
        sourceValues,
        notesSummary:
          notes.length === 0
            ? "-"
            : notes.length === 1
              ? notes[0]
              : "Multiple notes",
        latestModifiedRecord: getLatestModifiedRecord(groupedPeriodRecords),
        hasExactDuplicates: exactDuplicateKeys.size < groupedPeriodRecords.length,
      }
    }
  )
}

function SourceBadges({ sourceValues }: { sourceValues: GuideAvailability["source"][] }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-wrap gap-1">
      {sourceValues.map((source) => (
        <Badge key={source} variant="outline">
          {t(sourceLabel[source])}
        </Badge>
      ))}
    </div>
  )
}

function parseIsoDateUtc(dateIso: string) {
  const [year, month, day] = dateIso.split("-").map(Number)

  return new Date(Date.UTC(year, month - 1, day))
}

function dateToIsoUtc(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function addUtcDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + days)
  return nextDate
}

function diffUtcDays(startDateIso: string, endDateIso: string) {
  const startDate = parseIsoDateUtc(startDateIso)
  const endDate = parseIsoDateUtc(endDateIso)

  return Math.round(
    (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
  )
}

function getTimelineRange(
  selectedYears: string[],
  records: DisplayGuideAvailability[]
) {
  const years = new Set(
    selectedYears
    .map((year) => Number(year))
    .filter((year) => Number.isFinite(year))
  )
  records.forEach((record) => {
    const startYear = Number(record.startDateIso.slice(0, 4))
    const endYear = Number(record.endDateIso.slice(0, 4))

    if (Number.isFinite(startYear)) {
      years.add(startYear)
    }

    if (Number.isFinite(endYear)) {
      years.add(endYear)
    }
  })
  const sortedYears = Array.from(years).sort((a, b) => a - b)
  const fallbackYear = new Date().getFullYear()
  const startYear = sortedYears[0] ?? fallbackYear
  const endYear = sortedYears[sortedYears.length - 1] ?? startYear

  return {
    startDateIso: `${startYear}-01-01`,
    endDateIso: `${endYear}-12-31`,
  }
}

function clampDateIso(dateIso: string, minDateIso: string, maxDateIso: string) {
  if (dateIso < minDateIso) {
    return minDateIso
  }

  if (dateIso > maxDateIso) {
    return maxDateIso
  }

  return dateIso
}

function buildTimelineMonths(startDateIso: string, endDateIso: string, locale: string) {
  const months: {
    key: string
    label: string
    left: number
    width: number
  }[] = []
  const totalDays = diffUtcDays(startDateIso, endDateIso) + 1
  const startDate = parseIsoDateUtc(startDateIso)
  const endDate = parseIsoDateUtc(endDateIso)
  let cursor = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1)
  )

  while (cursor <= endDate) {
    const monthStartIso = dateToIsoUtc(cursor)
    const nextMonth = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)
    )
    const monthEndIso = dateToIsoUtc(addUtcDays(nextMonth, -1))
    const visibleStartIso = clampDateIso(monthStartIso, startDateIso, endDateIso)
    const visibleEndIso = clampDateIso(monthEndIso, startDateIso, endDateIso)
    const left = (diffUtcDays(startDateIso, visibleStartIso) / totalDays) * 100
    const width =
      ((diffUtcDays(visibleStartIso, visibleEndIso) + 1) / totalDays) * 100

    months.push({
      key: monthStartIso,
      label: cursor.toLocaleDateString(locale, {
        month: "short",
        timeZone: "UTC",
        year: "numeric",
      }),
      left,
      width,
    })

    cursor = nextMonth
  }

  return months
}

function buildTimelineLanes(periodGroups: VisualPeriodGroup[]) {
  const lanes: VisualPeriodGroup[][] = []
  const sortedGroups = [...periodGroups].sort((a, b) => {
    const startComparison = a.startDateIso.localeCompare(b.startDateIso)

    if (startComparison !== 0) {
      return startComparison
    }

    const endComparison = a.endDateIso.localeCompare(b.endDateIso)

    if (endComparison !== 0) {
      return endComparison
    }

    return a.status.localeCompare(b.status)
  })

  sortedGroups.forEach((periodGroup) => {
    const availableLane = lanes.find((lane) => {
      const lastPeriod = lane[lane.length - 1]
      return lastPeriod.endDateIso < periodGroup.startDateIso
    })

    if (availableLane) {
      availableLane.push(periodGroup)
      return
    }

    lanes.push([periodGroup])
  })

  return lanes
}

function getAssignmentContexts(periodGroup: VisualPeriodGroup) {
  return Array.from(
    new Map(
      periodGroup.records
        .filter((record) => record.assignmentGroupCode)
        .map((record) => [
          record.assignmentGroupCode,
          {
            code: record.assignmentGroupCode,
            circuitName: record.assignmentCircuitName,
            startDateIso: record.assignmentGroupStartDateIso,
            endDateIso: record.assignmentGroupEndDateIso,
          },
        ])
    ).values()
  )
}

function getPeriodGroupSummary(periodGroup: VisualPeriodGroup, t: ReturnType<typeof useI18n>["t"]) {
  const assignmentContexts = getAssignmentContexts(periodGroup)

  if (assignmentContexts.length > 0) {
    return assignmentContexts
      .map((context) => context.code)
      .filter(Boolean)
      .join(", ")
  }

  return periodGroup.notesSummary === "-"
    ? t("availability.table.no_notes")
    : periodGroup.notesSummary === "Multiple notes"
      ? t("availability.table.multiple_notes")
      : periodGroup.notesSummary
}

function GuideAvailabilityVisualDetail({
  group,
  selectedYears,
  onEditAvailability,
  onDeleteAvailability,
  canEditAvailability,
  canDeleteAvailability,
  editPermissionMessage,
  deletePermissionMessage,
}: {
  group: GuideAvailabilityGroup
  selectedYears: string[]
  onEditAvailability: (availability: DisplayGuideAvailability) => void
  onDeleteAvailability: (availability: DisplayGuideAvailability) => void
  canEditAvailability: boolean
  canDeleteAvailability: boolean
  editPermissionMessage: string
  deletePermissionMessage: string
}) {
  const { locale, t } = useI18n()
  const visualGroups = useMemo(
    () => buildVisualPeriodGroups(group.records),
    [group.records]
  )
  const sortedVisualGroups = useMemo(
    () =>
      [...visualGroups].sort((a, b) => {
        const startComparison = a.startDateIso.localeCompare(b.startDateIso)

        if (startComparison !== 0) {
          return startComparison
        }

        return a.endDateIso.localeCompare(b.endDateIso)
      }),
    [visualGroups]
  )
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>(
    sortedVisualGroups[0]?.key ?? ""
  )
  const selectedPeriod =
    sortedVisualGroups.find((periodGroup) => periodGroup.key === selectedPeriodKey) ??
    sortedVisualGroups[0]
  const timelineRange = useMemo(
    () => getTimelineRange(selectedYears, group.records),
    [group.records, selectedYears]
  )
  const timelineMonths = useMemo(
    () =>
      buildTimelineMonths(timelineRange.startDateIso, timelineRange.endDateIso, locale),
    [locale, timelineRange.endDateIso, timelineRange.startDateIso]
  )
  const timelineLanes = useMemo(
    () => buildTimelineLanes(sortedVisualGroups),
    [sortedVisualGroups]
  )
  const totalTimelineDays =
    diffUtcDays(timelineRange.startDateIso, timelineRange.endDateIso) + 1
  const timelineMinWidth = Math.max(880, timelineMonths.length * 74)
  const selectedAssignmentContexts = selectedPeriod
    ? getAssignmentContexts(selectedPeriod)
    : []

  return (
    <div className="space-y-3 p-3">
      <div className="grid gap-2 md:grid-cols-4">
        <div className="rounded-lg border bg-background px-3 py-2">
          <p className="text-xs text-muted-foreground"><T i18nKey="availability.status.available" /></p>
          <p className="text-lg font-semibold">{group.availableRecords.length}</p>
        </div>
        <div className="rounded-lg border bg-background px-3 py-2">
          <p className="text-xs text-muted-foreground"><T i18nKey="common.not_available" /></p>
          <p className="text-lg font-semibold">
            {group.notAvailableRecords.length}
          </p>
        </div>
        <div className="rounded-lg border bg-background px-3 py-2">
          <p className="text-xs text-muted-foreground"><T i18nKey="availability.availability_table.occupied_assignments" /></p>
          <p className="text-lg font-semibold">{group.occupiedRecords.length}</p>
        </div>
        <div className="rounded-lg border bg-background px-3 py-2">
          <p className="text-xs text-muted-foreground"><T i18nKey="status.pending_review" /></p>
          <p className="text-lg font-semibold">{group.pendingRecords.length}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-background">
        <div className="flex flex-col gap-2 border-b px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold"><T i18nKey="availability.availability_table.year_timeline" /></p>
            <p className="text-xs text-muted-foreground">
              <T i18nKey="availability.availability_table.click_a_period_to_inspect_notes_source_assignment" />
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(availabilityVisualConfig).map(([status, config]) => (
              <span key={status} className="inline-flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", config.dotClassName)} />
                {t(config.labelKey)}
              </span>
            ))}
          </div>
        </div>

        {sortedVisualGroups.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            <T i18nKey="availability.availability_table.no_availability_periods_for_the_selected_year" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="p-3" style={{ minWidth: timelineMinWidth }}>
              <div className="relative h-7 border-b text-[11px] text-muted-foreground">
                {timelineMonths.map((month) => (
                  <div
                    key={month.key}
                    className="absolute inset-y-0 border-l pl-1"
                    style={{
                      left: `${month.left}%`,
                      width: `${month.width}%`,
                    }}
                  >
                    {month.label}
                  </div>
                ))}
              </div>

              <div
                className="relative mt-2 rounded-md border bg-muted/20"
                style={{
                  height: Math.max(44, timelineLanes.length * 32 + 12),
                }}
              >
                {timelineMonths.map((month) => (
                  <div
                    key={month.key}
                    className="absolute inset-y-0 border-l border-border/60"
                    style={{ left: `${month.left}%` }}
                  />
                ))}
                {timelineLanes.map((lane, laneIndex) =>
                  lane.map((periodGroup) => {
                    const startDateIso = clampDateIso(
                      periodGroup.startDateIso,
                      timelineRange.startDateIso,
                      timelineRange.endDateIso
                    )
                    const endDateIso = clampDateIso(
                      periodGroup.endDateIso,
                      timelineRange.startDateIso,
                      timelineRange.endDateIso
                    )
                    const left =
                      (diffUtcDays(timelineRange.startDateIso, startDateIso) /
                        totalTimelineDays) *
                      100
                    const width =
                      ((diffUtcDays(startDateIso, endDateIso) + 1) /
                        totalTimelineDays) *
                      100
                    const config = availabilityVisualConfig[periodGroup.status]
                    const isSelected = selectedPeriod?.key === periodGroup.key
                    const isProtected = periodGroup.records.some(
                      (record) => record.source === "assignment-generated"
                    )

                    return (
                      <button
                        key={periodGroup.key}
                        type="button"
                        className={cn(
                          "absolute flex h-6 min-w-12 items-center gap-1 overflow-hidden rounded-md border px-2 text-left text-[11px] leading-none shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                          config.barClassName,
                          isSelected && "ring-2 ring-primary/45"
                        )}
                        style={{
                          left: `${left}%`,
                          top: 6 + laneIndex * 32,
                          width: `${Math.max(width, 3)}%`,
                        }}
                        title={`${t(config.labelKey)}: ${formatDateDisplay(
                          periodGroup.startDateIso
                        )} - ${formatDateDisplay(periodGroup.endDateIso)}`}
                        onClick={() => setSelectedPeriodKey(periodGroup.key)}
                      >
                        {isProtected ? (
                          <ShieldCheck className="size-3 shrink-0" />
                        ) : null}
                        <span className="truncate">
                          {t(config.labelKey)}
                          {periodGroup.records.length > 1
                            ? ` · ${periodGroup.records.length}`
                            : ""}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="rounded-lg border bg-background">
          <div className="border-b px-3 py-2">
            <p className="text-sm font-semibold"><T i18nKey="availability.availability_table.periods" /></p>
            <p className="text-xs text-muted-foreground">
              <T i18nKey="availability.availability_table.notes_stay_in_the_detail_panel_so_the" />
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto p-2">
            <div className="space-y-1.5">
              {sortedVisualGroups.map((periodGroup) => {
                const config = availabilityVisualConfig[periodGroup.status]
                const isProtected = periodGroup.records.some(
                  (record) => record.source === "assignment-generated"
                )

                return (
                  <button
                    key={periodGroup.key}
                    type="button"
                    className={cn(
                      "flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left transition hover:border-primary/30 hover:bg-primary/5",
                      config.rowClassName,
                      selectedPeriod?.key === periodGroup.key &&
                        "border-primary/40 ring-1 ring-primary/25"
                    )}
                    onClick={() => setSelectedPeriodKey(periodGroup.key)}
                  >
                    <span className="min-w-0 space-y-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <AvailabilityStatusBadge status={periodGroup.status} />
                        {isProtected ? (
                          <Badge
                            variant="outline"
                            className="border-blue-200 bg-blue-50 text-blue-700"
                          >
                            <T i18nKey="availability.availability_table.protected" />
                          </Badge>
                        ) : null}
                        {periodGroup.records.length > 1 ? (
                          <Badge variant="outline">
                            {periodGroup.records.length} <T i18nKey="availability.availability_table.records" />
                          </Badge>
                        ) : null}
                      </span>
                      <span className="block text-xs font-medium">
                        {formatDateDisplay(periodGroup.startDateIso)} -{" "}
                        {formatDateDisplay(periodGroup.endDateIso)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {getPeriodGroupSummary(periodGroup, t)}
                      </span>
                    </span>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-background">
          <div className="border-b px-3 py-2">
            <p className="text-sm font-semibold"><T i18nKey="availability.availability_table.selected_period_details" /></p>
            <p className="text-xs text-muted-foreground">
              <T i18nKey="availability.availability_table.source_notes_protected_state_and_actions" />
            </p>
          </div>
          {selectedPeriod ? (
            <div className="space-y-3 p-3 text-sm">
              <div className="space-y-2">
                <AvailabilityStatusBadge status={selectedPeriod.status} />
                <div className="text-xs font-medium">
                  {formatDateDisplay(selectedPeriod.startDateIso)} -{" "}
                  {formatDateDisplay(selectedPeriod.endDateIso)}
                </div>
                <SourceBadges sourceValues={selectedPeriod.sourceValues} />
                <div className="flex flex-wrap gap-1">
                  {selectedPeriod.records.length > 1 ? (
                    <Badge variant="outline">
                      {selectedPeriod.records.length} <T i18nKey="availability.availability_table.stored_records" />
                    </Badge>
                  ) : null}
                  {selectedPeriod.hasExactDuplicates ? (
                    <Badge
                      variant="outline"
                      className="border-amber-200 bg-amber-50 text-amber-800"
                    >
                      <T i18nKey="availability.availability_table.duplicate_records" />
                    </Badge>
                  ) : null}
                  {selectedPeriod.records.some(
                    (record) => record.source === "assignment-generated"
                  ) ? (
                    <Badge
                      variant="outline"
                      className="border-blue-200 bg-blue-50 text-blue-700"
                    >
                      <T i18nKey="availability.availability_table.protected" />
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground"><T i18nKey="common.notes" /></p>
                <p className="whitespace-pre-wrap text-sm">
                  {selectedPeriod.notesSummary === "-"
                    ? t("availability.table.no_notes")
                    : selectedPeriod.notesSummary === "Multiple notes"
                      ? t("availability.table.multiple_notes")
                      : selectedPeriod.notesSummary}
                </p>
              </div>

              {selectedAssignmentContexts.length > 0 ? (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">
                  <p className="font-medium"><T i18nKey="availability.availability_table.assignment_context" /></p>
                  <div className="mt-1 space-y-1">
                    {selectedAssignmentContexts.map((context) => (
                      <div key={context.code}>
                        {context.code}
                        {context.circuitName ? ` · ${context.circuitName}` : ""}
                        {context.startDateIso && context.endDateIso
                          ? ` · ${formatDateDisplay(context.startDateIso)} - ${formatDateDisplay(context.endDateIso)}`
                          : ""}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div>
                  <span className="block font-medium text-foreground">
                    <T i18nKey="availability.availability_table.last_modified" />
                  </span>
                  {formatDateTimeDisplay(selectedPeriod.latestModifiedRecord?.updatedAtIso)}
                </div>
                <div>
                  <span className="block font-medium text-foreground">
                    <T i18nKey="availability.availability_table.updated_by" />
                  </span>
                  {selectedPeriod.latestModifiedRecord?.updatedBy || "—"}
                </div>
              </div>

              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  <T i18nKey="availability.availability_table.stored_records_and_actions" />
                </p>
                {selectedPeriod.records.map((record) => {
                  const isAssignmentGenerated =
                    record.source === "assignment-generated" ||
                    record.status === "occupied-by-assignment"

                  return (
                    <div
                      key={record.id}
                      className="rounded-md border bg-muted/20 p-2"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1 text-xs">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline">
                              {t(sourceLabel[record.source])}
                            </Badge>
                            {isAssignmentGenerated ? (
                              <Badge
                                variant="outline"
                                className="border-blue-200 bg-blue-50 text-blue-700"
                              >
                                <T i18nKey="availability.availability_table.protected" />
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground">
                            <T i18nKey="availability.availability_table.created" /> {formatDateTimeDisplay(record.createdAtIso)}
                          </p>
                          {record.notes ? (
                            <p className="whitespace-pre-wrap text-foreground">
                              {record.notes}
                            </p>
                          ) : null}
                          {isAssignmentGenerated ? (
                            <p className="text-blue-800">
                              <T i18nKey="availability.availability_table.assignment_generated_periods_are_protected_change_the_assignment" />
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isAssignmentGenerated || !canEditAvailability}
                            title={
                              !canEditAvailability
                                ? editPermissionMessage
                                : isAssignmentGenerated
                                  ? "Assignment-generated periods are protected."
                                  : undefined
                            }
                            onClick={() => {
                              if (!isAssignmentGenerated && canEditAvailability) {
                                onEditAvailability(record)
                              }
                            }}
                          >
                            <Edit className="size-3.5" />
                            <T i18nKey="common.edit" />
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={isAssignmentGenerated || !canDeleteAvailability}
                            title={
                              !canDeleteAvailability
                                ? deletePermissionMessage
                                : isAssignmentGenerated
                                  ? "Assignment-generated periods are protected."
                                  : undefined
                            }
                            onClick={() => {
                              if (!isAssignmentGenerated && canDeleteAvailability) {
                                onDeleteAvailability(record)
                              }
                            }}
                          >
                            <Trash2 className="size-3.5" />
                            <T i18nKey="common.delete" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="p-3 text-sm text-muted-foreground">
              <T i18nKey="availability.availability_table.select_a_period_to_see_its_details" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function AvailabilityTable({
  availability,
  totalRecords,
  guides,
  circuits,
  selectedYears,
  onEditAvailability,
  onDeleteAvailability,
  canEditAvailability = true,
  canDeleteAvailability = true,
  editPermissionMessage = "You do not have permission to edit availability.",
  deletePermissionMessage = "You do not have permission to delete availability.",
}: AvailabilityTableProps) {
  const { t } = useI18n()
  const [expandedGuideIds, setExpandedGuideIds] = useState<string[]>([])
  const groups = useMemo(
    () => buildGroups(availability, guides, selectedYears),
    [availability, guides, selectedYears]
  )
  const hasActiveFilters = availability.length !== totalRecords

  function toggleGuide(guideId: string) {
    setExpandedGuideIds((currentIds) =>
      currentIds.includes(guideId)
        ? currentIds.filter((id) => id !== guideId)
        : [...currentIds, guideId]
    )
  }

  return (
    <Card size="sm" className="gap-2">
      <CardHeader className="border-b pb-2">
        <div>
          <CardTitle><T i18nKey="availability.availability_table.availability_by_guide" /></CardTitle>
          <CardDescription className="text-xs">
            <T i18nKey="availability.availability_filters.showing" /> {groups.length} <T i18nKey="availability.availability_table.guides_and" /> {availability.length}
            {hasActiveFilters ? ` of ${totalRecords}` : ""} <T i18nKey="availability.availability_table.matching_records_for" /> {selectedYears.join(", ")}.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="text-xs [&_td]:px-2 [&_td]:py-1.5 [&_th]:h-8 [&_th]:px-2">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4" />
              <TableHead><T i18nKey="common.guide" /></TableHead>
              <TableHead><T i18nKey="availability.availability_filters.preferred_language" /></TableHead>
              <TableHead><T i18nKey="availability.availability_filters.circuit_capability" /></TableHead>
              <TableHead><T i18nKey="common.year" /></TableHead>
              <TableHead><T i18nKey="availability.availability_table.available_periods" /></TableHead>
              <TableHead><T i18nKey="availability.availability_table.not_available_exceptions" /></TableHead>
              <TableHead><T i18nKey="availability.availability_table.occupied_assignments" /></TableHead>
              <TableHead><T i18nKey="status.pending_review" /></TableHead>
              <TableHead><T i18nKey="availability.availability_table.last_modified" /></TableHead>
              <TableHead className="pr-4 text-right"><T i18nKey="common.actions" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="h-28 text-center text-muted-foreground"
                >
                  <T i18nKey="availability.availability_table.no_guide_availability_matches_the_selected_filters" />
                </TableCell>
              </TableRow>
            ) : null}
            {groups.map((group) => {
              const isExpanded = expandedGuideIds.includes(group.guide.id)
              const latestModifiedRecord = getLatestModifiedRecord(group.records)

              return (
                <Fragment key={group.guide.id}>
                  <TableRow
                    className={cn(
                      group.occupiedRecords.length > 0 &&
                        "bg-blue-50/50 hover:bg-blue-50",
                      group.notAvailableRecords.length > 0 &&
                        group.occupiedRecords.length === 0 &&
                        "bg-red-50/40 hover:bg-red-50"
                    )}
                  >
                    <TableCell className="pl-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleGuide(group.guide.id)}
                        aria-label={
                          isExpanded ? t("availability.table.hide_periods") : t("availability.table.view_periods")
                        }
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">
                      {group.guide.name}
                    </TableCell>
                    <TableCell>{group.guide.preferredLanguage || "-"}</TableCell>
                    <TableCell>
                      <div className="flex max-w-72 flex-wrap gap-1">
                        {group.guide.circuitIds.map((circuitId) => (
                          <Badge key={circuitId} variant="outline">
                            {getCircuitName(circuits, circuitId, t)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {selectedYears.length > 1 ? t("availability.table.multiple_years") : selectedYears[0]}
                    </TableCell>
                    <TableCell className="max-w-64 text-xs">
                      {group.availableRecords.length} <T i18nKey="availability.availability_table.periods_2" />
                    </TableCell>
                    <TableCell className="max-w-64 text-xs">
                      {group.notAvailableRecords.length} <T i18nKey="availability.availability_table.exceptions" />
                    </TableCell>
                    <TableCell className="max-w-56 text-xs">
                      {group.occupiedRecords.length} <T i18nKey="availability.availability_table.assignments" />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {group.pendingRecords.length}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTimeDisplay(latestModifiedRecord?.updatedAtIso)}
                      {latestModifiedRecord?.updatedBy ? (
                        <span className="block">
                          {latestModifiedRecord.updatedBy}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggleGuide(group.guide.id)}
                      >
                        <T i18nKey="availability.availability_table.view_periods" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isExpanded ? (
                    <TableRow>
                      <TableCell colSpan={11} className="bg-muted/30 p-0">
                        <GuideAvailabilityVisualDetail
                          group={group}
                          selectedYears={selectedYears}
                          onEditAvailability={onEditAvailability}
                          onDeleteAvailability={onDeleteAvailability}
                          canEditAvailability={canEditAvailability}
                          canDeleteAvailability={canDeleteAvailability}
                          editPermissionMessage={editPermissionMessage}
                          deletePermissionMessage={deletePermissionMessage}
                        />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
