import { T, useI18n } from "@/components/i18n/i18n-provider"
import { AlertTriangle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Circuit, Guide, TourGroup } from "@/lib/types/domain"
import { formatDateDisplay } from "@/lib/utils/date-format"
import { groupStatusOptions } from "@/lib/utils/group-status"

type SelectedGroupCardProps = {
  group: TourGroup
  circuit: Circuit | undefined
  guide: Guide | undefined
  actionsDisabled?: boolean
  isSaving?: boolean
  canAssignGuide?: boolean
  canChangeGuide?: boolean
  canConfirmGuide?: boolean
  canRemoveGuide?: boolean
  assignPermissionMessage?: string
  changePermissionMessage?: string
  confirmPermissionMessage?: string
  removePermissionMessage?: string
  onPrimaryAction?: () => void
  onConfirmGuide?: () => void
  onRemoveGuide?: () => void
}

const groupStatusConfig = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cxl: "border-red-200 bg-red-50 text-red-700",
  fusionado: "border-amber-200 bg-amber-50 text-amber-800",
  finalized: "border-blue-200 bg-blue-50 text-blue-700",
} as const

const confirmationStatusConfig = {
  "not-required": "border-border bg-background text-muted-foreground",
  "pending-confirmation": "border-amber-200 bg-amber-50 text-amber-800",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
} as const

export function SelectedGroupCard({
  group,
  circuit,
  guide,
  actionsDisabled = false,
  isSaving = false,
  canConfirmGuide = true,
  canRemoveGuide = true,
  confirmPermissionMessage,
  removePermissionMessage,
  onPrimaryAction,
  onConfirmGuide,
  onRemoveGuide,
}: SelectedGroupCardProps) {
  const { t } = useI18n()
  const confirmDenied = confirmPermissionMessage ?? t("planning.permission.confirm")
  const removeDenied = removePermissionMessage ?? t("assignments.selected.remove_denied")
  const groupStatus = t(groupStatusOptions.find((option) => option.value === group.groupStatus)?.labelKey ?? "status.active")
  const permissionMessages = [
    guide && !canConfirmGuide ? confirmDenied : null,
    guide && !canRemoveGuide ? removeDenied : null,
  ].filter(Boolean)
  const reviewMessages = [
    !guide ? t("assignments.selected.no_guide") : null,
    guide && group.confirmationStatus === "pending-confirmation"
      ? t("assignments.selected.pending_confirmation")
      : null,
    group.groupStatus !== "active"
      ? t("assignments.selected.inactive_warning", { status: groupStatus })
      : null,
    ...Array.from(new Set(permissionMessages)),
  ].filter(Boolean)

  return (
    <Card size="sm">
      <CardHeader className="border-b py-3">
        <CardTitle><T i18nKey="assignments.selected_group_card.selected_group" /></CardTitle>
        <CardAction className="max-w-72">
          <div className="flex flex-wrap justify-end gap-2">
            {guide && group.confirmationStatus !== "confirmed" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={actionsDisabled || isSaving || !canConfirmGuide}
                title={!canConfirmGuide ? confirmDenied : undefined}
                onClick={onConfirmGuide}
              >
                {isSaving ? t("planning.dialog.saving") : t("planning.dialog.confirm_guide")}
              </Button>
            ) : null}
            {guide ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={actionsDisabled || isSaving || !canRemoveGuide}
                title={!canRemoveGuide ? removeDenied : undefined}
                onClick={onRemoveGuide}
              >
                <T i18nKey="assignments.selected_group_card.remove_guide" />
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={actionsDisabled || isSaving}
              onClick={onPrimaryAction}
            >
              {isSaving
                ? t("planning.dialog.saving")
                : guide
                  ? t("assignments.selected.review_candidates")
                  : t("assignments.selected.choose_candidate")}
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2 pt-3">
        {reviewMessages.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
            <div className="mb-1 flex items-center gap-1.5 font-medium">
              <AlertTriangle className="size-3.5 shrink-0" />
              <T i18nKey="assignments.selected_group_card.needs_review" />
            </div>
            <div className="space-y-1 pl-5">
              {reviewMessages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-x-4 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground"><T i18nKey="assignments.group_browser_filters.group_code" /></p>
            <p className="font-medium">{group.code}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground"><T i18nKey="common.circuit" /></p>
            <p
              className="truncate font-medium"
              title={circuit?.name ?? t("common.unknown")}
            >
              {circuit?.name ?? t("common.unknown")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground"><T i18nKey="common.start_date" /></p>
            <p className="font-medium">
              {formatDateDisplay(group.startDateIso)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground"><T i18nKey="common.end_date" /></p>
            <p className="font-medium">{formatDateDisplay(group.endDateIso)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground"><T i18nKey="assignments.selected_group_card.current_guide" /></p>
            <p
              className="truncate font-medium"
              title={guide?.name ?? t("status.without_guide")}
            >
              {guide?.name ?? t("status.without_guide")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground"><T i18nKey="settings.language.label" /></p>
            <p className="font-medium">
              {group.requiredLanguage ?? group.language ?? t("assignments.selected.any_language")}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground"><T i18nKey="assignments.group_browser_filters.group_status" /></p>
            <Badge
              variant="outline"
              className={groupStatusConfig[group.groupStatus]}
            >
              {groupStatus}
            </Badge>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground"><T i18nKey="assignments.selected_group_card.confirmation" /></p>
            <Badge
              variant="outline"
              className={confirmationStatusConfig[group.confirmationStatus]}
            >
              {t(group.confirmationStatus === "not-required" ? "status.not_required" : group.confirmationStatus === "confirmed" ? "status.confirmed" : "status.pending_confirmation")}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
