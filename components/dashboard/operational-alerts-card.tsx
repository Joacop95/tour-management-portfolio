import { T } from "@/components/i18n/i18n-provider"
import Link from "next/link"
import { AlertTriangle, ArrowRight, UserRoundCheck } from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type OperationalAlertsCardProps = {
  groupsWithoutGuide: number
  groupsPendingConfirmation: number
}

export function OperationalAlertsCard({
  groupsWithoutGuide,
  groupsPendingConfirmation,
}: OperationalAlertsCardProps) {
  const totalAlerts = groupsWithoutGuide + groupsPendingConfirmation

  return (
    <Card className="border-amber-200/80 bg-amber-50/25">
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">
          <T i18nKey="dashboard.operational_alerts_card.needs_attention" />
        </CardTitle>
        <CardAction>
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-50 text-amber-800 ring-1 ring-amber-200">
            <AlertTriangle className="size-4" />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums">{totalAlerts}</p>
        <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <Link
            href="/assignments"
            className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-revival-primary/8 hover:text-foreground"
          >
            <span>{groupsWithoutGuide} <T i18nKey="dashboard.operational_alerts_card.without_guide" /></span>
            <ArrowRight className="size-3.5" />
          </Link>
          <Link
            href="/groups"
            className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-revival-primary/8 hover:text-foreground"
          >
            <span>{groupsPendingConfirmation} <T i18nKey="dashboard.operational_alerts_card.pending_confirmation" /></span>
            <UserRoundCheck className="size-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
