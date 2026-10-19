"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import Link from "next/link"
import { ArrowRight, CalendarDays, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { StatePanel } from "@/components/ui/state-panel"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { UpcomingGroup } from "@/lib/types/dashboard"
import { formatDateDisplay } from "@/lib/utils/date-format"

export function UnassignedGroupsCard({
  groups,
}: {
  groups: UpcomingGroup[]
}) {
  const { t } = useI18n()
  return (
    <Card>
      <CardHeader className="border-b">
        <div>
          <CardTitle><T i18nKey="dashboard.unassigned_groups_card.upcoming_groups_without_guide" /></CardTitle>
          <CardDescription>
            <T i18nKey="dashboard.unassigned_groups_card.prioritize_the_nearest_tours_that_still_need_assignment" />
          </CardDescription>
        </div>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link href="/groups">
              <T i18nKey="dashboard.unassigned_groups_card.view_all" />
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {groups.length > 0 ? (
          <div className="divide-y divide-border/75">
            {groups.map((group) => (
              <div
                key={group.code}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{group.code}</span>
                    <StatusBadge tone="destructive"><T i18nKey="dashboard.unassigned_groups_card.needs_guide" /></StatusBadge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {group.circuit}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <CalendarDays className="size-3.5 text-muted-foreground" />
                    <T i18nKey="dashboard.unassigned_groups_card.starts" /> {formatDateDisplay(group.startDateIso)}
                  </p>
                </div>
                <Button asChild size="sm" className="shrink-0 self-start sm:self-auto">
                  <Link href="/assignments">
                    <UserPlus className="size-3.5" />
                    <T i18nKey="dashboard.unassigned_groups_card.assign_guide" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <StatePanel
            compact
            className="m-4"
            title={t("dashboard.upcoming_all_assigned")}
            description={t("dashboard.no_assignment_required")}
          />
        )}
      </CardContent>
    </Card>
  )
}
