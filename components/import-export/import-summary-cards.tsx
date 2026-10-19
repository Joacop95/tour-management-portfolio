import { AlertTriangle, CheckCircle2, FilePenLine, GitMerge } from "lucide-react"

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ImportSummaryMetric } from "@/lib/types/import-export"

type ImportSummaryCardsProps = {
  metrics: ImportSummaryMetric[]
}

const metricConfig = {
  emerald: {
    icon: CheckCircle2,
    className: "text-emerald-700 bg-emerald-50 ring-emerald-200",
  },
  blue: {
    icon: FilePenLine,
    className: "text-blue-700 bg-blue-50 ring-blue-200",
  },
  red: {
    icon: AlertTriangle,
    className: "text-red-700 bg-red-50 ring-red-200",
  },
  amber: {
    icon: GitMerge,
    className: "text-amber-800 bg-amber-50 ring-amber-200",
  },
} as const

export function ImportSummaryCards({ metrics }: ImportSummaryCardsProps) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {metrics.map((metric) => {
        const config = metricConfig[metric.tone]
        const Icon = config.icon

        return (
          <Card key={metric.label} size="sm">
            <CardHeader className="gap-1 pb-1">
              <CardTitle className="text-xs text-muted-foreground">
                {metric.label}
              </CardTitle>
              <CardAction>
                <div
                  className={`flex size-8 items-center justify-center rounded-lg ring-1 ${config.className}`}
                >
                  <Icon className="size-4" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xl font-semibold">{metric.value}</p>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}
