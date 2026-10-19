"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { GuidePortalIdentityStatus } from "@/lib/auth/guide-portal-auth"
import {
  createGuidePortalChangeRequest,
  type GuidePortalChangeRequestType,
} from "@/lib/supabase/mutations/guide-portal-change-requests"
import type { TourGroup } from "@/lib/types/domain"

type GuideChangeRequestDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: TourGroup[]
  guidePortalSource: "preview" | "auth"
  guidePortalAuthStatus: GuidePortalIdentityStatus
  defaultRequestType?: GuidePortalChangeRequestType
  defaultGroupId?: string | null
  defaultAvailabilityId?: string | null
  allowedAvailabilityIds?: string[]
  onCreated?: () => void
}

const noGroupValue = "__no_group__"

const requestTypeLabels: Record<GuidePortalChangeRequestType, UiTranslationKey> = {
  group_change: "guide_portal.requests.type.group_change",
  availability_change: "change_requests.type.availability_change",
  profile_change: "change_requests.type.profile_change",
  other: "change_requests.type.other",
}

export function GuideChangeRequestDialog({
  open,
  onOpenChange,
  groups,
  guidePortalSource,
  guidePortalAuthStatus,
  defaultRequestType = "other",
  defaultGroupId = null,
  defaultAvailabilityId = null,
  allowedAvailabilityIds = [],
  onCreated,
}: GuideChangeRequestDialogProps) {
  const { t } = useI18n()
  const [requestType, setRequestType] =
    useState<GuidePortalChangeRequestType>(defaultRequestType)
  const [groupId, setGroupId] = useState(defaultGroupId ?? "")
  const [message, setMessage] = useState("")
  const [feedback, setFeedback] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const canCreate =
    guidePortalSource === "auth" && guidePortalAuthStatus === "ready"
  const allowedGroupIds = useMemo(
    () => groups.map((group) => group.id),
    [groups]
  )

  async function handleSubmit() {
    setFeedback("")
    setErrorMessage("")

    if (!canCreate) {
      setErrorMessage(
        guidePortalSource === "auth"
          ? t("guide_portal.request.sign_in_required")
          : t("guide_portal.request.preview_read_only")
      )
      return
    }

    if (!message.trim()) {
      setErrorMessage(t("guide_portal.request.message_required"))
      return
    }

    const relatedGroupId = groupId || null

    if (relatedGroupId && !allowedGroupIds.includes(relatedGroupId)) {
      setErrorMessage(
        t("guide_portal.request.invalid_group")
      )
      return
    }

    setIsSubmitting(true)

    const result = await createGuidePortalChangeRequest({
      requestType,
      message,
      groupId: relatedGroupId,
      allowedGroupIds,
      availabilityId: defaultAvailabilityId,
      allowedAvailabilityIds,
    })

    setIsSubmitting(false)

    if (!result.success) {
      setErrorMessage(
        result.error ?? t("guide_portal.request.create_failed")
      )
      return
    }

    setMessage("")
    setFeedback(t("guide_portal.request.submitted"))
    onCreated?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle><T i18nKey="guide_portal.guide_change_request_dialog.new_change_request" /></DialogTitle>
          <DialogDescription>
            <T i18nKey="guide_portal.guide_change_request_dialog.this_sends_a_pending_request_to_the_operations" />
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="guide-request-type"><T i18nKey="guide_portal.guide_change_request_dialog.request_type" /></Label>
            <p className="text-xs text-muted-foreground">
              <T i18nKey="guide_portal.guide_change_request_dialog.choose_the_closest_reason_so_operations_can_route" />
            </p>
            <Select
              value={requestType}
              disabled={!canCreate || isSubmitting}
              onValueChange={(value) =>
                setRequestType(value as GuidePortalChangeRequestType)
              }
            >
              <SelectTrigger id="guide-request-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="group_change">
                  {t(requestTypeLabels.group_change)}
                </SelectItem>
                <SelectItem value="availability_change">
                  {t(requestTypeLabels.availability_change)}
                </SelectItem>
                <SelectItem value="profile_change">
                  {t(requestTypeLabels.profile_change)}
                </SelectItem>
                <SelectItem value="other">{t(requestTypeLabels.other)}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="guide-request-group"><T i18nKey="guide_portal.guide_change_request_dialog.related_group" /></Label>
            <p className="text-xs text-muted-foreground">
              <T i18nKey="guide_portal.guide_change_request_dialog.optional_only_groups_currently_assigned_to_you_can" />
            </p>
            <Select
              value={groupId || noGroupValue}
              disabled={!canCreate || isSubmitting}
              onValueChange={(value) =>
                setGroupId(value === noGroupValue ? "" : value)
              }
            >
              <SelectTrigger id="guide-request-group" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={noGroupValue}><T i18nKey="guide_portal.guide_change_request_dialog.no_group_linked" /></SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="guide-request-message">
              <T i18nKey="guide_portal.guide_change_request_dialog.what_should_operations_review" />
            </Label>
            <Textarea
              id="guide-request-message"
              value={message}
              disabled={!canCreate || isSubmitting}
              placeholder={t("guide_portal.guide_change_request_dialog.placeholder_describe_the_issue_requested_change_or_context_operations")}
              className="min-h-28"
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>

          {!canCreate ? (
            <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              {guidePortalSource === "auth"
                ? t("guide_portal.request.sign_in_hint")
                : t("guide_portal.request.preview_hint")}
            </div>
          ) : null}

          {feedback ? (
            <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {feedback}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={!canCreate || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? t("guide_portal.request.submitting") : t("guide_portal.request.submit")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            <T i18nKey="common.close" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
