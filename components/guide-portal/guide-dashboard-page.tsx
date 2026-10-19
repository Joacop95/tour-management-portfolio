"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import Link from "next/link"
import { useState } from "react"
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  MapPinned,
} from "lucide-react"

import { GuideAssignmentActions } from "@/components/guide-portal/guide-assignment-actions"
import { GuideChangeRequestDialog } from "@/components/guide-portal/guide-change-request-dialog"
import { useGuidePortalData } from "@/components/guide-portal/guide-portal-data"
import { useAppSettings } from "@/components/settings/settings-client-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateDisplay } from "@/lib/utils/date-format"
import { normalizeSpokenLanguages } from "@/lib/utils/language-options"

export function GuideDashboardPage() {
  const { t } = useI18n()
  const appSettings = useAppSettings()
  const {
    availability,
    availabilitySubmissions,
    changeRequests,
    circuits,
    groups,
    guidePortalAuthStatus,
    guidePortalSource,
    refreshGuidePortalData,
    selectedGuide,
  } = useGuidePortalData()
  const [requestGroupId, setRequestGroupId] = useState<string | null>(null)
  const [requestOpen, setRequestOpen] = useState(false)
  const [confirmationFeedback, setConfirmationFeedback] = useState("")

  if (!selectedGuide) {
    return null
  }

  const today = new Date().toISOString().slice(0, 10)
  const targetYear = appSettings.availability.defaultSelectedYear
  const upcomingGroups = groups
    .filter(
      (group) =>
        group.guideId === selectedGuide.id &&
        group.endDateIso >= today &&
        group.groupStatus === "active"
    )
    .sort((a, b) => a.startDateIso.localeCompare(b.startDateIso))
  const pendingGroups = upcomingGroups.filter(
    (group) => group.confirmationStatus === "pending-confirmation"
  )
  const confirmedGroups = upcomingGroups
    .filter((group) => group.confirmationStatus === "confirmed")
    .slice(0, 3)
  const openRequests = changeRequests.filter(
    (request) =>
      request.status === "pending" || request.status === "in_progress"
  )
  const annualSubmission = availabilitySubmissions.find(
    (submission) =>
      submission.guideId === selectedGuide.id && submission.year === targetYear
  )
  const annualAvailability = availability.filter(
    (record) =>
      record.guideId === selectedGuide.id &&
      record.source === "guide-submitted" &&
      record.startDateIso <= `${targetYear}-12-31` &&
      record.endDateIso >= `${targetYear}-01-01`
  )
  const generalPeriods = annualAvailability.filter(
    (record) => record.status === "available"
  )
  const generalPeriod = generalPeriods.length === 1 ? generalPeriods[0] : null
  const unavailableExceptionCount = annualAvailability.filter(
    (record) => record.status === "not-available"
  ).length
  const availabilityNeedsAction =
    !annualSubmission ||
    annualSubmission.status === "draft" ||
    annualSubmission.status === "pending-review" ||
    annualSubmission.status === "changes-requested"
  const languages = normalizeSpokenLanguages(
    selectedGuide.languages,
    selectedGuide.preferredLanguage
  )

  function circuitName(circuitId: string) {
    return circuits.find((circuit) => circuit.id === circuitId)?.name ?? t("guide_portal.availability.assigned_circuit")
  }

  function openGroupRequest(groupId: string) {
    setRequestGroupId(groupId)
    setRequestOpen(true)
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground"><T i18nKey="guide_portal.guide_dashboard.welcome_back" /></p>
          <h2 className="mt-0.5 text-xl font-semibold">{selectedGuide.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {selectedGuide.status.replaceAll("-", " ")}
            </Badge>
            {languages.map((language) => (
              <Badge key={language} variant="outline">{language}</Badge>
            ))}
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/guide/profile"><T i18nKey="guide_portal.guide_dashboard.view_profile" /> <ArrowRight /></Link>
        </Button>
      </section>

      <Card className="border-amber-300 bg-amber-50/55 shadow-sm">
        <CardHeader className="border-b border-amber-200/80 pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base text-amber-950">
            <span className="flex size-8 items-center justify-center rounded-full bg-amber-100 ring-1 ring-amber-300">
              <CircleAlert className="size-4 text-amber-700" />
            </span>
            <span><T i18nKey="guide_portal.guide_dashboard.actions_required" /></span>
            {pendingGroups.length + (availabilityNeedsAction ? 1 : 0) > 0 ? (
              <Badge className="border-amber-300 bg-white/80 text-amber-900" variant="outline">
                {pendingGroups.length + (availabilityNeedsAction ? 1 : 0)}
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {confirmationFeedback ? (
            <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900" role="status">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />{confirmationFeedback}
            </p>
          ) : null}
          {pendingGroups.length > 0 ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-950">
              <T i18nKey="guide_portal.guide_dashboard.pending_confirmations" />
              <Badge className="border-amber-300 bg-amber-100 text-amber-900" variant="outline">{pendingGroups.length}</Badge>
            </div>
          ) : null}
          {pendingGroups.map((group) => (
            <article key={group.id} className="rounded-lg border border-amber-200 bg-background p-3 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-base font-semibold text-foreground">{group.code}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                    {circuitName(group.circuitId)} · {formatDateDisplay(group.startDateIso)} – {formatDateDisplay(group.endDateIso)}
                  </div>
                </div>
                <Badge className="border-amber-300 bg-amber-50 text-amber-800" variant="outline">
                  <T i18nKey="guide_portal.guide_dashboard.pending_confirmation" />
                </Badge>
              </div>
              <div className="mt-3">
                <GuideAssignmentActions
                  group={group}
                  guidePortalSource={guidePortalSource}
                  guidePortalAuthStatus={guidePortalAuthStatus}
                  onConfirmed={() => {
                    setConfirmationFeedback(`${group.code} confirmed.`)
                    refreshGuidePortalData()
                  }}
                  onRequestChange={() => openGroupRequest(group.id)}
                />
              </div>
            </article>
          ))}

          {availabilityNeedsAction ? (
            <div className={`flex flex-col gap-3 rounded-lg border p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between ${annualSubmission?.status === "changes-requested" ? "border-rose-300 bg-rose-50/80" : annualSubmission?.status === "pending-review" ? "border-blue-300 bg-blue-50/80" : "border-amber-200 bg-background"}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2 font-semibold">
                  {annualSubmission?.status === "changes-requested"
                    ? t("guide_portal.home.changes_requested_year", { year: targetYear })
                    : annualSubmission?.status === "pending-review"
                      ? t("guide_portal.home.review_year", { year: targetYear })
                    : annualSubmission?.status === "draft"
                    ? t("guide_portal.home.draft_year", { year: targetYear })
                    : t("guide_portal.home.not_submitted_year", { year: targetYear })}
                  <Badge variant="outline" className={annualSubmission?.status === "changes-requested" ? "border-rose-300 bg-white/70 text-rose-800" : annualSubmission?.status === "pending-review" ? "border-blue-300 bg-white/70 text-blue-800" : "border-amber-300 bg-amber-50 text-amber-800"}>
                    {annualSubmission?.status === "pending-review" ? t("guide_portal.home.review_pending") : t("guide_portal.home.action_required")}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  {annualSubmission?.status === "changes-requested"
                    ? annualSubmission.reviewMessage ?? t("guide_portal.home.operations_requested_updates")
                    : annualSubmission?.status === "pending-review"
                      ? t("guide_portal.home.conflict_review")
                    : annualSubmission?.status === "draft"
                    ? t("guide_portal.home.continue_draft")
                    : t("guide_portal.home.add_annual")}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/guide/availability">
                  {annualSubmission?.status === "changes-requested"
                    ? t("guide_portal.guide_availability.edit_availability")
                    : annualSubmission?.status === "pending-review"
                      ? t("guide_portal.home.review_conflict")
                    : annualSubmission?.status === "draft"
                    ? t("guide_portal.home.continue_availability")
                    : t("guide_portal.home.add_year", { year: targetYear })}
                </Link>
              </Button>
            </div>
          ) : null}

          {pendingGroups.length === 0 && !availabilityNeedsAction ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-900">
              <CheckCircle2 className="size-4" />
              <T i18nKey="guide_portal.guide_dashboard.you_re_up_to_date" />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {annualSubmission?.status === "approved" ? (
        <Card className="border-emerald-200 bg-emerald-50/35">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 font-semibold text-emerald-950">
                <span className="flex size-7 items-center justify-center rounded-full bg-emerald-100"><CheckCircle2 className="size-4 text-emerald-700" /></span>
                {annualSubmission.reviewedAt
                  ? t("guide_portal.home.approved_year", { year: targetYear })
                  : t("guide_portal.home.submitted_year", { year: targetYear })}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {generalPeriod
                  ? t(unavailableExceptionCount === 1 ? "guide_portal.home.general_availability_one" : "guide_portal.home.general_availability_many", { start: formatDateDisplay(generalPeriod.startDateIso), end: formatDateDisplay(generalPeriod.endDateIso), count: unavailableExceptionCount })
                  : t("guide_portal.home.submitted_details")}
              </p>
            </div>
            <Button asChild size="sm" variant="outline"><Link href="/guide/availability"><T i18nKey="guide_portal.guide_dashboard.view_availability" /></Link></Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPinned className="size-4 text-primary" />
              <T i18nKey="guide_portal.guide_dashboard.upcoming_confirmed_groups" />
            </CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/guide/groups"><T i18nKey="guide_portal.guide_dashboard.view_all_groups" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {confirmedGroups.length > 0 ? confirmedGroups.map((group) => (
              <Link
                key={group.id}
                href="/guide/groups"
                className="flex min-h-16 items-center justify-between gap-3 rounded-lg border px-3 py-2 hover:bg-muted/50"
              >
                <div>
                  <div className="font-medium">{group.code}</div>
                  <div className="text-xs text-muted-foreground">
                    {circuitName(group.circuitId)} · {formatDateDisplay(group.startDateIso)} – {formatDateDisplay(group.endDateIso)}
                  </div>
                </div>
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800" variant="outline">
                  <T i18nKey="status.confirmed" />
                </Badge>
              </Link>
            )) : (
              <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                <T i18nKey="guide_portal.guide_dashboard.no_upcoming_confirmed_groups" />
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="size-4 text-primary" />
              <T i18nKey="guide_portal.navigation.change_requests" />
            </CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/guide/change-requests"><T i18nKey="guide_portal.guide_dashboard.view_requests" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm text-muted-foreground">
              {openRequests.length} <T i18nKey="guide_portal.guide_dashboard.open" /> {openRequests.length === 1 ? "request" : "requests"}
            </div>
            {openRequests.slice(0, 3).map((request) => (
              <div key={request.id} className="rounded-lg border px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium capitalize">
                    {request.requestType.replaceAll("_", " ")}
                  </span>
                  <Badge variant="outline" className="capitalize">
                    {request.status.replaceAll("_", " ")}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {request.groupCode ?? request.circuitName ?? t("guide_portal.requests.no_group")}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" />
            <div>
              <div className="font-medium">
                {!annualSubmission
                  ? `${targetYear} availability not submitted`
                  : annualSubmission.status === "draft"
                    ? `${targetYear} availability draft`
                    : annualSubmission.status === "changes-requested"
                      ? `Changes requested for ${targetYear} availability`
                    : annualSubmission.status === "pending-review"
                      ? `${targetYear} availability needs review`
                      : `${targetYear} availability submitted`}
              </div>
              {annualSubmission?.status === "pending-review" ? (
                <p className="text-xs text-amber-700"><T i18nKey="status.pending_review" /></p>
              ) : null}
              {annualSubmission?.status === "changes-requested" ? (
                <p className="text-xs text-amber-700"><T i18nKey="guide_portal.guide_dashboard.operations_feedback_is_ready_to_review" /></p>
              ) : null}
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/guide/availability">
              {!annualSubmission
                ? `Add ${targetYear} availability`
                : annualSubmission.status === "draft" || annualSubmission.status === "changes-requested"
                  ? t("guide_portal.home.continue_availability")
                  : t("guide_portal.home.view_availability")}
            </Link>
          </Button>
        </CardContent>
      </Card>

      {requestOpen ? (
        <GuideChangeRequestDialog
          open={requestOpen}
          onOpenChange={setRequestOpen}
          groups={upcomingGroups}
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
