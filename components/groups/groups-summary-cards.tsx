"use client"

import { useI18n } from "@/components/i18n/i18n-provider"
import { AlertTriangle, CheckCircle2, GitMerge, Users } from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { TourGroup } from "@/lib/types/domain"

export type GroupsSummaryAction =
  | "active"
  | "without-guide"
  | "pending-confirmation"
  | "cancelled-merged"

type GroupsSummaryCardsProps = {
  groups: TourGroup[]
  onSelect: (action: GroupsSummaryAction) => void
}

export function GroupsSummaryCards({
  groups,
  onSelect,
}: GroupsSummaryCardsProps) {
  const { t } = useI18n()
  const summaries = [
    {
      label: t("groups.summary.total_active"),
      value: groups.filter((group) => group.groupStatus === "active").length,
      icon: Users,
      tone: "text-emerald-700 bg-emerald-50 ring-emerald-200",
      action: "active" as const,
      actionLabel: t("groups.summary.show_active"),
    },
    {
      label: t("groups.summary.without_guide"),
      value: groups.filter(
        (group) =>
          group.groupStatus === "active" &&
          group.assignmentStatus === "without-guide"
      ).length,
      icon: AlertTriangle,
      tone: "text-red-700 bg-red-50 ring-red-200",
      action: "without-guide" as const,
      actionLabel: t("groups.summary.filter_without_guide"),
    },
    {
      label: t("groups.summary.without_confirmed_guide"),
      value: groups.filter(
        (group) =>
          group.groupStatus === "active" &&
          group.assignmentStatus === "assigned" &&
          group.confirmationStatus === "pending-confirmation"
      ).length,
      icon: CheckCircle2,
      tone: "text-amber-800 bg-amber-50 ring-amber-200",
      action: "pending-confirmation" as const,
      actionLabel: t("groups.summary.filter_pending_confirmation"),
    },
    {
      label: t("groups.summary.cancelled_merged"),
      value: groups.filter((group) =>
        ["cxl", "fusionado"].includes(group.groupStatus)
      ).length,
      icon: GitMerge,
      tone: "text-blue-700 bg-blue-50 ring-blue-200",
      action: "cancelled-merged" as const,
      actionLabel: t("groups.summary.show_cancelled_merged"),
    },
  ]

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {summaries.map((summary) => {
        const Icon = summary.icon

        return (
          <Card
            key={summary.label}
            className="transition-shadow hover:shadow-md"
          >
            <button
              type="button"
              className="w-full text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              onClick={() => onSelect(summary.action)}
            >
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  {summary.label}
                </CardTitle>
                <CardAction>
                  <div
                    className={`flex size-9 items-center justify-center rounded-lg ring-1 ${summary.tone}`}
                  >
                    <Icon className="size-4" />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{summary.value}</p>
                <span className="mt-2 inline-flex text-sm font-medium text-primary">
                  {summary.actionLabel}
                </span>
              </CardContent>
            </button>
          </Card>
        )
      })}
    </section>
  )
}
