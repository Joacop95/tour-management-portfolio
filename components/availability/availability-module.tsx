"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { useEffect, useMemo, useState } from "react"
import { CalendarPlus, Info } from "lucide-react"

import { AvailabilityFormDialog } from "@/components/availability/availability-form-dialog"
import { AnnualAvailabilitySubmissions } from "@/components/availability/annual-availability-submissions"
import {
  AvailabilityFilters,
  type AvailabilityFilterValues,
} from "@/components/availability/availability-filters"
import { AvailabilitySummaryCards } from "@/components/availability/availability-summary-cards"
import { AvailabilityTable } from "@/components/availability/availability-table"
import { YearlyAvailabilityRequest } from "@/components/availability/yearly-availability-request"
import { useCurrentUserAccess } from "@/components/layout/current-user-access-provider"
import {
  useAppSettings,
  usePermissionSource,
  usePreviewRole,
} from "@/components/settings/settings-client-store"
import { Badge } from "@/components/ui/badge"
import { isDevToolsEnabled } from "@/lib/auth/runtime-mode"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  hasActivePermission,
  resolveActivePermissionKeys,
} from "@/lib/auth/permission-source"
import type {
  AvailabilitySource,
  AvailabilityStatus,
  Circuit,
  Guide,
  GuideAvailability,
  TourGroup,
} from "@/lib/types/domain"
import {
  usePersistedAvailability,
  usePersistedCircuits,
  usePersistedGroups,
  usePersistedGuides,
} from "@/lib/hooks/use-persisted-mock-data"
import {
  localStorageKeys,
  writeLocalStorageValue,
} from "@/lib/utils/local-storage"
import { getAllSupabaseCircuits } from "@/lib/supabase/queries/circuits"
import {
  getSupabaseAvailability,
  getSupabaseAvailabilitySubmissions,
  type SupabaseAvailabilitySubmission,
} from "@/lib/supabase/queries/availability"
import { getSupabaseGroups } from "@/lib/supabase/queries/groups"
import { getSupabaseGuides } from "@/lib/supabase/queries/guides"
import {
  buildSupabaseAvailabilityMutationInput,
  createSupabaseAvailability,
  deleteSupabaseAvailability,
  updateSupabaseAvailability,
} from "@/lib/supabase/mutations/availability"
import { overlapsYear } from "@/lib/utils/availability-conflicts"
import { formatDateDisplay } from "@/lib/utils/date-format"
import { normalizeLanguageOptions } from "@/lib/utils/language-options"

const defaultFilters: AvailabilityFilterValues = {
  search: "",
  dateFrom: "",
  dateTo: "",
  years: ["2026"],
  status: "all",
  preferredLanguage: "all",
  circuitIds: [],
}

type AvailabilityModuleProps = {
  availability: GuideAvailability[]
  guides: Guide[]
  circuits: Circuit[]
  groups: TourGroup[]
}

type AvailabilityDataSource = "local-fallback" | "supabase"

const protectedAvailabilityMessage =
  "This period was generated from an assigned group. Change the assignment instead."
const createAvailabilityPermissionMessage =
  "You do not have permission to create availability."
const editAvailabilityPermissionMessage =
  "You do not have permission to edit availability."
const deleteAvailabilityPermissionMessage =
  "You do not have permission to delete availability."

function dateRangeOverlapsRecord(
  record: GuideAvailability,
  dateFrom: string,
  dateTo: string
) {
  if (dateFrom && dateTo) {
    return record.startDateIso <= dateTo && record.endDateIso >= dateFrom
  }

  if (dateFrom) {
    return record.endDateIso >= dateFrom
  }

  if (dateTo) {
    return record.startDateIso <= dateTo
  }

  return true
}

function filterAvailability(
  availability: GuideAvailability[],
  guides: Guide[],
  filters: AvailabilityFilterValues
) {
  const search = filters.search.trim().toLowerCase()

  return availability.filter((record) => {
    const guide = guides.find((item) => item.id === record.guideId)
    const matchesSearch = search
      ? guide?.name.toLowerCase().includes(search)
      : true
    const matchesDates = dateRangeOverlapsRecord(
      record,
      filters.dateFrom,
      filters.dateTo
    )
    const matchesYear =
      filters.dateFrom ||
      filters.dateTo ||
      filters.years.some((year) =>
        overlapsYear(record.startDateIso, record.endDateIso, year)
      )
    const matchesStatus =
      filters.status === "all" || record.status === filters.status
    const matchesPreferredLanguage =
      filters.preferredLanguage === "all" ||
      guide?.preferredLanguage === filters.preferredLanguage
    const matchesCircuit =
      filters.circuitIds.length === 0 ||
      filters.circuitIds.some((circuitId) =>
        guide?.circuitIds.includes(circuitId)
      )

    return (
      matchesSearch &&
      matchesDates &&
      matchesYear &&
      matchesStatus &&
      matchesPreferredLanguage &&
      matchesCircuit
    )
  })
}

async function readSupabaseAvailabilityData() {
  let availabilityResult: Awaited<ReturnType<typeof getSupabaseAvailability>>
  let guidesResult: Awaited<ReturnType<typeof getSupabaseGuides>>
  let circuitsResult: Awaited<ReturnType<typeof getAllSupabaseCircuits>>
  let groupsResult: Awaited<ReturnType<typeof getSupabaseGroups>>
  let submissionsResult: Awaited<ReturnType<typeof getSupabaseAvailabilitySubmissions>>

  try {
    const results = await Promise.all([
      getSupabaseAvailability(),
      getSupabaseGuides(),
      getAllSupabaseCircuits(),
      getSupabaseGroups(),
      getSupabaseAvailabilitySubmissions(),
    ])

    availabilityResult = results[0]
    guidesResult = results[1]
    circuitsResult = results[2]
    groupsResult = results[3]
    submissionsResult = results[4]
  } catch (error) {
    return {
      availability: null,
      guides: null,
      circuits: null,
      groups: null,
      submissions: null,
      error:
        error instanceof Error
          ? error.message
          : "Supabase availability read failed.",
    }
  }

  const readError =
    availabilityResult.error ??
    guidesResult.error ??
    circuitsResult.error ??
    groupsResult.error ??
    submissionsResult.error

  if (readError) {
    return {
      availability: null,
      guides: null,
      circuits: null,
      groups: null,
      submissions: null,
      error: readError,
    }
  }

  return {
    availability: availabilityResult.data,
    guides: guidesResult.data,
    circuits: circuitsResult.data,
    groups: groupsResult.data,
    submissions: submissionsResult.data,
    error: null,
  }
}

export function AvailabilityModule({
}: AvailabilityModuleProps) {
  const { t } = useI18n()
  const [activeView, setActiveView] = useState<"periods" | "submissions">("periods")
  const [filters, setFilters] =
    useState<AvailabilityFilterValues>(defaultFilters)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingAvailability, setEditingAvailability] =
    useState<GuideAvailability | null>(null)
  const [deletingAvailability, setDeletingAvailability] =
    useState<GuideAvailability | null>(null)
  const [createDefaults, setCreateDefaults] = useState<
    Partial<Pick<GuideAvailability, "status" | "source">>
  >({})
  const [supabaseAvailability, setSupabaseAvailability] = useState<
    GuideAvailability[] | null
  >(null)
  const [supabaseGuides, setSupabaseGuides] = useState<Guide[] | null>(null)
  const [supabaseCircuits, setSupabaseCircuits] = useState<Circuit[] | null>(
    null
  )
  const [supabaseGroups, setSupabaseGroups] = useState<TourGroup[] | null>(null)
  const [supabaseSubmissions, setSupabaseSubmissions] = useState<
    SupabaseAvailabilitySubmission[]
  >([])
  const [supabaseError, setSupabaseError] = useState<string | null>(null)
  const [writeError, setWriteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { access: authAccess, isInitialLoading: isAuthAccessLoading } =
    useCurrentUserAccess()
  const localAvailability = usePersistedAvailability()
  const localGroups = usePersistedGroups()
  const localGuides = usePersistedGuides()
  const localCircuits = usePersistedCircuits()
  const appSettings = useAppSettings()
  const previewRole = usePreviewRole()
  const permissionSource = usePermissionSource()
  const dataSource: AvailabilityDataSource = process.env.NODE_ENV === "production" || supabaseAvailability
    ? "supabase"
    : "local-fallback"
  const availability = useMemo(
    () =>
      dataSource === "supabase"
        ? (supabaseAvailability ?? [])
        : localAvailability,
    [dataSource, localAvailability, supabaseAvailability]
  )
  const guides = useMemo(
    () =>
      dataSource === "supabase"
        ? (supabaseGuides ?? [])
        : localGuides,
    [dataSource, localGuides, supabaseGuides]
  )
  const circuits = useMemo(
    () =>
      dataSource === "supabase"
        ? (supabaseCircuits ?? [])
        : localCircuits,
    [dataSource, localCircuits, supabaseCircuits]
  )
  const groups = useMemo(
    () =>
      dataSource === "supabase"
        ? (supabaseGroups ?? [])
        : localGroups,
    [dataSource, localGroups, supabaseGroups]
  )
  const activeCircuits = useMemo(
    () => circuits.filter((circuit) => circuit.isActive !== false),
    [circuits]
  )
  const languages = useMemo(
    () =>
      normalizeLanguageOptions(guides.map((guide) => guide.preferredLanguage)),
    [guides]
  )
  const filteredAvailability = useMemo(
    () => filterAvailability(availability, guides, filters),
    [availability, guides, filters]
  )
  const deletingGuide = deletingAvailability
    ? guides.find((guide) => guide.id === deletingAvailability.guideId)
    : null
  const activePermissionResolution = resolveActivePermissionKeys({
    permissionSource,
    appSettings,
    previewRole,
    authAccess,
  })
  const activePermissionKeys = activePermissionResolution.activePermissionKeys
  const isCheckingAuthPermissions =
    permissionSource === "auth" && isAuthAccessLoading
  const canCreateAvailability =
    !isCheckingAuthPermissions &&
    hasActivePermission(activePermissionKeys, "availability.create")
  const canEditAvailability =
    !isCheckingAuthPermissions &&
    hasActivePermission(activePermissionKeys, "availability.edit")
  const canDeleteAvailability =
    !isCheckingAuthPermissions &&
    hasActivePermission(activePermissionKeys, "availability.delete")
  const canReviewAnnualSubmissions =
    authAccess.isAuthenticated &&
    authAccess.permissionKeys.includes("availability.edit")
  const annualReviewPermissionMessage = isAuthAccessLoading
    ? "Loading authenticated user permissions."
    : "Your authenticated internal account does not have permission to review annual availability."
  const createPermissionMessage = isCheckingAuthPermissions
    ? "Loading Auth permissions."
    : createAvailabilityPermissionMessage
  const editPermissionMessage = isCheckingAuthPermissions
    ? "Loading Auth permissions."
    : editAvailabilityPermissionMessage
  const deletePermissionMessage = isCheckingAuthPermissions
    ? "Loading Auth permissions."
    : deleteAvailabilityPermissionMessage

  useEffect(() => {
    let isMounted = true

    async function loadSupabaseAvailability() {
      const result = await readSupabaseAvailabilityData()

      if (!isMounted) {
        return
      }

      if (result.error) {
        setSupabaseAvailability(null)
        setSupabaseGuides(null)
        setSupabaseCircuits(null)
        setSupabaseGroups(null)
        setSupabaseSubmissions([])
        setSupabaseError(result.error)
        return
      }

      setSupabaseAvailability(result.availability)
      setSupabaseGuides(result.guides)
      setSupabaseCircuits(result.circuits)
      setSupabaseGroups(result.groups)
      setSupabaseSubmissions(result.submissions ?? [])
      setSupabaseError(null)
    }

    loadSupabaseAvailability()

    return () => {
      isMounted = false
    }
  }, [])

  async function refreshSupabaseAvailability() {
    const result = await readSupabaseAvailabilityData()

    if (result.error) {
      setSupabaseAvailability(null)
      setSupabaseGuides(null)
      setSupabaseCircuits(null)
      setSupabaseGroups(null)
      setSupabaseSubmissions([])
      setSupabaseError(result.error)
      return result.error
    }

    setSupabaseAvailability(result.availability)
    setSupabaseGuides(result.guides)
    setSupabaseCircuits(result.circuits)
    setSupabaseGroups(result.groups)
    setSupabaseSubmissions(result.submissions ?? [])
    setSupabaseError(null)
    return null
  }

  function handleAddAvailability(
    status: AvailabilityStatus = "available",
    source: AvailabilitySource = "admin-updated"
  ) {
    setWriteError(null)
    if (!canCreateAvailability) {
      setWriteError(createPermissionMessage)
      return
    }

    setDialogMode("create")
    setEditingAvailability(null)
    setCreateDefaults({ status, source })
    setDialogOpen(true)
  }

  function handleEditAvailability(record: GuideAvailability) {
    setWriteError(null)
    if (
      record.source === "assignment-generated" ||
      record.status === "occupied-by-assignment"
    ) {
      setWriteError(protectedAvailabilityMessage)
      return
    }

    if (!canEditAvailability) {
      setWriteError(editPermissionMessage)
      return
    }

    setDialogMode("edit")
    setEditingAvailability(record)
    setCreateDefaults({})
    setDialogOpen(true)
  }

  async function handleSaveAvailability(records: GuideAvailability[]) {
    setWriteError(null)
    const existingRecordIds = new Set(availability.map((item) => item.id))
    const updatesExistingRecords = records.some((record) =>
      existingRecordIds.has(record.id)
    )

    if (updatesExistingRecords && !canEditAvailability) {
      setWriteError(editPermissionMessage)
      return editPermissionMessage
    }

    if (!updatesExistingRecords && !canCreateAvailability) {
      setWriteError(createPermissionMessage)
      return createPermissionMessage
    }

    if (dataSource === "supabase") {
      for (const record of records) {
        if (
          record.source === "assignment-generated" ||
          record.status === "occupied-by-assignment"
        ) {
          setWriteError(protectedAvailabilityMessage)
          return protectedAvailabilityMessage
        }

        const input = buildSupabaseAvailabilityMutationInput(record)
        const result = existingRecordIds.has(record.id)
          ? await updateSupabaseAvailability(record.id, input)
          : await createSupabaseAvailability(input)

        if (result.error) {
          setWriteError(result.error)
          return result.error
        }
      }

      const refreshError = await refreshSupabaseAvailability()

      if (refreshError) {
        setWriteError(refreshError)
        return refreshError
      }

      return null
    }

    const nowIso = new Date().toISOString()
    const localExistingRecordIds = new Set(
      localAvailability.map((item) => item.id)
    )
    const existingRecordMap = new Map(
      localAvailability.map((item) => [item.id, item])
    )
    const recordsWithMetadata = records.map((record) => {
      const existingRecord = existingRecordMap.get(record.id)

      return {
        ...record,
        createdAtIso: existingRecord?.createdAtIso ?? record.createdAtIso ?? nowIso,
        updatedAtIso: nowIso,
        updatedBy: "Super Admin",
      }
    })
    const updatedRecords = recordsWithMetadata.filter((record) =>
      localExistingRecordIds.has(record.id)
    )
    const createdRecords = recordsWithMetadata.filter(
      (record) => !localExistingRecordIds.has(record.id)
    )

    if (updatedRecords.length === 0) {
      writeLocalStorageValue(localStorageKeys.availability, [
        ...createdRecords,
        ...localAvailability,
      ])
      return null
    }

    const updatedRecordMap = new Map(
      updatedRecords.map((record) => [record.id, record])
    )
    const updatedAvailability = localAvailability.map(
      (item) => updatedRecordMap.get(item.id) ?? item
    )

    writeLocalStorageValue(localStorageKeys.availability, [
      ...createdRecords,
      ...updatedAvailability,
    ])

    return null
  }

  async function handleDeleteAvailability() {
    if (!deletingAvailability) {
      return
    }

    setWriteError(null)

    if (
      deletingAvailability.source === "assignment-generated" ||
      deletingAvailability.status === "occupied-by-assignment"
    ) {
      setWriteError(protectedAvailabilityMessage)
      return
    }

    if (!canDeleteAvailability) {
      setWriteError(deletePermissionMessage)
      return
    }

    if (dataSource === "supabase") {
      setIsDeleting(true)
      const result = await deleteSupabaseAvailability(deletingAvailability.id)
      setIsDeleting(false)

      if (result.error) {
        setWriteError(result.error)
        return
      }

      const refreshError = await refreshSupabaseAvailability()

      if (refreshError) {
        setWriteError(refreshError)
        return
      }

      setDeletingAvailability(null)
      return
    }

    writeLocalStorageValue(
      localStorageKeys.availability,
      localAvailability.filter((record) => record.id !== deletingAvailability.id)
    )
    setDeletingAvailability(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-fit rounded-lg border bg-muted/35 p-1">
          <Button type="button" size="sm" variant={activeView === "periods" ? "secondary" : "ghost"} onClick={() => setActiveView("periods")}>
            <T i18nKey="availability.availability_module.availability_periods" />
          </Button>
          <Button type="button" size="sm" variant={activeView === "submissions" ? "secondary" : "ghost"} onClick={() => setActiveView("submissions")}>
            <T i18nKey="availability.annual_availability_submissions.availability_conflicts" />
            {supabaseSubmissions.some((item) => item.status === "pending-review") ? (
              <Badge variant="outline" className="ml-1 bg-background">{supabaseSubmissions.filter((item) => item.status === "pending-review").length}</Badge>
            ) : null}
          </Button>
        </div>
        {activeView === "periods" ? <div className="flex flex-col items-end gap-1">
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            disabled={!canCreateAvailability}
            title={!canCreateAvailability ? createPermissionMessage : undefined}
            onClick={() => handleAddAvailability()}
          >
            <CalendarPlus className="size-4" />
            <T i18nKey="availability.availability_module.add_availability" />
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canCreateAvailability}
            title={!canCreateAvailability ? createPermissionMessage : undefined}
            onClick={() => handleAddAvailability("not-available")}
          >
            <CalendarPlus className="size-4" />
            <T i18nKey="availability.availability_module.add_unavailable_period" />
          </Button>
        </div>
        {!canCreateAvailability ? (
          <p className="text-xs text-muted-foreground">
            {createPermissionMessage}
          </p>
        ) : null}
        </div> : null}
      </div>

      {isDevToolsEnabled ? <Card size="sm" className="gap-1">
        <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1 py-0 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium"><T i18nKey="availability.availability_module.data_source" /></span>
            <Badge variant={dataSource === "supabase" ? "default" : "outline"}>
              {dataSource === "supabase"
                ? "Supabase"
                : t("groups.data.local_fallback")}
            </Badge>
          </div>
          <span className="text-muted-foreground">
            {dataSource === "supabase"
              ? "Changes are saved to Supabase."
              : "Supabase is unavailable. Changes are saved locally in this browser."}
          </span>
          <span className="text-muted-foreground">
            <T i18nKey="availability.availability_module.availability_actions_use" />{" "}
            {activePermissionResolution.effectiveSource === "auth"
              ? t("common.auth_user_permissions")
              : activePermissionResolution.effectiveSource ===
                  "preview-fallback"
                ? "preview role permissions as a safe fallback"
                : "preview role permissions"}
            .
          </span>
          {activePermissionResolution.warning ? (
            <span className="text-amber-700">
              {activePermissionResolution.warning}
            </span>
          ) : null}
          {isCheckingAuthPermissions ? (
            <span className="text-muted-foreground">
              <T i18nKey="availability.availability_module.loading_auth_permissions_before_enabling_availability_actions" />
            </span>
          ) : null}
        </CardContent>
      </Card> : null}
      {supabaseError ? (
        <p className="text-xs text-red-700">
          <T i18nKey="availability.availability_module.supabase_read_issue" /> {supabaseError}
        </p>
      ) : null}
      {writeError ? (
        <p className="text-xs text-red-700">
          <T i18nKey="availability.availability_module.availability_write_issue" /> {writeError}
        </p>
      ) : null}

      {activeView === "submissions" ? (
        dataSource === "supabase" ? (
          <AnnualAvailabilitySubmissions
            submissions={supabaseSubmissions}
            guides={guides}
            availability={availability}
            groups={groups}
            circuits={circuits}
            canReview={canReviewAnnualSubmissions}
            reviewPermissionMessage={annualReviewPermissionMessage}
            onReviewed={refreshSupabaseAvailability}
          />
        ) : (
          <Card size="sm"><CardContent className="py-6 text-center text-sm text-muted-foreground"><T i18nKey="availability.availability_module.supabase_is_required_to_review_annual_availability_submissions" /></CardContent></Card>
        )
      ) : <>
      <AvailabilitySummaryCards
        availability={filteredAvailability}
        guides={guides}
        filters={filters}
      />

      {isDevToolsEnabled ? <YearlyAvailabilityRequest
        guides={guides}
        availability={availability}
      /> : null}

      <div className="flex items-start gap-2 rounded-lg border border-blue-200/80 bg-blue-50/50 px-3 py-2 text-xs text-blue-900">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <p>
          <span className="font-medium"><T i18nKey="availability.availability_module.assignment_blocking" /></span> <T i18nKey="availability.availability_module.assigned_groups_mark_guides_occupied_for_the_tour" />
        </p>
      </div>

      <AvailabilityFilters
        circuits={activeCircuits}
        languages={languages}
        values={filters}
        onChange={setFilters}
        onClear={() => setFilters(defaultFilters)}
        resultCount={filteredAvailability.length}
        totalCount={availability.length}
      />

      <AvailabilityTable
        availability={filteredAvailability}
        totalRecords={availability.length}
        guides={guides}
        circuits={circuits}
        selectedYears={filters.years}
        onEditAvailability={handleEditAvailability}
        onDeleteAvailability={setDeletingAvailability}
        canCreateAvailability={canCreateAvailability}
        canEditAvailability={canEditAvailability}
        canDeleteAvailability={canDeleteAvailability}
        createPermissionMessage={createPermissionMessage}
        editPermissionMessage={editPermissionMessage}
        deletePermissionMessage={deletePermissionMessage}
      />

      <AvailabilityFormDialog
        open={dialogOpen}
        mode={dialogMode}
        availability={editingAvailability}
        guides={guides}
        availabilityRecords={availability}
        groups={groups}
        circuits={activeCircuits}
        selectedYear={filters.years[0] ?? "2026"}
        createDefaults={createDefaults}
        helperText={
          dataSource === "supabase"
            ? "Changes are saved to Supabase."
            : "Supabase is unavailable. Changes are saved locally in this browser."
        }
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setEditingAvailability(null)
            setCreateDefaults({})
            setWriteError(null)
          }
        }}
        onSaveAvailability={handleSaveAvailability}
      />

      <Dialog
        open={Boolean(deletingAvailability)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingAvailability(null)
            setWriteError(null)
            setIsDeleting(false)
          }
        }}
      >
        {deletingAvailability ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle><T i18nKey="availability.availability_module.delete_availability" /></DialogTitle>
              <DialogDescription>
                {dataSource === "supabase"
                  ? "This archives the manual availability period in Supabase."
                  : "This removes the manual availability period from this local mock dataset."}
              </DialogDescription>
            </DialogHeader>
            {deletingAvailability.source === "assignment-generated" ||
            deletingAvailability.status === "occupied-by-assignment" ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                <T i18nKey="availability.availability_module.this_period_was_generated_from_an_assigned_group" />
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border p-3 text-sm">
                <div>
                  <span className="text-muted-foreground"><T i18nKey="availability.availability_module.guide" /> </span>
                  {deletingGuide?.name ?? t("change_requests.fallback.unknown_guide")}
                </div>
                <div>
                  <span className="text-muted-foreground"><T i18nKey="availability.availability_module.status" /> </span>
                  {deletingAvailability.status}
                </div>
                <div>
                  <span className="text-muted-foreground"><T i18nKey="availability.availability_module.dates" /> </span>
                  {formatDateDisplay(deletingAvailability.startDateIso)} -{" "}
                  {formatDateDisplay(deletingAvailability.endDateIso)}
                </div>
              </div>
            )}
            {writeError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {writeError}
              </div>
            ) : null}
            {!canDeleteAvailability ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {deletePermissionMessage}
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isDeleting}
                onClick={() => {
                  setDeletingAvailability(null)
                  setWriteError(null)
                }}
              >
                <T i18nKey="common.cancel" />
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={
                  isDeleting ||
                  !canDeleteAvailability ||
                  deletingAvailability.source === "assignment-generated" ||
                  deletingAvailability.status === "occupied-by-assignment"
                }
                title={!canDeleteAvailability ? deletePermissionMessage : undefined}
                onClick={handleDeleteAvailability}
              >
                {isDeleting ? t("availability.deleting") : t("availability.delete_action")}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
      </>}
    </div>
  )
}
