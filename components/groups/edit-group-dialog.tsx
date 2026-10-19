"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { FormEvent, useMemo, useState } from "react"
import { AlertTriangle } from "lucide-react"

import { DatePickerInput } from "@/components/common/date-picker-input"
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/common/searchable-select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type {
  Circuit,
  ConfirmationStatus,
  GroupStatus,
  Guide,
  GuideAvailability,
  TourGroup,
} from "@/lib/types/domain"
import {
  type AssignableGuideResult,
  getAssignableGuidesForDates,
  getGuideAssignmentConflicts,
  getGuideAvailabilityResult,
} from "@/lib/utils/availability-conflicts"
import { formatDateDisplay } from "@/lib/utils/date-format"
import { groupStatusOptions } from "@/lib/utils/group-status"

type EditGroupDialogProps = {
  open: boolean
  group: TourGroup | null
  circuits: Circuit[]
  guides: Guide[]
  existingGroups: TourGroup[]
  availability: GuideAvailability[]
  canAssignGuide?: boolean
  canChangeGuide?: boolean
  canConfirmGuide?: boolean
  helperText?: string
  onOpenChange: (open: boolean) => void
  onSaveGroup: (group: TourGroup) => Promise<string | null> | string | null
}

type FormValues = {
  groupCode: string
  circuitId: string
  requiredLanguage: string
  startDate: string
  endDate: string
  guideId: string
  groupStatus: GroupStatus | ""
  confirmationStatus: ConfirmationStatus
  markGuideConfirmed: boolean
  internalNotes: string
}

type FormErrors = Partial<Record<keyof FormValues, string>>

const noGuideValue = "__without-guide"
const noRequiredLanguageValue = "__any-language"
const requiredLanguageOptions = ["EN", "FR", "ES", "TR"]

const confirmationStatusOptions: {
  value: ConfirmationStatus
  labelKey: "status.pending_confirmation" | "status.confirmed"
}[] = [
  { value: "pending-confirmation", labelKey: "status.pending_confirmation" },
  { value: "confirmed", labelKey: "status.confirmed" },
]

function getInitialValues(group: TourGroup | null): FormValues {
  return {
    groupCode: group?.code ?? "",
    circuitId: group?.circuitId ?? "",
    requiredLanguage:
      group?.requiredLanguage ?? group?.language ?? noRequiredLanguageValue,
    startDate: group?.startDateIso ?? "",
    endDate: group?.endDateIso ?? "",
    guideId: group?.guideId ?? noGuideValue,
    groupStatus: group?.groupStatus ?? "",
    confirmationStatus:
      group?.guideId === null
        ? "not-required"
        : group?.confirmationStatus ?? "pending-confirmation",
    markGuideConfirmed: group?.confirmationStatus === "confirmed",
    internalNotes: group?.internalNotes ?? "",
  }
}

export function EditGroupDialog({
  open,
  group,
  circuits,
  guides,
  existingGroups,
  availability,
  canAssignGuide = true,
  canChangeGuide = true,
  canConfirmGuide = true,
  helperText = "",
  onOpenChange,
  onSaveGroup,
}: EditGroupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {group ? (
        <EditGroupForm
          key={group.id}
          group={group}
          circuits={circuits}
          guides={guides}
          existingGroups={existingGroups}
          availability={availability}
          canAssignGuide={canAssignGuide}
          canChangeGuide={canChangeGuide}
          canConfirmGuide={canConfirmGuide}
          helperText={helperText}
          onCancel={() => onOpenChange(false)}
          onSaveGroup={onSaveGroup}
        />
      ) : null}
    </Dialog>
  )
}

type EditGroupFormProps = {
  group: TourGroup
  circuits: Circuit[]
  guides: Guide[]
  existingGroups: TourGroup[]
  availability: GuideAvailability[]
  canAssignGuide: boolean
  canChangeGuide: boolean
  canConfirmGuide: boolean
  helperText: string
  onCancel: () => void
  onSaveGroup: (group: TourGroup) => Promise<string | null> | string | null
}

function EditGroupForm({
  group,
  circuits,
  guides,
  existingGroups,
  availability,
  canAssignGuide,
  canChangeGuide,
  canConfirmGuide,
  helperText,
  onCancel,
  onSaveGroup,
}: EditGroupFormProps) {
  const { t } = useI18n()
  const [values, setValues] = useState<FormValues>(() =>
    getInitialValues(group)
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showUnavailableGuides, setShowUnavailableGuides] = useState(false)
  const hasSelectedGuide = values.guideId !== noGuideValue
  const guideChanged = values.guideId !== (group.guideId ?? noGuideValue)
  const datesChanged =
    values.startDate !== group.startDateIso ||
    values.endDate !== group.endDateIso
  const assignedScheduleChanged = Boolean(group.guideId) &&
    (datesChanged || values.circuitId !== group.circuitId)
  const manualAvailability = useMemo(
    () =>
      availability.filter(
        (record) => record.status !== "occupied-by-assignment"
      ),
    [availability]
  )
  const hasValidDateRange =
    Boolean(values.startDate) &&
    Boolean(values.endDate) &&
    values.endDate >= values.startDate
  const guideAssignmentWarnings = useMemo(() => {
    if (!hasSelectedGuide || !values.startDate || !values.endDate) {
      return []
    }

    return getGuideAssignmentConflicts(
      values.guideId,
      values.startDate,
      values.endDate,
      existingGroups,
      { excludeGroupId: group.id }
    ).filter((conflict) => conflict.type === "boundary")
  }, [
    existingGroups,
    group.id,
    hasSelectedGuide,
    values.endDate,
    values.guideId,
    values.startDate,
  ])
  const availabilityWarning = useMemo(() => {
    if (!hasSelectedGuide || !values.startDate || !values.endDate) {
      return null
    }

    const availabilityResult = getGuideAvailabilityResult(
      values.guideId,
      values.startDate,
      values.endDate,
      manualAvailability
    )

    return availabilityResult.status === "needs-review"
      ? "No availability loaded for this guide and date range. Assignment should be reviewed."
      : null
  }, [
    hasSelectedGuide,
    manualAvailability,
    values.endDate,
    values.guideId,
    values.startDate,
  ])
  const circuitOptions: SearchableSelectOption[] = circuits.map((circuit) => ({
    value: circuit.id,
    label: circuit.name,
  }))
  const assignableGuideResults = useMemo(
    () =>
      getAssignableGuidesForDates(
        guides,
        existingGroups,
        manualAvailability,
        values.startDate,
        values.endDate,
        {
          excludeGroupId: group.id,
          showUnavailable: showUnavailableGuides,
        }
      ),
    [
      existingGroups,
      group.id,
      guides,
      manualAvailability,
      showUnavailableGuides,
      values.endDate,
      values.startDate,
    ]
  )
  const guideOptions: SearchableSelectOption[] = assignableGuideResults.map(
    (result) => ({
      value: result.guide.id,
      label:
        result.status === "needs-review"
          ? `${result.guide.name} (Needs review)`
          : result.guide.name,
      description: getGuideOptionDescription(result),
      searchValue: `${result.guide.name} ${result.guide.email} ${result.reason}`,
      disabled:
        result.status === "not-available" ||
        result.status === "occupied" ||
        result.status === "inactive",
    })
  )

  const existingCodes = useMemo(
    () =>
      new Map(
        existingGroups.map((existingGroup) => [
          existingGroup.code.toLowerCase(),
          existingGroup.id,
        ])
      ),
    [existingGroups]
  )

  function updateValue<Key extends keyof FormValues>(
    key: Key,
    value: FormValues[Key]
  ) {
    setValues((currentValues) => {
      const nextValues = {
        ...currentValues,
        [key]: value,
      }

      if (key === "guideId") {
        if (value === noGuideValue) {
          nextValues.confirmationStatus = "not-required"
          nextValues.markGuideConfirmed = false
        } else if (value !== (group?.guideId ?? noGuideValue)) {
          nextValues.confirmationStatus = "pending-confirmation"
          nextValues.markGuideConfirmed = false
        }
      }

      if (key === "confirmationStatus") {
        nextValues.markGuideConfirmed = value === "confirmed"
      }

      if (key === "markGuideConfirmed") {
        nextValues.confirmationStatus =
          value === true ? "confirmed" : "pending-confirmation"
      }

      return nextValues
    })
    setErrors((currentErrors) => ({ ...currentErrors, [key]: undefined }))
    setFormError(null)
  }

  function validateForm() {
    const nextErrors: FormErrors = {}
    if (values.groupStatus && values.groupStatus !== group.groupStatus) {
      const initial = getInitialValues(group)
      const statusOnly = { ...values, groupStatus: initial.groupStatus }
      if (JSON.stringify(statusOnly) !== JSON.stringify(initial)) {
        nextErrors.groupStatus = "Save the status change separately from other group edits."
      }
      setErrors(nextErrors)
      return Object.keys(nextErrors).length === 0
    }
    if (assignedScheduleChanged) {
      nextErrors.startDate = t("groups.error.assigned_schedule_edit")
      setErrors(nextErrors)
      return false
    }
    const normalizedCode = values.groupCode.trim().toLowerCase()
    const duplicateGroupId = existingCodes.get(normalizedCode)

    if (!values.groupCode.trim()) {
      nextErrors.groupCode = "Group code is required."
    } else if (duplicateGroupId && duplicateGroupId !== group?.id) {
      nextErrors.groupCode = "This group code already exists."
    }

    if (!values.circuitId) {
      nextErrors.circuitId = "Circuit is required."
    }

    if (!values.startDate) {
      nextErrors.startDate = "Start date is required."
    }

    if (!values.endDate) {
      nextErrors.endDate = "End date is required."
    } else if (values.startDate && values.endDate < values.startDate) {
      nextErrors.endDate = "End date cannot be before start date."
    }

    if (!values.groupStatus) {
      nextErrors.groupStatus = "Group status is required."
    }

    if (
      values.guideId !== noGuideValue &&
      values.startDate &&
      values.endDate &&
      values.endDate >= values.startDate
    ) {
      const assignmentConflicts = getGuideAssignmentConflicts(
        values.guideId,
        values.startDate,
        values.endDate,
        existingGroups,
        { excludeGroupId: group.id }
      ).filter((conflict) => conflict.type === "overlap")
      const availabilityResult = getGuideAvailabilityResult(
        values.guideId,
        values.startDate,
        values.endDate,
        manualAvailability
      )

      if (assignmentConflicts.length > 0) {
        const conflictGroup = assignmentConflicts[0].group
        nextErrors.guideId = `Guide is already assigned to ${conflictGroup.code} (${formatDateDisplay(conflictGroup.startDateIso)} - ${formatDateDisplay(conflictGroup.endDateIso)}).`
      } else if (availabilityResult.status === "blocked") {
        const conflict = availabilityResult.conflicts[0].record
        nextErrors.guideId = `Guide is not available for this date range (${formatDateDisplay(conflict.startDateIso)} - ${formatDateDisplay(conflict.endDateIso)}).`
      }
    }

    setErrors(nextErrors)

    return Object.keys(nextErrors).length === 0
  }

  function getGuideOptionDescription(result: AssignableGuideResult) {
    if (result.status === "available") {
      return undefined
    }

    if (result.status === "needs-review") {
      return t("status.needs_review")
    }

    const assignmentConflict = result.assignmentConflicts.find(
      (conflict) => conflict.type === "overlap"
    )

    if (assignmentConflict) {
      return t("groups.occupied_by_group", { code: assignmentConflict.group.code, start: formatDateDisplay(assignmentConflict.group.startDateIso), end: formatDateDisplay(assignmentConflict.group.endDateIso) })
    }

    const availabilityConflict = result.availabilityResult.conflicts[0]?.record

    if (availabilityConflict) {
      return t("groups.availability_conflict", { status: t(result.status === "not-available" ? "availability.status.not_available" : "availability.status.occupied"), start: formatDateDisplay(availabilityConflict.startDateIso), end: formatDateDisplay(availabilityConflict.endDateIso) })
    }

    return result.reason
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!validateForm()) {
      return
    }

    const guideId = values.guideId === noGuideValue ? null : values.guideId
    const groupStatus = values.groupStatus as GroupStatus
    const confirmationStatus: ConfirmationStatus = guideId
      ? values.confirmationStatus === "not-required"
        ? "pending-confirmation"
        : values.confirmationStatus
      : "not-required"

    setIsSaving(true)
    setFormError(null)

    const saveError = await onSaveGroup(groupStatus !== group.groupStatus ? {
      ...group,
      groupStatus,
    } : {
      ...group,
      code: values.groupCode.trim(),
      circuitId: values.circuitId,
      startDate: formatDateDisplay(values.startDate),
      endDate: formatDateDisplay(values.endDate),
      startDateIso: values.startDate,
      endDateIso: values.endDate,
      guideId,
      groupStatus,
      assignmentStatus: guideId ? "assigned" : "without-guide",
      confirmationStatus,
      requiredLanguage:
        values.requiredLanguage === noRequiredLanguageValue
          ? null
          : values.requiredLanguage,
      internalNotes: values.internalNotes.trim() || undefined,
    })

    setIsSaving(false)

    if (saveError) {
      setFormError(saveError)
      return
    }

    onCancel()
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle><T i18nKey="groups.edit_group_dialog.edit_group" /></DialogTitle>
            <DialogDescription className={helperText ? undefined : "sr-only"}>
              {helperText || t("groups.edit_group_dialog.edit_group")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-group-code"><T i18nKey="groups.create_group_dialog.group_code" /></Label>
              <Input
                id="edit-group-code"
                value={values.groupCode}
                onChange={(event) =>
                  updateValue("groupCode", event.target.value)
                }
                aria-invalid={Boolean(errors.groupCode)}
              />
              {errors.groupCode ? (
                <p className="text-xs text-red-700">{errors.groupCode}</p>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label><T i18nKey="common.circuit" /></Label>
              <SearchableSelect
                value={values.circuitId}
                options={circuitOptions}
                placeholder={t("groups.create_group_dialog.placeholder_select_circuit")}
                searchPlaceholder={t("common.search_circuits")}
                emptyText={t("groups.create_group_dialog.empty_text_no_circuit_found")}
                aria-label={t("common.circuit")}
                onValueChange={(value) => updateValue("circuitId", value)}
                aria-invalid={Boolean(errors.circuitId)}
              />
              {errors.circuitId ? (
                <p className="text-xs text-red-700">{errors.circuitId}</p>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label><T i18nKey="groups.create_group_dialog.required_language" /></Label>
              <Select
                value={values.requiredLanguage}
                onValueChange={(value) =>
                  updateValue("requiredLanguage", value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={noRequiredLanguageValue}>
                    <T i18nKey="groups.create_group_dialog.no_language_requirement" />
                  </SelectItem>
                  {requiredLanguageOptions.map((language) => (
                    <SelectItem key={language} value={language}>
                      {language}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                <T i18nKey="groups.create_group_dialog.leave_empty_if_any_guide_language_is_acceptable" />
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-start-date"><T i18nKey="common.start_date" /></Label>
              <DatePickerInput
                id="edit-start-date"
                value={values.startDate}
                onChange={(value) => updateValue("startDate", value)}
                aria-invalid={Boolean(errors.startDate)}
              />
              {errors.startDate ? (
                <p className="text-xs text-red-700">{errors.startDate}</p>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-end-date"><T i18nKey="common.end_date" /></Label>
              <DatePickerInput
                id="edit-end-date"
                value={values.endDate}
                onChange={(value) => updateValue("endDate", value)}
                aria-invalid={Boolean(errors.endDate)}
              />
              {errors.endDate ? (
                <p className="text-xs text-red-700">{errors.endDate}</p>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label><T i18nKey="groups.create_group_dialog.assigned_guide" /></Label>
              <SearchableSelect
                disabled={group.guideId ? !canChangeGuide : !canAssignGuide}
                value={values.guideId}
                options={guideOptions}
                placeholder={t("status.without_guide")}
                searchPlaceholder={t("common.search_guides")}
                emptyText={t("groups.create_group_dialog.empty_text_no_guide_found")}
                clearValue={noGuideValue}
                clearLabel="Without guide"
                onValueChange={(value) => updateValue("guideId", value)}
                aria-invalid={Boolean(errors.guideId)}
              />
              {errors.guideId ? (
                <p className="text-xs text-red-700">{errors.guideId}</p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {hasValidDateRange
                    ? "Only guides available for the selected dates are shown. Guides without loaded availability may require review."
                    : "Select group dates to filter guides by availability."}
                </span>
                {hasValidDateRange ? (
                  <Button
                    type="button"
                    variant={showUnavailableGuides ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setShowUnavailableGuides((currentValue) => !currentValue)
                    }
                  >
                    <T i18nKey="groups.create_group_dialog.show_unavailable_guides" />
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label><T i18nKey="groups.edit_group_dialog.group_status" /></Label>
              <Select
                value={values.groupStatus}
                onValueChange={(value) =>
                  updateValue("groupStatus", value as GroupStatus)
                }
              >
                <SelectTrigger
                  aria-invalid={Boolean(errors.groupStatus)}
                  className="w-full"
                >
                  <SelectValue placeholder={t("groups.edit_group_dialog.placeholder_select_group_status")} />
                </SelectTrigger>
                <SelectContent>
                  {groupStatusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {t(status.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.groupStatus ? (
                <p className="text-xs text-red-700">{errors.groupStatus}</p>
              ) : null}
            </div>

            <div className="grid gap-1.5 md:col-span-2">
              <Label><T i18nKey="groups.edit_group_dialog.confirmation_status" /></Label>
              <Select
                value={values.confirmationStatus}
                disabled={!hasSelectedGuide || !canConfirmGuide}
                onValueChange={(value) =>
                  updateValue(
                    "confirmationStatus",
                    value as ConfirmationStatus
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hasSelectedGuide ? (
                    confirmationStatusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {t(status.labelKey)}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="not-required"><T i18nKey="groups.edit_group_dialog.not_required" /></SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {guideChanged && hasSelectedGuide ? (
              <Label className="flex items-center gap-2 rounded-lg border p-3 md:col-span-2">
                <Checkbox
                  disabled={!canConfirmGuide}
                  checked={values.markGuideConfirmed}
                  onCheckedChange={(checked) =>
                    updateValue("markGuideConfirmed", checked === true)
                  }
                />
                <T i18nKey="groups.edit_group_dialog.mark_the_new_guide_as_confirmed" />
              </Label>
            ) : null}

            <div className="grid gap-1.5 md:col-span-2">
              <Label htmlFor="edit-internal-notes"><T i18nKey="groups.edit_group_dialog.internal_notes" /></Label>
              <Textarea
                id="edit-internal-notes"
                value={values.internalNotes}
                onChange={(event) =>
                  updateValue("internalNotes", event.target.value)
                }
                rows={3}
              />
            </div>
          </div>

          {assignedScheduleChanged ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <T i18nKey="groups.error.assigned_schedule_edit" />
            </div>
          ) : null}

          {guideAssignmentWarnings.length > 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <T i18nKey="groups.create_group_dialog.this_guide_finishes_another_tour_on_the_same" />
            </div>
          ) : null}

          {availabilityWarning ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {availabilityWarning}
            </div>
          ) : null}

          {values.groupStatus === "cxl" ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <T i18nKey="groups.edit_group_dialog.if_assigned_saving_cxl_removes_the_current_assignment" />
            </div>
          ) : null}

          {values.groupStatus === "fusionado" ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <T i18nKey="groups.edit_group_dialog.if_assigned_saving_fusionado_removes_the_current_assignment" />
            </div>
          ) : null}

          {formError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {formError}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
            >
              <T i18nKey="common.cancel" />
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t("groups.form.saving") : t("groups.form.save_changes")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
  )
}
