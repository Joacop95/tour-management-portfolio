"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import { useState } from "react"
import { CalendarDays, Plus } from "lucide-react"

import { GuideChangeRequestDialog } from "@/components/guide-portal/guide-change-request-dialog"
import {
  type GuidePortalChangeRequest,
  useGuidePortalData,
} from "@/components/guide-portal/guide-portal-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge"
import { StatePanel } from "@/components/ui/state-panel"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDateDisplay } from "@/lib/utils/date-format"

const mockChangeRequests = [
  {
    id: "cr-camille-1",
    guideId: "camille-laurent",
    groupCode: "BT-FR-2210",
    requestType: "Date review",
    status: "Pending",
    requestedAtIso: "2026-06-02",
    notes: "Please review return travel timing.",
  },
  {
    id: "cr-luc-1",
    guideId: "luc-moreau",
    groupCode: "BT-FR-1405",
    requestType: "Change guide",
    status: "Completed",
    requestedAtIso: "2026-05-29",
    notes: "Resolved by operations.",
  },
  {
    id: "cr-daniel-1",
    guideId: "daniel-ortega",
    groupCode: "BT-ES-1182",
    requestType: "Availability conflict",
    status: "Rejected",
    requestedAtIso: "2026-05-28",
    notes: "No conflict found after review.",
  },
]

const requestTypeLabels: Record<GuidePortalChangeRequest["requestType"], UiTranslationKey> = {
  group_change: "guide_portal.requests.type.group_change",
  availability_change: "change_requests.type.availability_change",
  profile_change: "change_requests.type.profile_change",
  other: "change_requests.type.other",
}

const requestStatusLabels: Record<GuidePortalChangeRequest["status"], UiTranslationKey> = {
  pending: "status.pending",
  in_progress: "change_requests.status.in_progress",
  approved: "change_requests.status.approved",
  rejected: "change_requests.status.rejected",
  completed: "change_requests.status.completed",
  cancelled: "change_requests.status.cancelled",
}

const requestStatusTones: Record<GuidePortalChangeRequest["status"], StatusTone> = {
  pending: "warning",
  in_progress: "info",
  approved: "success",
  rejected: "destructive",
  completed: "neutral",
  cancelled: "neutral",
}

export function GuideChangeRequestsPage() {
  const { t } = useI18n()
  const {
    changeRequests,
    groups,
    guidePortalAuthStatus,
    guidePortalSource,
    refreshGuidePortalData,
    selectedGuide,
  } = useGuidePortalData()
  const [dialogOpen, setDialogOpen] = useState(false)
  const isAuthMode = guidePortalSource === "auth"
  const canCreateRequest = isAuthMode && guidePortalAuthStatus === "ready"
  const previewRequests =
    selectedGuide && !isAuthMode
      ? mockChangeRequests.filter((request) => request.guideId === selectedGuide.id)
      : []
  const requestCount = isAuthMode ? changeRequests.length : previewRequests.length

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle><T i18nKey="guide_portal.navigation.change_requests" /></CardTitle>
            <CardDescription>
              {isAuthMode
                ? t("guide_portal.requests.auth_description")
                : t("guide_portal.requests.preview_description")}
            </CardDescription>
          </div>
          <Button
            type="button"
            disabled={!canCreateRequest}
            title={
              canCreateRequest
                ? t("guide_portal.requests.create_title")
                : isAuthMode
                ? t("guide_portal.requests.sign_in_title")
                : t("guide_portal.requests.preview_read_only")
            }
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-4" />
            <T i18nKey="guide_portal.guide_change_request_dialog.new_change_request" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {requestCount === 0 ? (
          <StatePanel
            title={t("guide_portal.guide_change_requests.title_no_change_requests_yet")}
            description={isAuthMode
              ? t("guide_portal.requests.empty_auth")
              : t("guide_portal.requests.empty_preview")}
          />
        ) : null}
        {isAuthMode
          ? changeRequests.map((request) => (
              <article key={request.id} className="rounded-lg border p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">
                      {t(requestTypeLabels[request.requestType])}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {request.groupCode
                        ? `${request.groupCode}${request.circuitName ? ` · ${request.circuitName}` : ""}`
                        : t("guide_portal.requests.no_group")}
                    </p>
                  </div>
                  <StatusBadge tone={requestStatusTones[request.status]}>
                    {t(requestStatusLabels[request.status])}
                  </StatusBadge>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="size-4" />
                  <T i18nKey="status.submitted" /> {formatDateDisplay(request.requestedAtIso)}
                  {request.completedAt
                    ? ` · ${t("guide_portal.requests.completed_at", { date: formatDateDisplay(request.completedAt) })}`
                    : request.reviewedAt
                      ? ` · ${t("guide_portal.requests.reviewed_at", { date: formatDateDisplay(request.reviewedAt) })}`
                      : request.cancelledAt
                        ? ` · ${t("guide_portal.requests.cancelled_at", { date: formatDateDisplay(request.cancelledAt) })}`
                        : ""}
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                  {request.notes || t("guide_portal.requests.no_message")}
                </p>
                {request.decisionReason ? (
                  <div className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">
                    <div className="text-xs font-medium text-muted-foreground">
                      <T i18nKey="guide_portal.guide_change_requests.operations_response" />
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words">
                      {request.decisionReason}
                    </p>
                  </div>
                ) : null}
              </article>
            ))
          : previewRequests.map((request) => (
              <article key={request.id} className="rounded-lg border p-4 opacity-80">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{request.requestType}</h3>
                    <p className="text-sm text-muted-foreground">{request.groupCode}</p>
                  </div>
                  <Badge variant="outline">{request.status}</Badge>
                </div>
                <p className="mt-3 text-sm">{request.notes}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  <T i18nKey="status.submitted" /> {formatDateDisplay(request.requestedAtIso)}
                </p>
              </article>
            ))}
      </CardContent>
      {dialogOpen ? (
        <GuideChangeRequestDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          groups={groups}
          guidePortalSource={guidePortalSource}
          guidePortalAuthStatus={guidePortalAuthStatus}
          onCreated={refreshGuidePortalData}
        />
      ) : null}
    </Card>
  )
}
