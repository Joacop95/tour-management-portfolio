import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { readAllPages, readByIdBatches } from "@/lib/supabase/queries/paginated-read"

type ChangeRequestType =
  | "group_change"
  | "availability_change"
  | "profile_change"
  | "other"

export type ChangeRequestStatus =
  | "pending"
  | "in_progress"
  | "approved"
  | "rejected"
  | "completed"
  | "cancelled"

type ChangeRequestRow = {
  id: string
  guide_id: string
  group_id: string | null
  assignment_id: string | null
  availability_id: string | null
  request_type: ChangeRequestType
  request_status: ChangeRequestStatus
  requested_at: string
  guide_message: string | null
  reason: string | null
  notes: string | null
  internal_notes: string | null
  decision_reason: string | null
  reviewed_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  created_at: string
}

type GuideLookupRow = {
  id: string
  full_name: string
  authorized_email: string
}

type GroupLookupRow = {
  id: string
  group_code: string
  circuit_id: string
  start_date: string
  end_date: string
}

type CircuitLookupRow = {
  id: string
  name: string
  code: string | null
}

export type SupabaseChangeRequestInboxItem = {
  id: string
  guideId: string
  guideName: string | null
  guideEmail: string | null
  groupId: string | null
  groupCode: string | null
  circuitId: string | null
  circuitName: string | null
  circuitCode: string | null
  groupStartDate: string | null
  groupEndDate: string | null
  assignmentId: string | null
  availabilityId: string | null
  requestType: ChangeRequestType
  requestStatus: ChangeRequestStatus
  requestedAt: string
  message: string
  internalNotes: string | null
  decisionReason: string | null
  reviewedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  createdAt: string
}

export type SupabaseChangeRequestInboxResult = {
  data: SupabaseChangeRequestInboxItem[]
  error: string | null
  warning: string | null
}

export type SupabaseChangeRequestCounts = Record<ChangeRequestStatus, number> & {
  totalActive: number
}

export type SupabaseChangeRequestCountsResult = {
  data: SupabaseChangeRequestCounts
  error: string | null
}

const supabaseUnavailableMessage =
  "Supabase environment variables are not configured."

const emptyChangeRequestCounts: SupabaseChangeRequestCounts = {
  pending: 0,
  in_progress: 0,
  approved: 0,
  rejected: 0,
  completed: 0,
  cancelled: 0,
  totalActive: 0,
}
const changeRequestStatuses: ChangeRequestStatus[] = [
  "pending", "in_progress", "approved", "rejected", "completed", "cancelled",
]

function uniqueNonEmpty(values: Array<string | null>) {
  return Array.from(new Set(values.filter(Boolean) as string[]))
}

export function countChangeRequestStatuses(
  statuses: ChangeRequestStatus[]
): SupabaseChangeRequestCounts {
  const counts = { ...emptyChangeRequestCounts }

  for (const status of statuses) {
    counts[status] += 1
  }

  counts.totalActive = counts.pending + counts.in_progress

  return counts
}

export async function getSupabaseChangeRequestCounts(): Promise<SupabaseChangeRequestCountsResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return {
      data: { ...emptyChangeRequestCounts },
      error: supabaseUnavailableMessage,
    }
  }

  const results = await Promise.all(changeRequestStatuses.map((status) =>
    supabase.from("change_requests")
      .select("id", { count: "exact", head: true })
      .eq("is_archived", false)
      .eq("request_status", status)
  ))
  const error = results.find((result) => result.error)?.error
  if (error) return { data: { ...emptyChangeRequestCounts }, error: error.message }

  const counts = { ...emptyChangeRequestCounts }
  changeRequestStatuses.forEach((status, index) => {
    counts[status] = results[index].count ?? 0
  })
  counts.totalActive = counts.pending + counts.in_progress
  return { data: counts, error: null }
}

export async function getSupabaseChangeRequestInbox(): Promise<SupabaseChangeRequestInboxResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return {
      data: [],
      error: supabaseUnavailableMessage,
      warning: null,
    }
  }

  const { data: requestRows, error: requestError } = await readAllPages((start, end) => supabase
    .from("change_requests")
    .select(
      "id, guide_id, group_id, assignment_id, availability_id, request_type, request_status, requested_at, guide_message, reason, notes, internal_notes, decision_reason, reviewed_at, completed_at, cancelled_at, created_at"
    )
    .order("requested_at", { ascending: false })
    .order("id", { ascending: true })
    .range(start, end)
    .returns<ChangeRequestRow[]>())

  if (requestError) {
    return {
      data: [],
      error: requestError,
      warning: null,
    }
  }

  const requests = requestRows ?? []
  const guideIds = uniqueNonEmpty(requests.map((request) => request.guide_id))
  const groupIds = uniqueNonEmpty(requests.map((request) => request.group_id))
  const warnings: string[] = []
  const guidesById = new Map<string, GuideLookupRow>()
  const groupsById = new Map<string, GroupLookupRow>()
  const circuitsById = new Map<string, CircuitLookupRow>()

  if (guideIds.length > 0) {
    const { data: guideRows, error: guideError } = await readByIdBatches(
      guideIds,
      (batch, start, end) => supabase.from("guides")
        .select("id, full_name, authorized_email")
        .in("id", batch).order("id", { ascending: true })
        .range(start, end).returns<GuideLookupRow[]>()
    )

    if (guideError) {
      warnings.push(`Guide display data could not be loaded: ${guideError}`)
    } else {
      for (const guide of guideRows ?? []) {
        guidesById.set(guide.id, guide)
      }
    }
  }

  if (groupIds.length > 0) {
    const { data: groupRows, error: groupError } = await readByIdBatches(
      groupIds,
      (batch, start, end) => supabase.from("groups")
        .select("id, group_code, circuit_id, start_date, end_date")
        .in("id", batch).order("id", { ascending: true })
        .range(start, end).returns<GroupLookupRow[]>()
    )

    if (groupError) {
      warnings.push(`Group display data could not be loaded: ${groupError}`)
    } else {
      const groups = groupRows ?? []

      groups.forEach((group) => groupsById.set(group.id, group))

      const circuitIds = uniqueNonEmpty(groups.map((group) => group.circuit_id))

      if (circuitIds.length > 0) {
        const { data: circuitRows, error: circuitError } = await readByIdBatches(
          circuitIds,
          (batch, start, end) => supabase.from("circuits")
            .select("id, name, code")
            .in("id", batch).order("id", { ascending: true })
            .range(start, end).returns<CircuitLookupRow[]>()
        )

        if (circuitError) {
          warnings.push(
            `Circuit display data could not be loaded: ${circuitError}`
          )
        } else {
          for (const circuit of circuitRows ?? []) {
            circuitsById.set(circuit.id, circuit)
          }
        }
      }
    }
  }

  return {
    data: requests.map((request) => {
      const guide = guidesById.get(request.guide_id)
      const group = request.group_id ? groupsById.get(request.group_id) : null
      const circuit = group ? circuitsById.get(group.circuit_id) : null

      return {
        id: request.id,
        guideId: request.guide_id,
        guideName: guide?.full_name ?? null,
        guideEmail: guide?.authorized_email ?? null,
        groupId: request.group_id,
        groupCode: group?.group_code ?? null,
        circuitId: group?.circuit_id ?? null,
        circuitName: circuit?.name ?? null,
        circuitCode: circuit?.code ?? null,
        groupStartDate: group?.start_date ?? null,
        groupEndDate: group?.end_date ?? null,
        assignmentId: request.assignment_id,
        availabilityId: request.availability_id,
        requestType: request.request_type,
        requestStatus: request.request_status,
        requestedAt: request.requested_at,
        message:
          request.guide_message ??
          request.reason ??
          request.notes ??
          "",
        internalNotes: request.internal_notes,
        decisionReason: request.decision_reason,
        reviewedAt: request.reviewed_at,
        completedAt: request.completed_at,
        cancelledAt: request.cancelled_at,
        createdAt: request.created_at,
      }
    }),
    error: null,
    warning: warnings.length > 0 ? warnings.join(" ") : null,
  }
}
