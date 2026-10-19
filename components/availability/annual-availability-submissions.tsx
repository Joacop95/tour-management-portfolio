"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import { useMemo, useState } from "react"
import { CheckCircle2, Search } from "lucide-react"

import { GuideAvailabilityYearGrid } from "@/components/guide-portal/guide-availability-year-grid"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { reviewGuideAnnualAvailability } from "@/lib/supabase/mutations/availability-submissions"
import type { SupabaseAvailabilitySubmission } from "@/lib/supabase/queries/availability"
import type { Circuit, Guide, GuideAvailability, TourGroup } from "@/lib/types/domain"
import { getEffectiveAvailabilitySummary } from "@/lib/utils/availability-conflicts"
import { getAvailabilitySubmissionConflicts } from "@/lib/utils/availability-submission-conflicts"
import { formatDateDisplay, formatDateTimeDisplay } from "@/lib/utils/date-format"

type SubmissionFilter = "all" | SupabaseAvailabilitySubmission["status"]

const statusLabels: Record<SupabaseAvailabilitySubmission["status"], UiTranslationKey> = {
  draft: "status.draft",
  "pending-review": "status.pending_review",
  "changes-requested": "status.changes_requested",
  approved: "status.approved",
}

const statusOrder: Record<SupabaseAvailabilitySubmission["status"], number> = {
  "pending-review": 0,
  "changes-requested": 1,
  draft: 2,
  approved: 3,
}

type AnnualAvailabilitySubmissionsProps = {
  submissions: SupabaseAvailabilitySubmission[]
  guides: Guide[]
  availability: GuideAvailability[]
  groups: TourGroup[]
  circuits: Circuit[]
  canReview: boolean
  reviewPermissionMessage: string
  onReviewed: () => Promise<string | null>
}

export function AnnualAvailabilitySubmissions({
  submissions,
  guides,
  availability,
  groups,
  circuits,
  canReview,
  reviewPermissionMessage,
  onReviewed,
}: AnnualAvailabilitySubmissionsProps) {
  const { t } = useI18n()
  const [statusFilter, setStatusFilter] = useState<SubmissionFilter>("pending-review")
  const [yearFilter, setYearFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<SupabaseAvailabilitySubmission | null>(null)
  const [reviewMessage, setReviewMessage] = useState("")
  const [isReviewing, setIsReviewing] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const guideById = useMemo(() => new Map(guides.map((guide) => [guide.id, guide])), [guides])
  const years = useMemo(
    () => Array.from(new Set(submissions.map((item) => item.year))).sort((a, b) => b - a),
    [submissions]
  )
  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return [...submissions]
      .filter((submission) => statusFilter === "all" || submission.status === statusFilter)
      .filter((submission) => yearFilter === "all" || String(submission.year) === yearFilter)
      .filter((submission) => {
        if (!normalizedSearch) return true
        const guide = guideById.get(submission.guideId)
        return guide?.name.toLowerCase().includes(normalizedSearch) || guide?.email.toLowerCase().includes(normalizedSearch)
      })
      .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || b.year - a.year || (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""))
  }, [guideById, search, statusFilter, submissions, yearFilter])

  const selectedGuide = selected ? guideById.get(selected.guideId) : null
  const selectedRecords = selected
    ? availability.filter(
        (record) =>
          record.guideId === selected.guideId &&
          record.startDateIso <= `${selected.year}-12-31` &&
          record.endDateIso >= `${selected.year}-01-01`
      )
    : []
  const selectedCoverage = selected ? getEffectiveAvailabilitySummary(selectedRecords, selected.year) : null
  const selectedGeneralPeriods = selectedRecords.filter(
    (record) => record.source === "guide-submitted" && record.status === "available"
  )
  const selectedExceptions = selectedRecords.filter(
    (record) => record.source === "guide-submitted" && record.status === "not-available"
  )
  const selectedConflicts = selected
    ? getAvailabilitySubmissionConflicts(
        selected.guideId,
        selected.year,
        availability,
        groups
      )
    : []

  async function review(action: "approve" | "request_changes") {
    if (!selected || !canReview || selected.status !== "pending-review") return
    if (action === "request_changes" && !reviewMessage.trim()) {
      setFeedback({ type: "error", message: t("availability.annual_availability_submissions.message_explain_what_the_guide_needs_to_change") })
      return
    }
    setIsReviewing(true)
    setFeedback(null)
    const result = await reviewGuideAnnualAvailability({
      submissionId: selected.id,
      action,
      reviewMessage,
    })
    if (!result.success) {
      setIsReviewing(false)
      setFeedback({ type: "error", message: result.message })
      return
    }
    const refreshError = await onReviewed()
    setIsReviewing(false)
    if (refreshError) {
      setFeedback({ type: "error", message: refreshError })
      return
    }
    setFeedback({ type: "success", message: result.message })
    setSelected(null)
    setReviewMessage("")
  }

  return (
    <div className="space-y-3">
      <Card size="sm">
        <CardContent className="grid gap-2 py-0 md:grid-cols-[minmax(14rem,1fr)_11rem_10rem_auto] md:items-end">
          <div className="grid gap-1">
            <Label htmlFor="annual-submission-search"><T i18nKey="availability.annual_availability_submissions.search_guide" /></Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="annual-submission-search" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-8" placeholder={t("availability.annual_availability_submissions.placeholder_name_or_email")} />
            </div>
          </div>
          <div className="grid gap-1">
            <Label><T i18nKey="common.status" /></Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as SubmissionFilter)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending-review"><T i18nKey="availability.annual_availability_submissions.needs_review" /></SelectItem>
                <SelectItem value="approved"><T i18nKey="status.approved" /></SelectItem>
                <SelectItem value="changes-requested"><T i18nKey="status.changes_requested" /></SelectItem>
                <SelectItem value="draft"><T i18nKey="status.draft" /></SelectItem>
                <SelectItem value="all"><T i18nKey="availability.annual_availability_submissions.all_statuses" /></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label><T i18nKey="common.year" /></Label>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><T i18nKey="availability.annual_availability_submissions.all_years" /></SelectItem>
                {years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className="mb-1 w-fit">{filtered.length} <T i18nKey="availability.annual_availability_submissions.submissions" /></Badge>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base"><T i18nKey="availability.annual_availability_submissions.availability_conflicts" /></CardTitle>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {filtered.length ? (
            <Table>
              <TableHeader><TableRow><TableHead className="pl-4"><T i18nKey="common.guide" /></TableHead><TableHead><T i18nKey="common.year" /></TableHead><TableHead><T i18nKey="common.status" /></TableHead><TableHead><T i18nKey="status.submitted" /></TableHead><TableHead><T i18nKey="availability.annual_availability_submissions.conflicts" /></TableHead><TableHead className="pr-4 text-right"><T i18nKey="availability.annual_availability_submissions.action" /></TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.map((submission) => {
                  const guide = guideById.get(submission.guideId)
                  const records = availability.filter((record) => record.guideId === submission.guideId && record.startDateIso <= `${submission.year}-12-31` && record.endDateIso >= `${submission.year}-01-01`)
                  const coverage = getEffectiveAvailabilitySummary(records, submission.year)
                  const conflicts = getAvailabilitySubmissionConflicts(
                    submission.guideId,
                    submission.year,
                    availability,
                    groups
                  )
                  return (
                    <TableRow key={submission.id}>
                      <TableCell className="pl-4 font-medium">{guide?.name ?? t("change_requests.fallback.unknown_guide")}</TableCell>
                      <TableCell>{submission.year}</TableCell>
                      <TableCell><Badge variant="outline">{t(statusLabels[submission.status])}</Badge></TableCell>
                      <TableCell>{formatDateTimeDisplay(submission.submittedAt)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {submission.status === "pending-review"
                          ? `${conflicts.length} ${conflicts.length === 1 ? "conflict" : "conflicts"}${conflicts[0] ? ` · ${conflicts[0].groupCode}` : " · assignment state changed"}`
                          : `${coverage.available} available · ${coverage["not-available"]} unavailable`}
                      </TableCell>
                      <TableCell className="pr-4 text-right"><Button size="sm" variant="outline" onClick={() => { setSelected(submission); setFeedback(null); setReviewMessage("") }}><T i18nKey="availability.annual_availability_submissions.review" /></Button></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground"><T i18nKey="availability.annual_availability_submissions.no_annual_submissions_match_these_filters" /></p>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) { setSelected(null); setFeedback(null); setReviewMessage("") } }}>
        {selected && selectedCoverage ? (
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
            <DialogHeader>
              <DialogTitle>{selectedGuide?.name ?? t("common.guide")} · {selected.year} <T i18nKey="availability.annual_availability_submissions.availability" /></DialogTitle>
              <DialogDescription><T i18nKey="status.submitted" /> {formatDateTimeDisplay(selected.submittedAt)} · {t(statusLabels[selected.status])}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border p-2"><div className="text-xs text-muted-foreground"><T i18nKey="availability.status.available" /></div><strong>{selectedCoverage.available} <T i18nKey="availability.annual_availability_submissions.days" /></strong></div>
              <div className="rounded-lg border p-2"><div className="text-xs text-muted-foreground"><T i18nKey="common.not_available" /></div><strong>{selectedCoverage["not-available"]} <T i18nKey="availability.annual_availability_submissions.days" /></strong></div>
              <div className="rounded-lg border p-2"><div className="text-xs text-muted-foreground"><T i18nKey="availability.status.occupied" /></div><strong>{selectedCoverage["occupied-by-assignment"]} <T i18nKey="availability.annual_availability_submissions.days" /></strong></div>
              <div className="rounded-lg border p-2"><div className="text-xs text-muted-foreground"><T i18nKey="availability.status.not_provided" /></div><strong>{selectedCoverage["not-provided"]} <T i18nKey="availability.annual_availability_submissions.days" /></strong></div>
            </div>
            {selectedCoverage.conflict > 0 ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-900">
                {selectedCoverage.conflict} <T i18nKey="availability.annual_availability_submissions.conflict" /> {selectedCoverage.conflict === 1 ? "day" : "days"}<T i18nKey="availability.annual_availability_submissions.conflict_days_are_counted_separately_from_occupied" />
              </div>
            ) : null}
            <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground"><T i18nKey="availability.annual_availability_submissions.generally_available" /></div>
                {selectedGeneralPeriods.length === 1 ? (
                  <p className="mt-1 font-medium">{formatDateDisplay(selectedGeneralPeriods[0].startDateIso)} → {formatDateDisplay(selectedGeneralPeriods[0].endDateIso)}</p>
                ) : selectedGeneralPeriods.length > 1 ? (
                  <div className="mt-1 space-y-1 text-sm">
                    <p className="text-amber-800"><T i18nKey="availability.annual_availability_submissions.legacy_submission_with_multiple_available_periods" /></p>
                    {selectedGeneralPeriods.map((record) => <p key={record.id}>{formatDateDisplay(record.startDateIso)} → {formatDateDisplay(record.endDateIso)}</p>)}
                  </div>
                ) : <p className="mt-1 text-sm text-muted-foreground"><T i18nKey="availability.annual_availability_submissions.no_general_period_provided" /></p>}
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground"><T i18nKey="availability.annual_availability_submissions.guide_exceptions" /></div>
                {selectedExceptions.length ? <div className="mt-1 space-y-1 text-sm">{selectedExceptions.map((record) => <p key={record.id}>{formatDateDisplay(record.startDateIso)} → {formatDateDisplay(record.endDateIso)}</p>)}</div> : <p className="mt-1 text-sm text-muted-foreground"><T i18nKey="availability.annual_availability_submissions.no_unavailable_exceptions" /></p>}
              </div>
            </div>
            {selected.status === "pending-review" ? (
              <div className="space-y-2 rounded-lg border border-rose-300 bg-rose-50 p-3">
                <div className="font-semibold text-rose-950"><T i18nKey="availability.annual_availability_submissions.availability_conflicts_2" />{selectedConflicts.length})</div>
                {selectedConflicts.length ? selectedConflicts.map((conflict) => {
                  const circuit = circuits.find((item) => item.id === conflict.circuitId)
                  return (
                    <div key={`${conflict.availabilityId}-${conflict.groupId}`} className="grid gap-1 rounded-md border border-rose-200 bg-background px-3 py-2 text-sm sm:grid-cols-2">
                      <div><span className="text-muted-foreground"><T i18nKey="availability.annual_availability_submissions.guide_declared" /></span><br /><T i18nKey="availability.annual_availability_submissions.not_available" /> {formatDateDisplay(conflict.availabilityStartDateIso)} → {formatDateDisplay(conflict.availabilityEndDateIso)}</div>
                      <div><span className="text-muted-foreground"><T i18nKey="availability.annual_availability_submissions.conflicts_with" /></span><br />{conflict.groupCode} · {circuit?.name ?? t("guide_portal.availability.assigned_circuit")}<br />{formatDateDisplay(conflict.assignmentStartDateIso)} → {formatDateDisplay(conflict.assignmentEndDateIso)}</div>
                    </div>
                  )
                }) : (
                  <p className="text-sm text-rose-900"><T i18nKey="availability.annual_availability_submissions.the_assignment_state_changed_after_submission_refresh_before" /></p>
                )}
              </div>
            ) : null}
            <div className="pointer-events-none" aria-label={t("availability.annual_availability_submissions.aria_label_read_only_annual_availability_calendar")}>
              <GuideAvailabilityYearGrid year={selected.year} records={selectedRecords} />
            </div>
            {selected.reviewMessage ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong><T i18nKey="availability.annual_availability_submissions.guide_visible_review_message" /></strong> {selected.reviewMessage}</div> : null}
            {selected.status === "pending-review" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="annual-review-message"><T i18nKey="availability.annual_availability_submissions.message_to_guide_when_requesting_changes" /></Label>
                <Textarea id="annual-review-message" value={reviewMessage} onChange={(event) => setReviewMessage(event.target.value)} placeholder={t("availability.annual_availability_submissions.placeholder_explain_what_needs_correction_before_re_submission")} />
              </div>
            ) : null}
            {feedback ? <p role="status" className={feedback.type === "success" ? "rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800" : "rounded-lg bg-rose-50 p-3 text-sm text-rose-800"}>{feedback.message}</p> : null}
            {!canReview && selected.status === "pending-review" ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{reviewPermissionMessage}</p> : null}
            <DialogFooter>
              {selected.status === "pending-review" ? (
                <>
                  <Button variant="outline" disabled={!canReview || isReviewing} onClick={() => review("request_changes")}><T i18nKey="availability.annual_availability_submissions.request_changes" /></Button>
                  <Button disabled={!canReview || isReviewing} onClick={() => review("approve")}><CheckCircle2 /><T i18nKey="availability.annual_availability_submissions.approve_availability" /></Button>
                </>
              ) : null}
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  )
}
