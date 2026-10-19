"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import Link from "next/link"
import { ArrowUpRight, ListFilter } from "lucide-react"

import { Button } from "@/components/ui/button"
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge"
import {
  Card,
  CardAction,
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
import type {
  UpcomingGroup,
  UpcomingGroupConfirmation,
  UpcomingGroupStatus,
} from "@/lib/types/dashboard"
import { formatDateDisplay } from "@/lib/utils/date-format"

const statusTone: Record<UpcomingGroupStatus, StatusTone> = {
  "Needs guide": "destructive",
  Assigned: "info",
  Confirmed: "success",
}

const confirmationTone: Record<UpcomingGroupConfirmation, StatusTone> = {
  Open: "neutral",
  Pending: "warning",
  Confirmed: "success",
}

const statusLabelKey = {
  "Needs guide": "status.needs_guide",
  Assigned: "status.assigned",
  Confirmed: "status.confirmed",
} as const

const confirmationLabelKey = {
  Open: "status.open",
  Pending: "status.pending",
  Confirmed: "status.confirmed",
} as const

type UpcomingGroupsTableProps = {
  groups: UpcomingGroup[]
}

export function UpcomingGroupsTable({ groups }: UpcomingGroupsTableProps) {
  const { t } = useI18n()
  return (
    <Card>
      <CardHeader className="border-b">
        <div>
          <CardTitle><T i18nKey="dashboard.upcoming_groups_table.upcoming_groups" /></CardTitle>
          <CardDescription>
            <T i18nKey="dashboard.upcoming_groups_table.nearest_operational_groups_with_assignment_work_kept_visible" />
          </CardDescription>
        </div>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link href="/groups">
              <ListFilter className="size-4" />
              <T i18nKey="dashboard.upcoming_groups_table.view_groups" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4"><T i18nKey="dashboard.upcoming_groups_table.group_code" /></TableHead>
              <TableHead><T i18nKey="common.circuit" /></TableHead>
              <TableHead><T i18nKey="common.start_date" /></TableHead>
              <TableHead><T i18nKey="common.end_date" /></TableHead>
              <TableHead><T i18nKey="common.guide" /></TableHead>
              <TableHead><T i18nKey="common.status" /></TableHead>
              <TableHead><T i18nKey="dashboard.upcoming_groups_table.confirmation" /></TableHead>
              <TableHead className="pr-4 text-right"><T i18nKey="dashboard.upcoming_groups_table.action" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <TableRow key={group.code}>
                <TableCell className="pl-4 font-medium">
                  {group.code}
                </TableCell>
                <TableCell>{group.circuit}</TableCell>
                <TableCell>{formatDateDisplay(group.startDateIso)}</TableCell>
                <TableCell>{formatDateDisplay(group.endDateIso)}</TableCell>
                <TableCell
                  className={
                    group.guide === "Unassigned"
                      ? "text-muted-foreground"
                      : undefined
                  }
                >
                  {group.guide === "Unassigned" ? t("status.unassigned") : group.guide}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={statusTone[group.status]}>
                    {t(statusLabelKey[group.status])}
                  </StatusBadge>
                </TableCell>
                <TableCell className="pr-4">
                  <StatusBadge tone={confirmationTone[group.confirmation]}>
                    {t(confirmationLabelKey[group.confirmation])}
                  </StatusBadge>
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={group.status === "Needs guide" ? "/assignments" : "/groups"}>
                      {group.status === "Needs guide"
                        ? t("dashboard.metrics.assign_guide")
                        : t("dashboard.upcoming.view_group")}
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
