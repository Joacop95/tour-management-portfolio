"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { useEffect, useState, useSyncExternalStore } from "react"
import { Info } from "lucide-react"
import Link from "next/link"

import { useCurrentUserAccess } from "@/components/layout/current-user-access-provider"
import { ExportSection, type ExportDataset } from "@/components/import-export/export-section"
import { GuideImportSection } from "@/components/import-export/guide-import-section"
import { ImportSection } from "@/components/import-export/import-section"
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
  usePersistedAvailability,
  usePersistedCircuits,
  usePersistedGroups,
  usePersistedGuides,
} from "@/lib/hooks/use-persisted-mock-data"
import { getSupabaseAvailability } from "@/lib/supabase/queries/availability"
import { getAllSupabaseCircuits } from "@/lib/supabase/queries/circuits"
import { getSupabaseGroups } from "@/lib/supabase/queries/groups"
import { getSupabaseGuides } from "@/lib/supabase/queries/guides"
import { getGroupCodeCircuitMappings, type GroupCodeCircuitMapping } from "@/lib/supabase/queries/import-configuration"
import type {
  Circuit,
  Guide,
  GuideAvailability,
  TourGroup,
} from "@/lib/types/domain"
import {
  hasActivePermission,
  resolveActivePermissionKeys,
} from "@/lib/auth/permission-source"

type ImportExportDataSource = "local-fallback" | "supabase"

type SupabaseImportExportData = {
  groups: TourGroup[]
  guides: Guide[]
  availability: GuideAvailability[]
  circuits: Circuit[]
}

export function ImportExportModule() {
  const { t } = useI18n()
  const [activeArea, setActiveArea] = useState<"import" | "export">(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("area") === "export"
      ? "export"
      : "import"
  )
  const [activeImport, setActiveImport] = useState<"groups" | "guides">(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("type") === "guides"
      ? "guides"
      : "groups"
  )
  const fromPlanning = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("from") === "planning",
    () => false
  )
  const localGroups = usePersistedGroups()
  const localGuides = usePersistedGuides()
  const localAvailability = usePersistedAvailability()
  const localCircuits = usePersistedCircuits()
  const [supabaseData, setSupabaseData] =
    useState<SupabaseImportExportData | null>(null)
  const [supabaseError, setSupabaseError] = useState<string | null>(null)
  const [groupCodeMappings, setGroupCodeMappings] = useState<GroupCodeCircuitMapping[]>([])
  const { access: authAccess, isInitialLoading: isAuthAccessLoading } =
    useCurrentUserAccess()
  const appSettings = useAppSettings()
  const previewRole = usePreviewRole()
  const permissionSource = usePermissionSource()
  const dataSource: ImportExportDataSource = process.env.NODE_ENV === "production" || supabaseData
    ? "supabase"
    : "local-fallback"
  const groups = supabaseData?.groups ?? localGroups
  const guides = supabaseData?.guides ?? localGuides
  const availability = supabaseData?.availability ?? localAvailability
  const circuits = supabaseData?.circuits ?? localCircuits
  const activePermissionResolution = resolveActivePermissionKeys({
    permissionSource,
    appSettings,
    previewRole,
    authAccess,
  })
  const activePermissionKeys = activePermissionResolution.activePermissionKeys
  const isCheckingAuthPermissions =
    permissionSource === "auth" && isAuthAccessLoading
  const canManageGuideImport =
    !isCheckingAuthPermissions &&
    (hasActivePermission(activePermissionKeys, "guides.create") ||
      hasActivePermission(activePermissionKeys, "guides.edit"))
  const canImportGroups = !isCheckingAuthPermissions &&
    hasActivePermission(activePermissionKeys, "import_export.import_excel") &&
    hasActivePermission(activePermissionKeys, "groups.create")
  const realPermissionKeys = new Set(authAccess.permissionKeys)
  const canExport =
    authAccess.isAuthenticated &&
    realPermissionKeys.has("import_export.export_excel")
  const allowedExportDatasets: ExportDataset[] = canExport
    ? [
        realPermissionKeys.has("groups.view") ? "groups" : null,
        realPermissionKeys.has("guides.view") ? "guides" : null,
        realPermissionKeys.has("assignments.view") ? "assignments" : null,
        realPermissionKeys.has("availability.view") ? "availability" : null,
        realPermissionKeys.has("change_requests.view")
          ? "change-requests"
          : null,
      ].filter((value): value is ExportDataset => value !== null)
    : []

  async function refreshSupabaseGuides() {
    const guidesResult = await getSupabaseGuides()

    if (guidesResult.error) {
      return guidesResult.error
    }

    setSupabaseData((currentData) =>
      currentData ? { ...currentData, guides: guidesResult.data } : currentData
    )

    return null
  }

  async function refreshSupabaseGroups() {
    const result = await getSupabaseGroups()
    if (result.error) return result.error
    setSupabaseData((current) => current ? { ...current, groups: result.data } : current)
    return null
  }

  useEffect(() => {
    let isMounted = true

    async function loadSupabaseExportData() {
      try {
        const [groupsResult, guidesResult, availabilityResult, circuitsResult, mappingsResult] =
          await Promise.all([
            getSupabaseGroups(),
            getSupabaseGuides(),
            getSupabaseAvailability(),
            getAllSupabaseCircuits(),
            getGroupCodeCircuitMappings(),
          ])

        if (!isMounted) {
          return
        }

        const readError =
          groupsResult.error ??
          guidesResult.error ??
          availabilityResult.error ??
          circuitsResult.error ??
          mappingsResult.error

        if (readError) {
          setSupabaseData(null)
          setSupabaseError(readError)
          return
        }

        setSupabaseData({
          groups: groupsResult.data,
          guides: guidesResult.data,
          availability: availabilityResult.data,
          circuits: circuitsResult.data,
        })
        setGroupCodeMappings(mappingsResult.data)
        setSupabaseError(null)
      } catch (error) {
        if (!isMounted) {
          return
        }

        setSupabaseData(null)
        setSupabaseError(
          error instanceof Error
            ? error.message
            : "Unable to read Import / Export data from Supabase."
        )
      }
    }

    loadSupabaseExportData()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="space-y-4">
      {fromPlanning ? (
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href="/planning"><T i18nKey="import_export.import_export_module.return_to_planning" /></Link>
          </Button>
        </div>
      ) : null}
      {isDevToolsEnabled ? <Card size="sm">
        <CardContent className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-200">
            <Info className="size-4" />
          </div>
          <div className="space-y-1">
            <p className="font-medium"><T i18nKey="import_export.import_export_module.import_export_migration_status" /></p>
            <p className="text-sm leading-6 text-muted-foreground">
              <T i18nKey="import_export.import_export_module.group_and_guide_csv_import_use_guarded_supabase" />
            </p>
          </div>
        </CardContent>
      </Card> : null}

      {isDevToolsEnabled ? <Card size="sm">
        <CardContent className="space-y-2 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium"><T i18nKey="import_export.import_export_module.data_source" /></span>
            <Badge variant={dataSource === "supabase" ? "default" : "outline"}>
              {dataSource === "supabase" ? "Supabase" : t("groups.data.local_fallback")}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {dataSource === "supabase"
              ? "Exports use current permission-scoped Supabase data."
              : "Supabase is unavailable. Import previews can use local data, but operational export requires Supabase and Auth."}
          </p>
        </CardContent>
      </Card> : null}
      {supabaseError ? (
        <p className="text-xs text-red-700">
          <T i18nKey="import_export.import_export_module.supabase_operational_data_could_not_be_loaded" />
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b pb-3">
        {(["import", "export"] as const).map((area) => (
          <button
            key={area}
            type="button"
            className={`rounded-md border px-4 py-2 text-sm font-medium transition ${activeArea === area ? "border-primary/40 bg-primary/8" : "hover:bg-muted"}`}
            aria-pressed={activeArea === area}
            onClick={() => setActiveArea(area)}
          >
            {area === "import" ? t("import_export.section.import") : t("import_export.section.export")}
          </button>
        ))}
      </div>

      {activeArea === "import" ? (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {(["groups", "guides"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                className={`rounded-md border px-3 py-1.5 text-sm transition ${activeImport === kind ? "border-primary/40 bg-primary/8 font-medium" : "hover:bg-muted"}`}
                aria-pressed={activeImport === kind}
                onClick={() => setActiveImport(kind)}
              >
                {kind === "groups" ? t("navigation.groups") : t("navigation.guides")}
              </button>
            ))}
          </div>
          {activeImport === "groups" ? (
            <ImportSection
              circuits={circuits}
              guides={guides}
              groups={groups}
              mappings={groupCodeMappings}
              canPreview={!isCheckingAuthPermissions && hasActivePermission(activePermissionKeys, "import_export.view")}
              canApply={canImportGroups && dataSource === "supabase"}
              onApplied={refreshSupabaseGroups}
            />
          ) : (
            <GuideImportSection
              guides={guides}
              canPreview={!isCheckingAuthPermissions && hasActivePermission(activePermissionKeys, "import_export.view")}
              canApply={canManageGuideImport && hasActivePermission(activePermissionKeys, "import_export.import_excel") && dataSource === "supabase"}
              onApplied={refreshSupabaseGuides}
            />
          )}
        </div>
      ) : (
        <ExportSection
          groups={groups}
          circuits={circuits}
          guides={guides}
          availability={availability}
          allowedDatasets={allowedExportDatasets}
          isAuthenticated={authAccess.isAuthenticated}
          isSupabase={dataSource === "supabase"}
          loadError={supabaseError}
        />
      )}
    </div>
  )
}
