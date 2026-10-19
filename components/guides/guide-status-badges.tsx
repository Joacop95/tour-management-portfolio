"use client"

import { useI18n } from "@/components/i18n/i18n-provider"
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import type { GuideStatus } from "@/lib/types/domain"

const guideStatusConfig: Record<
  GuideStatus,
  { labelKey: UiTranslationKey; tone: StatusTone }
> = {
  "pending-invitation": {
    labelKey: "status.pending_invitation",
    tone: "warning",
  },
  invited: {
    labelKey: "status.invited",
    tone: "info",
  },
  active: {
    labelKey: "status.active",
    tone: "success",
  },
  inactive: {
    labelKey: "status.inactive",
    tone: "neutral",
  },
  blocked: {
    labelKey: "status.blocked",
    tone: "destructive",
  },
}

export function GuideStatusBadge({ status }: { status: GuideStatus }) {
  const { t } = useI18n()
  const config = guideStatusConfig[status]

  return (
    <StatusBadge tone={config.tone}>
      {t(config.labelKey)}
    </StatusBadge>
  )
}
