"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { useEffect, useMemo, useState } from "react"

import {
  GroupsFilters,
  type ConfirmationFilterValue,
  type GroupsFilterValues,
} from "@/components/groups/groups-filters"
import {
  GroupsSummaryCards,
  type GroupsSummaryAction,
} from "@/components/groups/groups-summary-cards"
import { CreateGroupDialog } from "@/components/groups/create-group-dialog"
import { EditGroupDialog } from "@/components/groups/edit-group-dialog"
import { GroupsTable } from "@/components/groups/groups-table"
import { useCurrentUserAccess } from "@/components/layout/current-user-access-provider"
import {
  useAppSettings,
  usePermissionSource,
  usePreviewRole,
} from "@/components/settings/settings-client-store"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { isDevToolsEnabled } from "@/lib/auth/runtime-mode"
import {
  hasActivePermission,
  resolveActivePermissionKeys,
} from "@/lib/auth/permission-source"
import type {
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
import {
  buildSupabaseGroupMutationInput,
  createSupabaseGroup,
  updateSupabaseGroup,
} from "@/lib/supabase/mutations/groups"
import { getSupabaseAvailability } from "@/lib/supabase/queries/availability"
import { getAllSupabaseCircuits } from "@/lib/supabase/queries/circuits"
import { getSupabaseGroups } from "@/lib/supabase/queries/groups"
import { getSupabaseGuides } from "@/lib/supabase/queries/guides"

const defaultFilters: GroupsFilterValues = {
  search: "",
  circuitIds: [],
  guideIds: [],
  groupStatuses: [],
  confirmationStatuses: [],
  dateFrom: "",
  dateTo: "",
  attention: "all",
}

type GroupsModuleProps = {
  circuits: Circuit[]
  guides: Guide[]
  groups: TourGroup[]
  availability: GuideAvailability[]
}

type GroupsDataSource = "local-fallback" | "supabase"

function dateRangeOverlapsGroup(
  group: TourGroup,
  dateFrom: string,
  dateTo: string
) {
  if (dateFrom && dateTo) {
    return group.startDateIso <= dateTo && group.endDateIso >= dateFrom
  }

  if (dateFrom) {
    return group.endDateIso >= dateFrom
  }

  if (dateTo) {
    return group.startDateIso <= dateTo
  }

  return true
}

function matchesConfirmationFilter(
  group: TourGroup,
  selectedStatuses: ConfirmationFilterValue[]
) {
  if (selectedStatuses.length === 0) {
    return true
  }

  return selectedStatuses.some((status) => {
    if (status === "without-guide") {
      return group.guideId === null
    }

    if (status === "assigned") {
      return group.assignmentStatus === "assigned"
    }

    return group.confirmationStatus === status
  })
}

function filterGroups(groups: TourGroup[], filters: GroupsFilterValues) {
  const search = filters.search.trim().toLowerCase()

  return groups.filter((group) => {
    const matchesSearch = search
      ? group.code.toLowerCase().includes(search)
      : true
    const matchesCircuit =
      filters.circuitIds.length === 0 ||
      filters.circuitIds.includes(group.circuitId)
    const matchesGuide =
      filters.guideIds.length === 0 ||
      filters.guideIds.some((guideId) =>
        guideId === "without-guide"
          ? group.guideId === null
          : group.guideId === guideId
      )
    const matchesGroupStatus =
      filters.groupStatuses.length === 0 ||
      filters.groupStatuses.includes(group.groupStatus)
    const matchesConfirmation = matchesConfirmationFilter(
      group,
      filters.confirmationStatuses
    )
    const matchesDates = dateRangeOverlapsGroup(
      group,
      filters.dateFrom,
      filters.dateTo
    )
    const matchesAttention =
      filters.attention === "all" ||
      (filters.attention === "without-guide" && group.guideId === null) ||
      (filters.attention === "pending-guide-confirmation" &&
        group.guideId !== null &&
        group.confirmationStatus === "pending-confirmation")

    return (
      matchesSearch &&
      matchesCircuit &&
      matchesGuide &&
      matchesGroupStatus &&
      matchesConfirmation &&
      matchesDates &&
      matchesAttention
    )
  })
}

function getOperationalGroupPriority(group: TourGroup) {
  if (group.groupStatus === "active" && group.guideId === null) {
    return 0
  }

  if (
    group.groupStatus === "active" &&
    group.guideId !== null &&
    group.confirmationStatus === "pending-confirmation"
  ) {
    return 1
  }

  if (group.groupStatus === "active") {
    return 2
  }

  return 3
}

function sortGroupsForOperations(groups: TourGroup[]) {
  return [...groups].sort((firstGroup, secondGroup) => {
    const priorityDifference =
      getOperationalGroupPriority(firstGroup) -
      getOperationalGroupPriority(secondGroup)

    if (priorityDifference !== 0) {
      return priorityDifference
    }

    return firstGroup.startDateIso.localeCompare(secondGroup.startDateIso)
  })
}

export function GroupsModule({}: GroupsModuleProps) {
  const { t } = useI18n()
  const [filters, setFilters] = useState<GroupsFilterValues>(defaultFilters)
  const [editingGroup, setEditingGroup] = useState<TourGroup | null>(null)
  const [supabaseGroups, setSupabaseGroups] = useState<TourGroup[] | null>(null)
  const [supabaseGuides, setSupabaseGuides] = useState<Guide[] | null>(null)
  const [supabaseCircuits, setSupabaseCircuits] = useState<Circuit[] | null>(
    null
  )
  const [supabaseAvailability, setSupabaseAvailability] = useState<
    GuideAvailability[] | null
  >(null)
  const [supabaseError, setSupabaseError] = useState<string | null>(null)
  const [writeError, setWriteError] = useState<string | null>(null)
  const { access: authAccess, isInitialLoading: isAuthAccessLoading } =
    useCurrentUserAccess()
  const localGroups = usePersistedGroups()
  const localGuides = usePersistedGuides()
  const localAvailability = usePersistedAvailability()
  const localCircuits = usePersistedCircuits()
  const appSettings = useAppSettings()
  const previewRole = usePreviewRole()
  const permissionSource = usePermissionSource()
  const dataSource: GroupsDataSource = process.env.NODE_ENV === "production" || supabaseGroups
    ? "supabase"
    : "local-fallback"
  const groups = supabaseGroups ?? localGroups
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
  const availability = useMemo(
    () =>
      dataSource === "supabase"
        ? (supabaseAvailability ?? [])
        : localAvailability,
    [dataSource, localAvailability, supabaseAvailability]
  )
  const activeCircuits = useMemo(
    () => circuits.filter((circuit) => circuit.isActive !== false),
    [circuits]
  )
  const filteredGroups = useMemo(
    () => sortGroupsForOperations(filterGroups(groups, filters)),
    [filters, groups]
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
  const canCreateGroup =
    !isCheckingAuthPermissions &&
    hasActivePermission(activePermissionKeys, "groups.create")
  const canEditGroup =
    !isCheckingAuthPermissions &&
    hasActivePermission(activePermissionKeys, "groups.edit")
  const canAssignGuide =
    !isCheckingAuthPermissions &&
    hasActivePermission(activePermissionKeys, "groups.assign_guide")
  const canConfirmGuide =
    !isCheckingAuthPermissions &&
    hasActivePermission(activePermissionKeys, "groups.confirm_guide")

  async function refreshSupabaseData() {
    const [groupsResult, guidesResult, circuitsResult, availabilityResult] =
      await Promise.all([
        getSupabaseGroups(),
        getSupabaseGuides(),
        getAllSupabaseCircuits(),
        getSupabaseAvailability(),
      ])

    if (groupsResult.error) {
      setSupabaseGroups(null)
      setSupabaseGuides(null)
      setSupabaseCircuits(null)
      setSupabaseAvailability(null)
      setSupabaseError(groupsResult.error)
      return groupsResult.error
    }

    setSupabaseGroups(groupsResult.data)
    setSupabaseGuides(guidesResult.error ? [] : guidesResult.data)
    setSupabaseCircuits(circuitsResult.error ? [] : circuitsResult.data)
    setSupabaseAvailability(
      availabilityResult.error ? [] : availabilityResult.data
    )
    setSupabaseError(
      guidesResult.error ?? circuitsResult.error ?? availabilityResult.error
    )
    return null
  }

  useEffect(() => {
    let isMounted = true

    async function loadSupabaseGroups() {
      const [groupsResult, guidesResult, circuitsResult, availabilityResult] =
        await Promise.all([
          getSupabaseGroups(),
          getSupabaseGuides(),
          getAllSupabaseCircuits(),
          getSupabaseAvailability(),
        ])

      if (!isMounted) {
        return
      }

      if (groupsResult.error) {
        setSupabaseGroups(null)
        setSupabaseGuides(null)
        setSupabaseCircuits(null)
        setSupabaseAvailability(null)
        setSupabaseError(groupsResult.error)
        return
      }

      setSupabaseGroups(groupsResult.data)
      setSupabaseGuides(guidesResult.error ? [] : guidesResult.data)
      setSupabaseCircuits(circuitsResult.error ? [] : circuitsResult.data)
      setSupabaseAvailability(
        availabilityResult.error ? [] : availabilityResult.data
      )
      setSupabaseError(
        guidesResult.error ?? circuitsResult.error ?? availabilityResult.error
      )
    }

    loadSupabaseGroups()

    return () => {
      isMounted = false
    }
  }, [])

  async function handleSaveGroup(updatedGroup: TourGroup) {
    setWriteError(null)
    const original = groups.find((group) => group.id === updatedGroup.id)
    if (!original) return t("groups.error.no_longer_available")

    if (dataSource === "supabase") {
      const result = await updateSupabaseGroup(
        updatedGroup.id,
        buildSupabaseGroupMutationInput(updatedGroup),
        original
      )

      if (result.error) {
        setWriteError(result.error)
        return result.error
      }

      const refreshError = await refreshSupabaseData()

      if (refreshError) {
        setWriteError(refreshError)
        return refreshError
      }

      return null
    }

    if (original.groupStatus !== updatedGroup.groupStatus) {
      return t("groups.error.status_requires_connection")
    }

    const groupExists = localGroups.some((group) => group.id === updatedGroup.id)
    const updatedGroups = groupExists
      ? localGroups.map((group) =>
          group.id === updatedGroup.id ? updatedGroup : group
        )
      : [updatedGroup, ...localGroups]

    writeLocalStorageValue(localStorageKeys.groups, updatedGroups)
    return null
  }

  async function handleCreateGroup(group: TourGroup) {
    setWriteError(null)

    if (dataSource === "supabase") {
      const result = await createSupabaseGroup(
        buildSupabaseGroupMutationInput(group)
      )

      if (result.error) {
        setWriteError(result.error)
        return result.error
      }

      const refreshError = await refreshSupabaseData()

      if (refreshError) {
        setWriteError(refreshError)
        return refreshError
      }

      return null
    }

    writeLocalStorageValue(localStorageKeys.groups, [group, ...localGroups])
    return null
  }

  function handleSummaryAction(action: GroupsSummaryAction) {
    if (action === "active") {
      setFilters({ ...defaultFilters, groupStatuses: ["active"] })
      return
    }

    if (action === "without-guide") {
      setFilters({ ...defaultFilters, attention: "without-guide" })
      return
    }

    if (action === "pending-confirmation") {
      setFilters({
        ...defaultFilters,
        attention: "pending-guide-confirmation",
      })
      return
    }

    setFilters({ ...defaultFilters, groupStatuses: ["cxl", "fusionado"] })
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <CreateGroupDialog
          circuits={activeCircuits}
          guides={guides}
          existingGroups={groups}
          availability={availability}
          canCreateGroup={canCreateGroup}
          canAssignGuide={dataSource !== "supabase" || hasActivePermission(activePermissionKeys, "assignments.assign_guide")}
          canConfirmGuide={dataSource !== "supabase" || hasActivePermission(activePermissionKeys, "assignments.confirm_guide")}
          createPermissionMessage={
            isCheckingAuthPermissions
              ? "Loading Auth permissions."
              : "You do not have permission to create groups."
          }
          helperText={
            !isDevToolsEnabled
              ? ""
              : dataSource === "supabase"
              ? "Changes are saved to Supabase. Assignment history is stored in the assignments table."
              : "Supabase is unavailable. Changes are saved locally in this browser."
          }
          onCreateGroup={handleCreateGroup}
        />
      </div>
      {isDevToolsEnabled ? <Card>
        <CardContent className="space-y-2 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium"><T i18nKey="groups.groups_module.data_source" /></span>
            <Badge variant={dataSource === "supabase" ? "default" : "outline"}>
              {dataSource === "supabase" ? "Supabase" : t("groups.data.local_fallback")}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {dataSource === "supabase"
              ? "Changes are saved to Supabase."
              : "Supabase is unavailable. Changes are saved locally in this browser."}
          </p>
          <p className="text-muted-foreground">
            <T i18nKey="groups.groups_module.groups_actions_use" />{" "}
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
              <T i18nKey="groups.groups_module.loading_auth_permissions_before_enabling_group_actions" />
            </p>
          ) : null}
        </CardContent>
      </Card> : null}
      {supabaseError ? (
        <p className="text-xs text-red-700">
          <T i18nKey="groups.groups_module.supabase_read_issue" /> {supabaseError}
        </p>
      ) : null}
      {writeError ? (
        <p className="text-xs text-red-700">
          <T i18nKey="groups.groups_module.group_save_failed" /> {writeError}
        </p>
      ) : null}
      <GroupsSummaryCards groups={groups} onSelect={handleSummaryAction} />
      <GroupsFilters
        circuits={activeCircuits}
        guides={guides}
        values={filters}
        onChange={setFilters}
        onClear={() => setFilters(defaultFilters)}
        resultCount={filteredGroups.length}
        totalCount={groups.length}
      />
      <GroupsTable
        circuits={circuits}
        guides={guides}
        groups={filteredGroups}
        totalGroups={groups.length}
        onEditGroup={(group) => {
          if (canEditGroup) {
            setEditingGroup(group)
          }
        }}
        canAssignGuide={canAssignGuide}
        canConfirmGuide={canConfirmGuide}
        canEditGroup={canEditGroup}
        assignPermissionMessage="You do not have permission to assign guides."
        confirmPermissionMessage="You do not have permission to confirm guides."
        editPermissionMessage="You do not have permission to edit groups."
      />
      <EditGroupDialog
        open={Boolean(editingGroup)}
        group={editingGroup}
        circuits={activeCircuits}
        guides={guides}
        existingGroups={groups}
        availability={availability}
        canAssignGuide={dataSource !== "supabase" || hasActivePermission(activePermissionKeys, "assignments.assign_guide")}
        canChangeGuide={dataSource !== "supabase" || hasActivePermission(activePermissionKeys, "assignments.change_guide")}
        canConfirmGuide={dataSource !== "supabase" || hasActivePermission(activePermissionKeys, "assignments.confirm_guide")}
        helperText={
          !isDevToolsEnabled
            ? ""
            : dataSource === "supabase"
            ? "Changes are saved to Supabase. Guide changes create assignment history."
            : "Supabase is unavailable. Changes are saved locally in this browser."
        }
        onOpenChange={(open) => {
          if (!open) {
            setEditingGroup(null)
            setWriteError(null)
          }
        }}
        onSaveGroup={handleSaveGroup}
      />
    </>
  )
}
