"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardCopy,
  ExternalLink,
  FileUp,
  History,
  Mail,
  MessageCircle,
  Search,
} from "lucide-react"

import { CandidateGuidesTable } from "@/components/assignments/candidate-guides-table"
import { CreateGroupDialog } from "@/components/groups/create-group-dialog"
import { useCurrentUserAccess } from "@/components/layout/current-user-access-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AssignmentStatusBadge,
  ConfirmationStatusBadge,
  GroupStatusBadge,
} from "@/components/groups/status-badges"
import {
  useAppSettings,
  usePermissionSource,
  usePreviewRole,
} from "@/components/settings/settings-client-store"
import {
  usePersistedCircuits,
  usePersistedAvailability,
  usePersistedGroups,
  usePersistedGuides,
} from "@/lib/hooks/use-persisted-mock-data"
import {
  hasActivePermission,
  resolveActivePermissionKeys,
} from "@/lib/auth/permission-source"
import { isDevToolsEnabled } from "@/lib/auth/runtime-mode"
import { getSupabaseAvailability } from "@/lib/supabase/queries/availability"
import { getAllSupabaseCircuits } from "@/lib/supabase/queries/circuits"
import {
  getSupabaseGroups,
  type SupabaseGroupSearchItem,
} from "@/lib/supabase/queries/groups"
import { getSupabaseGuides } from "@/lib/supabase/queries/guides"
import {
  assignSupabaseGuideToGroup,
  changeSupabaseGuideForGroup,
  confirmSupabaseGroupGuide,
} from "@/lib/supabase/mutations/assignments"
import {
  enqueueManualAssignmentNotification,
  getGroupAssignmentNotificationHistory,
  getGroupAssignmentNotificationStatus,
  type AssignmentNotificationEvent,
  type AssignmentNotificationHistoryRow,
  type AssignmentNotificationStatusRow,
} from "@/lib/supabase/mutations/assignment-notifications"
import {
  buildSupabaseGroupMutationInput,
  createSupabaseGroup,
  setSupabaseGroupStatus,
} from "@/lib/supabase/mutations/groups"
import type {
  Circuit,
  Guide,
  GuideAvailability,
  GroupStatus,
  TourGroup,
} from "@/lib/types/domain"
import {
  PlanningControls,
  type PlanningRangeDays,
} from "@/components/planning/planning-controls"
import { PlanningGroupSearch } from "@/components/planning/planning-group-search"
import { PlanningLegend } from "@/components/planning/planning-legend"
import {
  PlanningTimeline,
  type PlanningCircuitSort,
  type PlanningGuideSort,
  type PlanningTimelineItem,
  type PlanningTimelineRow,
  type PlanningTimelineSection,
} from "@/components/planning/planning-timeline"
import type { PlanningDate, PlanningTimelineData } from "@/lib/types/planning"
import {
  buildCandidateGuides,
  type CandidateGuide,
} from "@/lib/utils/assignment-candidates"
import {
  formatDateDisplay,
  formatDateTimeDisplay,
  formatMonthYearDisplay,
} from "@/lib/utils/date-format"
import { normalizeSpokenLanguages } from "@/lib/utils/language-options"
import { groupStatusOptions } from "@/lib/utils/group-status"
import { getWhatsAppContact } from "@/lib/utils/whatsapp"
import {
  localStorageKeys,
  readLocalStorageValue,
  writeLocalStorageValue,
} from "@/lib/utils/local-storage"

type PlanningDataSource = "local-fallback" | "supabase"
type PlanningZoom = "compact" | "comfortable" | "detailed"

const communicationEventLabels: Record<string, UiTranslationKey> = {
  assignment_created: "planning.communication.assignment_information",
  assignment_changed_new_guide: "planning.communication.new_assignment_information",
  assignment_changed_previous_guide: "planning.communication.assignment_changed_previous",
  assignment_removed: "planning.communication.assignment_removed",
  group_cancelled_for_guide: "planning.communication.group_cancelled",
  group_merged_for_guide: "planning.communication.group_merged",
  confirmation_request: "planning.communication.confirmation_request",
  group_information: "planning.communication.group_information",
}

function getCommunicationStatusLabel(row: AssignmentNotificationStatusRow, t: ReturnType<typeof useI18n>["t"]) {
  if (row.status === "sent" && row.sentAt) return t("planning.planning_module.sent")
  if (row.status === "failed") return t("planning.planning_module.failed")
  if (row.status === "blocked") {
    return row.lastErrorSafe?.toLocaleLowerCase().includes("template")
      ? t("planning.communication.blocked_missing_template")
      : t("planning.communication.blocked_recipient")
  }
  if (row.status === "processing") return t("planning.communication.processing")
  return t("planning.communication.provider_not_configured")
}

const zoomDayWidths: Record<PlanningZoom, number> = {
  compact: 32,
  comfortable: 44,
  detailed: 58,
}

function toUtcDate(dateIso: string) {
  return new Date(`${dateIso}T00:00:00.000Z`)
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function getMonthValue(dateIso: string) {
  return dateIso.slice(0, 7)
}

function getMonthRange(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number)
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 0))

  return {
    startDateIso: formatDate(start),
    endDateIso: formatDate(end),
  }
}

function getTodayIso() {
  const today = new Date()

  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(today.getDate()).padStart(2, "0")}`
}

function addDaysIso(dateIso: string, days: number) {
  const date = toUtcDate(dateIso)
  date.setUTCDate(date.getUTCDate() + days)

  return formatDate(date)
}

function getMonthLabel(monthValue: string, locale: string) {
  return formatMonthYearDisplay(monthValue, locale)
}

function createPlanningDates(
  startDateIso: string,
  endDateIso: string,
  locale: string
): PlanningDate[] {
  const dates: PlanningDate[] = []
  const current = toUtcDate(startDateIso)
  const end = toUtcDate(endDateIso)

  while (current <= end) {
    dates.push({
      iso: formatDate(current),
      day: current.getUTCDate(),
      weekday: current.toLocaleDateString(locale, {
        timeZone: "UTC",
        weekday: "short",
      }),
    })
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return dates
}

function daysBetween(startDateIso: string, endDateIso: string) {
  const start = toUtcDate(startDateIso).getTime()
  const end = toUtcDate(endDateIso).getTime()

  return Math.round((end - start) / 86_400_000)
}

function rangesOverlap(
  firstStartDateIso: string,
  firstEndDateIso: string,
  secondStartDateIso: string,
  secondEndDateIso: string
) {
  return (
    firstStartDateIso <= secondEndDateIso &&
    secondStartDateIso <= firstEndDateIso
  )
}

function sortGroupsByDate(groups: TourGroup[]) {
  return [...groups].sort((firstGroup, secondGroup) => {
    const dateCompare = firstGroup.startDateIso.localeCompare(
      secondGroup.startDateIso
    )

    if (dateCompare !== 0) {
      return dateCompare
    }

    return firstGroup.code.localeCompare(secondGroup.code)
  })
}

function compareNames(firstName: string, secondName: string) {
  return firstName.localeCompare(secondName, undefined, {
    sensitivity: "base",
  })
}

function stackGroupsIntoLanes(
  groups: TourGroup[],
  getItemContext: (group: TourGroup, lane: number) => Omit<
    PlanningTimelineItem,
    "group" | "lane"
  >
) {
  const laneEndDates: string[] = []

  return sortGroupsByDate(groups).map<PlanningTimelineItem>((group) => {
    const laneIndex = laneEndDates.findIndex(
      (laneEndDate) => group.startDateIso > laneEndDate
    )
    const lane = laneIndex >= 0 ? laneIndex : laneEndDates.length

    laneEndDates[lane] = group.endDateIso

    return {
      group,
      lane,
      ...getItemContext(group, lane),
    }
  })
}

function getRestLabel(
  group: TourGroup,
  previousGroup: TourGroup | undefined,
  t: ReturnType<typeof useI18n>["t"]
): Pick<PlanningTimelineItem, "restLabel" | "restTone"> {
  if (!previousGroup) {
    return {
      restLabel: t("planning.rest.no_previous"),
      restTone: "neutral",
    }
  }

  if (group.startDateIso <= previousGroup.endDateIso) {
    return {
      restLabel: t("planning.legend.overlap"),
      restTone: "danger",
    }
  }

  const restDays = daysBetween(previousGroup.endDateIso, group.startDateIso) - 1

  if (restDays <= 0) {
    return {
      restLabel: t("planning.rest.back_to_back"),
      restTone: "warning",
    }
  }

  return {
    restLabel: t(restDays === 1 ? "planning.rest.before_one" : "planning.rest.before_many", { count: restDays }),
    restTone: "neutral",
  }
}

function getCircuitAbbreviation(circuit: Circuit | null) {
  if (!circuit) {
    return "—"
  }

  if (circuit.code) {
    return circuit.code
  }

  const initials = circuit.name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase())
    .join("")

  return initials || circuit.name.slice(0, 3).toUpperCase()
}

function getOperationalGroupRank(group: TourGroup) {
  const startsInFuture = group.startDateIso >= formatDate(new Date())

  if (startsInFuture && group.assignmentStatus === "without-guide") {
    return 0
  }

  if (
    startsInFuture &&
    group.confirmationStatus === "pending-confirmation"
  ) {
    return 1
  }

  if (startsInFuture && group.groupStatus === "active") {
    return 2
  }

  if (group.groupStatus === "finalized") {
    return 3
  }

  return 4
}

async function readSupabasePlanningData() {
  let groupsResult: Awaited<ReturnType<typeof getSupabaseGroups>>
  let guidesResult: Awaited<ReturnType<typeof getSupabaseGuides>>
  let circuitsResult: Awaited<ReturnType<typeof getAllSupabaseCircuits>>
  let availabilityResult: Awaited<ReturnType<typeof getSupabaseAvailability>>

  try {
    const results = await Promise.all([
      getSupabaseGroups(),
      getSupabaseGuides(),
      getAllSupabaseCircuits(),
      getSupabaseAvailability(),
    ])

    groupsResult = results[0]
    guidesResult = results[1]
    circuitsResult = results[2]
    availabilityResult = results[3]
  } catch (error) {
    return {
      groups: null,
      guides: null,
      circuits: null,
      availability: null,
      error:
        error instanceof Error
          ? error.message
          : "Unable to read Planning data from Supabase.",
    }
  }

  const readError =
    groupsResult.error ??
    guidesResult.error ??
    circuitsResult.error ??
    availabilityResult.error

  if (readError) {
    return {
      groups: null,
      guides: null,
      circuits: null,
      availability: null,
      error: readError,
    }
  }

  return {
    groups: groupsResult.data,
    guides: guidesResult.data,
    circuits: circuitsResult.data,
    availability: availabilityResult.data,
    error: null,
  }
}

export function PlanningModule({ data }: { data: PlanningTimelineData }) {
  const { locale, t } = useI18n()
  const localGroups = usePersistedGroups()
  const localGuides = usePersistedGuides()
  const localCircuits = usePersistedCircuits()
  const localAvailability = usePersistedAvailability()
  const [selectedCircuitId, setSelectedCircuitId] = useState("all-circuits")
  const [startDateIso, setStartDateIso] = useState(getTodayIso)
  const [rangeDays, setRangeDays] = useState<PlanningRangeDays>(30)
  const [onlyWithoutGuide, setOnlyWithoutGuide] = useState(false)
  const [showCancelledMerged, setShowCancelledMerged] = useState(true)
  const [selectedItem, setSelectedItem] =
    useState<PlanningTimelineItem | null>(null)
  const [zoom, setZoom] = useState<PlanningZoom>(() =>
    readLocalStorageValue<PlanningZoom>(
      localStorageKeys.planningZoom,
      "comfortable"
    )
  )
  const [circuitsExpanded, setCircuitsExpanded] = useState(() =>
    readLocalStorageValue<boolean>(
      localStorageKeys.planningCircuitsExpanded,
      true
    )
  )
  const [guidesExpanded, setGuidesExpanded] = useState(() =>
    readLocalStorageValue<boolean>(
      localStorageKeys.planningGuidesExpanded,
      false
    )
  )
  const [circuitSort, setCircuitSort] = useState<PlanningCircuitSort>(() =>
    readLocalStorageValue<PlanningCircuitSort>(
      localStorageKeys.planningCircuitSort,
      "custom"
    )
  )
  const [guideSort, setGuideSort] = useState<PlanningGuideSort>(() =>
    readLocalStorageValue<PlanningGuideSort>(
      localStorageKeys.planningGuideSort,
      "alphabetical"
    )
  )
  const [supabaseGroups, setSupabaseGroups] = useState<TourGroup[] | null>(
    null
  )
  const [supabaseGuides, setSupabaseGuides] = useState<Guide[] | null>(null)
  const [supabaseCircuits, setSupabaseCircuits] = useState<Circuit[] | null>(
    null
  )
  const [supabaseAvailability, setSupabaseAvailability] = useState<
    GuideAvailability[] | null
  >(null)
  const [isLoadingSupabase, setIsLoadingSupabase] = useState(true)
  const [supabaseError, setSupabaseError] = useState<string | null>(null)
  const [assignmentMessage, setAssignmentMessage] = useState<{
    tone: "success" | "warning" | "error"
    text: string
  } | null>(null)
  const [selectedFilterNotice, setSelectedFilterNotice] = useState<string | null>(
    null
  )
  const [isSavingAssignment, setIsSavingAssignment] = useState(false)
  const [isSavingGroupStatus, setIsSavingGroupStatus] = useState(false)
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
  const canCreateGroup =
    !isCheckingAuthPermissions &&
    hasActivePermission(activePermissionKeys, "groups.create")
  const canEditGroup =
    !isAuthAccessLoading && authAccess.isAuthenticated &&
    authAccess.permissionKeys.includes("groups.edit") &&
    hasActivePermission(activePermissionKeys, "groups.edit")
  const canImportGroups =
    !isCheckingAuthPermissions &&
    hasActivePermission(activePermissionKeys, "import_export.import_excel") &&
    hasActivePermission(activePermissionKeys, "groups.create")
  const assignPermissionMessage = isCheckingAuthPermissions
    ? "Loading Auth permissions."
    : t("planning.permission.assign")
  const changePermissionMessage = isCheckingAuthPermissions
    ? "Loading Auth permissions."
    : t("planning.permission.change")
  const confirmPermissionMessage = isCheckingAuthPermissions
    ? "Loading Auth permissions."
    : t("planning.permission.confirm")
  const dataSource: PlanningDataSource = process.env.NODE_ENV === "production" || supabaseGroups
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
      dataSource === "supabase" ? (supabaseAvailability ?? []) : localAvailability,
    [dataSource, localAvailability, supabaseAvailability]
  )

  useEffect(() => {
    let isMounted = true

    async function loadSupabasePlanningData() {
      const result = await readSupabasePlanningData()

      if (!isMounted) {
        return
      }

      if (result.error) {
        setSupabaseGroups(null)
        setSupabaseGuides(null)
        setSupabaseCircuits(null)
        setSupabaseAvailability(null)
        setSupabaseError(result.error)
        setIsLoadingSupabase(false)
        return
      }

      setSupabaseGroups(result.groups)
      setSupabaseGuides(result.guides)
      setSupabaseCircuits(result.circuits)
      setSupabaseAvailability(result.availability)
      setSupabaseError(null)
      setIsLoadingSupabase(false)
    }

    loadSupabasePlanningData()

    return () => {
      isMounted = false
    }
  }, [])

  async function refreshSupabasePlanning() {
    const result = await readSupabasePlanningData()

    if (result.error) {
      setSupabaseGroups(null)
      setSupabaseGuides(null)
      setSupabaseCircuits(null)
      setSupabaseAvailability(null)
      setSupabaseError(result.error)
      return {
        error: result.error,
        groups: null,
      }
    }

    setSupabaseGroups(result.groups)
    setSupabaseGuides(result.guides)
    setSupabaseCircuits(result.circuits)
    setSupabaseAvailability(result.availability)
    setSupabaseError(null)
    return {
      error: null,
      groups: result.groups,
    }
  }

  const monthOptions = useMemo(() => {
    const monthValues = new Set<string>([
      getMonthValue(startDateIso),
      getMonthValue(data.startDateIso),
      ...groups.flatMap((group) => [
        getMonthValue(group.startDateIso),
        getMonthValue(group.endDateIso),
      ]),
    ])

    return Array.from(monthValues)
      .sort()
      .map((monthValue) => ({
        value: monthValue,
        label: getMonthLabel(monthValue, locale),
      }))
  }, [data.startDateIso, groups, locale, startDateIso])

  function handleZoomChange(nextZoom: PlanningZoom) {
    setZoom(nextZoom)
    writeLocalStorageValue(localStorageKeys.planningZoom, nextZoom)
  }

  function handleGuidesExpandedChange(expanded: boolean) {
    setGuidesExpanded(expanded)
    writeLocalStorageValue(
      localStorageKeys.planningGuidesExpanded,
      expanded
    )
  }

  function handleCircuitsExpandedChange(expanded: boolean) {
    setCircuitsExpanded(expanded)
    writeLocalStorageValue(
      localStorageKeys.planningCircuitsExpanded,
      expanded
    )
  }

  function handleCircuitSortChange(nextSort: PlanningCircuitSort) {
    setCircuitSort(nextSort)
    writeLocalStorageValue(localStorageKeys.planningCircuitSort, nextSort)
  }

  function handleGuideSortChange(nextSort: PlanningGuideSort) {
    setGuideSort(nextSort)
    writeLocalStorageValue(localStorageKeys.planningGuideSort, nextSort)
  }

  function handleMonthChange(monthValue: string) {
    setStartDateIso(getMonthRange(monthValue).startDateIso)
  }

  function handleShiftRange(direction: "previous" | "next") {
    setStartDateIso((currentDateIso) =>
      addDaysIso(currentDateIso, direction === "previous" ? -rangeDays : rangeDays)
    )
  }

  const guideById = useMemo(
    () => new Map(guides.map((guide) => [guide.id, guide])),
    [guides]
  )
  const circuitById = useMemo(
    () => new Map(circuits.map((circuit) => [circuit.id, circuit])),
    [circuits]
  )
  const selectedRange = useMemo(
    () => ({
      startDateIso,
      endDateIso: addDaysIso(startDateIso, rangeDays - 1),
    }),
    [rangeDays, startDateIso]
  )
  const visibleDates = useMemo(
    () =>
      createPlanningDates(
        selectedRange.startDateIso,
        selectedRange.endDateIso,
        locale
      ),
    [locale, selectedRange.endDateIso, selectedRange.startDateIso]
  )
  const visibleGroups = useMemo(() => {
    return groups
      .filter((group) =>
        rangesOverlap(
          group.startDateIso,
          group.endDateIso,
          selectedRange.startDateIso,
          selectedRange.endDateIso
        )
      )
      .filter((group) =>
        selectedCircuitId === "all-circuits"
          ? true
          : group.circuitId === selectedCircuitId
      )
      .filter((group) =>
        showCancelledMerged
          ? true
          : group.groupStatus !== "cxl" && group.groupStatus !== "fusionado"
      )
      .sort((firstGroup, secondGroup) => {
        const rankCompare =
          getOperationalGroupRank(firstGroup) -
          getOperationalGroupRank(secondGroup)

        if (rankCompare !== 0) {
          return rankCompare
        }

        return firstGroup.startDateIso.localeCompare(secondGroup.startDateIso)
      })
  }, [
    groups,
    selectedCircuitId,
    selectedRange.endDateIso,
    selectedRange.startDateIso,
    showCancelledMerged,
  ])
  const visibleCircuitGroups = useMemo(
    () =>
      onlyWithoutGuide
        ? visibleGroups.filter(
            (group) => group.assignmentStatus === "without-guide"
          )
        : visibleGroups,
    [onlyWithoutGuide, visibleGroups]
  )
  const todayIso = getTodayIso()
  const guideSortMetrics = useMemo(() => {
    const yearlyTourCountByGuideId = new Map<string, number>()
    const nextAssignmentByGuideId = new Map<string, string>()
    const currentYear = Number(todayIso.slice(0, 4))

    for (const group of groups) {
      if (
        !group.guideId ||
        group.assignmentStatus !== "assigned" ||
        group.groupStatus === "cxl" ||
        group.groupStatus === "fusionado"
      ) continue

      if (Number(group.startDateIso.slice(0, 4)) === currentYear) {
        yearlyTourCountByGuideId.set(
          group.guideId,
          (yearlyTourCountByGuideId.get(group.guideId) ?? 0) + 1
        )
      }
      if (group.startDateIso >= todayIso) {
        const nextDate = nextAssignmentByGuideId.get(group.guideId)
        if (!nextDate || group.startDateIso < nextDate) {
          nextAssignmentByGuideId.set(group.guideId, group.startDateIso)
        }
      }
    }

    return { yearlyTourCountByGuideId, nextAssignmentByGuideId }
  }, [groups, todayIso])
  const planningSections = useMemo<PlanningTimelineSection[]>(() => {
    const activeCircuits = circuits.filter((circuit) => circuit.isActive !== false)
    const circuitGroupsById = new Map<string, TourGroup[]>()
    const activeGroupCircuitIds = new Set<string>()
    for (const group of visibleCircuitGroups) {
      const circuitGroups = circuitGroupsById.get(group.circuitId) ?? []
      circuitGroups.push(group)
      circuitGroupsById.set(group.circuitId, circuitGroups)
      if (group.groupStatus === "active") activeGroupCircuitIds.add(group.circuitId)
    }
    const visibleCircuitIds = new Set(circuitGroupsById.keys())
    // Preserve a visible active group even when its circuit was later deactivated.
    const visibleInactiveCircuits = circuits.filter(
      (circuit) =>
        circuit.isActive === false &&
        activeGroupCircuitIds.has(circuit.id)
    )
    const displayedActiveCircuits = circuitsExpanded
      ? activeCircuits
      : activeCircuits.filter((circuit) => visibleCircuitIds.has(circuit.id))
    const sectionCircuits = (
      selectedCircuitId === "all-circuits"
        ? [...displayedActiveCircuits, ...visibleInactiveCircuits]
        : displayedActiveCircuits.filter(
            (circuit) => circuit.id === selectedCircuitId
          )
    ).sort((firstCircuit, secondCircuit) => {
      const alphabeticalCompare = compareNames(
        firstCircuit.name,
        secondCircuit.name
      )

      if (circuitSort === "alphabetical") {
        return alphabeticalCompare || firstCircuit.id.localeCompare(secondCircuit.id)
      }

      if (circuitSort === "most-tours") {
        const firstCount = circuitGroupsById.get(firstCircuit.id)?.length ?? 0
        const secondCount = circuitGroupsById.get(secondCircuit.id)?.length ?? 0

        return (
          secondCount - firstCount ||
          alphabeticalCompare ||
          firstCircuit.id.localeCompare(secondCircuit.id)
        )
      }

      const firstOrder = firstCircuit.planningSortOrder
      const secondOrder = secondCircuit.planningSortOrder

      if (firstOrder !== null && firstOrder !== undefined) {
        if (secondOrder === null || secondOrder === undefined) return -1
        if (firstOrder !== secondOrder) return firstOrder - secondOrder
      } else if (secondOrder !== null && secondOrder !== undefined) {
        return 1
      }

      return alphabeticalCompare || firstCircuit.id.localeCompare(secondCircuit.id)
    })

    const circuitRows: PlanningTimelineRow[] = sectionCircuits.map((circuit) => {
      const circuitGroups = circuitGroupsById.get(circuit.id) ?? []
      const items = stackGroupsIntoLanes(circuitGroups, (group) => ({
        circuit,
        guide: group.guideId ? (guideById.get(group.guideId) ?? null) : null,
      }))

      return {
        id: circuit.id,
        label: circuit.name,
        meta: `${circuit.code} · ${circuit.region}${circuit.isActive === false ? " · Inactive circuit" : ""}`,
        items,
      }
    })

    const assignedGroupsByGuideId = new Map<string, TourGroup[]>()

    visibleGroups.forEach((group) => {
      if (!group.guideId) {
        return
      }

      const guideGroups = assignedGroupsByGuideId.get(group.guideId) ?? []
      guideGroups.push(group)
      assignedGroupsByGuideId.set(group.guideId, guideGroups)
    })

    const guideIds = guidesExpanded
      ? guides.map((guide) => guide.id)
      : Array.from(assignedGroupsByGuideId.keys())
    const { yearlyTourCountByGuideId, nextAssignmentByGuideId } = guideSortMetrics
    const guideRows: PlanningTimelineRow[] = guideIds
      .map((guideId) => {
        const guideGroups = assignedGroupsByGuideId.get(guideId) ?? []
        const guide = guideById.get(guideId)
        const sortedGuideGroups = sortGroupsByDate(guideGroups)
        const restByGroupId = new Map<string, Pick<
          PlanningTimelineItem,
          "restLabel" | "restTone"
        >>()

        sortedGuideGroups.forEach((group, index) => {
          restByGroupId.set(group.id, getRestLabel(group, sortedGuideGroups[index - 1], t))
        })

        const items = stackGroupsIntoLanes(sortedGuideGroups, (group) => ({
          circuit: circuitById.get(group.circuitId) ?? null,
          guide: guide ?? null,
          circuitAbbreviation: getCircuitAbbreviation(
            circuitById.get(group.circuitId) ?? null
          ),
          ...restByGroupId.get(group.id),
        }))

        return {
          id: guideId,
          label: guide?.name ?? t("change_requests.fallback.unknown_guide"),
          meta: guide
            ? `${guide.preferredLanguage} · ${t(guide.status === "pending-invitation" ? "status.pending_invitation" : guide.status === "invited" ? "status.invited" : guide.status === "active" ? "status.active" : guide.status === "blocked" ? "status.blocked" : "status.inactive")}${
                guideSort === "most-tours-year"
                  ? ` · ${t((yearlyTourCountByGuideId.get(guideId) ?? 0) === 1 ? "planning.guide.tours_this_year_one" : "planning.guide.tours_this_year_many", { count: yearlyTourCountByGuideId.get(guideId) ?? 0 })}`
                  : ""
              }`
            : t("planning.guide.record_unavailable"),
          items,
        }
      })
      .sort((firstRow, secondRow) => {
        const alphabeticalCompare = compareNames(firstRow.label, secondRow.label)

        if (guideSort === "most-tours-year") {
          return (
            (yearlyTourCountByGuideId.get(secondRow.id) ?? 0) -
              (yearlyTourCountByGuideId.get(firstRow.id) ?? 0) ||
            alphabeticalCompare ||
            firstRow.id.localeCompare(secondRow.id)
          )
        }

        if (guideSort === "next-assignment") {
          const firstDate = nextAssignmentByGuideId.get(firstRow.id)
          const secondDate = nextAssignmentByGuideId.get(secondRow.id)

          if (firstDate && secondDate && firstDate !== secondDate) {
            return firstDate.localeCompare(secondDate)
          }
          if (firstDate && !secondDate) return -1
          if (!firstDate && secondDate) return 1
        }

        return alphabeticalCompare || firstRow.id.localeCompare(secondRow.id)
      })

    return [
      {
        title: t("planning.groups_by_circuit.title"),
        description: t("planning.groups_by_circuit.description"),
        emptyMessage: t("planning.groups_by_circuit.empty"),
        leftLabel: t("common.circuit"),
        variant: "circuit",
        rows: circuitRows,
      },
      {
        title: t("planning.assignments_by_guide.title"),
        description: t("planning.assignments_by_guide.description"),
        emptyMessage: t("planning.assignments_by_guide.empty"),
        leftLabel: t("common.guide"),
        variant: "guide",
        rows: guideRows,
      },
    ]
  }, [
    circuitById,
    circuitSort,
    circuitsExpanded,
    circuits,
    guideById,
    guideSort,
    guideSortMetrics,
    guides,
    guidesExpanded,
    selectedCircuitId,
    t,
    visibleCircuitGroups,
    visibleGroups,
  ])
  const selectedGroup = selectedItem
    ? (groups.find((group) => group.id === selectedItem.group.id) ??
      selectedItem.group)
    : null
  const selectedDialogItem =
    selectedItem && selectedGroup
      ? {
          ...selectedItem,
          group: selectedGroup,
          guide: selectedGroup.guideId
            ? (guideById.get(selectedGroup.guideId) ?? null)
            : null,
          circuit: circuitById.get(selectedGroup.circuitId) ?? selectedItem.circuit,
        }
      : selectedItem
  const selectedCandidates = useMemo(
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

  function updateLocalGroup(updatedGroup: TourGroup) {
    writeLocalStorageValue(
      localStorageKeys.groups,
      localGroups.map((group) =>
        group.id === updatedGroup.id ? updatedGroup : group
      )
    )
  }

  async function handlePlanningAssignGuide(candidate: CandidateGuide) {
    if (!selectedGroup) {
      return
    }

    const isChangingGuide = Boolean(selectedGroup.guideId)
    const previousGuide = selectedGroup.guideId
      ? (guideById.get(selectedGroup.guideId) ?? null)
      : null

    if (selectedGroup.guideId === candidate.guide.id) {
      setAssignmentMessage({
        tone: "warning",
        text: t("planning.assignment.already_assigned", { guide: candidate.guide.name, group: selectedGroup.code }),
      })
      return
    }

    if (isChangingGuide && !canChangeGuide) {
      setAssignmentMessage({
        tone: "error",
        text: changePermissionMessage,
      })
      return
    }

    if (!isChangingGuide && !canAssignGuide) {
      setAssignmentMessage({
        tone: "error",
        text: assignPermissionMessage,
      })
      return
    }

    if (!candidate.canAssign) {
      setAssignmentMessage({
        tone: "error",
        text: candidate.blockingReason ?? t("planning.assignment.cannot_assign"),
      })
      return
    }

    const updatedGroup: TourGroup = {
      ...selectedGroup,
      guideId: candidate.guide.id,
      assignmentStatus: "assigned",
      confirmationStatus: "pending-confirmation",
    }
    const successMessage =
      candidate.warningReason ??
      (isChangingGuide
        ? t("planning.assignment.changed", { previous: previousGuide?.name ?? t("planning.assignment.current_guide_fallback"), guide: candidate.guide.name, group: selectedGroup.code })
        : t("planning.assignment.created", { guide: candidate.guide.name, group: selectedGroup.code }))

    if (dataSource === "supabase") {
      setIsSavingAssignment(true)
      setAssignmentMessage(null)

      const mutation = isChangingGuide
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

      const refreshResult = await refreshSupabasePlanning()
      setIsSavingAssignment(false)

      if (refreshResult.error) {
        setAssignmentMessage({
          tone: "error",
          text: refreshResult.error,
        })
        return
      }

      const refreshedGroup = refreshResult.groups?.find(
        (group) => group.id === selectedGroup.id
      )

      if (refreshedGroup) {
        setSelectedItem((currentItem) =>
          currentItem
            ? {
                ...currentItem,
                group: refreshedGroup,
                guide: refreshedGroup.guideId
                  ? (guideById.get(refreshedGroup.guideId) ?? candidate.guide)
                  : null,
              }
            : currentItem
        )
      }
    } else {
      updateLocalGroup(updatedGroup)
      setSelectedItem((currentItem) =>
        currentItem
          ? {
              ...currentItem,
              group: updatedGroup,
              guide: candidate.guide,
            }
          : currentItem
      )
    }
    setAssignmentMessage({
      tone: candidate.warningReason ? "warning" : "success",
      text: successMessage,
    })
  }

  async function handlePlanningConfirmGuide() {
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

    if (selectedGroup.confirmationStatus !== "pending-confirmation") {
      setAssignmentMessage({
        tone: "warning",
        text: t("planning.confirmation.not_required", { group: selectedGroup.code }),
      })
      return
    }

    const updatedGroup: TourGroup = {
      ...selectedGroup,
      assignmentStatus: "assigned",
      confirmationStatus: "confirmed",
    }

    if (dataSource === "supabase") {
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

      const refreshResult = await refreshSupabasePlanning()
      setIsSavingAssignment(false)

      if (refreshResult.error) {
        setAssignmentMessage({
          tone: "error",
          text: refreshResult.error,
        })
        return
      }

      const refreshedGroup = refreshResult.groups?.find(
        (group) => group.id === selectedGroup.id
      )

      if (refreshedGroup) {
        setSelectedItem((currentItem) =>
          currentItem
            ? {
                ...currentItem,
                group: refreshedGroup,
              }
            : currentItem
        )
      }
    } else {
      updateLocalGroup(updatedGroup)
      setSelectedItem((currentItem) =>
        currentItem
          ? {
              ...currentItem,
              group: updatedGroup,
            }
          : currentItem
      )
    }

    setAssignmentMessage({
      tone: "success",
      text: t("planning.confirmation.success", { group: selectedGroup.code }),
    })
  }

  async function handlePlanningGroupStatusChange(nextStatus: GroupStatus) {
    if (!selectedGroup || nextStatus === selectedGroup.groupStatus) return

    if (!canEditGroup) {
      setAssignmentMessage({
        tone: "error",
        text: t("planning.permission.edit_group"),
      })
      return
    }

    if (dataSource !== "supabase") {
      setAssignmentMessage({
        tone: "error",
        text: t("planning.status.requires_supabase"),
      })
      return
    }

    setIsSavingGroupStatus(true)
    setAssignmentMessage(null)

    if (dataSource === "supabase") {
      const result = await setSupabaseGroupStatus(selectedGroup, nextStatus)

      if (result.error) {
        setIsSavingGroupStatus(false)
        setAssignmentMessage({ tone: "error", text: result.error })
        return
      }

      const refreshResult = await refreshSupabasePlanning()
      setIsSavingGroupStatus(false)

      if (refreshResult.error) {
        setAssignmentMessage({ tone: "error", text: refreshResult.error })
        return
      }

      const refreshedGroup = refreshResult.groups?.find(
        (group) => group.id === selectedGroup.id
      )
      if (refreshedGroup) {
        setSelectedItem((currentItem) =>
          currentItem ? { ...currentItem, group: refreshedGroup } : currentItem
        )
      }
    }

    setAssignmentMessage({
      tone: "success",
      text: t("planning.status.updated", { group: selectedGroup.code }),
    })
  }

  async function handleCreateGroup(group: TourGroup) {
    if (dataSource === "supabase") {
      const result = await createSupabaseGroup(buildSupabaseGroupMutationInput(group))

      if (result.error) return result.error

      const refreshResult = await refreshSupabasePlanning()
      return refreshResult.error
    }

    writeLocalStorageValue(localStorageKeys.groups, [group, ...localGroups])
    return null
  }

  function getSearchFilterNotice(group: TourGroup) {
    const hiddenBy: string[] = []

    if (
      selectedCircuitId !== "all-circuits" &&
      selectedCircuitId !== group.circuitId
    ) {
      hiddenBy.push(t("planning.search.filter_circuit"))
    }
    if (
      !showCancelledMerged &&
      (group.groupStatus === "cxl" || group.groupStatus === "fusionado")
    ) {
      hiddenBy.push(t("planning.search.filter_cancelled_merged"))
    }
    if (onlyWithoutGuide && group.assignmentStatus !== "without-guide") {
      hiddenBy.push(t("planning.search.filter_without_guide"))
    }

    if (!group.startDateIso) {
      return t("planning.search.no_start_date")
    }
    if (hiddenBy.length === 0) return null

    return t("planning.search.hidden_by_filters", { filters: hiddenBy.join(", ") })
  }

  async function handleGroupSearchSelect(result: SupabaseGroupSearchItem) {
    if (result.group.startDateIso) setStartDateIso(result.group.startDateIso)
    setAssignmentMessage(null)

    let selectedSearchGroup = result.group
    if (dataSource === "supabase") {
      const refreshResult = await refreshSupabasePlanning()
      selectedSearchGroup =
        refreshResult.groups?.find((group) => group.id === result.group.id) ??
        result.group
    }

    setSelectedFilterNotice(getSearchFilterNotice(selectedSearchGroup))
    setSelectedItem({
      group: selectedSearchGroup,
      circuit: circuitById.get(selectedSearchGroup.circuitId) ?? null,
      guide: selectedSearchGroup.guideId
        ? (guideById.get(selectedSearchGroup.guideId) ?? null)
        : null,
      lane: 0,
    })
  }

  return (
    <>
      <section
        aria-label={t("planning.planning_module.aria_label_planning_tools")}
        className="relative space-y-2 rounded-lg border border-border/70 bg-card p-2.5"
      >
        <div className="flex items-end">
          <PlanningControls
            circuits={circuits.filter((circuit) => circuit.isActive !== false)}
            circuitId={selectedCircuitId}
            monthOptions={monthOptions}
            onlyWithoutGuide={onlyWithoutGuide}
            rangeDays={rangeDays}
            showCancelledMerged={showCancelledMerged}
            startDateIso={startDateIso}
            zoom={zoom}
            onCircuitChange={setSelectedCircuitId}
            onMonthChange={handleMonthChange}
            onOnlyWithoutGuideChange={setOnlyWithoutGuide}
            onRangeDaysChange={setRangeDays}
            onShowCancelledMergedChange={setShowCancelledMerged}
            onShiftRange={handleShiftRange}
            onStartDateChange={setStartDateIso}
            onTodayClick={() => setStartDateIso(getTodayIso())}
            onZoomChange={handleZoomChange}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
          <PlanningGroupSearch
            circuits={circuits}
            dataSource={dataSource}
            groups={groups}
            guides={guides}
            onSelect={handleGroupSearchSelect}
          />
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-md border bg-background px-2.5 py-1.5 text-muted-foreground">
              <span className="font-semibold text-foreground">{rangeDays} <T i18nKey="planning.planning_controls.days" /></span>
              {" · "}
              {formatDateDisplay(selectedRange.startDateIso)} -{" "}
              {formatDateDisplay(selectedRange.endDateIso)}
            </span>
            <span className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 font-semibold text-rose-800">
              {
                visibleCircuitGroups.filter(
                  (group) => group.assignmentStatus === "without-guide"
                ).length
              }{" "}
              <T i18nKey="planning.planning_module.need_guide" />
            </span>
            <span className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 font-semibold text-amber-800">
              {
                visibleGroups.filter(
                  (group) =>
                    group.confirmationStatus === "pending-confirmation"
                ).length
              }{" "}
              <T i18nKey="planning.planning_module.pending_confirmation" />
            </span>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {isDevToolsEnabled ? <Badge
              variant={dataSource === "supabase" ? "default" : "secondary"}
            >
              {dataSource === "supabase" ? "Supabase" : t("planning.data.local_fallback")}
            </Badge> : null}
            {isDevToolsEnabled && isLoadingSupabase ? (
              <Badge variant="outline"><T i18nKey="planning.planning_module.checking_supabase" /></Badge>
            ) : null}
            {canImportGroups ? (
              <Button asChild type="button" variant="outline" size="sm">
                <Link href="/import-export?area=import&type=groups&from=planning">
                  <FileUp />
                  <T i18nKey="planning.planning_module.import_new_groups" />
                </Link>
              </Button>
            ) : null}
            {canCreateGroup ? (
              <CreateGroupDialog
                circuits={circuits.filter(
                  (circuit) => circuit.isActive !== false
                )}
                guides={guides}
                existingGroups={groups}
                availability={availability}
                canCreateGroup={canCreateGroup}
                canAssignGuide={canAssignGuide}
                canConfirmGuide={canConfirmGuide}
                onCreateGroup={handleCreateGroup}
                helperText={
                  !isDevToolsEnabled
                    ? ""
                    : dataSource === "supabase"
                    ? t("planning.create.supabase_help")
                    : t("planning.create.local_help")
                }
              />
            ) : null}
          </div>
          <div className="basis-full">
            <PlanningLegend />
          </div>
        </div>

        {supabaseError ? (
          <p className="text-xs text-destructive">
            <T i18nKey="planning.planning_module.supabase_read_issue" /> {supabaseError}
          </p>
        ) : null}
      </section>
      <PlanningTimeline
        circuitSort={circuitSort}
        circuitsExpanded={circuitsExpanded}
        dates={visibleDates}
        dayWidth={zoomDayWidths[zoom]}
        endDateIso={selectedRange.endDateIso}
        guidesExpanded={guidesExpanded}
        guideSort={guideSort}
        onCircuitsExpandedChange={handleCircuitsExpandedChange}
        onCircuitSortChange={handleCircuitSortChange}
        onGuideSortChange={handleGuideSortChange}
        onItemSelect={(item) => {
          setSelectedFilterNotice(null)
          setAssignmentMessage(null)
          setSelectedItem(item)
        }}
        onGuidesExpandedChange={handleGuidesExpandedChange}
        sections={planningSections}
        startDateIso={selectedRange.startDateIso}
      />
      <PlanningGroupDialog
        key={selectedGroup?.id ?? "closed"}
        assignPermissionMessage={assignPermissionMessage}
        assignmentMessage={assignmentMessage}
        canAssignGuide={canAssignGuide}
        canChangeGuide={canChangeGuide}
        canConfirmGuide={canConfirmGuide}
        canEditGroup={canEditGroup}
        canSendGroupInformation={canAssignGuide || canChangeGuide}
        candidates={selectedCandidates}
        circuits={circuits}
        changePermissionMessage={changePermissionMessage}
        confirmPermissionMessage={confirmPermissionMessage}
        isSavingAssignment={isSavingAssignment}
        isSavingGroupStatus={isSavingGroupStatus}
        communicationEnabled={dataSource === "supabase"}
        filterNotice={selectedFilterNotice}
        item={selectedDialogItem}
        onAssignGuide={handlePlanningAssignGuide}
        onConfirmGuide={handlePlanningConfirmGuide}
        onGroupStatusChange={handlePlanningGroupStatusChange}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedItem(null)
            setAssignmentMessage(null)
            setSelectedFilterNotice(null)
          }
        }}
      />
    </>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="grid gap-1 rounded-lg border border-border/70 bg-background/70 p-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  )
}

type CandidateStatusFilter =
  | "all"
  | "assignable"
  | "needs-review"
  | "blocked"
type CandidateGuideStatusFilter = "all" | "active"
type CandidateCompatibilityFilter =
  | "all"
  | "language"
  | "circuit"
  | "available"

function PlanningGroupDialog({
  assignPermissionMessage,
  assignmentMessage,
  canAssignGuide,
  canChangeGuide,
  canConfirmGuide,
  canEditGroup,
  canSendGroupInformation,
  candidates,
  circuits,
  changePermissionMessage,
  confirmPermissionMessage,
  isSavingAssignment,
  isSavingGroupStatus,
  communicationEnabled,
  filterNotice,
  item,
  onAssignGuide,
  onConfirmGuide,
  onGroupStatusChange,
  onOpenChange,
}: {
  assignPermissionMessage: string
  assignmentMessage: {
    tone: "success" | "warning" | "error"
    text: string
  } | null
  canAssignGuide: boolean
  canChangeGuide: boolean
  canConfirmGuide: boolean
  canEditGroup: boolean
  canSendGroupInformation: boolean
  candidates: CandidateGuide[]
  circuits: Circuit[]
  changePermissionMessage: string
  confirmPermissionMessage: string
  isSavingAssignment: boolean
  isSavingGroupStatus: boolean
  communicationEnabled: boolean
  filterNotice: string | null
  item: PlanningTimelineItem | null
  onAssignGuide: (candidate: CandidateGuide) => void
  onConfirmGuide: () => void
  onGroupStatusChange: (status: GroupStatus) => Promise<void>
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useI18n()
  const group = item?.group ?? null
  const guideName = item?.guide?.name ?? t("status.without_guide")
  const circuitAbbreviation = item
    ? getCircuitAbbreviation(item.circuit)
    : "—"
  const [candidateSearch, setCandidateSearch] = useState("")
  const [candidateStatusFilter, setCandidateStatusFilter] =
    useState<CandidateStatusFilter>("all")
  const [guideStatusFilter, setGuideStatusFilter] =
    useState<CandidateGuideStatusFilter>("all")
  const [compatibilityFilter, setCompatibilityFilter] =
    useState<CandidateCompatibilityFilter>("all")
  const [communicationRows, setCommunicationRows] = useState<
    AssignmentNotificationStatusRow[]
  >([])
  const [communicationHistory, setCommunicationHistory] = useState<
    AssignmentNotificationHistoryRow[]
  >([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [communicationMessage, setCommunicationMessage] = useState<{
    tone: "success" | "error"
    text: string
  } | null>(null)
  const [contactCopyFeedback, setContactCopyFeedback] = useState<{
    guideId: string
    contact: "email" | "phone"
    tone: "success" | "error"
  } | null>(null)
  const [pendingCommunication, setPendingCommunication] =
    useState<AssignmentNotificationEvent | null>(null)
  const [selectedGroupStatus, setSelectedGroupStatus] = useState<GroupStatus>(
    group?.groupStatus ?? "active"
  )
  const circuitById = useMemo(
    () => new Map(circuits.map((circuit) => [circuit.id, circuit])),
    [circuits]
  )
  const filteredCandidates = useMemo(() => {
    const normalizedSearch = candidateSearch.trim().toLocaleLowerCase()

    return candidates.filter((candidate) => {
      const spokenLanguages = normalizeSpokenLanguages(
        candidate.guide.languages,
        candidate.guide.preferredLanguage
      )
      const circuitSearchValues = candidate.guide.circuitIds.flatMap(
        (circuitId) => {
          const circuit = circuitById.get(circuitId)

          return circuit
            ? [
                circuit.code,
                circuit.name,
                circuit.region,
                ...(circuit.aliases ?? []),
              ]
            : [circuitId]
        }
      )
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [
          candidate.guide.name,
          candidate.guide.email,
          candidate.guide.phone ?? "",
          candidate.guide.preferredLanguage,
          ...spokenLanguages,
          ...circuitSearchValues,
        ].some((value) =>
          value.toLocaleLowerCase().includes(normalizedSearch)
        )
      const matchesCandidateStatus =
        candidateStatusFilter === "all" ||
        (candidateStatusFilter === "assignable" &&
          candidate.canAssign &&
          !candidate.warningReason) ||
        (candidateStatusFilter === "needs-review" &&
          candidate.canAssign &&
          Boolean(candidate.warningReason)) ||
        (candidateStatusFilter === "blocked" && !candidate.canAssign)
      const matchesGuideStatus =
        guideStatusFilter === "all" || candidate.guide.status === "active"
      const matchesCompatibility =
        compatibilityFilter === "all" ||
        (compatibilityFilter === "language" &&
          (candidate.languageResult === "match" ||
            candidate.languageResult === "not-required")) ||
        (compatibilityFilter === "circuit" &&
          candidate.circuitResult === "match") ||
        (compatibilityFilter === "available" &&
          candidate.availabilityResult === "available" &&
          candidate.conflictResult === "clear")

      return (
        matchesSearch &&
        matchesCandidateStatus &&
        matchesGuideStatus &&
        matchesCompatibility
      )
    })
  }, [
    candidateSearch,
    candidateStatusFilter,
    candidates,
    circuitById,
    compatibilityFilter,
    guideStatusFilter,
  ])
  const filtersAreActive =
    candidateSearch.trim().length > 0 ||
    candidateStatusFilter !== "all" ||
    guideStatusFilter !== "all" ||
    compatibilityFilter !== "all"
  const guidePhone = item?.guide?.phone?.trim() ?? ""
  const whatsAppContact = getWhatsAppContact(guidePhone)
  const guideEmail = item?.guide?.email.trim() ?? ""
  const hasGuideEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guideEmail)
  const activeContactCopyFeedback =
    contactCopyFeedback?.guideId === item?.guide?.id
      ? contactCopyFeedback
      : null

  useEffect(() => {
    let active = true

    async function loadCommunicationStatus() {
      if (!communicationEnabled || !group?.id) {
        setCommunicationRows([])
        return
      }

      const result = await getGroupAssignmentNotificationStatus(group.id)

      if (active && !result.error) setCommunicationRows(result.data)
      if (historyOpen) {
        const history = await getGroupAssignmentNotificationHistory(group.id)
        if (active) {
          setHistoryError(history.error)
          setCommunicationHistory(history.data)
        }
      }
    }

    void loadCommunicationStatus()

    return () => {
      active = false
    }
  }, [communicationEnabled, group?.currentAssignmentId, group?.guideId, group?.id, group?.groupStatus, historyOpen])

  async function handleHistoryToggle() {
    if (historyOpen) {
      setHistoryOpen(false)
      return
    }
    if (!group || !communicationEnabled) return

    setHistoryOpen(true)
    setHistoryLoading(true)
    setHistoryError(null)
    const result = await getGroupAssignmentNotificationHistory(group.id)
    setHistoryLoading(false)

    if (result.error) {
      setHistoryError(result.error)
      return
    }

    setCommunicationHistory(result.data)
  }

  function getLatestCommunicationStatus(eventTypes: string[]) {
    return communicationRows
      .filter((row) => eventTypes.includes(row.eventType))
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0]
  }

  function formatCommunicationStatus(row: AssignmentNotificationStatusRow | undefined) {
    if (!row) return t("planning.communication.never_queued")
    if (row.status === "sent" && row.sentAt) {
      return t("planning.communication.sent_at", { date: formatDateTimeDisplay(row.sentAt) })
    }
    if (row.status === "failed") return t("planning.planning_module.failed")
    if (row.status === "blocked") return t("planning.communication.not_configured")
    return t("planning.communication.pending_delivery")
  }

  async function handleCommunication(eventType: AssignmentNotificationEvent) {
    if (!group || pendingCommunication) return

    setPendingCommunication(eventType)
    setCommunicationMessage(null)
    const result = await enqueueManualAssignmentNotification({
      eventType,
      groupId: group.id,
    })
    setPendingCommunication(null)

    if (result.error) {
      setCommunicationMessage({ tone: "error", text: result.error })
      return
    }

    setCommunicationMessage({
      tone: "success",
      text: result.message ?? t("planning.communication.queued"),
    })
    const refreshResult = await getGroupAssignmentNotificationStatus(group.id)
    if (!refreshResult.error) setCommunicationRows(refreshResult.data)
    if (historyOpen) {
      const historyResult = await getGroupAssignmentNotificationHistory(group.id)
      if (!historyResult.error) setCommunicationHistory(historyResult.data)
    }
  }

  async function handleCopyContact(
    contact: "email" | "phone",
    value: string
  ) {
    if (!item?.guide || !value) return

    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable")
      await navigator.clipboard.writeText(value)
      setContactCopyFeedback({
        guideId: item.guide.id,
        contact,
        tone: "success",
      })
    } catch {
      setContactCopyFeedback({
        guideId: item.guide.id,
        contact,
        tone: "error",
      })
    }
  }

  function resetCandidateFilters() {
    setCandidateSearch("")
    setCandidateStatusFilter("all")
    setGuideStatusFilter("all")
    setCompatibilityFilter("all")
  }

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      {group && item ? (
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{group.code}</DialogTitle>
            <DialogDescription>
              <T i18nKey="planning.planning_module.review_candidate_guides_without_leaving_planning_assignment_actions" />
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-3">
            <DetailRow label={t("common.circuit")} value={item.circuit?.name ?? t("common.unknown")} />
            <DetailRow label={t("planning.planning_module.label_circuit_code")} value={circuitAbbreviation} />
            <DetailRow
              label={t("planning.planning_module.label_dates")}
              value={`${formatDateDisplay(group.startDateIso)} - ${formatDateDisplay(
                group.endDateIso
              )}`}
            />
            <DetailRow
              label={t("planning.planning_module.label_required_language")}
              value={group.requiredLanguage ?? group.language ?? t("assignments.selected.any_language")}
            />
            <DetailRow label={t("planning.planning_module.label_current_guide")} value={guideName} />
            <DetailRow
              label={t("planning.planning_module.label_rest_overlap")}
              value={item.restLabel ?? t("planning.dialog.rest_not_applicable")}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <GroupStatusBadge status={group.groupStatus} />
            <AssignmentStatusBadge status={group.assignmentStatus} />
            <ConfirmationStatusBadge status={group.confirmationStatus} />
            {group.guideId &&
            group.confirmationStatus === "pending-confirmation" ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isSavingAssignment || !canConfirmGuide}
                  title={
                    !canConfirmGuide ? confirmPermissionMessage : undefined
                  }
                  onClick={onConfirmGuide}
                >
                  <CheckCircle2 className="size-4" />
                  {isSavingAssignment ? t("planning.dialog.saving") : t("planning.dialog.confirm_guide")}
                </Button>
                {!canConfirmGuide ? (
                  <span className="text-xs text-muted-foreground">
                    {confirmPermissionMessage}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <section className="space-y-1.5 rounded-lg border border-border/70 bg-background/60 p-2.5">
            <div className="flex flex-wrap items-end gap-2">
              <div className="grid min-w-44 gap-1">
                <label
                  htmlFor={`planning-group-status-${group.id}`}
                  className="text-xs font-medium text-muted-foreground"
                >
                  <T i18nKey="planning.planning_module.group_status" />
                </label>
                <Select
                  value={selectedGroupStatus}
                  disabled={!canEditGroup || isSavingGroupStatus}
                  onValueChange={(value) =>
                    setSelectedGroupStatus(value as GroupStatus)
                  }
                >
                  <SelectTrigger id={`planning-group-status-${group.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {groupStatusOptions.map((status) => (
                      <SelectItem
                        key={status.value}
                        value={status.value}
                      >
                      {t(status.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {canEditGroup ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    isSavingGroupStatus ||
                    selectedGroupStatus === group.groupStatus
                  }
                  onClick={() =>
                    void onGroupStatusChange(selectedGroupStatus)
                  }
                >
                  {isSavingGroupStatus ? t("planning.dialog.saving") : t("planning.dialog.save_status")}
                </Button>
              ) : (
                <span className="pb-1 text-xs text-muted-foreground">
                  <T i18nKey="planning.planning_module.view_only" />
                </span>
              )}
            </div>
            {group.guideId && (selectedGroupStatus === "cxl" || selectedGroupStatus === "fusionado") ? (
              <p className="text-xs text-muted-foreground">
                <T i18nKey="planning.planning_module.saving_this_status_removes_the_current_assignment_releases" />
              </p>
            ) : null}
          </section>

          <div className="grid gap-2">
            {filterNotice ? (
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <Search className="mt-0.5 size-4 shrink-0" />
                {filterNotice}
              </div>
            ) : null}
            {group.assignmentStatus === "without-guide" ? (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <T i18nKey="planning.planning_module.this_group_does_not_have_a_guide_assigned" />
              </div>
            ) : null}
            {group.confirmationStatus === "pending-confirmation" ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <T i18nKey="planning.planning_module.the_current_guide_assignment_is_pending_confirmation" />
              </div>
            ) : null}
            {item.restTone === "danger" ? (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <T i18nKey="planning.planning_module.this_guide_timeline_has_an_overlapping_assigned_tour" />
              </div>
            ) : null}
            {assignmentMessage ? (
              <div
                className={
                  assignmentMessage.tone === "error"
                    ? "rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                    : assignmentMessage.tone === "warning"
                      ? "rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                      : "rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
                }
              >
                {assignmentMessage.text}
              </div>
            ) : null}
          </div>

          {communicationEnabled ? (
            <section className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Mail className="size-4" />
                    <T i18nKey="planning.planning_module.guide_communication" />
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <T i18nKey="planning.planning_module.messages_are_recorded_in_the_outbox_delivery_provider" />
                  </p>
                </div>
              </div>
              {group.guideId ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {group.confirmationStatus === "pending-confirmation" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          !hasGuideEmail ||
                          !canConfirmGuide ||
                          Boolean(pendingCommunication)
                        }
                        onClick={() => void handleCommunication("confirmation_request")}
                      >
                        <Mail className="size-3.5" />
                        {pendingCommunication === "confirmation_request"
                          ? t("planning.communication.queue_progress")
                          : t("planning.communication.resend_confirmation")}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        !hasGuideEmail ||
                        !canSendGroupInformation ||
                        Boolean(pendingCommunication)
                      }
                      onClick={() => void handleCommunication("group_information")}
                    >
                      <Mail className="size-3.5" />
                      {pendingCommunication === "group_information"
                        ? t("planning.communication.queue_progress")
                        : t("planning.communication.resend_group_info")}
                    </Button>
                  </div>
                  <div className="grid gap-3 pt-1 sm:grid-cols-2">
                    <div className="min-w-0 space-y-1.5">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Mail className="size-3.5" />
                        <T i18nKey="common.email" />
                      </p>
                      <p className={hasGuideEmail
                        ? "break-all text-sm text-foreground"
                        : "text-sm text-muted-foreground"}
                      >
                        {hasGuideEmail
                          ? guideEmail
                          : t("planning.planning_module.email_unavailable_no_email_address")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!hasGuideEmail}
                          onClick={() => void handleCopyContact("email", guideEmail)}
                        >
                          {activeContactCopyFeedback?.contact === "email" &&
                          activeContactCopyFeedback.tone === "success" ? (
                            <ClipboardCheck className="size-3.5" />
                          ) : (
                            <ClipboardCopy className="size-3.5" />
                          )}
                          {activeContactCopyFeedback?.contact === "email" &&
                          activeContactCopyFeedback.tone === "success"
                            ? t("common.copied")
                            : t("common.copy")}
                        </Button>
                        {hasGuideEmail ? (
                          <Button asChild type="button" size="sm" variant="outline">
                            <a href={`mailto:${guideEmail}`}>
                              <Mail className="size-3.5" />
                              <T i18nKey="planning.communication.open_email" />
                            </a>
                          </Button>
                        ) : (
                          <Button type="button" size="sm" variant="outline" disabled>
                            <Mail className="size-3.5" />
                            <T i18nKey="planning.communication.open_email" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <MessageCircle className="size-3.5" />
                        <T i18nKey="guides.guides_table.whatsapp" />
                      </p>
                      <p className={guidePhone
                        ? "break-all text-sm text-foreground"
                        : "text-sm text-muted-foreground"}
                      >
                        {guidePhone || t("planning.communication.whatsapp_no_phone")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!guidePhone}
                          onClick={() => void handleCopyContact("phone", guidePhone)}
                        >
                          {activeContactCopyFeedback?.contact === "phone" &&
                          activeContactCopyFeedback.tone === "success" ? (
                            <ClipboardCheck className="size-3.5" />
                          ) : (
                            <ClipboardCopy className="size-3.5" />
                          )}
                          {activeContactCopyFeedback?.contact === "phone" &&
                          activeContactCopyFeedback.tone === "success"
                            ? t("common.copied")
                            : t("common.copy")}
                        </Button>
                        {whatsAppContact.available ? (
                          <Button asChild type="button" size="sm" variant="outline">
                            <a
                              href={whatsAppContact.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle className="size-3.5" />
                              <T i18nKey="planning.communication.open_whatsapp" />
                              <ExternalLink className="size-3" />
                            </a>
                          </Button>
                        ) : (
                          <Button type="button" size="sm" variant="outline" disabled>
                            <MessageCircle className="size-3.5" />
                            <T i18nKey="planning.communication.open_whatsapp" />
                          </Button>
                        )}
                      </div>
                      {guidePhone && !whatsAppContact.available ? (
                        <p className="text-xs text-amber-700">
                          <T i18nKey="planning.communication.whatsapp_format_required" />
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {activeContactCopyFeedback?.tone === "error" ? (
                    <p className="text-xs text-red-700"><T i18nKey="common.copy_failed" /></p>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  <T i18nKey="planning.planning_module.assign_a_guide_to_enable_current_communication_actions" />
                </p>
              )}
              {group.guideId ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {group.confirmationStatus === "pending-confirmation" ? (
                    <span>
                      <T i18nKey="planning.planning_module.confirmation_email" /> {formatCommunicationStatus(
                        getLatestCommunicationStatus(["confirmation_request"])
                      )}
                    </span>
                  ) : null}
                  <span>
                    <T i18nKey="planning.planning_module.group_information" /> {formatCommunicationStatus(
                      getLatestCommunicationStatus([
                        "group_information",
                        "assignment_created",
                        "assignment_changed_new_guide",
                      ])
                    )}
                  </span>
                </div>
              ) : null}
              {communicationMessage ? (
                <p
                  className={
                    communicationMessage.tone === "error"
                      ? "text-xs text-red-700"
                      : "text-xs text-emerald-700"
                  }
                >
                  {communicationMessage.text}
                </p>
              ) : null}
              <div className="border-t pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="px-1.5"
                  onClick={() => void handleHistoryToggle()}
                >
                  <History className="size-3.5" />
                  {historyOpen ? t("planning.communication.hide_history") : t("planning.communication.view_history")}
                </Button>
              </div>
              {historyOpen ? (
                <div className="overflow-hidden rounded-md border bg-background">
                  {historyLoading ? (
                    <p className="p-3 text-xs text-muted-foreground">
                      <T i18nKey="planning.planning_module.loading_communication_history" />
                    </p>
                  ) : historyError ? (
                    <p className="p-3 text-xs text-red-700">{historyError}</p>
                  ) : communicationHistory.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">
                      <T i18nKey="planning.planning_module.no_communication_has_been_recorded_for_this_group" />
                    </p>
                  ) : (
                    <div className="max-h-64 divide-y overflow-y-auto">
                      {communicationHistory.map((row, index) => (
                        <div
                          key={`${row.createdAt}-${row.eventType}-${index}`}
                          className="grid gap-1 p-3 text-xs sm:grid-cols-[minmax(10rem,1fr)_minmax(11rem,1fr)_auto] sm:gap-3"
                        >
                          <div>
                            <p className="font-medium text-foreground">
                              {t(communicationEventLabels[row.eventType] ?? "planning.communication.guide_communication")}
                            </p>
                            <p className="text-muted-foreground">
                              {t(row.isManual ? "planning.communication.manual" : "planning.communication.automatic")} · {formatDateTimeDisplay(row.createdAt)}
                            </p>
                          </div>
                          <div className="min-w-0 text-muted-foreground">
                            <p className="truncate">{row.recipientEmail ?? t("planning.communication.no_recipient")}</p>
                            {row.status === "sent" && row.sentAt ? (
                              <p><T i18nKey="planning.planning_module.sent" /> {formatDateTimeDisplay(row.sentAt)}</p>
                            ) : null}
                            {row.status === "failed" && row.failedAt ? (
                              <p><T i18nKey="planning.planning_module.failed" /> {formatDateTimeDisplay(row.failedAt)}</p>
                            ) : null}
                          </div>
                          <div className="sm:text-right">
                            <Badge variant="outline">{getCommunicationStatusLabel(row, t)}</Badge>
                            {row.lastErrorSafe && row.status !== "sent" ? (
                              <p className="mt-1 max-w-56 text-muted-foreground">
                                {row.lastErrorSafe}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="space-y-2">
            <div className="grid gap-2 rounded-xl border bg-muted/20 p-2 md:grid-cols-[minmax(12rem,1fr)_auto_auto_auto_auto] md:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={candidateSearch}
                  onChange={(event) => setCandidateSearch(event.target.value)}
                  placeholder={t("planning.planning_module.placeholder_search_guide_language_circuit")}
                  className="pl-8"
                  aria-label={t("planning.planning_module.aria_label_search_candidate_guides")}
                />
              </div>
              <Select
                value={candidateStatusFilter}
                onValueChange={(value) =>
                  setCandidateStatusFilter(value as CandidateStatusFilter)
                }
              >
                <SelectTrigger size="sm" aria-label={t("planning.planning_module.aria_label_candidate_status_filter")}>
                  <SelectValue placeholder={t("planning.planning_module.placeholder_candidate_status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all"><T i18nKey="planning.planning_module.all_candidates" /></SelectItem>
                  <SelectItem value="assignable">
                    <T i18nKey="planning.planning_module.assignable_recommended" />
                  </SelectItem>
                  <SelectItem value="needs-review"><T i18nKey="planning.planning_module.needs_review" /></SelectItem>
                  <SelectItem value="blocked"><T i18nKey="planning.planning_module.blocked_unavailable" /></SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={guideStatusFilter}
                onValueChange={(value) =>
                  setGuideStatusFilter(value as CandidateGuideStatusFilter)
                }
              >
                <SelectTrigger size="sm" aria-label={t("planning.planning_module.aria_label_guide_status_filter")}>
                  <SelectValue placeholder={t("planning.planning_module.placeholder_guide_status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all"><T i18nKey="planning.planning_module.all_guide_statuses" /></SelectItem>
                  <SelectItem value="active"><T i18nKey="planning.planning_module.active_only" /></SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={compatibilityFilter}
                onValueChange={(value) =>
                  setCompatibilityFilter(
                    value as CandidateCompatibilityFilter
                  )
                }
              >
                <SelectTrigger size="sm" aria-label={t("planning.planning_module.aria_label_compatibility_filter")}>
                  <SelectValue placeholder={t("planning.planning_module.placeholder_compatibility")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all"><T i18nKey="planning.planning_module.all_compatibility" /></SelectItem>
                  <SelectItem value="language"><T i18nKey="planning.planning_module.language_match" /></SelectItem>
                  <SelectItem value="circuit"><T i18nKey="planning.planning_module.circuit_match" /></SelectItem>
                  <SelectItem value="available">
                    <T i18nKey="planning.planning_module.available_no_conflict" />
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!filtersAreActive}
                onClick={resetCandidateFilters}
              >
                <T i18nKey="planning.planning_module.reset_filters" />
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {filteredCandidates.length} <T i18nKey="planning.planning_module.of" /> {candidates.length} <T i18nKey="planning.planning_module.candidates" />
              </span>
              {group.guideId ? (
                <span><T i18nKey="planning.planning_module.the_current_guide_cannot_be_selected_again" /></span>
              ) : null}
            </div>
          </div>

          {filteredCandidates.length > 0 ? (
            <div className="max-h-[24rem] overflow-x-hidden overflow-y-auto rounded-xl border bg-background">
              <CandidateGuidesTable
                actionsDisabled={
                  isSavingAssignment ||
                  (group.guideId ? !canChangeGuide : !canAssignGuide)
                }
                actionsDisabledReason={
                  isSavingAssignment
                    ? "Saving assignment."
                    : group.guideId
                      ? changePermissionMessage
                      : assignPermissionMessage
                }
                candidates={filteredCandidates}
                currentGuideId={group.guideId}
                description={t("planning.planning_module.description_candidate_ranking_uses_the_shared_assignments_matching_rules")}
                hasCurrentGuide={Boolean(group.guideId)}
                onAssignGuide={onAssignGuide}
                tableClassName="min-w-[58rem]"
                variant="planning-dialog"
              />
            </div>
          ) : (
            <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 text-center">
              <p className="text-sm font-medium"><T i18nKey="planning.planning_module.no_candidates_match" /></p>
              <p className="text-xs text-muted-foreground">
                <T i18nKey="planning.planning_module.adjust_the_search_or_candidate_filters_to_inspect" />
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={resetCandidateFilters}
              >
                <T i18nKey="planning.planning_module.reset_filters" />
              </Button>
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            <Button variant="outline" asChild>
              <Link href="/groups">
                <ExternalLink className="size-4" />
                <T i18nKey="planning.planning_module.open_in_groups" />
              </Link>
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" asChild>
                <Link href="/assignments">
                  <ArrowRight className="size-4" />
                  <T i18nKey="planning.planning_module.open_assignments" />
                </Link>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
