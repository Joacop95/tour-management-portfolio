"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react"

import {
  CandidateGuidesTable,
  type CandidateGuide,
} from "@/components/assignments/candidate-guides-table"
import { GroupBrowser } from "@/components/assignments/group-browser"
import { SelectedGroupCard } from "@/components/assignments/selected-group-card"
import { useCurrentUserAccess } from "@/components/layout/current-user-access-provider"
import {
  useAppSettings,
  usePermissionSource,
  usePreviewRole,
} from "@/components/settings/settings-client-store"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { localStorageKeys, writeLocalStorageValue } from "@/lib/utils/local-storage"
import { buildCandidateGuides } from "@/lib/utils/assignment-candidates"
import { getSupabaseAvailability } from "@/lib/supabase/queries/availability"
import { getActiveSupabaseCircuits } from "@/lib/supabase/queries/circuits"
import { getSupabaseGroups } from "@/lib/supabase/queries/groups"
import { getSupabaseGuides } from "@/lib/supabase/queries/guides"
import {
  assignSupabaseGuideToGroup,
  changeSupabaseGuideForGroup,
  confirmSupabaseGroupGuide,
  removeSupabaseGuideFromGroup,
} from "@/lib/supabase/mutations/assignments"

type AssignmentsModuleProps = {
  groups: TourGroup[]
  guides: Guide[]
  availability: GuideAvailability[]
  circuits: Circuit[]
}

type AssignmentsDataSource = "local-fallback" | "supabase"

function getGuide(guides: Guide[], guideId: string | null) {
  if (!guideId) {
    return undefined
  }

  return guides.find((guide) => guide.id === guideId)
}

function getCircuit(circuits: Circuit[], circuitId: string) {
  return circuits.find((circuit) => circuit.id === circuitId)
}

function AssignmentSummaryCards({
  candidates,
}: {
  candidates: CandidateGuide[]
}) {
  const { t } = useI18n()
  const availableCandidates = candidates.filter(
    (candidate) =>
      candidate.guide.status === "active" &&
      candidate.circuitResult === "match" &&
      candidate.languageResult !== "not-listed" &&
      candidate.availabilityResult === "available" &&
      candidate.conflictResult === "clear"
  ).length
  const needsReview = candidates.filter(
    (candidate) =>
      candidate.guide.status === "active" &&
      candidate.availabilityResult === "needs-review"
  ).length
  const conflictsOrUnavailable = candidates.filter(
    (candidate) =>
      candidate.availabilityResult === "occupied" ||
      candidate.availabilityResult === "not-available"
  ).length
  const summaries = [
    {
      label: t("assignments.summary.available_candidates"),
      value: availableCandidates,
      icon: CheckCircle2,
      tone: "text-emerald-700 bg-emerald-50 ring-emerald-200",
    },
    {
      label: t("status.needs_review"),
      value: needsReview,
      icon: HelpCircle,
      tone: "text-amber-800 bg-amber-50 ring-amber-200",
    },
    {
      label: t("assignments.summary.conflicts_not_available"),
      value: conflictsOrUnavailable,
      icon: AlertTriangle,
      tone: "text-red-700 bg-red-50 ring-red-200",
    },
  ]

  return (
    <section className="grid gap-2 md:grid-cols-3">
      {summaries.map((summary) => {
        const Icon = summary.icon

        return (
          <Card key={summary.label} size="sm">
            <CardHeader className="gap-1 pb-1">
              <CardTitle className="text-xs text-muted-foreground">
                {summary.label}
              </CardTitle>
              <CardAction>
                <div
                  className={`flex size-8 items-center justify-center rounded-lg ring-1 ${summary.tone}`}
                >
                  <Icon className="size-4" />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xl font-semibold">{summary.value}</p>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}

async function readSupabaseAssignmentsData() {
  let groupsResult: Awaited<ReturnType<typeof getSupabaseGroups>>
  let guidesResult: Awaited<ReturnType<typeof getSupabaseGuides>>
  let availabilityResult: Awaited<ReturnType<typeof getSupabaseAvailability>>
  let circuitsResult: Awaited<ReturnType<typeof getActiveSupabaseCircuits>>

  try {
    const results = await Promise.all([
      getSupabaseGroups(),
      getSupabaseGuides(),
      getSupabaseAvailability(),
      getActiveSupabaseCircuits(),
    ])

    groupsResult = results[0]
    guidesResult = results[1]
    availabilityResult = results[2]
    circuitsResult = results[3]
  } catch (error) {
    return {
      groups: null,
      guides: null,
      availability: null,
      circuits: null,
      error:
        error instanceof Error
          ? error.message
          : "Supabase assignments read failed.",
    }
  }

  const readError =
    groupsResult.error ??
    guidesResult.error ??
    availabilityResult.error ??
    circuitsResult.error

  if (readError) {
    return {
      groups: null,
      guides: null,
      availability: null,
      circuits: null,
      error: readError,
    }
  }

  return {
    groups: groupsResult.data,
    guides: guidesResult.data,
    availability: availabilityResult.data,
    circuits: circuitsResult.data,
    error: null,
  }
}

export function AssignmentsModule({
}: AssignmentsModuleProps) {
  const { t } = useI18n()
  const persistedGroups = usePersistedGroups()
  const persistedGuides = usePersistedGuides()
  const persistedAvailability = usePersistedAvailability()
  const persistedCircuits = usePersistedCircuits()
  const [supabaseGroups, setSupabaseGroups] = useState<TourGroup[] | null>(null)
  const [supabaseGuides, setSupabaseGuides] = useState<Guide[] | null>(null)
  const [supabaseAvailability, setSupabaseAvailability] = useState<
    GuideAvailability[] | null
  >(null)
  const [supabaseCircuits, setSupabaseCircuits] = useState<Circuit[] | null>(
    null
  )
  const [supabaseError, setSupabaseError] = useState<string | null>(null)
  const dataSource: AssignmentsDataSource = process.env.NODE_ENV === "production" || supabaseGroups
    ? "supabase"
    : "local-fallback"
  const groups = useMemo(
    () => (dataSource === "supabase" ? (supabaseGroups ?? []) : persistedGroups),
    [dataSource, persistedGroups, supabaseGroups]
  )
  const guides = useMemo(
    () => (dataSource === "supabase" ? (supabaseGuides ?? []) : persistedGuides),
    [dataSource, persistedGuides, supabaseGuides]
  )
  const availability = useMemo(
    () =>
      dataSource === "supabase"
        ? (supabaseAvailability ?? [])
        : persistedAvailability,
    [dataSource, persistedAvailability, supabaseAvailability]
  )
  const circuits = useMemo(
    () =>
      dataSource === "supabase" ? (supabaseCircuits ?? []) : persistedCircuits,
    [dataSource, persistedCircuits, supabaseCircuits]
  )
  const initialGroupId =
    groups.find((group) => group.guideId === null)?.id ??
    groups[0]?.id ??
    null
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    initialGroupId
  )
  const [assignmentMessage, setAssignmentMessage] = useState<{
    tone: "success" | "warning" | "error"
    text: string
  } | null>(null)
  const [isSavingAssignment, setIsSavingAssignment] = useState(false)
  const { access: authAccess, isInitialLoading: isAuthAccessLoading } =
    useCurrentUserAccess()
  const appSettings = useAppSettings()
  const previewRole = usePreviewRole()
  const permissionSource = usePermissionSource()
  const activePermissionResolution = resolveActivePermissionKeys({
    permissionSource,
    appSettings,
    previewRole,
    authAccess,
  })
  const activePermissionKeys = activePermissionResolution.activePermissionKeys
  const isCheckingAuthPermissions =
    permissionSource === "auth" && isAuthAccessLoading
  const canAssignGuide =
    !isCheckingAuthPermissions &&
    hasActivePermission(activePermissionKeys, "assignments.assign_guide")
  const canChangeGuide =
    !isCheckingAuthPermissions &&
    hasActivePermission(activePermissionKeys, "assignments.change_guide")
  const canConfirmGuide =
    !isCheckingAuthPermissions &&
    hasActivePermission(activePermissionKeys, "assignments.confirm_guide")
  const canRemoveGuide = canChangeGuide
  const assignPermissionMessage = isCheckingAuthPermissions
    ? "Loading Auth permissions."
    : t("planning.permission.assign")
  const changePermissionMessage = isCheckingAuthPermissions
    ? "Loading Auth permissions."
    : t("planning.permission.change")
  const confirmPermissionMessage = isCheckingAuthPermissions
    ? "Loading Auth permissions."
    : t("planning.permission.confirm")
  const removePermissionMessage = isCheckingAuthPermissions
    ? "Loading Auth permissions."
    : t("assignments.selected.remove_denied")

  async function refreshSupabaseAssignments() {
    const result = await readSupabaseAssignmentsData()

    if (result.error) {
      setSupabaseGroups(null)
      setSupabaseGuides(null)
      setSupabaseAvailability(null)
      setSupabaseCircuits(null)
      setSupabaseError(result.error)
      return result.error
    }

    setSupabaseGroups(result.groups)
    setSupabaseGuides(result.guides)
    setSupabaseAvailability(result.availability)
    setSupabaseCircuits(result.circuits)
    setSupabaseError(null)
    return null
  }

  useEffect(() => {
    let isMounted = true

    async function loadSupabaseAssignments() {
      const result = await readSupabaseAssignmentsData()

      if (!isMounted) {
        return
      }

      if (result.error) {
        setSupabaseGroups(null)
        setSupabaseGuides(null)
        setSupabaseAvailability(null)
        setSupabaseCircuits(null)
        setSupabaseError(result.error)
        return
      }

      setSupabaseGroups(result.groups)
      setSupabaseGuides(result.guides)
      setSupabaseAvailability(result.availability)
      setSupabaseCircuits(result.circuits)
      setSupabaseError(null)
    }

    loadSupabaseAssignments()

    return () => {
      isMounted = false
    }
  }, [])

  const selectedGroup =
    groups.find((group) => group.id === selectedGroupId) ??
    groups.find((group) => group.guideId === null) ??
    groups[0] ??
    null
  const selectedCircuit = selectedGroup
    ? getCircuit(circuits, selectedGroup.circuitId)
    : undefined
  const selectedGuide = selectedGroup
    ? getGuide(guides, selectedGroup.guideId)
    : undefined
  const candidates = useMemo(
    () =>
      selectedGroup
        ? buildCandidateGuides({
            selectedGroup,
            guides,
            groups,
            availability,
          })
        : [],
    [availability, groups, guides, selectedGroup]
  )

  function updateGroup(updatedGroup: TourGroup) {
    writeLocalStorageValue(
      localStorageKeys.groups,
      persistedGroups.map((group) =>
        group.id === updatedGroup.id ? updatedGroup : group
      )
    )
  }

  function handleAssignGuide(candidate: CandidateGuide) {
    if (!selectedGroup) {
      return
    }

    if (selectedGroup.guideId && !canChangeGuide) {
      setAssignmentMessage({
        tone: "error",
        text: changePermissionMessage,
      })
      return
    }

    if (!selectedGroup.guideId && !canAssignGuide) {
      setAssignmentMessage({
        tone: "error",
        text: assignPermissionMessage,
      })
      return
    }

    if (!candidate.canAssign) {
      setAssignmentMessage({
        tone: "error",
        text: candidate.blockingReason ?? "This guide cannot be assigned.",
      })
      return
    }

    if (dataSource === "supabase") {
      handleSupabaseAssignGuide(candidate)
      return
    }

    const updatedGroup: TourGroup = {
      ...selectedGroup,
      guideId: candidate.guide.id,
      assignmentStatus: "assigned",
      confirmationStatus: "pending-confirmation",
    }

    updateGroup(updatedGroup)
    setAssignmentMessage({
      tone: candidate.warningReason ? "warning" : "success",
      text:
        candidate.warningReason ??
        `${candidate.guide.name} assigned to ${selectedGroup.code}. Confirmation is pending.`,
    })
  }

  function handleConfirmGuide() {
    if (!selectedGroup?.guideId) {
      return
    }

    if (!canConfirmGuide) {
      setAssignmentMessage({
        tone: "error",
        text: confirmPermissionMessage,
      })
      return
    }

    if (dataSource === "supabase") {
      handleSupabaseConfirmGuide()
      return
    }

    updateGroup({
      ...selectedGroup,
      assignmentStatus: "assigned",
      confirmationStatus: "confirmed",
    })
    setAssignmentMessage({
      tone: "success",
      text: `Guide confirmed for ${selectedGroup.code}.`,
    })
  }

  function focusCandidateTable() {
    document.getElementById("candidate-guides")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
    setAssignmentMessage({
      tone: "warning",
      text: "Review the eligible candidate guides below before assigning.",
    })
  }

  async function handleSupabaseAssignGuide(candidate: CandidateGuide) {
    if (!selectedGroup) {
      return
    }

    if (selectedGroup.guideId && !canChangeGuide) {
      setAssignmentMessage({
        tone: "error",
        text: changePermissionMessage,
      })
      return
    }

    if (!selectedGroup.guideId && !canAssignGuide) {
      setAssignmentMessage({
        tone: "error",
        text: assignPermissionMessage,
      })
      return
    }

    if (!candidate.canAssign) {
      setAssignmentMessage({
        tone: "error",
        text: candidate.blockingReason ?? "This guide cannot be assigned.",
      })
      return
    }

    setIsSavingAssignment(true)
    setAssignmentMessage(null)

    const mutation = selectedGroup.guideId
      ? changeSupabaseGuideForGroup
      : assignSupabaseGuideToGroup
    const result = await mutation({
      groupId: selectedGroup.id,
      guideId: candidate.guide.id,
      currentAssignmentId: selectedGroup.currentAssignmentId ?? null,
    })

    if (result.error) {
      setIsSavingAssignment(false)
      setAssignmentMessage({
        tone: "error",
        text: result.error,
      })
      return
    }

    const refreshError = await refreshSupabaseAssignments()
    setIsSavingAssignment(false)

    if (refreshError) {
      setAssignmentMessage({
        tone: "error",
        text: refreshError,
      })
      return
    }

    setAssignmentMessage({
      tone: candidate.warningReason ? "warning" : "success",
      text:
        candidate.warningReason ??
        `${candidate.guide.name} assigned to ${selectedGroup.code}. Confirmation is pending.`,
    })
  }

  async function handleSupabaseConfirmGuide() {
    if (!selectedGroup?.guideId) {
      return
    }

    if (!canConfirmGuide) {
      setAssignmentMessage({
        tone: "error",
        text: confirmPermissionMessage,
      })
      return
    }

    setIsSavingAssignment(true)
    setAssignmentMessage(null)
    const result = await confirmSupabaseGroupGuide({
      groupId: selectedGroup.id,
      guideId: selectedGroup.guideId,
      currentAssignmentId: selectedGroup.currentAssignmentId ?? null,
    })

    if (result.error) {
      setIsSavingAssignment(false)
      setAssignmentMessage({
        tone: "error",
        text: result.error,
      })
      return
    }

    const refreshError = await refreshSupabaseAssignments()
    setIsSavingAssignment(false)

    if (refreshError) {
      setAssignmentMessage({
        tone: "error",
        text: refreshError,
      })
      return
    }

    setAssignmentMessage({
      tone: "success",
      text: `Guide confirmed for ${selectedGroup.code}.`,
    })
  }

  async function handleRemoveGuide() {
    if (!selectedGroup?.guideId) {
      return
    }

    if (!canRemoveGuide) {
      setAssignmentMessage({
        tone: "error",
        text: removePermissionMessage,
      })
      return
    }

    if (dataSource === "supabase") {
      setIsSavingAssignment(true)
      setAssignmentMessage(null)
      const result = await removeSupabaseGuideFromGroup({
        groupId: selectedGroup.id,
        currentAssignmentId: selectedGroup.currentAssignmentId ?? null,
      })

      if (result.error) {
        setIsSavingAssignment(false)
        setAssignmentMessage({
          tone: "error",
          text: result.error,
        })
        return
      }

      const refreshError = await refreshSupabaseAssignments()
      setIsSavingAssignment(false)

      if (refreshError) {
        setAssignmentMessage({
          tone: "error",
          text: refreshError,
        })
        return
      }

      setAssignmentMessage({
        tone: "success",
        text: `Guide removed from ${selectedGroup.code}.`,
      })
      return
    }

    updateGroup({
      ...selectedGroup,
      guideId: null,
      assignmentStatus: "without-guide",
      confirmationStatus: "not-required",
    })
    setAssignmentMessage({
      tone: "success",
      text: `Guide removed from ${selectedGroup.code}.`,
    })
  }

  return (
    <div className="space-y-4">
      {isDevToolsEnabled ? <Card size="sm">
        <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-medium"><T i18nKey="assignments.assignments_module.data_source" /></span>
            <Badge variant={dataSource === "supabase" ? "default" : "outline"}>
              {dataSource === "supabase"
                ? "Supabase"
                : t("groups.data.local_fallback")}
            </Badge>
          </div>
          <span className="text-muted-foreground">
            {dataSource === "supabase"
              ? t("assignments.supabase_saved")
              : "Supabase is unavailable. Assignment changes are saved locally in this browser."}
          </span>
          <span className="text-muted-foreground">
            <T i18nKey="assignments.assignments_module.assignment_actions_use" />{" "}
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
              <T i18nKey="assignments.assignments_module.loading_auth_permissions_before_enabling_assignment_actions" />
            </span>
          ) : null}
        </CardContent>
      </Card> : null}
      {supabaseError ? (
        <p className="text-xs text-red-700">
          <T i18nKey="assignments.assignments_module.supabase_read_issue" /> {supabaseError}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,9fr)_minmax(0,11fr)] xl:items-start">
        <section className="min-w-0">
          <GroupBrowser
            groups={groups}
            circuits={circuits}
            guides={guides}
            selectedGroupId={selectedGroup?.id ?? selectedGroupId}
            onSelectGroup={(groupId) => {
              setSelectedGroupId(groupId)
              setAssignmentMessage(null)
            }}
          />
        </section>

        <section className="min-w-0 space-y-4">
          {selectedGroup ? (
            <>
              <SelectedGroupCard
                group={selectedGroup}
                circuit={selectedCircuit}
                guide={selectedGuide}
                isSaving={isSavingAssignment}
                onPrimaryAction={focusCandidateTable}
                onConfirmGuide={handleConfirmGuide}
                onRemoveGuide={handleRemoveGuide}
                canAssignGuide={canAssignGuide}
                canChangeGuide={canChangeGuide}
                canConfirmGuide={canConfirmGuide}
                canRemoveGuide={canRemoveGuide}
                assignPermissionMessage={assignPermissionMessage}
                changePermissionMessage={changePermissionMessage}
                confirmPermissionMessage={confirmPermissionMessage}
                removePermissionMessage={removePermissionMessage}
              />
              {assignmentMessage ? (
                <Card
                  size="sm"
                  className={
                    assignmentMessage.tone === "error"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : assignmentMessage.tone === "warning"
                        ? "border-amber-200 bg-amber-50 text-amber-900"
                        : "border-emerald-200 bg-emerald-50 text-emerald-800"
                  }
                >
                  <CardContent className="py-2 text-sm">
                    {assignmentMessage.text}
                  </CardContent>
                </Card>
              ) : null}
              <AssignmentSummaryCards candidates={candidates} />
              <CandidateGuidesTable
                candidates={candidates}
                hasCurrentGuide={selectedGroup.guideId !== null}
                actionsDisabled={
                  isSavingAssignment ||
                  (selectedGroup.guideId ? !canChangeGuide : !canAssignGuide)
                }
                actionsDisabledReason={
                  isSavingAssignment
                    ? "Saving assignment..."
                    : selectedGroup.guideId
                      ? changePermissionMessage
                      : assignPermissionMessage
                }
                description={
                  dataSource === "supabase"
                    ? "Matching based on Supabase groups, guides, availability, and current assignments."
                    : undefined
                }
                onAssignGuide={handleAssignGuide}
              />
            </>
          ) : (
            <Card>
              <CardContent className="flex min-h-64 items-center justify-center text-center text-muted-foreground">
                <T i18nKey="assignments.assignments_module.search_and_select_a_group_to_see_possible" />
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}
