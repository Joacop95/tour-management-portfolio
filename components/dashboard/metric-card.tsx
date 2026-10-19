import Link from "next/link"
import { ArrowRight } from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { DashboardMetric } from "@/lib/types/dashboard"

type MetricCardProps = {
  metric: DashboardMetric
}

export function MetricCard({ metric }: MetricCardProps) {
  const Icon = metric.icon

  return (
    <Card className="border-amber-200/80 bg-amber-50/25">
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">
          {metric.label}
        </CardTitle>
        <CardAction>
          <div
            className={`flex size-9 items-center justify-center rounded-lg ring-1 ${metric.tone}`}
          >
            <Icon className="size-4" />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums">{metric.value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{metric.detail}</p>
        {metric.actionHref && metric.actionLabel ? (
          <Link
            href={metric.actionHref}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {metric.actionLabel}
            <ArrowRight className="size-3.5" />
          </Link>
        ) : null}
      </CardContent>
    </Card>
  )
}
