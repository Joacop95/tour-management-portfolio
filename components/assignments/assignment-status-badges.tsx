"use client"

import { useI18n } from "@/components/i18n/i18n-provider"
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import type { GuideStatus } from "@/lib/types/domain"
import type {
  CandidateAvailabilityResult,
  CandidateCircuitResult,
  CandidateConflictResult,
  CandidateLanguageResult,
} from "@/lib/utils/assignment-candidates"

export type {
  CandidateAvailabilityResult,
  CandidateCircuitResult,
  CandidateConflictResult,
  CandidateLanguageResult,
} from "@/lib/utils/assignment-candidates"

const guideStatusConfig: Record<GuideStatus, { labelKey: UiTranslationKey; tone: StatusTone }> =
  {
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

const availabilityConfig: Record<
  CandidateAvailabilityResult,
  { labelKey: UiTranslationKey; tone: StatusTone }
> = {
  available: {
    labelKey: "availability.status.available",
    tone: "success",
  },
  "needs-review": {
    labelKey: "status.needs_review",
    tone: "warning",
  },
  "not-available": {
    labelKey: "availability.status.not_available",
    tone: "destructive",
  },
  occupied: {
    labelKey: "availability.status.occupied",
    tone: "info",
  },
}

const conflictConfig: Record<
  CandidateConflictResult,
  { labelKey: UiTranslationKey; tone: StatusTone }
> = {
  clear: {
    labelKey: "status.no_conflict",
    tone: "success",
  },
  conflict: {
    labelKey: "status.conflict",
    tone: "destructive",
  },
}

const circuitConfig: Record<
  CandidateCircuitResult,
  { labelKey: UiTranslationKey; tone: StatusTone }
> = {
  match: {
    labelKey: "assignments.status.circuit_match",
    tone: "success",
  },
  "not-listed": {
    labelKey: "assignments.status.circuit_not_listed",
    tone: "warning",
  },
}

const languageConfig: Record<
  CandidateLanguageResult,
  { labelKey: UiTranslationKey; tone: StatusTone }
> = {
  match: {
    labelKey: "assignments.status.language_match",
    tone: "success",
  },
  "not-listed": {
    labelKey: "assignments.status.language_not_listed",
    tone: "destructive",
  },
  "not-required": {
    labelKey: "assignments.status.no_language_requirement",
    tone: "neutral",
  },
  unknown: {
    labelKey: "assignments.status.languages_not_configured",
    tone: "warning",
  },
}

function CompactStatusBadge({ config }: { config: { labelKey: UiTranslationKey; tone: StatusTone } }) {
  const { t } = useI18n()
  return (
    <StatusBadge tone={config.tone} className="px-1.5 py-0 text-[11px]">
      {t(config.labelKey)}
    </StatusBadge>
  )
}

export function CandidateGuideStatusBadge({ status }: { status: GuideStatus }) {
  return <CompactStatusBadge config={guideStatusConfig[status]} />
}

export function CandidateAvailabilityBadge({
  result,
}: {
  result: CandidateAvailabilityResult
}) {
  return <CompactStatusBadge config={availabilityConfig[result]} />
}

export function CandidateConflictBadge({
  result,
}: {
  result: CandidateConflictResult
}) {
  return <CompactStatusBadge config={conflictConfig[result]} />
}

export function CandidateCircuitBadge({
  result,
}: {
  result: CandidateCircuitResult
}) {
  return <CompactStatusBadge config={circuitConfig[result]} />
}

export function CandidateLanguageBadge({
  result,
}: {
  result: CandidateLanguageResult
}) {
  return <CompactStatusBadge config={languageConfig[result]} />
}
