"use client"

import { useI18n } from "@/components/i18n/i18n-provider"
import { MailCheck, ShieldX, UserCheck, Users } from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Guide } from "@/lib/types/domain"

type GuidesSummaryCardsProps = {
  guides: Guide[]
}

export function GuidesSummaryCards({ guides }: GuidesSummaryCardsProps) {
  const { t } = useI18n()
  const summaries = [
    {
      label: t("guides.summary.total"),
      value: guides.length,
      icon: Users,
      tone: "text-blue-700 bg-blue-50 ring-blue-200",
    },
    {
      label: t("guides.summary.active"),
      value: guides.filter((guide) => guide.status === "active").length,
      icon: UserCheck,
      tone: "text-emerald-700 bg-emerald-50 ring-emerald-200",
    },
    {
      label: t("status.pending_invitation"),
      value: guides.filter((guide) =>
        ["pending-invitation", "invited"].includes(guide.status)
      ).length,
      icon: MailCheck,
      tone: "text-amber-800 bg-amber-50 ring-amber-200",
    },
    {
      label: t("guides.summary.inactive_blocked"),
      value: guides.filter((guide) =>
        ["inactive", "blocked"].includes(guide.status)
      ).length,
      icon: ShieldX,
      tone: "text-red-700 bg-red-50 ring-red-200",
    },
  ]

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {summaries.map((summary) => {
        const Icon = summary.icon

        return (
          <Card key={summary.label}>
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
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}
