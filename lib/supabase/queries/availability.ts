import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import type {
  AvailabilitySource,
  AvailabilityStatus,
  GuideAvailability,
} from "@/lib/types/domain"
import { readAllPages, readByIdBatches } from "@/lib/supabase/queries/paginated-read"

type SupabaseAvailabilityStatus =
  | "available"
  | "not_available"
  | "occupied_by_assignment"
  | "pending_review"

type SupabaseAvailabilitySource =
  | "guide_submitted"
  | "admin_updated"
  | "assignment_generated"

type AvailabilityRow = {
  id: string
  guide_id: string
  assignment_id: string | null
  start_date: string
  end_date: string
  status: SupabaseAvailabilityStatus
  source: SupabaseAvailabilitySource
  notes: string | null
  created_at: string
  updated_at: string
  updated_by: string | null
}

type GuideRow = {
  id: string
  full_name: string
}

type AssignmentRow = {
  id: string
  group_id: string
}

type GroupRow = {
  id: string
  group_code: string
  circuit_id: string | null
  start_date: string
  end_date: string
}

type CircuitRow = {
  id: string
  name: string
}

export type SupabaseGuideAvailability = GuideAvailability & {
  guideName: string
  assignmentId?: string
  assignmentGroupCode?: string
  assignmentGroupStartDateIso?: string
  assignmentGroupEndDateIso?: string
  assignmentCircuitName?: string
}

export type SupabaseAvailabilityResult = {
  data: SupabaseGuideAvailability[]
  error: string | null
}

export type SupabaseAvailabilitySubmission = {
  id: string
  guideId: string
  year: number
  status: "draft" | "pending-review" | "changes-requested" | "approved"
  submittedAt: string | null
  reviewedAt: string | null
  reviewMessage: string | null
  updatedAt: string
}

type AvailabilitySubmissionRow = {
  id: string
  guide_id: string
  year: number
  status: "draft" | "pending_review" | "changes_requested" | "approved"
  submitted_at: string | null
  reviewed_at: string | null
  review_message: string | null
  updated_at: string
}

export async function getSupabaseAvailabilitySubmissions(): Promise<{
  data: SupabaseAvailabilitySubmission[]
  error: string | null
}> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return { data: [], error: "Supabase environment variables are not configured." }
  }

  const { data, error } = await readAllPages((start, end) => supabase
    .from("guide_availability_submissions")
    .select(
      "id, guide_id, year, status, submitted_at, reviewed_at, review_message, updated_at"
    )
    .order("status", { ascending: false })
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .range(start, end)
    .returns<AvailabilitySubmissionRow[]>())

  if (error) return { data: [], error }

  return {
    data: data.map((row) => ({
      id: row.id,
      guideId: row.guide_id,
      year: row.year,
      status:
        row.status === "pending_review"
          ? "pending-review"
          : row.status === "changes_requested"
            ? "changes-requested"
            : row.status,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      reviewMessage: row.review_message,
      updatedAt: row.updated_at,
    })),
    error: null,
  }
}

const availabilityStatusBySupabaseValue: Record<
  SupabaseAvailabilityStatus,
  AvailabilityStatus
> = {
  available: "available",
  not_available: "not-available",
  occupied_by_assignment: "occupied-by-assignment",
  pending_review: "pending-review",
}

const availabilitySourceBySupabaseValue: Record<
  SupabaseAvailabilitySource,
  AvailabilitySource
> = {
  guide_submitted: "guide-submitted",
  admin_updated: "admin-updated",
  assignment_generated: "assignment-generated",
}

export async function getSupabaseAvailability(): Promise<SupabaseAvailabilityResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return {
      data: [],
      error: "Supabase environment variables are not configured.",
    }
  }

  const { data: availability, error: availabilityError } = await readAllPages((start, end) => supabase
    .from("availability")
    .select(
      "id, guide_id, assignment_id, start_date, end_date, status, source, notes, created_at, updated_at, updated_by"
    )
    .eq("is_archived", false)
    .order("start_date", { ascending: true })
    .order("id", { ascending: true })
    .range(start, end)
    .returns<AvailabilityRow[]>())

  if (availabilityError) {
    return {
      data: [],
      error: availabilityError,
    }
  }

  if (availability.length === 0) {
    return {
      data: [],
      error: null,
    }
  }

  const guideIds = Array.from(
    new Set(availability.map((record) => record.guide_id))
  )
  const assignmentIds = Array.from(
    new Set(
      availability
        .map((record) => record.assignment_id)
        .filter((assignmentId): assignmentId is string =>
          Boolean(assignmentId)
        )
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

  const { data: assignments, error: assignmentsError } = await readByIdBatches(
    assignmentIds,
    (batch, start, end) => supabase.from("assignments")
      .select("id, group_id").in("id", batch)
      .order("id", { ascending: true }).range(start, end)
      .returns<AssignmentRow[]>()
  )

  if (assignmentsError) {
    return {
      data: [],
      error: assignmentsError,
    }
  }

  const groupIds = Array.from(
    new Set(assignments.map((assignment) => assignment.group_id))
  )
  const { data: groups, error: groupsError } = await readByIdBatches(
    groupIds,
    (batch, start, end) => supabase.from("groups")
      .select("id, group_code, circuit_id, start_date, end_date")
      .in("id", batch)
      .order("id", { ascending: true }).range(start, end)
      .returns<GroupRow[]>()
  )

  if (groupsError) {
    return {
      data: [],
      error: groupsError,
    }
  }

  const circuitIds = Array.from(
    new Set(groups.map((group) => group.circuit_id).filter((id): id is string => Boolean(id)))
  )
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

  const guideNameById = new Map(
    guides.map((guide) => [guide.id, guide.full_name])
  )
  const assignmentById = new Map(
    assignments.map((assignment) => [assignment.id, assignment])
  )
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const circuitNameById = new Map(
    circuits.map((circuit) => [circuit.id, circuit.name])
  )

  return {
    data: availability.map((record) => {
      const assignment = record.assignment_id
        ? assignmentById.get(record.assignment_id)
        : undefined
      const group = assignment ? groupById.get(assignment.group_id) : undefined

      return {
        id: record.id,
        guideId: record.guide_id,
        guideName: guideNameById.get(record.guide_id) ?? "Unknown guide",
        assignmentId: record.assignment_id ?? undefined,
        assignmentGroupId: group?.id,
        assignmentGroupCode: group?.group_code,
        assignmentGroupStartDateIso: group?.start_date,
        assignmentGroupEndDateIso: group?.end_date,
        assignmentCircuitName: group
          ? circuitNameById.get(group.circuit_id ?? "")
          : undefined,
        startDate: record.start_date,
        endDate: record.end_date,
        startDateIso: record.start_date,
        endDateIso: record.end_date,
        status: availabilityStatusBySupabaseValue[record.status],
        source: availabilitySourceBySupabaseValue[record.source],
        notes: record.notes ?? "",
        createdAtIso: record.created_at,
        updatedAtIso: record.updated_at,
        updatedBy: record.updated_by ?? undefined,
      }
    }),
    error: null,
  }
}
