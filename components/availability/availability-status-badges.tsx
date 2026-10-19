"use client"

import { useI18n } from "@/components/i18n/i18n-provider"
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import type { AvailabilityStatus } from "@/lib/types/domain"

const availabilityStatusConfig: Record<
  AvailabilityStatus,
  { labelKey: UiTranslationKey; tone: StatusTone }
> = {
  available: {
    labelKey: "availability.status.available",
    tone: "success",
  },
  "not-available": {
    labelKey: "availability.status.not_available",
    tone: "destructive",
  },
  "occupied-by-assignment": {
    labelKey: "availability.status.occupied_by_assignment",
    tone: "info",
  },
  "pending-review": {
    labelKey: "status.pending_review",
    tone: "warning",
  },
}

export function AvailabilityStatusBadge({
  status,
}: {
  status: AvailabilityStatus
}) {
  const { t } = useI18n()
  const config = availabilityStatusConfig[status]

  return (
    <StatusBadge tone={config.tone}>
      {t(config.labelKey)}
    </StatusBadge>
  )
}
