"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { Circuit, TourGroup } from "@/lib/types/domain"
import { cn } from "@/lib/utils"
import { formatDateDisplay } from "@/lib/utils/date-format"

type GroupSelectorProps = {
  groups: TourGroup[]
  circuits: Circuit[]
  search: string
  selectedGroupId: string | null
  onSearchChange: (search: string) => void
  onSelectGroup: (groupId: string) => void
}

function getCircuitName(circuits: Circuit[], circuitId: string, t: ReturnType<typeof useI18n>["t"]) {
  return circuits.find((circuit) => circuit.id === circuitId)?.name ?? t("common.unknown")
}

export function GroupSelector({
  groups,
  circuits,
  search,
  selectedGroupId,
  onSearchChange,
  onSelectGroup,
}: GroupSelectorProps) {
  const { t } = useI18n()
  const searchTerm = search.trim().toLowerCase()
  const filteredGroups = groups
    .filter((group) =>
      searchTerm ? group.code.toLowerCase().includes(searchTerm) : true
    )
    .sort((firstGroup, secondGroup) => {
      if (firstGroup.guideId === null && secondGroup.guideId !== null) {
        return -1
      }

      if (firstGroup.guideId !== null && secondGroup.guideId === null) {
        return 1
      }

      return firstGroup.startDateIso.localeCompare(secondGroup.startDateIso)
    })

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle><T i18nKey="assignments.group_selector.search_group" /></CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={t("assignments.group_browser_filters.placeholder_search_by_group_code")}
            className="pl-8"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {filteredGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectGroup(group.id)}
              className={cn(
                "flex w-full flex-col gap-1 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/60",
                selectedGroupId === group.id && "border-primary bg-muted"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{group.code}</span>
                {group.guideId === null ? (
                  <Badge
                    variant="outline"
                    className="border-red-200 bg-red-50 text-red-700"
                  >
                    <T i18nKey="status.without_guide" />
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50 text-blue-700"
                  >
                    <T i18nKey="assignments.group_selector.assigned" />
                  </Badge>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {getCircuitName(circuits, group.circuitId, t)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDateDisplay(group.startDateIso)} -{" "}
                {formatDateDisplay(group.endDateIso)}
              </span>
            </button>
          ))}
          {filteredGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              <T i18nKey="assignments.group_selector.no_groups_match_this_search" />
            </div>
          ) : null}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => onSearchChange("")}
        >
          <T i18nKey="assignments.group_selector.clear_search" />
        </Button>
      </CardContent>
    </Card>
  )
}
