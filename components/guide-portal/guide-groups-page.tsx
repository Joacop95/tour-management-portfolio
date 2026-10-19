"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { useState } from "react"
import { CalendarDays, MapPinned, Repeat, Users } from "lucide-react"

import { GuideChangeRequestDialog } from "@/components/guide-portal/guide-change-request-dialog"
import { GuideAssignmentActions } from "@/components/guide-portal/guide-assignment-actions"
import { useGuidePortalData } from "@/components/guide-portal/guide-portal-data"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDateDisplay } from "@/lib/utils/date-format"

export function GuideGroupsPage() {
  const { t } = useI18n()
  const {
    circuits,
    dataSource,
    groups,
    guidePortalAuthStatus,
    guidePortalSource,
    refreshGuidePortalData,
    selectedGuide,
  } = useGuidePortalData()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [requestGroupId, setRequestGroupId] = useState<string | null>(null)
  const [confirmationFeedback, setConfirmationFeedback] = useState("")
  const isSupabaseMode = dataSource === "supabase"
  const canCreateRequest =
    guidePortalSource === "auth" && guidePortalAuthStatus === "ready"
  const assignedGroups = selectedGuide
    ? groups
        .filter((group) => group.guideId === selectedGuide.id)
        .sort((a, b) => a.startDateIso.localeCompare(b.startDateIso))
    : []
  const today = new Date().toISOString().slice(0, 10)
  const upcomingGroups = assignedGroups.filter(
    (group) => group.endDateIso >= today
  )
  const pastGroups = assignedGroups.filter((group) => group.endDateIso < today)
  function getCircuitName(circuitId: string) {
    return circuits.find((circuit) => circuit.id === circuitId)?.name ?? circuitId
  }

  function renderGroup(group: (typeof assignedGroups)[number], past = false) {
    const isMuted =
      past || group.groupStatus === "cxl" || group.groupStatus === "fusionado"

    return (
      <article
        key={group.id}
        className={`rounded-xl border bg-card p-4 shadow-sm ${isMuted ? "opacity-70" : ""}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">{group.code}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPinned className="size-4" />
              {getCircuitName(group.circuitId)}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="capitalize">
              {group.groupStatus.replaceAll("-", " ")}
            </Badge>
            <Badge
              variant="outline"
              className={
                group.confirmationStatus === "pending-confirmation"
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : group.confirmationStatus === "confirmed"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : ""
              }
            >
              {group.confirmationStatus.replaceAll("-", " ")}
            </Badge>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            <span>
              {formatDateDisplay(group.startDateIso)} – {formatDateDisplay(group.endDateIso)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <span>{group.travelers || "—"} <T i18nKey="guide_portal.guide_groups.travelers" /></span>
          </div>
          <div>
            <T i18nKey="guide_portal.guide_groups.language" /> {group.requiredLanguage || "Any"}
          </div>
        </div>
        <div className="mt-4">
          {group.confirmationStatus === "pending-confirmation" ? (
            <GuideAssignmentActions
              group={group}
              guidePortalSource={guidePortalSource}
              guidePortalAuthStatus={guidePortalAuthStatus}
              onConfirmed={() => {
                setConfirmationFeedback(`${group.code} confirmed.`)
                refreshGuidePortalData()
              }}
              onRequestChange={() => {
                setRequestGroupId(group.id)
                setDialogOpen(true)
              }}
            />
          ) : (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canCreateRequest}
                title={
                  canCreateRequest
                    ? t("guide_portal.groups.request_title")
                    : guidePortalSource === "auth"
                      ? t("guide_portal.groups.sign_in_title")
                      : t("guide_portal.assignment.preview_read_only")
                }
                onClick={() => {
                  setRequestGroupId(group.id)
                  setDialogOpen(true)
                }}
              >
                <Repeat />
                <T i18nKey="guide_portal.guide_assignment_actions.request_a_change" />
              </Button>
            </div>
          )}
        </div>
      </article>
    )
  }

  return (
    <div className="space-y-4">
      {confirmationFeedback ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          {confirmationFeedback}
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle><T i18nKey="guide_portal.guide_groups.upcoming_groups" /></CardTitle>
          <CardDescription>
            <T i18nKey="guide_portal.guide_groups.your_current_and_upcoming_assignments_nearest_first" />
            {isSupabaseMode
              ? " Requests are reviewed by operations and do not change assignments directly."
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {upcomingGroups.length > 0 ? (
            upcomingGroups.map((group) => renderGroup(group))
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="font-medium"><T i18nKey="guide_portal.guide_groups.no_upcoming_assigned_groups" /></p>
              <p className="mt-1 text-sm text-muted-foreground">
                <T i18nKey="guide_portal.guide_groups.new_assignments_will_appear_here" />
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {pastGroups.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base"><T i18nKey="guide_portal.guide_groups.past_groups" /></CardTitle>
            <CardDescription><T i18nKey="guide_portal.guide_groups.previous_assignments_for_reference" /></CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {pastGroups.map((group) => renderGroup(group, true))}
          </CardContent>
        </Card>
      ) : null}
      {dialogOpen ? (
        <GuideChangeRequestDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          groups={assignedGroups}
          guidePortalSource={guidePortalSource}
          guidePortalAuthStatus={guidePortalAuthStatus}
          defaultRequestType="group_change"
          defaultGroupId={requestGroupId}
          onCreated={refreshGuidePortalData}
        />
      ) : null}
    </div>
  )
}
