"use client"

import { useI18n } from "@/components/i18n/i18n-provider"
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import type {
  AssignmentStatus,
  ConfirmationStatus,
  GroupStatus,
} from "@/lib/types/domain"

const groupStatusConfig: Record<
  GroupStatus,
  { labelKey: UiTranslationKey; tone: StatusTone }
> = {
  active: {
    labelKey: "status.active",
    tone: "success",
  },
  cxl: {
    labelKey: "status.cxl",
    tone: "destructive",
  },
  fusionado: {
    labelKey: "status.fusionado",
    tone: "warning",
  },
  finalized: {
    labelKey: "status.finalized",
    tone: "info",
  },
}

const assignmentStatusConfig: Record<
  AssignmentStatus,
  { labelKey: UiTranslationKey; tone: StatusTone }
> = {
  "without-guide": {
    labelKey: "status.without_guide",
    tone: "destructive",
  },
  assigned: {
    labelKey: "status.assigned",
    tone: "info",
  },
}

const confirmationStatusConfig: Record<
  ConfirmationStatus,
  { labelKey: UiTranslationKey; tone: StatusTone }
> = {
  "not-required": {
    labelKey: "status.not_required",
    tone: "neutral",
  },
  "pending-confirmation": {
    labelKey: "status.pending_confirmation",
    tone: "warning",
  },
  confirmed: {
    labelKey: "status.confirmed",
    tone: "success",
  },
}

export function GroupStatusBadge({ status }: { status: GroupStatus }) {
  const { t } = useI18n()
  const config = groupStatusConfig[status]

  return (
    <StatusBadge tone={config.tone}>
      {t(config.labelKey)}
    </StatusBadge>
  )
}

export function AssignmentStatusBadge({
  status,
}: {
  status: AssignmentStatus
}) {
  const { t } = useI18n()
  const config = assignmentStatusConfig[status]

  return (
    <StatusBadge tone={config.tone}>
      {t(config.labelKey)}
    </StatusBadge>
  )
}

export function ConfirmationStatusBadge({
  status,
}: {
  status: ConfirmationStatus
}) {
  const { t } = useI18n()
  const config = confirmationStatusConfig[status]

  return (
    <StatusBadge tone={config.tone}>
      {t(config.labelKey)}
    </StatusBadge>
  )
}
