"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { useCurrentUserAccess } from "@/components/layout/current-user-access-provider"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import { useEffect, useMemo, useState } from "react"
import { Archive, CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { StatePanel } from "@/components/ui/state-panel"
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  useAppSettings,
  usePermissionSource,
  usePreviewRole,
} from "@/components/settings/settings-client-store"
import {
  hasActivePermission,
  resolveActivePermissionKeys,
} from "@/lib/auth/permission-source"
import { onSupabaseAuthStateChange } from "@/lib/auth/supabase-auth"
import {
  archiveChangeRequest,
  updateChangeRequestReviewStatus,
  type InternalChangeRequestReviewStatus,
} from "@/lib/supabase/mutations/change-requests"
import {
  countChangeRequestStatuses,
  getSupabaseChangeRequestInbox,
  type SupabaseChangeRequestInboxItem,
} from "@/lib/supabase/queries/change-requests"
import { formatDateDisplay } from "@/lib/utils/date-format"

type RequestStatusFilter = SupabaseChangeRequestInboxItem["requestStatus"] | "all"
type RequestTypeFilter = SupabaseChangeRequestInboxItem["requestType"] | "all"
type ReviewAction = {
  type: "review"
  status: InternalChangeRequestReviewStatus
}
type ArchiveAction = {
  type: "archive"
}
type ChangeRequestAction = ReviewAction | ArchiveAction

const requestTypeLabels: Record<
  SupabaseChangeRequestInboxItem["requestType"],
  UiTranslationKey
> = {
  group_change: "change_requests.type.group_change",
  availability_change: "change_requests.type.availability_change",
  profile_change: "change_requests.type.profile_change",
  other: "change_requests.type.other",
}

const requestStatusLabels: Record<
  SupabaseChangeRequestInboxItem["requestStatus"],
  UiTranslationKey
> = {
  pending: "status.pending",
  in_progress: "change_requests.status.in_progress",
  approved: "change_requests.status.approved",
  rejected: "change_requests.status.rejected",
  completed: "change_requests.status.completed",
  cancelled: "change_requests.status.cancelled",
}

const reviewActionLabels: Record<InternalChangeRequestReviewStatus, UiTranslationKey> = {
  in_progress: "change_requests.action.in_progress",
  approved: "change_requests.action.approved",
  rejected: "change_requests.action.rejected",
  completed: "change_requests.action.completed",
}

const reviewActionDescriptions: Record<InternalChangeRequestReviewStatus, UiTranslationKey> = {
  in_progress: "change_requests.action.in_progress_help",
  approved: "change_requests.action.approved_help",
  rejected: "change_requests.action.rejected_help",
  completed: "change_requests.action.completed_help",
}

const statusTransitions: Record<
  SupabaseChangeRequestInboxItem["requestStatus"],
  InternalChangeRequestReviewStatus[]
> = {
  pending: ["in_progress", "approved", "rejected", "completed"],
  in_progress: ["approved", "rejected", "completed"],
  approved: ["completed"],
  rejected: [],
  completed: [],
  cancelled: [],
}

const requestStatusStyles: Record<
  SupabaseChangeRequestInboxItem["requestStatus"],
  string
> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  in_progress: "border-blue-200 bg-blue-50 text-blue-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-red-200 bg-red-50 text-red-800",
  completed: "border-slate-200 bg-slate-100 text-slate-700",
  cancelled: "border-zinc-200 bg-zinc-100 text-zinc-700",
}

const requestStatusTones: Record<
  SupabaseChangeRequestInboxItem["requestStatus"],
  StatusTone
> = {
  pending: "warning",
  in_progress: "info",
  approved: "success",
  rejected: "destructive",
  completed: "neutral",
  cancelled: "neutral",
}

function getRequestRowClassName(
  status: SupabaseChangeRequestInboxItem["requestStatus"]
) {
  if (status === "pending") {
    return "bg-amber-50/35"
  }

  if (status === "in_progress") {
    return "bg-blue-50/35"
  }

  return ""
}

function getRequestSearchText(request: SupabaseChangeRequestInboxItem) {
  return [
    request.guideName,
    request.guideEmail,
    request.guideId,
    request.groupCode,
    request.circuitName,
    request.circuitCode,
    request.message,
    request.internalNotes,
    request.decisionReason,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function filterRequests({
  requests,
  status,
  requestType,
  guideId,
  search,
}: {
  requests: SupabaseChangeRequestInboxItem[]
  status: RequestStatusFilter
  requestType: RequestTypeFilter
  guideId: string
  search: string
}) {
  const normalizedSearch = search.trim().toLowerCase()

  return requests.filter((request) => {
    const matchesStatus =
      status === "all" || request.requestStatus === status
    const matchesType =
      requestType === "all" || request.requestType === requestType
    const matchesGuide = guideId === "all" || request.guideId === guideId
    const matchesSearch =
      !normalizedSearch ||
      getRequestSearchText(request).includes(normalizedSearch)

    return matchesStatus && matchesType && matchesGuide && matchesSearch
  })
}

function getReviewActionsForRequest(request: SupabaseChangeRequestInboxItem) {
  return statusTransitions[request.requestStatus]
}

function getActionTitle(action: ChangeRequestAction) {
  if (action.type === "archive") {
    return "change_requests.action.archive"
  }

  return reviewActionLabels[action.status]
}

function getActionDescription(action: ChangeRequestAction) {
  if (action.type === "archive") {
    return "change_requests.action.archive_help"
  }

  return reviewActionDescriptions[action.status]
}

export function ChangeRequestsModule() {
  const { t } = useI18n()
  const appSettings = useAppSettings()
  const previewRole = usePreviewRole()
  const permissionSource = usePermissionSource()
  const [requests, setRequests] = useState<SupabaseChangeRequestInboxItem[]>([])
  const { access: authAccess } = useCurrentUserAccess()
  const [status, setStatus] = useState<RequestStatusFilter>("all")
  const [requestType, setRequestType] = useState<RequestTypeFilter>("all")
  const [guideId, setGuideId] = useState("all")
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [warningMessage, setWarningMessage] = useState("")
  const [selectedRequest, setSelectedRequest] =
    useState<SupabaseChangeRequestInboxItem | null>(null)
  const [pendingAction, setPendingAction] =
    useState<ChangeRequestAction | null>(null)
  const [reviewNote, setReviewNote] = useState("")
  const activePermissionResolution = resolveActivePermissionKeys({
    permissionSource,
    appSettings,
    previewRole,
    authAccess,
  })
  const activePermissionKeys = activePermissionResolution.activePermissionKeys
  const canReviewChangeRequests = hasActivePermission(
    activePermissionKeys,
    "change_requests.review"
  )
  const canArchiveChangeRequests = hasActivePermission(
    activePermissionKeys,
    "change_requests.archive"
  )
  const guideOptions = useMemo(
    () =>
      Array.from(
        new Map(
          requests.map((request) => [
            request.guideId,
            {
              id: request.guideId,
              label:
                request.guideName ??
                request.guideEmail ??
                request.guideId,
            },
          ])
        ).values()
      ).sort((left, right) => left.label.localeCompare(right.label)),
    [requests]
  )
  const filteredRequests = useMemo(
    () =>
      filterRequests({
        requests,
        status,
        requestType,
        guideId,
        search,
      }),
    [guideId, requestType, requests, search, status]
  )
  const requestStatusCounts = useMemo(
    () =>
      countChangeRequestStatuses(
        requests.map((request) => request.requestStatus)
      ),
    [requests]
  )

  async function loadRequests({ preserveSuccess = false } = {}) {
    setIsLoading(true)
    setErrorMessage("")
    if (!preserveSuccess) {
      setSuccessMessage("")
    }
    setWarningMessage("")

    const result = await getSupabaseChangeRequestInbox()

    setRequests(result.data)
    setErrorMessage(result.error ?? "")
    setWarningMessage(result.warning ?? "")
    setIsLoading(false)
  }

  useEffect(() => {
    let isMounted = true

    async function loadIfMounted() {
      setIsLoading(true)
      setErrorMessage("")
      setSuccessMessage("")
      setWarningMessage("")

      const result = await getSupabaseChangeRequestInbox()

      if (!isMounted) {
        return
      }

      setRequests(result.data)
      setErrorMessage(result.error ?? "")
      setWarningMessage(result.warning ?? "")
      setIsLoading(false)
    }

    void loadIfMounted()

    const unsubscribe = onSupabaseAuthStateChange(() => {
      void loadIfMounted()
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  function openActionDialog(
    request: SupabaseChangeRequestInboxItem,
    action: ChangeRequestAction
  ) {
    setSelectedRequest(request)
    setPendingAction(action)
    setReviewNote("")
    setErrorMessage("")
    setSuccessMessage("")
  }

  function closeActionDialog() {
    if (isSubmitting) {
      return
    }

    setSelectedRequest(null)
    setPendingAction(null)
    setReviewNote("")
  }

  async function handleSubmitAction() {
    if (!selectedRequest || !pendingAction) {
      return
    }

    const note = reviewNote.trim()

    if (pendingAction.type === "review" && pendingAction.status === "rejected" && !note) {
      setErrorMessage(
        "Enter a rejection reason. It may be shown to the guide as the decision reason."
      )
      return
    }

    setIsSubmitting(true)
    setErrorMessage("")
    setSuccessMessage("")

    const result =
      pendingAction.type === "archive"
        ? await archiveChangeRequest({ requestId: selectedRequest.id })
        : await updateChangeRequestReviewStatus({
            requestId: selectedRequest.id,
            status: pendingAction.status,
            note,
          })

    if (!result.success) {
      setErrorMessage(result.error ?? "Change request update failed.")
      setIsSubmitting(false)
      return
    }

    setSuccessMessage(
      pendingAction.type === "archive"
        ? "Change request archived."
        : "Change request review status updated."
    )
    setSelectedRequest(null)
    setPendingAction(null)
    setReviewNote("")
    setIsSubmitting(false)
    await loadRequests({ preserveSuccess: true })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle><T i18nKey="change_requests.change_requests_module.change_request_inbox" /></CardTitle>
              <CardDescription>
                <T i18nKey="change_requests.change_requests_module.operational_view_of_guide_submitted_requests_review_actions" />
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={() => void loadRequests()}
            >
              <RefreshCw className="size-4" />
              <T i18nKey="common.refresh" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_220px]">
            <Input
              value={search}
              placeholder={t("change_requests.change_requests_module.placeholder_search_guide_group_circuit_or_message")}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as RequestStatusFilter)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("common.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><T i18nKey="change_requests.change_requests_module.all_statuses" /></SelectItem>
                <SelectItem value="pending"><T i18nKey="status.pending" /></SelectItem>
                <SelectItem value="in_progress"><T i18nKey="change_requests.change_requests_module.in_progress" /></SelectItem>
                <SelectItem value="approved"><T i18nKey="status.approved" /></SelectItem>
                <SelectItem value="rejected"><T i18nKey="change_requests.change_requests_module.rejected" /></SelectItem>
                <SelectItem value="completed"><T i18nKey="change_requests.change_requests_module.completed" /></SelectItem>
                <SelectItem value="cancelled"><T i18nKey="change_requests.change_requests_module.cancelled" /></SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={requestType}
              onValueChange={(value) =>
                setRequestType(value as RequestTypeFilter)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("change_requests.change_requests_module.placeholder_request_type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><T i18nKey="change_requests.change_requests_module.all_types" /></SelectItem>
                <SelectItem value="group_change">
                  <T i18nKey="change_requests.change_requests_module.group_change_tour_issue" />
                </SelectItem>
                <SelectItem value="availability_change">
                  <T i18nKey="change_requests.change_requests_module.availability_change" />
                </SelectItem>
                <SelectItem value="profile_change">
                  <T i18nKey="change_requests.change_requests_module.profile_information_update" />
                </SelectItem>
                <SelectItem value="other"><T i18nKey="change_requests.change_requests_module.other_request" /></SelectItem>
              </SelectContent>
            </Select>
            <Select value={guideId} onValueChange={setGuideId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("common.guide")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><T i18nKey="change_requests.change_requests_module.all_guides" /></SelectItem>
                {guideOptions.map((guide) => (
                  <SelectItem key={guide.id} value={guide.id}>
                    {guide.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            <T i18nKey="change_requests.change_requests_module.approve_status_only_marks_the_request_record_as" />
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {(
              [
                "pending",
                "in_progress",
                "approved",
                "rejected",
                "completed",
              ] as const
            ).map((statusKey) => (
              <div
                key={statusKey}
                className={`rounded-md border px-3 py-2 ${requestStatusStyles[statusKey]}`}
              >
                <div className="text-xs font-medium">
                  {t(requestStatusLabels[statusKey])}
                </div>
                <div className="text-2xl font-semibold">
                  {requestStatusCounts[statusKey]}
                </div>
              </div>
            ))}
          </div>

          {errorMessage ? (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          {warningMessage ? (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {warningMessage}
            </div>
          ) : null}

          <div className="text-sm text-muted-foreground">
            {isLoading
              ? "Loading change requests..."
              : `${filteredRequests.length} of ${requests.length} requests shown`}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4"><T i18nKey="change_requests.change_requests_module.requested" /></TableHead>
                <TableHead><T i18nKey="common.guide" /></TableHead>
                <TableHead><T i18nKey="common.group" /></TableHead>
                <TableHead><T i18nKey="change_requests.change_requests_module.type" /></TableHead>
                <TableHead><T i18nKey="common.status" /></TableHead>
                <TableHead><T i18nKey="change_requests.change_requests_module.message" /></TableHead>
                <TableHead><T i18nKey="change_requests.change_requests_module.linked_records" /></TableHead>
                <TableHead className="pr-4 text-right"><T i18nKey="common.actions" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="p-4"
                  >
                    <StatePanel
                      compact
                      title={t("change_requests.change_requests_module.title_no_matching_change_requests")}
                      description={t("change_requests.change_requests_module.description_adjust_the_filters_to_review_a_different_set")}
                    />
                  </TableCell>
                </TableRow>
              ) : null}
              {filteredRequests.map((request) => (
                <TableRow
                  key={request.id}
                  className={getRequestRowClassName(request.requestStatus)}
                >
                  <TableCell className="pl-4 align-top">
                    <div>{formatDateDisplay(request.requestedAt)}</div>
                    <div className="text-xs text-muted-foreground">
                      <T i18nKey="change_requests.change_requests_module.created" /> {formatDateDisplay(request.createdAt)}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="font-medium">
                      {request.guideName ?? t("change_requests.fallback.unknown_guide")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {request.guideEmail ?? request.guideId}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="font-medium">
                      {request.groupCode ?? t("change_requests.fallback.no_group")}
                    </div>
                    {request.circuitName ? (
                      <div className="text-xs text-muted-foreground">
                        {request.circuitName}
                        {request.circuitCode ? ` (${request.circuitCode})` : ""}
                      </div>
                    ) : null}
                    {request.groupStartDate && request.groupEndDate ? (
                      <div className="text-xs text-muted-foreground">
                        {formatDateDisplay(request.groupStartDate)} -{" "}
                        {formatDateDisplay(request.groupEndDate)}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top">
                    {t(requestTypeLabels[request.requestType])}
                  </TableCell>
                  <TableCell className="align-top">
                    <StatusBadge tone={requestStatusTones[request.requestStatus]}>
                      {t(requestStatusLabels[request.requestStatus])}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="max-w-md align-top">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">
                        <T i18nKey="change_requests.change_requests_module.guide_message" />
                      </div>
                      <div className="line-clamp-3">
                        {request.message || "No message provided."}
                      </div>
                    </div>
                    {request.decisionReason ? (
                      <div className="mt-2 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                        <span className="font-medium"><T i18nKey="change_requests.change_requests_module.decision_reason" /></span>{" "}
                        {request.decisionReason}
                      </div>
                    ) : null}
                    {request.internalNotes ? (
                      <div className="mt-2 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground">
                        <span className="font-medium"><T i18nKey="change_requests.change_requests_module.internal_notes" /></span>{" "}
                        {request.internalNotes}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top text-xs text-muted-foreground">
                    <div><T i18nKey="change_requests.change_requests_module.request" /> {request.id}</div>
                    {request.assignmentId ? (
                      <div><T i18nKey="change_requests.change_requests_module.assignment" /> {request.assignmentId}</div>
                    ) : null}
                    {request.availabilityId ? (
                      <div><T i18nKey="change_requests.change_requests_module.availability" /> {request.availabilityId}</div>
                    ) : null}
                    {request.reviewedAt ? (
                      <div><T i18nKey="change_requests.change_requests_module.reviewed" /> {formatDateDisplay(request.reviewedAt)}</div>
                    ) : null}
                    {request.completedAt ? (
                      <div>
                        <T i18nKey="change_requests.change_requests_module.completed_2" /> {formatDateDisplay(request.completedAt)}
                      </div>
                    ) : null}
                    {request.cancelledAt ? (
                      <div>
                        <T i18nKey="change_requests.change_requests_module.cancelled_2" /> {formatDateDisplay(request.cancelledAt)}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="pr-4 align-top">
                    <div className="flex flex-wrap justify-end gap-2">
                      {canReviewChangeRequests
                        ? getReviewActionsForRequest(request).map((targetStatus) => (
                            <Button
                              key={targetStatus}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                openActionDialog(request, {
                                  type: "review",
                                  status: targetStatus,
                                })
                              }
                            >
                              {targetStatus === "in_progress" ? (
                                <Clock3 className="size-4" />
                              ) : targetStatus === "rejected" ? (
                                <XCircle className="size-4" />
                              ) : (
                                <CheckCircle2 className="size-4" />
                              )}
                              {t(reviewActionLabels[targetStatus])}
                            </Button>
                          ))
                        : null}
                      {canArchiveChangeRequests ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            openActionDialog(request, { type: "archive" })
                          }
                        >
                          <Archive className="size-4" />
                          <T i18nKey="change_requests.change_requests_module.archive" />
                        </Button>
                      ) : null}
                      {!canReviewChangeRequests && !canArchiveChangeRequests ? (
                        <span className="text-xs text-muted-foreground">
                          <T i18nKey="change_requests.change_requests_module.read_only" />
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={Boolean(pendingAction)} onOpenChange={closeActionDialog}>
        <DialogContent className="sm:max-w-lg">
          {pendingAction ? (
            <>
              <DialogHeader>
                <DialogTitle>{t(getActionTitle(pendingAction))}</DialogTitle>
                <DialogDescription>
                  {t(getActionDescription(pendingAction))}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {selectedRequest ? (
                  <div className="rounded-md border bg-muted/40 p-3 text-sm">
                    <div className="font-medium">
                      {selectedRequest.groupCode ?? t("change_requests.fallback.no_group")} -{" "}
                      {t(requestTypeLabels[selectedRequest.requestType])}
                    </div>
                    <div className="text-muted-foreground">
                      <T i18nKey="change_requests.change_requests_module.current_status" />{" "}
                      {t(requestStatusLabels[selectedRequest.requestStatus])}
                    </div>
                  </div>
                ) : null}
                {pendingAction.type === "review" ? (
                  <div className="space-y-2">
                    <label
                      htmlFor="change-request-review-note"
                      className="text-sm font-medium"
                    >
                      {pendingAction.status === "rejected"
                        ? t("change_requests.reason.rejection")
                        : pendingAction.status === "approved" ||
                          pendingAction.status === "completed"
                        ? t("change_requests.reason.decision")
                        : t("change_requests.reason.internal_note")}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {pendingAction.status === "approved"
                        ? "This is visible as a status-only approval and does not update assignments, groups, or availability."
                        : pendingAction.status === "rejected" ||
                          pendingAction.status === "completed"
                        ? "This can be shown to the guide as the operations response."
                        : "This note stays in the internal inbox and is not shown in the Guide Portal."}
                    </p>
                    <Textarea
                      id="change-request-review-note"
                      value={reviewNote}
                      placeholder={
                        pendingAction.status === "approved"
                          ? "Optional decision reason for the status-only approval."
                          : pendingAction.status === "rejected"
                          ? "Required. Explain why the request is rejected."
                          : pendingAction.status === "completed"
                          ? "Optional completion note for the guide."
                          : "Optional internal review note."
                      }
                      onChange={(event) => setReviewNote(event.target.value)}
                    />
                  </div>
                ) : (
                  <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <T i18nKey="change_requests.change_requests_module.archiving_removes_this_request_from_the_active_inbox" />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={closeActionDialog}
                >
                  <T i18nKey="common.cancel" />
                </Button>
                <Button
                  type="button"
                  variant={pendingAction.type === "archive" ? "destructive" : "default"}
                  disabled={isSubmitting}
                  onClick={() => void handleSubmitAction()}
                >
                  {isSubmitting ? t("planning.dialog.saving") : t(getActionTitle(pendingAction))}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
