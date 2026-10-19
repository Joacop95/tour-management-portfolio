"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import { useMemo, useState } from "react"
import { CalendarCheck2, ChevronDown, Pencil, Plus, Repeat, Send, Trash2, TriangleAlert } from "lucide-react"

import { DateRangePickerInput } from "@/components/common/date-range-picker-input"
import { GuideAvailabilityYearGrid } from "@/components/guide-portal/guide-availability-year-grid"
import { GuideChangeRequestDialog } from "@/components/guide-portal/guide-change-request-dialog"
import { useGuidePortalData } from "@/components/guide-portal/guide-portal-data"
import { useAppSettings } from "@/components/settings/settings-client-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  archiveOwnGuideAvailabilityPeriod,
  beginOwnAutoAcceptedAvailabilityRevision,
  beginOwnGuideAvailabilityRevision,
  saveOwnGuideAvailabilityPeriod,
  submitOwnGuideAnnualAvailability,
} from "@/lib/supabase/mutations/guide-portal-availability"
import type { GuideAvailability, GuideAvailabilitySubmissionStatus } from "@/lib/types/domain"
import { formatDateDisplay } from "@/lib/utils/date-format"
import { getEffectiveAvailabilitySummary } from "@/lib/utils/availability-conflicts"
import { getAvailabilitySubmissionConflicts } from "@/lib/utils/availability-submission-conflicts"

const submissionLabels: Record<GuideAvailabilitySubmissionStatus, UiTranslationKey> = {
  draft: "status.draft",
  "pending-review": "status.needs_review",
  "changes-requested": "status.changes_requested",
  approved: "status.approved",
}

type PeriodEditor = {
  kind: "general" | "exception"
  record: GuideAvailability | null
  startDate: string
  endDate: string
  notes: string
}

export function GuideAvailabilityPage() {
  const { t } = useI18n()
  const appSettings = useAppSettings()
  const {
    availability, availabilitySubmissions, circuits, groups, guidePortalAuthStatus,
    guidePortalSource, refreshGuidePortalData, selectedGuide,
  } = useGuidePortalData()
  const [selectedYear, setSelectedYear] = useState(appSettings.availability.defaultSelectedYear)
  const [editor, setEditor] = useState<PeriodEditor | null>(null)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const yearStart = `${selectedYear}-01-01`
  const yearEnd = `${selectedYear}-12-31`
  const records = useMemo(() => selectedGuide
    ? availability.filter((record) => record.guideId === selectedGuide.id && record.startDateIso <= yearEnd && record.endDateIso >= yearStart)
        .sort((a, b) => a.startDateIso.localeCompare(b.startDateIso))
    : [], [availability, selectedGuide, yearEnd, yearStart])
  const generalPeriods = records.filter((record) => record.source === "guide-submitted" && record.status === "available")
  const generalPeriod = generalPeriods.length === 1 ? generalPeriods[0] : null
  const exceptions = records.filter((record) => record.source === "guide-submitted" && record.status === "not-available")
  const submission = selectedGuide
    ? availabilitySubmissions.find((item) => item.guideId === selectedGuide.id && item.year === selectedYear) ?? null
    : null
  const summary = useMemo(() => getEffectiveAvailabilitySummary(records, selectedYear), [records, selectedYear])
  const conflicts = useMemo(() => selectedGuide
    ? getAvailabilitySubmissionConflicts(selectedGuide.id, selectedYear, availability, groups)
    : [], [availability, groups, selectedGuide, selectedYear])
  const canMutate = guidePortalSource === "auth" && guidePortalAuthStatus === "ready"
  const canEditDraft = canMutate && (!submission || submission.status === "draft")
  const autoAccepted = submission?.status === "approved" && !submission.reviewedAt
  const legacyMultiplePeriods = generalPeriods.length > 1
  const years = Array.from(
    { length: appSettings.availability.maxYear - appSettings.availability.minYear + 1 },
    (_, index) => appSettings.availability.minYear + index
  )

  function openGeneralEditor() {
    setEditor({ kind: "general", record: generalPeriod, startDate: generalPeriod?.startDateIso ?? "", endDate: generalPeriod?.endDateIso ?? "", notes: generalPeriod?.notes ?? "" })
  }

  function openExceptionEditor(record: GuideAvailability | null = null) {
    setEditor({ kind: "exception", record, startDate: record?.startDateIso ?? "", endDate: record?.endDateIso ?? "", notes: record?.notes ?? "" })
  }

  async function savePeriod() {
    if (!editor || !editor.startDate || !editor.endDate) return
    if (editor.endDate < editor.startDate) {
      setFeedback({ type: "error", message: t("guide_portal.guide_availability.message_end_date_must_be_on_or_after_start") })
      return
    }
    if (editor.kind === "exception" && generalPeriod && (editor.startDate < generalPeriod.startDateIso || editor.endDate > generalPeriod.endDateIso)) {
      setFeedback({ type: "error", message: t("guide_portal.guide_availability.message_unavailable_dates_must_stay_inside_the_general_availability") })
      return
    }
    setIsMutating(true)
    setFeedback(null)
    const result = await saveOwnGuideAvailabilityPeriod({
      availabilityId: editor.record?.id,
      year: selectedYear,
      startDate: editor.startDate,
      endDate: editor.endDate,
      status: editor.kind === "general" ? "available" : "not_available",
      notes: editor.notes,
    })
    setIsMutating(false)
    setFeedback({ type: result.success ? "success" : "error", message: result.message })
    if (result.success) {
      setEditor(null)
      refreshGuidePortalData()
    }
  }

  async function removeException(record: GuideAvailability) {
    setIsMutating(true)
    setFeedback(null)
    const result = await archiveOwnGuideAvailabilityPeriod(record.id, selectedYear)
    setIsMutating(false)
    setFeedback({ type: result.success ? "success" : "error", message: result.message })
    if (result.success) refreshGuidePortalData()
  }

  async function submitYear() {
    setIsMutating(true)
    setFeedback(null)
    const result = await submitOwnGuideAnnualAvailability(selectedYear)
    setIsMutating(false)
    setFeedback({ type: result.success ? "success" : "error", message: result.message })
    if (result.success) refreshGuidePortalData()
  }

  async function beginRevision(autoAcceptedRevision = false) {
    setIsMutating(true)
    setFeedback(null)
    const result = autoAcceptedRevision
      ? await beginOwnAutoAcceptedAvailabilityRevision(selectedYear)
      : await beginOwnGuideAvailabilityRevision(selectedYear)
    setIsMutating(false)
    setFeedback({ type: result.success ? "success" : "error", message: result.message })
    if (result.success) refreshGuidePortalData()
  }

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      <Card>
        <CardHeader className="border-b pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle><T i18nKey="guide_portal.guide_availability.my" /> {selectedYear} <T i18nKey="guide_portal.guide_availability.availability" /></CardTitle>
              <CardDescription>
                {submission?.status === "draft"
                  ? "Your changes are saved as a draft until you submit them."
                  : autoAccepted
                    ? "Availability submitted. Editing it will rerun conflict checks when you submit again."
                    : submission?.status === "pending-review"
                      ? "An unavailable exception overlaps an assigned tour and needs Operations review."
                      : submission?.status === "changes-requested"
                        ? "Operations requested changes before you submit again."
                        : submission?.status === "approved"
                          ? "Operations approved this submission. Request a change if it needs updating."
                          : "Confirm one general period, then add only the dates when you are unavailable."}
              </CardDescription>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(Number(value))}>
                <SelectTrigger aria-label={t("guide_portal.guide_availability.aria_label_availability_year")}><SelectValue /></SelectTrigger>
                <SelectContent>{years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
              </Select>
              <Badge variant="outline">{submission?.status === "approved" && !submission.reviewedAt ? t("status.submitted") : submission ? t(submissionLabels[submission.status]) : t("guide_portal.availability.not_submitted")}</Badge>
              {submission?.status === "draft" ? <Button size="sm" disabled={isMutating || !canMutate || !generalPeriod || legacyMultiplePeriods} onClick={submitYear}><Send /><T i18nKey="guide_portal.guide_availability.submit_availability" /></Button> : null}
              {autoAccepted ? <Button size="sm" variant="outline" disabled={isMutating || !canMutate} onClick={() => beginRevision(true)}><Pencil /><T i18nKey="guide_portal.guide_availability.edit_availability" /></Button> : null}
              {submission?.status === "changes-requested" ? <Button size="sm" variant="outline" disabled={isMutating || !canMutate} onClick={() => beginRevision(false)}><Pencil /><T i18nKey="guide_portal.guide_availability.edit_availability" /></Button> : null}
              {submission?.status === "approved" && submission.reviewedAt ? <Button size="sm" variant="outline" disabled={!canMutate} onClick={() => setRequestOpen(true)}><Repeat /><T i18nKey="guide_portal.guide_availability.request_change" /></Button> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {feedback ? <p role="status" className={feedback.type === "success" ? "flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900" : "flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900"}>{feedback.type === "success" ? <CalendarCheck2 className="size-4 shrink-0" /> : <TriangleAlert className="size-4 shrink-0" />}{feedback.message}</p> : null}
          {submission?.status === "changes-requested" ? <div className="flex gap-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-rose-950 shadow-xs"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-100 ring-1 ring-rose-300"><TriangleAlert className="size-4 text-rose-700" /></span><div><div className="font-semibold"><T i18nKey="guide_portal.guide_availability.changes_requested_for" /> {selectedYear} <T i18nKey="guide_portal.guide_availability.availability" /></div><p className="mt-1 whitespace-pre-wrap text-sm text-rose-900/80">{submission.reviewMessage}</p></div></div> : null}
          {guidePortalSource === "preview" ? <p className="text-sm text-muted-foreground"><T i18nKey="guide_portal.guide_availability.development_preview_remains_read_only" /></p> : null}
          {legacyMultiplePeriods ? <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" /><span><T i18nKey="guide_portal.guide_availability.this_year_contains_multiple_legacy_available_periods_they" /></span></div> : null}

          <section className="rounded-lg border p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-semibold"><T i18nKey="guide_portal.guide_availability.generally_available" /></h2><p className="text-sm text-muted-foreground"><T i18nKey="guide_portal.guide_availability.dates_outside_this_period_are_not_provided" /></p></div>
              {canEditDraft && !legacyMultiplePeriods ? <Button size="sm" variant={generalPeriod ? "outline" : "default"} onClick={openGeneralEditor}><Pencil />{generalPeriod ? t("guide_portal.availability.edit_period") : t("guide_portal.availability.add_period")}</Button> : null}
            </div>
            {generalPeriod ? <div className="mt-3 text-base font-medium">{formatDateDisplay(generalPeriod.startDateIso)} <span className="text-muted-foreground"><T i18nKey="guide_portal.guide_availability.to" /></span> {formatDateDisplay(generalPeriod.endDateIso)}</div> : <p className="mt-3 rounded-md bg-muted/45 px-3 py-2 text-sm text-muted-foreground"><T i18nKey="guide_portal.guide_availability.no_general_availability_period_provided" /></p>}
          </section>

          <section className="rounded-lg border p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-semibold"><T i18nKey="guide_portal.guide_availability.unavailable_dates" /></h2><p className="text-sm text-muted-foreground"><T i18nKey="guide_portal.guide_availability.exceptions_inside_your_general_availability_period" /></p></div>
              {canEditDraft && generalPeriod && !legacyMultiplePeriods ? <Button size="sm" variant="outline" onClick={() => openExceptionEditor()}><Plus /><T i18nKey="guide_portal.guide_availability.add_unavailable_period" /></Button> : null}
            </div>
            <div className="mt-3 space-y-2">
              {exceptions.length === 0 ? <p className="rounded-md bg-muted/45 px-3 py-2 text-sm text-muted-foreground"><T i18nKey="guide_portal.guide_availability.no_unavailable_exceptions_added" /></p> : exceptions.map((record) => (
                <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <div><div className="font-medium">{formatDateDisplay(record.startDateIso)} <T i18nKey="guide_portal.guide_availability.to" /> {formatDateDisplay(record.endDateIso)}</div>{record.notes ? <p className="mt-0.5 break-words text-xs text-muted-foreground">{record.notes}</p> : null}</div>
                  {canEditDraft ? <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => openExceptionEditor(record)}><Pencil /><T i18nKey="common.edit" /></Button><Button size="sm" variant="ghost" className="text-destructive" disabled={isMutating} onClick={() => removeException(record)}><Trash2 /><T i18nKey="common.remove" /></Button></div> : null}
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Summary label={t("guide_portal.guide_availability.label_available")} value={summary.available} />
            <Summary label={t("guide_portal.guide_availability.label_unavailable")} value={summary["not-available"]} />
            <Summary label={t("guide_portal.guide_availability.label_occupied")} value={summary["occupied-by-assignment"] + summary.conflict} />
            <Summary label={t("guide_portal.guide_availability.label_not_provided")} value={summary["not-provided"]} />
            <Summary label={t("guide_portal.guide_availability.label_conflicts")} value={summary.conflict} warning={summary.conflict > 0} />
          </div>

          {submission?.status === "pending-review" && conflicts.length > 0 ? (
            <div className="space-y-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-rose-950 shadow-sm">
              <div className="flex gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-100 ring-1 ring-rose-300"><TriangleAlert className="size-4 text-rose-700" /></span><div><div className="font-semibold"><T i18nKey="guide_portal.guide_availability.availability_conflict" /></div><p className="mt-0.5 text-sm text-rose-900/80"><T i18nKey="guide_portal.guide_availability.your_unavailable_dates_overlap_assigned_tours_operations_will" /></p></div></div>
              {conflicts.map((conflict) => <div key={`${conflict.availabilityId}-${conflict.groupId}`} className="rounded-md border border-rose-200 bg-background px-3 py-2 text-sm"><div className="font-semibold">{conflict.groupCode} · {circuits.find((item) => item.id === conflict.circuitId)?.name ?? t("guide_portal.availability.assigned_circuit")}</div><div className="mt-1 text-xs text-muted-foreground sm:text-sm"><T i18nKey="guide_portal.guide_availability.tour" /> {formatDateDisplay(conflict.assignmentStartDateIso)} <T i18nKey="guide_portal.guide_availability.to" /> {formatDateDisplay(conflict.assignmentEndDateIso)}</div><div className="text-xs font-medium text-rose-800 sm:text-sm"><T i18nKey="guide_portal.guide_availability.unavailable" /> {formatDateDisplay(conflict.availabilityStartDateIso)} <T i18nKey="guide_portal.guide_availability.to" /> {formatDateDisplay(conflict.availabilityEndDateIso)}</div></div>)}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="cursor-pointer pb-3" onClick={() => setOverviewOpen((value) => !value)}><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base"><T i18nKey="guide_portal.guide_availability.year_overview" /></CardTitle><CardDescription><T i18nKey="guide_portal.guide_availability.read_only_effective_availability_across" /> {selectedYear}.</CardDescription></div><ChevronDown className={`size-4 transition-transform ${overviewOpen ? "rotate-180" : ""}`} /></div></CardHeader>
        {overviewOpen ? <CardContent><GuideAvailabilityYearGrid year={selectedYear} records={records} /></CardContent> : null}
      </Card>

      <Dialog open={Boolean(editor)} onOpenChange={(open) => { if (!open) setEditor(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editor?.kind === "general" ? t("guide_portal.availability.general_period") : editor?.record ? t("guide_portal.availability.edit_unavailable") : t("guide_portal.availability.add_unavailable")}</DialogTitle><DialogDescription>{editor?.kind === "general" ? t("guide_portal.availability.general_period_help") : t("guide_portal.availability.exception_help")}</DialogDescription></DialogHeader>
          {editor ? <div className="space-y-3"><div className="grid gap-1.5"><Label><T i18nKey="guide_portal.guide_availability.date_range" /></Label><DateRangePickerInput startId="guide-period-start" endId="guide-period-end" startDateIso={editor.startDate} endDateIso={editor.endDate} minDateIso={editor.kind === "exception" && generalPeriod ? generalPeriod.startDateIso : yearStart} maxDateIso={editor.kind === "exception" && generalPeriod ? generalPeriod.endDateIso : yearEnd} onChange={(startDate, endDate) => setEditor((current) => current ? { ...current, startDate, endDate } : current)} /></div><div className="grid gap-1.5"><Label htmlFor="guide-period-notes"><T i18nKey="common.notes" /></Label><Textarea id="guide-period-notes" value={editor.notes} onChange={(event) => setEditor((current) => current ? { ...current, notes: event.target.value } : current)} /></div></div> : null}
          <DialogFooter><Button variant="outline" onClick={() => setEditor(null)}><T i18nKey="common.cancel" /></Button><Button disabled={isMutating || !editor?.startDate || !editor.endDate || editor.endDate < editor.startDate} onClick={savePeriod}><CalendarCheck2 /><T i18nKey="guide_portal.guide_availability.save_period" /></Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {requestOpen ? <GuideChangeRequestDialog open={requestOpen} onOpenChange={setRequestOpen} groups={groups} guidePortalSource={guidePortalSource} guidePortalAuthStatus={guidePortalAuthStatus} defaultRequestType="availability_change" allowedAvailabilityIds={records.map((record) => record.id)} onCreated={refreshGuidePortalData} /> : null}
    </div>
  )
}

function Summary({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return <div className={`rounded-lg border px-3 py-2 ${warning ? "border-rose-200 bg-rose-50" : ""}`}><div className="text-xs text-muted-foreground">{label}</div><div className="text-lg font-semibold">{value} <T i18nKey="guide_portal.guide_availability.days" /></div></div>
}
