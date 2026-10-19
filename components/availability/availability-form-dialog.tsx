"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import { FormEvent, useMemo, useState } from "react"
import { AlertTriangle, Plus, Trash2 } from "lucide-react"

import { DatePickerInput } from "@/components/common/date-picker-input"
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/common/searchable-select"
import { Badge } from "@/components/ui/badge"
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
import type {
  AvailabilitySource,
  AvailabilityStatus,
  Circuit,
  Guide,
  GuideAvailability,
  TourGroup,
} from "@/lib/types/domain"
import {
  getAvailabilityForGuideAndYear,
  hasDateOverlap,
  overlapsYear,
} from "@/lib/utils/availability-conflicts"
import { formatDateDisplay } from "@/lib/utils/date-format"

type AvailabilityFormDialogProps = {
  open: boolean
  mode: "create" | "edit"
  availability: GuideAvailability | null
  guides: Guide[]
  availabilityRecords: GuideAvailability[]
  groups: TourGroup[]
  circuits: Circuit[]
  selectedYear: string
  createDefaults?: Partial<Pick<GuideAvailability, "status" | "source">>
  helperText?: string
  onOpenChange: (open: boolean) => void
  onSaveAvailability: (
    availability: GuideAvailability[]
  ) => Promise<string | null | void> | string | null | void
}

type PeriodValues = {
  id: string
  status: AvailabilityStatus | ""
  startDate: string
  endDate: string
  notes: string
}

type FormValues = {
  guideId: string
  source: AvailabilitySource | ""
  year: string
  periods: PeriodValues[]
}

type PeriodErrors = Partial<
  Record<"status" | "startDate" | "endDate" | "conflict" | "duplicate", string>
>

type FormErrors = {
  guideId?: string
  source?: string
  periods: Record<string, PeriodErrors>
}

type DateInputValidationState = {
  hasValue: boolean
  isValid: boolean
  message: string | null
}

const defaultCreateSource: AvailabilitySource = "admin-updated"

const createStatusOptions: {
  value: Exclude<AvailabilityStatus, "occupied-by-assignment">
  labelKey: UiTranslationKey
}[] = [
  { value: "available", labelKey: "availability.status.available" },
  { value: "not-available", labelKey: "availability.status.not_available" },
  { value: "pending-review", labelKey: "status.pending_review" },
]

const editStatusOptions: { value: AvailabilityStatus; labelKey: UiTranslationKey }[] = [
  ...createStatusOptions,
  { value: "occupied-by-assignment", labelKey: "availability.status.occupied_by_assignment" },
]

const sourceOptions: { value: AvailabilitySource; labelKey: UiTranslationKey }[] = [
  { value: "guide-submitted", labelKey: "availability.source.guide_submitted" },
  { value: "admin-updated", labelKey: "availability.source.admin_updated" },
  { value: "assignment-generated", labelKey: "availability.source.assignment_generated" },
]

const yearOptions = Array.from({ length: 2040 - 2026 + 1 }, (_, index) =>
  String(2026 + index)
)

function buildPeriodId() {
  return `period-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function buildAvailabilityId(guideId: string, startDate: string, index: number) {
  return `manual-availability-${guideId}-${startDate}-${Date.now()}-${index}`
}

function createEmptyPeriod(
  status: Exclude<AvailabilityStatus, "occupied-by-assignment"> = "available"
): PeriodValues {
  return {
    id: buildPeriodId(),
    status,
    startDate: "",
    endDate: "",
    notes: "",
  }
}

function createFullYearPeriod(year: string): PeriodValues {
  return {
    id: buildPeriodId(),
    status: "available",
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    notes: `Full-year availability for ${year}.`,
  }
}

function buildDuplicateKey({
  guideId,
  status,
  startDateIso,
  endDateIso,
  source,
}: {
  guideId: string
  status: AvailabilityStatus | ""
  startDateIso: string
  endDateIso: string
  source: AvailabilitySource | ""
}) {
  return `${guideId}|${status}|${startDateIso}|${endDateIso}|${source}`
}

function getInitialValues(
  availability: GuideAvailability | null,
  selectedYear: string,
  createDefaults?: Partial<Pick<GuideAvailability, "status" | "source">>
): FormValues {
  if (availability) {
    return {
      guideId: availability.guideId,
      source: availability.source,
      year: availability.startDateIso.slice(0, 4),
      periods: [
        {
          id: availability.id,
          status: availability.status,
          startDate: availability.startDateIso,
          endDate: availability.endDateIso,
          notes: availability.notes,
        },
      ],
    }
  }

  return {
    guideId: "",
    source: createDefaults?.source ?? defaultCreateSource,
    year: selectedYear,
    periods: [
      createEmptyPeriod(
        createDefaults?.status === "not-available"
          ? "not-available"
          : "available"
      ),
    ],
  }
}

export function AvailabilityFormDialog({
  open,
  mode,
  availability,
  guides,
  availabilityRecords,
  groups,
  circuits,
  selectedYear,
  createDefaults,
  helperText,
  onOpenChange,
  onSaveAvailability,
}: AvailabilityFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <AvailabilityForm
          key={availability?.id ?? `create-${createDefaults?.status ?? ""}`}
          mode={mode}
          availability={availability}
          guides={guides}
          availabilityRecords={availabilityRecords}
          groups={groups}
          circuits={circuits}
          selectedYear={selectedYear}
          createDefaults={createDefaults}
          helperText={helperText}
          onCancel={() => onOpenChange(false)}
          onSaveAvailability={onSaveAvailability}
        />
      ) : null}
    </Dialog>
  )
}

type AvailabilityFormProps = {
  mode: "create" | "edit"
  availability: GuideAvailability | null
  guides: Guide[]
  availabilityRecords: GuideAvailability[]
  groups: TourGroup[]
  circuits: Circuit[]
  selectedYear: string
  createDefaults?: Partial<Pick<GuideAvailability, "status" | "source">>
  helperText?: string
  onCancel: () => void
  onSaveAvailability: (
    availability: GuideAvailability[]
  ) => Promise<string | null | void> | string | null | void
}

function AvailabilityForm({
  mode,
  availability,
  guides,
  availabilityRecords,
  groups,
  circuits,
  selectedYear,
  createDefaults,
  helperText,
  onCancel,
  onSaveAvailability,
}: AvailabilityFormProps) {
  const { t } = useI18n()
  const [values, setValues] = useState<FormValues>(() =>
    getInitialValues(availability, selectedYear, createDefaults)
  )
  const [errors, setErrors] = useState<FormErrors>({ periods: {} })
  const [dateInputStates, setDateInputStates] = useState<
    Record<string, DateInputValidationState>
  >({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const guideOptions: SearchableSelectOption[] = useMemo(
    () =>
      guides.map((guide) => ({
        value: guide.id,
        label: guide.name,
        searchValue: `${guide.name} ${guide.email}`,
      })),
    [guides]
  )
  const isEditMode = mode === "edit"
  const isAssignmentGenerated =
    availability?.source === "assignment-generated" ||
    Boolean(availability?.assignmentGroupId)
  const existingGuidePeriods = useMemo(
    () =>
      values.guideId
        ? getAvailabilityForGuideAndYear(
            values.guideId,
            values.year,
            availabilityRecords
          ).filter((record) => record.id !== availability?.id)
        : [],
    [availability?.id, availabilityRecords, values.guideId, values.year]
  )
  const assignedGuideGroups = useMemo(
    () =>
      values.guideId
        ? groups
            .filter(
              (group) =>
                group.guideId === values.guideId &&
                group.groupStatus !== "cxl" &&
                overlapsYear(group.startDateIso, group.endDateIso, values.year)
            )
            .sort((a, b) => a.startDateIso.localeCompare(b.startDateIso))
        : [],
    [groups, values.guideId, values.year]
  )
  const overlappingNotAvailableWarnings = values.periods.filter(
    (period, index) =>
      period.status === "not-available" &&
      period.startDate &&
      period.endDate &&
      values.periods.some(
        (otherPeriod, otherIndex) =>
          otherIndex !== index &&
          otherPeriod.status === "not-available" &&
          otherPeriod.startDate &&
          otherPeriod.endDate &&
          hasDateOverlap(
            period.startDate,
            period.endDate,
            otherPeriod.startDate,
            otherPeriod.endDate
          )
      )
  )
  const existingAvailablePeriods = existingGuidePeriods.filter(
    (record) => record.status === "available"
  )
  const existingNotAvailablePeriods = existingGuidePeriods.filter(
    (record) => record.status === "not-available"
  )
  const existingPendingReviewPeriods = existingGuidePeriods.filter(
    (record) => record.status === "pending-review"
  )
  const existingOccupiedPeriods = existingGuidePeriods.filter(
    (record) => record.status === "occupied-by-assignment"
  )
  const existingPeriodSections: {
    label: string
    records: GuideAvailability[]
  }[] = [
    { label: t("availability.periods.available"), records: existingAvailablePeriods },
    { label: t("availability.periods.not_available"), records: existingNotAvailablePeriods },
    { label: t("availability.periods.pending_review"), records: existingPendingReviewPeriods },
    {
      label: t("availability.periods.assignment_generated"),
      records: existingOccupiedPeriods,
    },
  ]

  function updateGuide(guideId: string) {
    setSubmitError(null)
    setValues((currentValues) => ({ ...currentValues, guideId }))
    setErrors((currentErrors) => ({ ...currentErrors, guideId: undefined }))
  }

  function updateSource(source: AvailabilitySource) {
    setSubmitError(null)
    setValues((currentValues) => ({ ...currentValues, source }))
    setErrors((currentErrors) => ({ ...currentErrors, source: undefined }))
  }

  function updatePeriod<Key extends keyof PeriodValues>(
    periodId: string,
    key: Key,
    value: PeriodValues[Key]
  ) {
    setSubmitError(null)
    setValues((currentValues) => ({
      ...currentValues,
      periods: currentValues.periods.map((period) =>
        period.id === periodId ? { ...period, [key]: value } : period
      ),
    }))
    setErrors((currentErrors) => ({
      ...currentErrors,
      periods: {
        ...currentErrors.periods,
        [periodId]: {
          ...currentErrors.periods[periodId],
          [key]: undefined,
        },
      },
    }))
  }

  function updateDateInputState(
    periodId: string,
    field: "startDate" | "endDate",
    state: DateInputValidationState
  ) {
    setSubmitError(null)
    setDateInputStates((currentStates) => ({
      ...currentStates,
      [`${periodId}:${field}`]: state,
    }))
  }

  function addPeriod(
    status: Exclude<AvailabilityStatus, "occupied-by-assignment"> = "available"
  ) {
    setSubmitError(null)
    setValues((currentValues) => ({
      ...currentValues,
      periods: [...currentValues.periods, createEmptyPeriod(status)],
    }))
  }

  function removePeriod(periodId: string) {
    setSubmitError(null)
    setValues((currentValues) => ({
      ...currentValues,
      periods:
        currentValues.periods.length === 1
          ? currentValues.periods
          : currentValues.periods.filter((period) => period.id !== periodId),
    }))
  }

  function addFullYearAvailability() {
    setSubmitError(null)
    setValues((currentValues) => ({
      ...currentValues,
      periods: [...currentValues.periods, createFullYearPeriod(values.year)],
    }))
  }

  function getAssignedGroupConflicts(period: PeriodValues) {
    if (
      !values.guideId ||
      period.status !== "not-available" ||
      !period.startDate ||
      !period.endDate
    ) {
      return []
    }

    return assignedGuideGroups.filter((group) =>
      hasDateOverlap(
        period.startDate,
        period.endDate,
        group.startDateIso,
        group.endDateIso
      )
    )
  }

  function getDuplicateKeyForPeriod(period: PeriodValues) {
    return buildDuplicateKey({
      guideId: values.guideId,
      status: period.status,
      startDateIso: period.startDate,
      endDateIso: period.endDate,
      source: isEditMode ? values.source : defaultCreateSource,
    })
  }

  function validateForm() {
    const nextErrors: FormErrors = { periods: {} }

    if (!values.guideId) {
      nextErrors.guideId = "Guide is required."
    }

    if (isEditMode && !values.source) {
      nextErrors.source = "Source is required."
    }

    const modalDuplicateKeyCounts = new Map<string, number>()

    values.periods.forEach((period) => {
      if (
        values.guideId &&
        period.status &&
        period.startDate &&
        period.endDate
      ) {
        const duplicateKey = getDuplicateKeyForPeriod(period)
        modalDuplicateKeyCounts.set(
          duplicateKey,
          (modalDuplicateKeyCounts.get(duplicateKey) ?? 0) + 1
        )
      }
    })

    values.periods.forEach((period) => {
      const periodErrors: PeriodErrors = {}

      if (!period.status) {
        periodErrors.status = "Status is required."
      }

      const startDateInputState = dateInputStates[`${period.id}:startDate`]
      const endDateInputState = dateInputStates[`${period.id}:endDate`]

      if (startDateInputState?.hasValue && !startDateInputState.isValid) {
        periodErrors.startDate =
          startDateInputState.message ?? "Invalid date. Use dd/mm/yyyy."
      } else if (!period.startDate) {
        periodErrors.startDate = "Date from is required."
      }

      if (endDateInputState?.hasValue && !endDateInputState.isValid) {
        periodErrors.endDate =
          endDateInputState.message ?? "Invalid date. Use dd/mm/yyyy."
      } else if (!period.endDate) {
        periodErrors.endDate = "Date to is required."
      } else if (period.startDate && period.endDate < period.startDate) {
        periodErrors.endDate = "Date to cannot be before date from."
      }

      if (getAssignedGroupConflicts(period).length > 0) {
        periodErrors.conflict =
          "This period conflicts with an assigned group. Change the guide on the group before updating availability."
      }

      if (
        values.guideId &&
        period.status &&
        period.startDate &&
        period.endDate
      ) {
        const duplicateKey = getDuplicateKeyForPeriod(period)
        const existingDuplicate = availabilityRecords.some(
          (record) =>
            record.id !== availability?.id &&
            buildDuplicateKey({
              guideId: record.guideId,
              status: record.status,
              startDateIso: record.startDateIso,
              endDateIso: record.endDateIso,
              source: record.source,
            }) === duplicateKey
        )
        const duplicateInModal =
          (modalDuplicateKeyCounts.get(duplicateKey) ?? 0) > 1

        if (existingDuplicate || duplicateInModal) {
          periodErrors.duplicate =
            "This availability period already exists for this guide."
        }
      }

      if (Object.keys(periodErrors).length > 0) {
        nextErrors.periods[period.id] = periodErrors
      }
    })

    setErrors(nextErrors)

    return (
      !nextErrors.guideId &&
      !nextErrors.source &&
      Object.keys(nextErrors.periods).length === 0
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)

    if (!validateForm()) {
      return
    }

    const savedAvailability: GuideAvailability[] = values.periods.map(
      (period, index) => ({
        id:
          isEditMode && availability
            ? availability.id
            : buildAvailabilityId(values.guideId, period.startDate, index),
        guideId: values.guideId,
        startDate: formatDateDisplay(period.startDate),
        endDate: formatDateDisplay(period.endDate),
        startDateIso: period.startDate,
        endDateIso: period.endDate,
        status: period.status as AvailabilityStatus,
        source: isEditMode
          ? (values.source as AvailabilitySource)
          : defaultCreateSource,
        notes: period.notes.trim(),
        assignmentGroupId: availability?.assignmentGroupId,
        createdAtIso: availability?.createdAtIso,
        updatedAtIso: availability?.updatedAtIso,
        updatedBy: availability?.updatedBy,
      })
    )

    setIsSaving(true)
    let saveError: string | null | void = null

    try {
      saveError = await onSaveAvailability(savedAvailability)
    } catch (error) {
      saveError =
        error instanceof Error ? error.message : "Availability save failed."
    } finally {
      setIsSaving(false)
    }

    if (saveError) {
      setSubmitError(saveError)
      return
    }

    onCancel()
  }

  function getCircuitName(circuitId: string) {
    return circuits.find((circuit) => circuit.id === circuitId)?.name ?? circuitId
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? t("availability.form.add") : t("availability.form.edit")}
          </DialogTitle>
          <DialogDescription>
            {helperText ??
              "Availability changes are saved by the active data source for this module."}
          </DialogDescription>
        </DialogHeader>

        {isAssignmentGenerated ? (
          <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              <T i18nKey="availability.availability_form_dialog.this_period_was_generated_from_an_assigned_group" />
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label><T i18nKey="common.guide" /></Label>
            <SearchableSelect
              value={values.guideId}
              options={guideOptions}
              placeholder={t("availability.availability_form_dialog.placeholder_select_guide")}
              searchPlaceholder={t("common.search_guides")}
              emptyText={t("availability.availability_form_dialog.empty_text_no_guide_found")}
              clearValue=""
              clearLabel="Clear guide"
              onValueChange={updateGuide}
              aria-invalid={Boolean(errors.guideId)}
            />
            {errors.guideId ? (
              <p className="text-xs text-red-700">{errors.guideId}</p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label><T i18nKey="common.year" /></Label>
            <Select
              value={values.year}
              onValueChange={(year) =>
                setValues((currentValues) => ({ ...currentValues, year }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isEditMode ? (
            <div className="grid gap-1.5">
              <Label><T i18nKey="common.source" /></Label>
              <Select
                value={values.source}
                onValueChange={(value) =>
                  updateSource(value as AvailabilitySource)
                }
              >
                <SelectTrigger
                  aria-invalid={Boolean(errors.source)}
                  className="w-full"
                >
                  <SelectValue placeholder={t("availability.availability_form_dialog.placeholder_select_source")} />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((source) => (
                    <SelectItem key={source.value} value={source.value}>
                      {t(source.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.source ? (
                <p className="text-xs text-red-700">{errors.source}</p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              <T i18nKey="availability.availability_form_dialog.manual_availability_periods_are_saved_with_source" />{" "}
              <span className="font-medium text-foreground"><T i18nKey="availability.availability_form_dialog.admin_updated" /></span>
              .
            </div>
          )}
        </div>

        {!isEditMode ? (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
            <Button
              type="button"
              variant="outline"
              onClick={addFullYearAvailability}
            >
              <T i18nKey="availability.availability_form_dialog.mark" /> {values.year} <T i18nKey="availability.availability_form_dialog.as_available" />
            </Button>
            <p className="text-sm text-muted-foreground">
              <T i18nKey="availability.availability_form_dialog.not_available_exceptions_override_the_available_range" />
            </p>
          </div>
        ) : null}

        {values.guideId ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">
                <T i18nKey="availability.availability_form_dialog.existing_availability_for" /> {values.year}
              </p>
              {existingGuidePeriods.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <T i18nKey="availability.availability_form_dialog.no_availability_periods_loaded_for_this_guide_year" />
                </p>
              ) : (
                <div className="space-y-3">
                  {existingPeriodSections.map((section) => (
                    <div key={section.label} className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {section.label}
                      </p>
                      {section.records.length === 0 ? (
                        <p className="text-xs text-muted-foreground"><T i18nKey="common.none" /></p>
                      ) : (
                        section.records.slice(0, 4).map((record) => (
                          <div
                            key={record.id}
                            className="flex flex-wrap items-center gap-2 text-sm"
                          >
                            <Badge variant="outline">{record.source}</Badge>
                            <span>
                              {formatDateDisplay(record.startDateIso)} -{" "}
                              {formatDateDisplay(record.endDateIso)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  ))}
                  {existingGuidePeriods.length > 5 ? (
                    <p className="text-xs text-muted-foreground">
                      +{existingGuidePeriods.length - 5} <T i18nKey="availability.availability_form_dialog.more_periods" />
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">
                <T i18nKey="availability.availability_form_dialog.assigned_groups_for" /> {values.year}
              </p>
              {assignedGuideGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <T i18nKey="availability.availability_form_dialog.no_assigned_groups_found_for_this_guide_year" />
                </p>
              ) : (
                <div className="space-y-2">
                  {assignedGuideGroups.map((group) => (
                    <div key={group.id} className="text-sm">
                      <div className="font-medium">{group.code}</div>
                      <div className="text-muted-foreground">
                        {getCircuitName(group.circuitId)} ·{" "}
                        {formatDateDisplay(group.startDateIso)} -{" "}
                        {formatDateDisplay(group.endDateIso)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {overlappingNotAvailableWarnings.length > 0 ? (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              <T i18nKey="availability.availability_form_dialog.some_not_available_periods_overlap_consider_merging_them" />
            </p>
          </div>
        ) : null}

        {submitError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {submitError}
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label>{isEditMode ? t("availability.form.period") : t("availability.form.periods")}</Label>
            {!isEditMode ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addPeriod("not-available")}
              >
                <Plus className="size-4" />
                <T i18nKey="availability.availability_form_dialog.add_another_period" />
              </Button>
            ) : null}
          </div>

          {values.periods.map((period, index) => {
            const periodErrors = errors.periods[period.id] ?? {}
            const periodAssignedGroupConflicts =
              getAssignedGroupConflicts(period)

            return (
              <div
                key={period.id}
                className="grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(160px,0.9fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(200px,1.4fr)_auto]"
              >
                <div className="grid gap-1.5">
                  <Label><T i18nKey="availability.availability_form_dialog.period" /> {index + 1} <T i18nKey="availability.availability_form_dialog.status" /></Label>
                  <Select
                    value={period.status}
                    onValueChange={(value) =>
                      updatePeriod(
                        period.id,
                        "status",
                        value as AvailabilityStatus
                      )
                    }
                  >
                    <SelectTrigger
                      aria-invalid={Boolean(periodErrors.status)}
                      className="w-full"
                    >
                      <SelectValue placeholder={t("availability.availability_form_dialog.placeholder_select_status")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(isEditMode
                        ? editStatusOptions
                        : createStatusOptions
                      ).map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {t(status.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {periodErrors.status ? (
                    <p className="text-xs text-red-700">
                      {periodErrors.status}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor={`availability-start-date-${period.id}`}>
                    <T i18nKey="availability.availability_filters.date_from" />
                  </Label>
                  <DatePickerInput
                    id={`availability-start-date-${period.id}`}
                    value={period.startDate}
                    onChange={(value) =>
                      updatePeriod(period.id, "startDate", value)
                    }
                    onValidationChange={(state) =>
                      updateDateInputState(period.id, "startDate", state)
                    }
                    aria-invalid={Boolean(periodErrors.startDate)}
                  />
                  {periodErrors.startDate ? (
                    <p className="text-xs text-red-700">
                      {periodErrors.startDate}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor={`availability-end-date-${period.id}`}>
                    <T i18nKey="availability.availability_filters.date_to" />
                  </Label>
                  <DatePickerInput
                    id={`availability-end-date-${period.id}`}
                    value={period.endDate}
                    onChange={(value) =>
                      updatePeriod(period.id, "endDate", value)
                    }
                    onValidationChange={(state) =>
                      updateDateInputState(period.id, "endDate", state)
                    }
                    aria-invalid={Boolean(periodErrors.endDate)}
                  />
                  {periodErrors.endDate ? (
                    <p className="text-xs text-red-700">
                      {periodErrors.endDate}
                    </p>
                  ) : null}
                  {periodErrors.conflict ? (
                    <p className="text-xs text-red-700">
                      {periodErrors.conflict}
                    </p>
                  ) : null}
                  {periodErrors.duplicate ? (
                    <p className="text-xs text-red-700">
                      {periodErrors.duplicate}
                    </p>
                  ) : null}
                  {periodAssignedGroupConflicts.length > 0 ? (
                    <p className="text-xs text-red-700">
                      <T i18nKey="availability.availability_form_dialog.conflicts" />{" "}
                      {periodAssignedGroupConflicts
                        .map(
                          (group) =>
                            `${group.code} (${getCircuitName(group.circuitId)}, ${formatDateDisplay(group.startDateIso)} - ${formatDateDisplay(group.endDateIso)})`
                        )
                        .join(", ")}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor={`availability-notes-${period.id}`}>
                    <T i18nKey="common.notes" />
                  </Label>
                  <Textarea
                    id={`availability-notes-${period.id}`}
                    value={period.notes}
                    onChange={(event) =>
                      updatePeriod(period.id, "notes", event.target.value)
                    }
                    rows={2}
                  />
                </div>

                <div className="flex items-end">
                  {!isEditMode && values.periods.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removePeriod(period.id)}
                      aria-label={`Remove period ${index + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={onCancel}
          >
            <T i18nKey="common.cancel" />
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? t("groups.form.saving") : t("availability.form.save")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
