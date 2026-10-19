"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { FormEvent, useMemo, useState } from "react"
import { Plus } from "lucide-react"

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
  DialogTrigger,
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
import type {
  Circuit,
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

type CreateGroupDialogProps = {
  circuits: Circuit[]
  guides: Guide[]
  existingGroups: TourGroup[]
  availability: GuideAvailability[]
  canCreateGroup?: boolean
  canAssignGuide?: boolean
  canConfirmGuide?: boolean
  createPermissionMessage?: string
  helperText?: string
  onCreateGroup: (group: TourGroup) => Promise<string | null> | string | null
}

type FormValues = {
  groupCode: string
  circuitId: string
  requiredLanguage: string
  startDate: string
  endDate: string
  guideId: string
  markGuideConfirmed: boolean
}

type FormErrors = Partial<Record<keyof FormValues, string>>

const noGuideValue = "__without-guide"
const noRequiredLanguageValue = "__any-language"
const requiredLanguageOptions = ["EN", "FR", "ES", "TR"]

const defaultFormValues: FormValues = {
  groupCode: "",
  circuitId: "",
  requiredLanguage: noRequiredLanguageValue,
  startDate: "",
  endDate: "",
  guideId: noGuideValue,
  markGuideConfirmed: false,
}

function buildGroupId(groupCode: string) {
  const normalizedCode = groupCode
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  return `manual-${normalizedCode}-${Date.now()}`
}

export function CreateGroupDialog({
  circuits,
  guides,
  existingGroups,
  availability,
  canCreateGroup = true,
  canAssignGuide = true,
  canConfirmGuide = true,
  createPermissionMessage = "You do not have permission to create groups.",
  helperText = "",
  onCreateGroup,
}: CreateGroupDialogProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<FormValues>(defaultFormValues)
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showUnavailableGuides, setShowUnavailableGuides] = useState(false)
  const existingCodes = useMemo(
    () => new Set(existingGroups.map((group) => group.code.toLowerCase())),
    [existingGroups]
  )
  const circuitOptions: SearchableSelectOption[] = circuits.map((circuit) => ({
    value: circuit.id,
    label: circuit.name,
  }))
  const manualAvailability = useMemo(
    () =>
      availability.filter(
        (record) => record.status !== "occupied-by-assignment"
      ),
    [availability]
  )
  const hasSelectedGuide = values.guideId !== noGuideValue
  const hasValidDateRange =
    Boolean(values.startDate) &&
    Boolean(values.endDate) &&
    values.endDate >= values.startDate
  const assignableGuideResults = useMemo(
    () =>
      getAssignableGuidesForDates(
        guides,
        existingGroups,
        manualAvailability,
        values.startDate,
        values.endDate,
        { showUnavailable: showUnavailableGuides }
      ),
    [
      existingGroups,
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
  const guideAssignmentWarnings = useMemo(() => {
    if (!hasSelectedGuide || !values.startDate || !values.endDate) {
      return []
    }

    return getGuideAssignmentConflicts(
      values.guideId,
      values.startDate,
      values.endDate,
      existingGroups
    ).filter((conflict) => conflict.type === "boundary")
  }, [
    existingGroups,
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

  function updateValue<Key extends keyof FormValues>(
    key: Key,
    value: FormValues[Key]
  ) {
    setValues((currentValues) => ({
      ...currentValues,
      [key]: value,
      ...(key === "guideId" && value === noGuideValue
        ? { markGuideConfirmed: false }
        : {}),
    }))
    setErrors((currentErrors) => ({ ...currentErrors, [key]: undefined }))
    setFormError(null)
  }

  function validateForm() {
    const nextErrors: FormErrors = {}
    const normalizedCode = values.groupCode.trim().toLowerCase()

    if (!values.groupCode.trim()) {
      nextErrors.groupCode = "Group code is required."
    } else if (existingCodes.has(normalizedCode)) {
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
        existingGroups
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

  function resetForm() {
    setValues(defaultFormValues)
    setErrors({})
    setFormError(null)
    setIsSaving(false)
    setShowUnavailableGuides(false)
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

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && !canCreateGroup) {
      return
    }

    setOpen(nextOpen)

    if (!nextOpen) {
      resetForm()
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!validateForm()) {
      return
    }

    const guideId = values.guideId === noGuideValue ? null : values.guideId
    const newGroup: TourGroup = {
      id: buildGroupId(values.groupCode),
      code: values.groupCode.trim(),
      circuitId: values.circuitId,
      startDate: formatDateDisplay(values.startDate),
      endDate: formatDateDisplay(values.endDate),
      startDateIso: values.startDate,
      endDateIso: values.endDate,
      guideId,
      groupStatus: "active",
      assignmentStatus: guideId ? "assigned" : "without-guide",
      confirmationStatus: guideId
        ? values.markGuideConfirmed
          ? "confirmed"
          : "pending-confirmation"
        : "not-required",
      requiredLanguage:
        values.requiredLanguage === noRequiredLanguageValue
          ? null
          : values.requiredLanguage,
      travelers: 0,
    }

    setIsSaving(true)
    setFormError(null)

    const saveError = await onCreateGroup(newGroup)

    setIsSaving(false)

    if (saveError) {
      setFormError(saveError)
      return
    }

    setOpen(false)
    resetForm()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <div className="grid justify-items-end gap-1">
        <DialogTrigger asChild>
          <Button
            type="button"
            disabled={!canCreateGroup}
            title={canCreateGroup ? undefined : createPermissionMessage}
          >
            <Plus className="size-4" />
            <T i18nKey="groups.create_group_dialog.create_group" />
          </Button>
        </DialogTrigger>
        {!canCreateGroup ? (
          <p className="text-xs text-muted-foreground">
            {createPermissionMessage}
          </p>
        ) : null}
      </div>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle><T i18nKey="groups.create_group_dialog.create_group" /></DialogTitle>
            <DialogDescription className={helperText ? undefined : "sr-only"}>
              {helperText || t("groups.create_group_dialog.create_group")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="create-group-code"><T i18nKey="groups.create_group_dialog.group_code" /></Label>
              <Input
                id="create-group-code"
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
                disabled={!canAssignGuide}
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
              <Label htmlFor="create-start-date"><T i18nKey="common.start_date" /></Label>
              <DatePickerInput
                id="create-start-date"
                value={values.startDate}
                onChange={(value) => updateValue("startDate", value)}
                aria-invalid={Boolean(errors.startDate)}
              />
              {errors.startDate ? (
                <p className="text-xs text-red-700">{errors.startDate}</p>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="create-end-date"><T i18nKey="common.end_date" /></Label>
              <DatePickerInput
                id="create-end-date"
                value={values.endDate}
                onChange={(value) => updateValue("endDate", value)}
                aria-invalid={Boolean(errors.endDate)}
              />
              {errors.endDate ? (
                <p className="text-xs text-red-700">{errors.endDate}</p>
              ) : null}
            </div>

            <div className="grid gap-1.5 md:col-span-2">
              <Label><T i18nKey="groups.create_group_dialog.assigned_guide" /></Label>
              <SearchableSelect
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

            {hasSelectedGuide ? (
              <Label className="flex items-center gap-2 rounded-lg border p-3 md:col-span-2">
                <Checkbox
                  disabled={!canConfirmGuide}
                  checked={values.markGuideConfirmed}
                  onCheckedChange={(checked) =>
                    updateValue("markGuideConfirmed", checked === true)
                  }
                />
                <T i18nKey="groups.create_group_dialog.mark_guide_as_confirmed" />
              </Label>
            ) : null}
          </div>

          {guideAssignmentWarnings.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <T i18nKey="groups.create_group_dialog.this_guide_finishes_another_tour_on_the_same" />
            </div>
          ) : null}

          {availabilityWarning ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {availabilityWarning}
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
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
            >
              <T i18nKey="common.cancel" />
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t("groups.form.saving") : t("groups.create_group_dialog.create_group")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
