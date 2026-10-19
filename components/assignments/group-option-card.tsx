"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { Badge } from "@/components/ui/badge"
import type { Circuit, Guide, TourGroup } from "@/lib/types/domain"
import { cn } from "@/lib/utils"
import { formatDateDisplay } from "@/lib/utils/date-format"

type GroupOptionCardProps = {
  group: TourGroup
  circuit: Circuit | undefined
  guide: Guide | undefined
  isSelected: boolean
  onSelect: () => void
}

function getConfirmationLabel(group: TourGroup, t: ReturnType<typeof useI18n>["t"]) {
  if (!group.guideId) {
    return t("status.no_guide")
  }

  if (group.confirmationStatus === "pending-confirmation") {
    return t("status.pending_confirmation")
  }

  if (group.confirmationStatus === "confirmed") {
    return t("status.confirmed")
  }

  return t("status.assigned")
}

function getConfirmationClassName(group: TourGroup) {
  if (!group.guideId) {
    return "border-red-200 bg-red-50 text-red-700"
  }

  if (group.confirmationStatus === "pending-confirmation") {
    return "border-amber-200 bg-amber-50 text-amber-800"
  }

  if (group.confirmationStatus === "confirmed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700"
  }

  return "border-blue-200 bg-blue-50 text-blue-700"
}

export function GroupOptionCard({
  group,
  circuit,
  guide,
  isSelected,
  onSelect,
}: GroupOptionCardProps) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-2 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/60",
        group.guideId === null && "border-red-200 bg-red-50/40",
        group.confirmationStatus === "pending-confirmation" &&
          "border-amber-200 bg-amber-50/40",
        isSelected && "border-primary bg-muted ring-1 ring-primary/20"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{group.code}</span>
        <Badge variant="outline" className={getConfirmationClassName(group)}>
          {getConfirmationLabel(group, t)}
        </Badge>
      </div>

      <div className="text-sm text-muted-foreground">
        {circuit?.name ?? t("planning.timeline.unknown_circuit")}
      </div>

      <div className="grid gap-1 text-xs text-muted-foreground">
        <span>
          {formatDateDisplay(group.startDateIso)} -{" "}
          {formatDateDisplay(group.endDateIso)}
        </span>
        <span><T i18nKey="assignments.group_option_card.guide" /> {guide?.name ?? t("planning.timeline.no_guide")}</span>
      </div>
    </button>
  )
}
