"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { useEffect, useMemo, useRef, useState } from "react"
import { UserPlus } from "lucide-react"

import { GuideFormDialog } from "@/components/guides/guide-form-dialog"
import {
  GuidesFilters,
  type GuidesFilterValues,
} from "@/components/guides/guides-filters"
import { GuidesSummaryCards } from "@/components/guides/guides-summary-cards"
import { GuidesTable } from "@/components/guides/guides-table"
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
  hasActivePermission,
  resolveActivePermissionKeys,
} from "@/lib/auth/permission-source"
import type { Circuit, Guide, TourGroup } from "@/lib/types/domain"
import {
  usePersistedCircuits,
  usePersistedGuides,
} from "@/lib/hooks/use-persisted-mock-data"
import {
  buildSupabaseGuideMutationInput,
  createSupabaseGuide,
  updateSupabaseGuide,
  upsertPrimaryGuideAuthorizedEmail,
} from "@/lib/supabase/mutations/guides"
import { getAllSupabaseCircuits } from "@/lib/supabase/queries/circuits"
import { getCurrentGuideAssignmentCounts, getSupabaseGuides } from "@/lib/supabase/queries/guides"
import {
  localStorageKeys,
  writeLocalStorageValue,
} from "@/lib/utils/local-storage"
import { normalizeLanguageOptions } from "@/lib/utils/language-options"

const defaultFilters: GuidesFilterValues = {
  search: "",
  status: "all",
  preferredLanguage: "all",
  circuitIds: [],
}

type GuidesModuleProps = {
  circuits: Circuit[]
  guides: Guide[]
  groups: TourGroup[]
}

type GuidesDataSource = "local-fallback" | "supabase"

function filterGuides(guides: Guide[], filters: GuidesFilterValues) {
  const search = filters.search.trim().toLowerCase()

  return guides.filter((guide) => {
    const matchesSearch = search
      ? guide.name.toLowerCase().includes(search) ||
        guide.email.toLowerCase().includes(search)
      : true
    const matchesStatus =
      filters.status === "all" || guide.status === filters.status
    const matchesPreferredLanguage =
      filters.preferredLanguage === "all" ||
      guide.preferredLanguage === filters.preferredLanguage
    const matchesCircuit =
      filters.circuitIds.length === 0 ||
      filters.circuitIds.some((circuitId) =>
        guide.circuitIds.includes(circuitId)
      )

    return (
      matchesSearch &&
      matchesStatus &&
      matchesPreferredLanguage &&
      matchesCircuit
    )
  })
}

export function GuidesModule({ groups }: GuidesModuleProps) {
  const { t } = useI18n()
  const [filters, setFilters] = useState<GuidesFilterValues>(defaultFilters)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [editingGuide, setEditingGuide] = useState<Guide | null>(null)
  const [isViewingGuide, setIsViewingGuide] = useState(false)
  const [supabaseGuides, setSupabaseGuides] = useState<Guide[] | null>(null)
  const [supabaseCircuits, setSupabaseCircuits] = useState<Circuit[] | null>(
    null
  )
  const [supabaseAssignmentCounts, setSupabaseAssignmentCounts] = useState<Record<string, number> | null>(null)
  const [supabaseError, setSupabaseError] = useState<string | null>(null)
  const [writeError, setWriteError] = useState<string | null>(null)
  const [pendingStatusGuideId, setPendingStatusGuideId] = useState<string | null>(null)
  const pendingStatusGuideIdRef = useRef<string | null>(null)
  const { access: authAccess, isInitialLoading: isAuthAccessLoading } =
    useCurrentUserAccess()
  const localGuides = usePersistedGuides()
  const localCircuits = usePersistedCircuits()
  const appSettings = useAppSettings()
  const previewRole = usePreviewRole()
  const permissionSource = usePermissionSource()
  const dataSource: GuidesDataSource = process.env.NODE_ENV === "production" || supabaseGuides
    ? "supabase"
    : "local-fallback"
  const guides = supabaseGuides ?? localGuides
  const circuits = useMemo(
    () =>
      dataSource === "supabase"
        ? (supabaseCircuits ?? [])
        : localCircuits,
    [dataSource, localCircuits, supabaseCircuits]
  )
  const activeCircuits = useMemo(
    () => circuits.filter((circuit) => circuit.isActive !== false),
    [circuits]
  )
  const activePermissionResolution = resolveActivePermissionKeys({
    permissionSource,
    appSettings,
    previewRole,
    authAccess,
  })
  const activePermissionKeys = activePermissionResolution.activePermissionKeys
  const isCheckingAuthPermissions =
    permissionSource === "auth" && isAuthAccessLoading
  const canCreateGuide =
    !isCheckingAuthPermissions &&
    hasActivePermission(activePermissionKeys, "guides.create")
  const canEditGuide =
    !isCheckingAuthPermissions &&
    hasActivePermission(activePermissionKeys, "guides.edit")
  const canViewGuide =
    !isCheckingAuthPermissions &&
    hasActivePermission(activePermissionKeys, "guides.view")
  const languages = useMemo(
    () =>
      normalizeLanguageOptions(
        guides.map((guide) => guide.preferredLanguage)
      ),
    [guides]
  )
  const filteredGuides = useMemo(
    () => filterGuides(guides, filters),
    [guides, filters]
  )
  const activeEditingGuide =
    editingGuide && dialogMode === "edit"
      ? guides.find((guide) => guide.id === editingGuide.id) ?? editingGuide
      : editingGuide

  async function refreshSupabaseData() {
    const [guidesResult, circuitsResult] = await Promise.all([
      getSupabaseGuides(),
      getAllSupabaseCircuits(),
    ])

    if (guidesResult.error) {
      setSupabaseGuides(null)
      setSupabaseCircuits(null)
      setSupabaseAssignmentCounts(null)
      setSupabaseError(guidesResult.error)
      return guidesResult.error
    }

    const countsResult = await getCurrentGuideAssignmentCounts(guidesResult.data.map((guide) => guide.id))
    setSupabaseGuides(guidesResult.data)
    setSupabaseCircuits(circuitsResult.error ? [] : circuitsResult.data)
    setSupabaseAssignmentCounts(countsResult.error ? null : countsResult.data)
    setSupabaseError(circuitsResult.error ?? countsResult.error)
    return circuitsResult.error ?? countsResult.error
  }

  useEffect(() => {
    let isMounted = true

    async function loadSupabaseGuides() {
      const [guidesResult, circuitsResult] = await Promise.all([
        getSupabaseGuides(),
        getAllSupabaseCircuits(),
      ])

      const countsResult = guidesResult.error
        ? null
        : await getCurrentGuideAssignmentCounts(guidesResult.data.map((guide) => guide.id))

      if (!isMounted) {
        return
      }

      if (guidesResult.error) {
        setSupabaseGuides(null)
        setSupabaseCircuits(null)
        setSupabaseAssignmentCounts(null)
        setSupabaseError(guidesResult.error)
        return
      }

      setSupabaseGuides(guidesResult.data)
      setSupabaseCircuits(circuitsResult.error ? [] : circuitsResult.data)
      setSupabaseAssignmentCounts(countsResult?.error ? null : countsResult?.data ?? {})
      setSupabaseError(circuitsResult.error ?? countsResult?.error ?? null)
    }

    loadSupabaseGuides()

    return () => {
      isMounted = false
    }
  }, [])

  function handleCreateGuide() {
    if (!canCreateGuide) {
      return
    }

    setDialogMode("create")
    setEditingGuide(null)
    setIsViewingGuide(false)
    setWriteError(null)
    setDialogOpen(true)
  }

  function handleEditGuide(guide: Guide) {
    if (!canEditGuide) {
      return
    }

    setDialogMode("edit")
    setEditingGuide(guide)
    setIsViewingGuide(false)
    setWriteError(null)
    setDialogOpen(true)
  }

  function handleViewGuide(guide: Guide) {
    if (!canViewGuide) {
      return
    }

    setDialogMode("edit")
    setEditingGuide(guide)
    setIsViewingGuide(true)
    setWriteError(null)
    setDialogOpen(true)
  }

  async function handleSaveGuide(guide: Guide) {
    setWriteError(null)

    const result = await persistGuide(guide, dialogMode === "edit" && editingGuide ? "edit" : "create")
    if (result) setWriteError(result)
    return result
  }

  async function persistGuide(guide: Guide, mode: "create" | "edit", statusOnly = false) {
    if (dataSource === "supabase") {
      const result =
        mode === "edit"
          ? await updateSupabaseGuide(
              guide.id,
              buildSupabaseGuideMutationInput(guide),
              { statusOnly }
            )
          : await createSupabaseGuide(buildSupabaseGuideMutationInput(guide))

      if (result.error) {
        return result.error
      }

      const refreshError = await refreshSupabaseData()

      if (refreshError) {
        return refreshError
      }

      return null
    }

    const guideExists = localGuides.some((item) => item.id === guide.id)

    if (!guideExists) {
      writeLocalStorageValue(localStorageKeys.guides, [guide, ...localGuides])
      return null
    }

    const updatedGuides = localGuides.map((item) =>
      item.id === guide.id
        ? statusOnly ? { ...item, status: guide.status } : guide
        : item
    )

    writeLocalStorageValue(localStorageKeys.guides, updatedGuides)
    return null
  }

  async function handleToggleGuideStatus(guide: Guide) {
    if (!canEditGuide || pendingStatusGuideIdRef.current) return

    pendingStatusGuideIdRef.current = guide.id
    setPendingStatusGuideId(guide.id)
    setWriteError(null)

    try {
      const nextStatus = guide.status === "active" ? "inactive" : "active"
      const error = await persistGuide({ ...guide, status: nextStatus }, "edit", true)
      if (error) setWriteError(error)
    } finally {
      pendingStatusGuideIdRef.current = null
      setPendingStatusGuideId(null)
    }
  }

  async function handleSaveCurrentAuthorizedLoginEmail(input: {
    email: string
    status: "allowed" | "invited" | "registered"
    notes: string | null
  }) {
    if (dataSource !== "supabase" || !activeEditingGuide || !canEditGuide) {
      return t("guides.error.manage_login_email_denied")
    }

    const result = await upsertPrimaryGuideAuthorizedEmail({
      guideId: activeEditingGuide.id,
      email: input.email,
      status: input.status,
      notes: input.notes,
    })

    if (result.error) {
      return result.error
    }

    return refreshSupabaseData()
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <div className="grid justify-items-end gap-1">
          <Button
            type="button"
            onClick={handleCreateGuide}
            disabled={!canCreateGuide}
            title={
              canCreateGuide
                ? undefined
                : "You do not have permission to create guides."
            }
          >
            <UserPlus className="size-4" />
            <T i18nKey="guides.guides_module.create_guide" />
          </Button>
          {!canCreateGuide ? (
            <p className="text-xs text-muted-foreground">
              {isCheckingAuthPermissions
                ? "Loading Auth permissions."
                : "You do not have permission to create guides."}
            </p>
          ) : null}
        </div>
      </div>
      {isDevToolsEnabled ? <Card>
        <CardContent className="space-y-2 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium"><T i18nKey="guides.guides_module.data_source" /></span>
            <Badge
              variant={dataSource === "supabase" ? "default" : "outline"}
            >
              {dataSource === "supabase" ? "Supabase" : t("groups.data.local_fallback")}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {dataSource === "supabase"
              ? "Changes are saved to Supabase."
              : "Supabase is unavailable. Changes are saved locally in this browser."}
          </p>
          <p className="text-muted-foreground">
            <T i18nKey="guides.guides_module.guides_actions_use" />{" "}
            {activePermissionResolution.effectiveSource === "auth"
              ? t("common.auth_user_permissions")
              : activePermissionResolution.effectiveSource ===
                  "preview-fallback"
                ? "preview role permissions as a safe fallback"
                : "preview role permissions"}
            .
          </p>
          {activePermissionResolution.warning ? (
            <p className="text-xs text-amber-700">
              {activePermissionResolution.warning}
            </p>
          ) : null}
          {isCheckingAuthPermissions ? (
            <p className="text-xs text-muted-foreground">
              <T i18nKey="guides.guides_module.loading_auth_permissions_before_enabling_guide_actions" />
            </p>
          ) : null}
        </CardContent>
      </Card> : null}
      {supabaseError ? (
        <p className="text-xs text-red-700">
          <T i18nKey="guides.guides_module.supabase_read_issue" /> {supabaseError}
        </p>
      ) : null}
      {writeError ? (
        <p className="text-xs text-red-700">
          <T i18nKey="guides.guides_module.guide_save_failed" /> {writeError}
        </p>
      ) : null}
      <GuidesSummaryCards guides={guides} />
      <GuidesFilters
        circuits={activeCircuits}
        languages={languages}
        values={filters}
        onChange={setFilters}
        onClear={() => setFilters(defaultFilters)}
        resultCount={filteredGuides.length}
        totalCount={guides.length}
      />
      <GuidesTable
        circuits={circuits}
        guides={filteredGuides}
        totalGuides={guides.length}
        groups={groups}
        assignedGroupCounts={dataSource === "supabase" ? supabaseAssignmentCounts : undefined}
        showChangeRequestMetrics={
          appSettings.display.showGuideChangeRequestMetrics
        }
        showInternalGuideMetrics={appSettings.display.showInternalGuideMetrics}
        showInternalRating={appSettings.guideMetrics.enableInternalRating}
        showSalesRanking={
          appSettings.display.showSalesRanking &&
          appSettings.guideMetrics.enableSalesRanking
        }
        showSalesScore={
          appSettings.display.showSalesRanking &&
          appSettings.guideMetrics.enableSalesScore
        }
        onEditGuide={handleEditGuide}
        onViewGuide={handleViewGuide}
        onToggleGuideStatus={handleToggleGuideStatus}
        pendingStatusGuideId={pendingStatusGuideId}
        canViewGuide={canViewGuide}
        canEditGuide={canEditGuide}
        editPermissionMessage="You do not have permission to edit guides."
      />
      <GuideFormDialog
        open={dialogOpen}
        mode={dialogMode}
        guide={activeEditingGuide}
        circuits={activeCircuits}
        existingGuides={guides}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setEditingGuide(null)
            setIsViewingGuide(false)
            setWriteError(null)
          }
        }}
        onSaveGuide={handleSaveGuide}
        readOnly={isViewingGuide}
        currentAuthorizedLoginEmailEnabled={
          dataSource === "supabase" && dialogMode === "edit"
        }
        onSaveCurrentAuthorizedLoginEmail={
          handleSaveCurrentAuthorizedLoginEmail
        }
        helperText={
          !isDevToolsEnabled
            ? ""
            : dataSource === "supabase"
            ? "Changes are saved to Supabase. Auth users and invitations are not created yet."
            : "Supabase is unavailable. Changes are saved locally in this browser."
        }
      />
    </>
  )
}
