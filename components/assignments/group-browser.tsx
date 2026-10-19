"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { useMemo, useState } from "react"

import {
  GroupBrowserFilters,
  type AssignmentGroupFilter,
} from "@/components/assignments/group-browser-filters"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Circuit, Guide, TourGroup } from "@/lib/types/domain"
import { cn } from "@/lib/utils"
import { formatDateDisplay } from "@/lib/utils/date-format"

type GroupBrowserProps = {
  groups: TourGroup[]
  circuits: Circuit[]
  guides: Guide[]
  selectedGroupId: string | null
  onSelectGroup: (groupId: string) => void
}

const referenceDate = "2026-06-01"

const defaultFilters: AssignmentGroupFilter = {
  search: "",
  circuitIds: [],
  assignmentStatuses: [],
  groupStatuses: [],
  dateFrom: "",
  dateTo: "",
  sort: "start-asc",
  quickFilter: "upcoming",
}

function getCircuit(circuits: Circuit[], circuitId: string) {
  return circuits.find((circuit) => circuit.id === circuitId)
}

function getGuide(guides: Guide[], guideId: string | null) {
  if (!guideId) {
    return undefined
  }

  return guides.find((guide) => guide.id === guideId)
}

function getAssignmentLabel(group: TourGroup, t: ReturnType<typeof useI18n>["t"]) {
  if (!group.guideId) return t("status.without_guide")
  if (group.confirmationStatus === "pending-confirmation") {
    return t("status.pending")
  }
  if (group.confirmationStatus === "confirmed") return t("status.confirmed")

  return t("status.assigned")
}

function getAssignmentClassName(group: TourGroup) {
  if (!group.guideId) return "border-red-200 bg-red-50 text-red-700"
  if (group.confirmationStatus === "pending-confirmation") {
    return "border-amber-200 bg-amber-50 text-amber-800"
  }
  if (group.confirmationStatus === "confirmed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700"
  }

  return "border-blue-200 bg-blue-50 text-blue-700"
}

function matchesAssignmentStatus(group: TourGroup, status: string) {
  if (status === "without-guide") return group.guideId === null
  if (status === "assigned") return group.guideId !== null
  if (status === "pending-confirmation") {
    return (
      group.guideId !== null &&
      group.confirmationStatus === "pending-confirmation"
    )
  }
  if (status === "confirmed") {
    return group.guideId !== null && group.confirmationStatus === "confirmed"
  }

  return false
}

function matchesQuickFilter(group: TourGroup, quickFilter: string) {
  if (quickFilter === "upcoming") {
    return group.groupStatus === "active" && group.startDateIso >= referenceDate
  }
  if (quickFilter === "without-guide") return group.guideId === null
  if (quickFilter === "pending-confirmation") {
    return (
      group.guideId !== null &&
      group.confirmationStatus === "pending-confirmation"
    )
  }
  if (quickFilter === "assigned") return group.guideId !== null

  return true
}

function filterGroups(groups: TourGroup[], filters: AssignmentGroupFilter) {
  const search = filters.search.trim().toLowerCase()

  return groups.filter((group) => {
    const matchesSearch = search
      ? group.code.toLowerCase().includes(search)
      : true
    const matchesCircuit =
      filters.circuitIds.length === 0 ||
      filters.circuitIds.includes(group.circuitId)
    const matchesAssignment =
      filters.assignmentStatuses.length === 0 ||
      filters.assignmentStatuses.some((status) =>
        matchesAssignmentStatus(group, status)
      )
    const matchesGroupStatus =
      filters.groupStatuses.length === 0 ||
      filters.groupStatuses.includes(group.groupStatus)
    const matchesDateFrom =
      !filters.dateFrom || group.startDateIso >= filters.dateFrom
    const matchesDateTo = !filters.dateTo || group.startDateIso <= filters.dateTo

    return (
      matchesSearch &&
      matchesCircuit &&
      matchesAssignment &&
      matchesGroupStatus &&
      matchesDateFrom &&
      matchesDateTo &&
      matchesQuickFilter(group, filters.quickFilter)
    )
  })
}

function sortGroups(
  groups: TourGroup[],
  sort: string,
  circuits: Circuit[]
) {
  return [...groups].sort((firstGroup, secondGroup) => {
    if (sort === "start-desc") {
      return secondGroup.startDateIso.localeCompare(firstGroup.startDateIso)
    }

    if (sort === "code-asc") {
      return firstGroup.code.localeCompare(secondGroup.code)
    }

    if (sort === "circuit-asc") {
      const firstCircuit = getCircuit(circuits, firstGroup.circuitId)?.name ?? ""
      const secondCircuit =
        getCircuit(circuits, secondGroup.circuitId)?.name ?? ""

      return firstCircuit.localeCompare(secondCircuit)
    }

    return firstGroup.startDateIso.localeCompare(secondGroup.startDateIso)
  })
}

export function GroupBrowser({
  groups,
  circuits,
  guides,
  selectedGroupId,
  onSelectGroup,
}: GroupBrowserProps) {
  const { t } = useI18n()
  const [filters, setFilters] = useState<AssignmentGroupFilter>(defaultFilters)
  const visibleGroups = useMemo(
    () => sortGroups(filterGroups(groups, filters), filters.sort, circuits),
    [circuits, filters, groups]
  )

  return (
    <Card>
      <CardHeader className="border-b py-3">
        <div className="flex flex-col gap-1">
          <CardTitle><T i18nKey="assignments.group_browser.group_browser" /></CardTitle>
          <p className="text-sm text-muted-foreground">
            <T i18nKey="assignments.group_browser.showing" /> {visibleGroups.length} <T i18nKey="assignments.group_browser.of" /> {groups.length} <T i18nKey="assignments.group_browser.groups" />
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <GroupBrowserFilters
          circuits={circuits}
          values={filters}
          onChange={setFilters}
          onClear={() => setFilters(defaultFilters)}
        />

        <div className="max-h-[46vh] overflow-auto rounded-lg border xl:max-h-[calc(100vh-390px)]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="pl-3"><T i18nKey="assignments.group_browser_filters.group_code" /></TableHead>
                <TableHead><T i18nKey="common.circuit" /></TableHead>
                <TableHead><T i18nKey="assignments.group_browser.start" /></TableHead>
                <TableHead><T i18nKey="assignments.group_browser.end" /></TableHead>
                <TableHead><T i18nKey="common.guide" /></TableHead>
                <TableHead className="pr-3"><T i18nKey="common.status" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleGroups.map((group) => {
                const guide = getGuide(guides, group.guideId)
                const isSelected = selectedGroupId === group.id

                return (
                  <TableRow
                    key={group.id}
                    className={cn(
                      "cursor-pointer focus-within:bg-primary/5",
                      group.guideId === null && "bg-red-50/60 hover:bg-red-50",
                      group.confirmationStatus === "pending-confirmation" &&
                        "bg-amber-50/60 hover:bg-amber-50",
                      isSelected &&
                        "bg-primary/10 shadow-[inset_3px_0_0_hsl(var(--primary))] ring-1 ring-inset ring-primary/25"
                    )}
                    data-state={isSelected ? "selected" : undefined}
                    aria-selected={isSelected}
                    onClick={() => onSelectGroup(group.id)}
                  >
                    <TableCell className="pl-3 font-medium">
                      <div className="flex min-w-24 flex-col gap-0.5">
                        <span>{group.code}</span>
                        {!guide ? (
                          <span className="text-[10px] font-medium text-red-700">
                            <T i18nKey="assignments.group_browser.needs_a_guide" />
                          </span>
                        ) : group.confirmationStatus ===
                          "pending-confirmation" ? (
                          <span className="text-[10px] font-medium text-amber-800">
                            <T i18nKey="assignments.group_browser.confirmation_pending" />
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getCircuit(circuits, group.circuitId)?.name ??
                        "Unknown"}
                    </TableCell>
                    <TableCell>{formatDateDisplay(group.startDateIso)}</TableCell>
                    <TableCell>{formatDateDisplay(group.endDateIso)}</TableCell>
                    <TableCell>
                      <span className={cn(!guide && "font-medium text-red-700")}>
                        {guide?.name ?? t("planning.timeline.no_guide")}
                      </span>
                    </TableCell>
                    <TableCell className="pr-3">
                      <Badge
                        variant="outline"
                        className={getAssignmentClassName(group)}
                      >
                        {getAssignmentLabel(group, t)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
              {visibleGroups.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-28 text-center text-muted-foreground"
                  >
                    <T i18nKey="assignments.group_browser.no_groups_match_the_selected_filters" />
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
