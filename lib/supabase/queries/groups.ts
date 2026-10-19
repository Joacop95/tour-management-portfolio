import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import type {
  AssignmentStatus,
  ConfirmationStatus,
  GroupStatus,
  TourGroup,
} from "@/lib/types/domain"
import { normalizeSpokenLanguages } from "@/lib/utils/language-options"
import { readAllPages, readByIdBatches } from "@/lib/supabase/queries/paginated-read"

type SupabaseGroupStatus = "active" | "cxl" | "fusionado" | "finalized"
type SupabaseAssignmentStatus = "without_guide" | "assigned"
type SupabaseConfirmationStatus =
  | "not_required"
  | "pending_confirmation"
  | "confirmed"

type GroupRow = {
  id: string
  group_code: string
  circuit_id: string | null
  start_date: string | null
  end_date: string | null
  group_status: SupabaseGroupStatus
  assignment_status: SupabaseAssignmentStatus
  confirmation_status: SupabaseConfirmationStatus
  language: "english" | "french" | "spanish" | "turkish" | null
  estimated_passengers: number | null
  internal_notes: string | null
  updated_at: string
}

type AssignmentRow = {
  id: string
  group_id: string
  guide_id: string | null
  status: SupabaseAssignmentStatus
  confirmation_status: SupabaseConfirmationStatus
}

type CircuitRow = {
  id: string
  name: string
}

type GuideRow = {
  id: string
  full_name: string
}

export type SupabaseTourGroup = TourGroup & {
  circuitName: string
  currentGuideName: string | null
}

export type SupabaseGroupsResult = {
  data: SupabaseTourGroup[]
  error: string | null
}

export type SupabaseGroupSearchItem = {
  group: TourGroup
  circuitName: string
  currentGuideName: string | null
}

export type SupabaseGroupSearchResult = {
  data: SupabaseGroupSearchItem[]
  error: string | null
}

const assignmentStatusBySupabaseValue: Record<
  SupabaseAssignmentStatus,
  AssignmentStatus
> = {
  without_guide: "without-guide",
  assigned: "assigned",
}

const confirmationStatusBySupabaseValue: Record<
  SupabaseConfirmationStatus,
  ConfirmationStatus
> = {
  not_required: "not-required",
  pending_confirmation: "pending-confirmation",
  confirmed: "confirmed",
}

function mapGroupStatus(status: SupabaseGroupStatus): GroupStatus {
  return status
}

export async function getSupabaseGroups(): Promise<SupabaseGroupsResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return {
      data: [],
      error: "Supabase environment variables are not configured.",
    }
  }

  const { data: groups, error: groupsError } = await readAllPages((start, end) =>
    supabase
      .from("groups")
      .select(
        "id, group_code, circuit_id, start_date, end_date, group_status, assignment_status, confirmation_status, language, estimated_passengers, internal_notes, updated_at"
      )
      .eq("is_archived", false)
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .range(start, end)
      .returns<GroupRow[]>()
  )

  if (groupsError) {
    return {
      data: [],
      error: groupsError,
    }
  }

  const groupIds = groups.map((group) => group.id)
  const circuitIds = Array.from(new Set(groups.map((group) => group.circuit_id).filter((id): id is string => Boolean(id))))

  if (groups.length === 0) {
    return {
      data: [],
      error: null,
    }
  }

  const { data: assignments, error: assignmentsError } = await readByIdBatches(
    groupIds,
    (batch, start, end) => supabase
      .from("assignments")
      .select("id, group_id, guide_id, status, confirmation_status")
      .in("group_id", batch)
      .eq("is_current", true)
      .eq("is_archived", false)
      .order("id", { ascending: true })
      .range(start, end)
      .returns<AssignmentRow[]>()
  )

  if (assignmentsError) {
    return {
      data: [],
      error: assignmentsError,
    }
  }

  const { data: circuits, error: circuitsError } = await readByIdBatches(
    circuitIds,
    (batch, start, end) => supabase.from("circuits")
      .select("id, name").in("id", batch)
      .order("id", { ascending: true }).range(start, end)
      .returns<CircuitRow[]>()
  )

  if (circuitsError) {
    return {
      data: [],
      error: circuitsError,
    }
  }

  const guideIds = Array.from(
    new Set(
      assignments
        .map((assignment) => assignment.guide_id)
        .filter((guideId): guideId is string => Boolean(guideId))
    )
  )
  const { data: guides, error: guidesError } = await readByIdBatches(
    guideIds,
    (batch, start, end) => supabase.from("guides")
      .select("id, full_name").in("id", batch)
      .order("id", { ascending: true }).range(start, end)
      .returns<GuideRow[]>()
  )

  if (guidesError) {
    return {
      data: [],
      error: guidesError,
    }
  }

  const assignmentByGroupId = new Map(
    assignments.map((assignment) => [assignment.group_id, assignment])
  )
  const circuitNameById = new Map(
    circuits.map((circuit) => [circuit.id, circuit.name])
  )
  const guideNameById = new Map(guides.map((guide) => [guide.id, guide.full_name]))

  return {
    data: groups.map((group) => {
      const currentAssignment = assignmentByGroupId.get(group.id)
      const guideId = currentAssignment?.guide_id ?? null

      return {
        id: group.id,
        code: group.group_code,
        circuitId: group.circuit_id ?? "",
        startDate: group.start_date ?? "",
        endDate: group.end_date ?? "",
        startDateIso: group.start_date ?? "",
        endDateIso: group.end_date ?? "",
        guideId,
        currentAssignmentId: currentAssignment?.id,
        updatedAtIso: group.updated_at,
        groupStatus: mapGroupStatus(group.group_status),
        assignmentStatus: currentAssignment
          ? assignmentStatusBySupabaseValue[currentAssignment.status]
          : assignmentStatusBySupabaseValue[group.assignment_status],
        confirmationStatus: currentAssignment
          ? confirmationStatusBySupabaseValue[
              currentAssignment.confirmation_status
            ]
          : confirmationStatusBySupabaseValue[group.confirmation_status],
        requiredLanguage:
          normalizeSpokenLanguages([group.language])[0] ?? null,
        travelers: group.estimated_passengers ?? 0,
        internalNotes: group.internal_notes ?? undefined,
        circuitName: group.circuit_id ? (circuitNameById.get(group.circuit_id) ?? "Unknown circuit") : "No circuit",
        currentGuideName: guideId
          ? (guideNameById.get(guideId) ?? "Unknown guide")
          : null,
      }
    }),
    error: null,
  }
}

function escapeIlikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&")
}

function getGroupCodeSearchRank(groupCode: string, query: string) {
  const normalizedCode = groupCode.toLocaleLowerCase()
  const normalizedQuery = query.toLocaleLowerCase()

  if (normalizedCode === normalizedQuery) return 0
  if (normalizedCode.startsWith(normalizedQuery)) return 1
  return 2
}

export async function searchSupabaseGroupsByCode(
  rawQuery: string,
  limit = 10
): Promise<SupabaseGroupSearchResult> {
  const query = rawQuery.trim()
  const supabase = getSupabaseBrowserClient()

  if (query.length < 2) return { data: [], error: null }
  if (!supabase) {
    return {
      data: [],
      error: "Supabase environment variables are not configured.",
    }
  }

  const escapedQuery = escapeIlikePattern(query)
  const groupColumns =
    "id, group_code, circuit_id, start_date, end_date, group_status, assignment_status, confirmation_status, language, estimated_passengers, updated_at"
  const [exactResult, prefixResult, partialResult] = await Promise.all([
    supabase
      .from("groups")
      .select(groupColumns)
      .eq("is_archived", false)
      .ilike("group_code", escapedQuery)
      .limit(1)
      .returns<GroupRow[]>(),
    supabase
      .from("groups")
      .select(groupColumns)
      .eq("is_archived", false)
      .ilike("group_code", `${escapedQuery}%`)
      .order("group_code", { ascending: true })
      .limit(limit)
      .returns<GroupRow[]>(),
    supabase
      .from("groups")
      .select(groupColumns)
      .eq("is_archived", false)
      .ilike("group_code", `%${escapedQuery}%`)
      .order("group_code", { ascending: true })
      .limit(20)
      .returns<GroupRow[]>(),
  ])

  const groupError =
    exactResult.error ?? prefixResult.error ?? partialResult.error
  if (groupError) return { data: [], error: "Unable to search groups." }

  const groupById = new Map<string, GroupRow>()
  ;[
    ...(exactResult.data ?? []),
    ...(prefixResult.data ?? []),
    ...(partialResult.data ?? []),
  ].forEach((group) => groupById.set(group.id, group))
  const matchedGroups = Array.from(groupById.values())
    .sort((firstGroup, secondGroup) => {
      const rankDifference =
        getGroupCodeSearchRank(firstGroup.group_code, query) -
        getGroupCodeSearchRank(secondGroup.group_code, query)

      return (
        rankDifference ||
        firstGroup.group_code.localeCompare(secondGroup.group_code, undefined, {
          sensitivity: "base",
        }) ||
        firstGroup.id.localeCompare(secondGroup.id)
      )
    })
    .slice(0, limit)

  if (matchedGroups.length === 0) return { data: [], error: null }

  const groupIds = matchedGroups.map((group) => group.id)
  const circuitIds = Array.from(
    new Set(
      matchedGroups
        .map((group) => group.circuit_id)
        .filter((id): id is string => Boolean(id))
    )
  )
  const [assignmentsResult, circuitsResult] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, group_id, guide_id, status, confirmation_status")
      .in("group_id", groupIds)
      .eq("is_current", true)
      .eq("is_archived", false)
      .returns<AssignmentRow[]>(),
    circuitIds.length > 0
      ? supabase
          .from("circuits")
          .select("id, name")
          .in("id", circuitIds)
          .returns<CircuitRow[]>()
      : Promise.resolve({ data: [] as CircuitRow[], error: null }),
  ])

  const contextError = assignmentsResult.error ?? circuitsResult.error
  if (contextError) return { data: [], error: "Unable to load group details." }

  const assignments = assignmentsResult.data ?? []
  const guideIds = Array.from(
    new Set(
      assignments
        .map((assignment) => assignment.guide_id)
        .filter((id): id is string => Boolean(id))
    )
  )
  const guidesResult =
    guideIds.length > 0
      ? await supabase
          .from("guides")
          .select("id, full_name")
          .in("id", guideIds)
          .returns<GuideRow[]>()
      : { data: [] as GuideRow[], error: null }

  if (guidesResult.error) {
    return { data: [], error: "Unable to load group details." }
  }

  const assignmentByGroupId = new Map(
    assignments.map((assignment) => [assignment.group_id, assignment])
  )
  const circuitNameById = new Map(
    (circuitsResult.data ?? []).map((circuit) => [circuit.id, circuit.name])
  )
  const guideNameById = new Map(
    (guidesResult.data ?? []).map((guide) => [guide.id, guide.full_name])
  )

  return {
    data: matchedGroups.map((group) => {
      const assignment = assignmentByGroupId.get(group.id)
      const guideId = assignment?.guide_id ?? null

      return {
        group: {
          id: group.id,
          code: group.group_code,
          circuitId: group.circuit_id ?? "",
          startDate: group.start_date ?? "",
          endDate: group.end_date ?? "",
          startDateIso: group.start_date ?? "",
          endDateIso: group.end_date ?? "",
          guideId,
          currentAssignmentId: assignment?.id,
          updatedAtIso: group.updated_at,
          groupStatus: mapGroupStatus(group.group_status),
          assignmentStatus: assignment
            ? assignmentStatusBySupabaseValue[assignment.status]
            : assignmentStatusBySupabaseValue[group.assignment_status],
          confirmationStatus: assignment
            ? confirmationStatusBySupabaseValue[assignment.confirmation_status]
            : confirmationStatusBySupabaseValue[group.confirmation_status],
          requiredLanguage:
            normalizeSpokenLanguages([group.language])[0] ?? null,
          travelers: group.estimated_passengers ?? 0,
        },
        circuitName: group.circuit_id
          ? (circuitNameById.get(group.circuit_id) ?? "Unknown circuit")
          : "No circuit",
        currentGuideName: guideId
          ? (guideNameById.get(guideId) ?? "Unknown guide")
          : null,
      }
    }),
    error: null,
  }
}
