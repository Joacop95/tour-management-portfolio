import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { readAllPages } from "@/lib/supabase/queries/paginated-read"

type SupportedLanguage =
  | "english"
  | "french"
  | "spanish"
  | "turkish"

type SupabaseGuideStatus =
  | "pending_invitation"
  | "invited"
  | "active"
  | "inactive"
  | "blocked"

type SupabaseGroupStatus = "active" | "cxl" | "fusionado" | "finalized"
type SupabaseAssignmentStatus = "without_guide" | "assigned"
type SupabaseConfirmationStatus =
  | "not_required"
  | "pending_confirmation"
  | "confirmed"
type SupabaseAvailabilityStatus =
  | "available"
  | "not_available"
  | "occupied_by_assignment"
  | "pending_review"
type SupabaseAvailabilitySource =
  | "guide_submitted"
  | "admin_updated"
  | "assignment_generated"
type SupabaseGuideAvailabilitySubmissionStatus =
  | "draft"
  | "pending_review"
  | "changes_requested"
  | "approved"
type SupabaseChangeRequestType =
  | "group_change"
  | "availability_change"
  | "profile_change"
  | "other"
type SupabaseChangeRequestStatus =
  | "pending"
  | "in_progress"
  | "approved"
  | "rejected"
  | "completed"
  | "cancelled"

type GuidePortalGuideRow = {
  guide_id: string
  full_name: string
  authorized_email: string
  phone: string | null
  preferred_language: SupportedLanguage | null
  languages: SupportedLanguage[] | null
  status: SupabaseGuideStatus
  circuit_ids: string[] | null
  circuit_names: string[] | null
}

type GuidePortalGroupRow = {
  group_id: string
  group_code: string
  circuit_id: string
  circuit_name: string
  circuit_code: string | null
  start_date: string
  end_date: string
  group_status: SupabaseGroupStatus
  assignment_status: SupabaseAssignmentStatus
  confirmation_status: SupabaseConfirmationStatus
  language: string | null
  estimated_passengers: number | null
  current_assignment_id: string
}

type GuidePortalAssignmentRow = {
  assignment_id: string
  group_id: string
  guide_id: string
  group_code: string
  circuit_id: string
  circuit_name: string
  circuit_code: string | null
  start_date: string
  end_date: string
  assignment_status: SupabaseAssignmentStatus
  confirmation_status: SupabaseConfirmationStatus
  assigned_at: string
  is_current: boolean
}

type GuidePortalAvailabilityRow = {
  availability_id: string
  guide_id: string
  assignment_id: string | null
  start_date: string
  end_date: string
  status: SupabaseAvailabilityStatus
  source: SupabaseAvailabilitySource
  notes: string | null
  assignment_group_id: string | null
  assignment_group_code: string | null
  assignment_group_start_date: string | null
  assignment_group_end_date: string | null
  assignment_circuit_id: string | null
  assignment_circuit_name: string | null
  assignment_circuit_code: string | null
}

type GuidePortalChangeRequestRow = {
  change_request_id: string
  guide_id: string
  group_id: string | null
  assignment_id: string | null
  availability_id: string | null
  request_type: SupabaseChangeRequestType
  request_status: SupabaseChangeRequestStatus
  requested_at: string
  guide_message: string
  decision_reason: string | null
  reviewed_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  group_code: string | null
  circuit_id: string | null
  circuit_name: string | null
  circuit_code: string | null
  group_start_date: string | null
  group_end_date: string | null
}

type GuideAvailabilitySubmissionRow = {
  id: string
  guide_id: string
  year: number
  status: SupabaseGuideAvailabilitySubmissionStatus
  submitted_at: string | null
  reviewed_at: string | null
  review_message: string | null
  updated_at: string
}

export type GuidePortalSafeGuide = {
  guideId: string
  fullName: string
  authorizedEmail: string
  phone: string | null
  preferredLanguage: SupportedLanguage | null
  languages: SupportedLanguage[]
  status: SupabaseGuideStatus
  circuitIds: string[]
  circuitNames: string[]
}

export type GuidePortalSafeGroup = {
  groupId: string
  groupCode: string
  circuitId: string
  circuitName: string
  circuitCode: string | null
  startDate: string
  endDate: string
  groupStatus: SupabaseGroupStatus
  assignmentStatus: SupabaseAssignmentStatus
  confirmationStatus: SupabaseConfirmationStatus
  language: string | null
  estimatedPassengers: number | null
  currentAssignmentId: string
}

export type GuidePortalSafeAssignment = {
  assignmentId: string
  groupId: string
  guideId: string
  groupCode: string
  circuitId: string
  circuitName: string
  circuitCode: string | null
  startDate: string
  endDate: string
  assignmentStatus: SupabaseAssignmentStatus
  confirmationStatus: SupabaseConfirmationStatus
  assignedAt: string
  isCurrent: boolean
}

export type GuidePortalSafeAvailability = {
  availabilityId: string
  guideId: string
  assignmentId: string | null
  startDate: string
  endDate: string
  status: SupabaseAvailabilityStatus
  source: SupabaseAvailabilitySource
  notes: string
  assignmentGroupId: string | null
  assignmentGroupCode: string | null
  assignmentGroupStartDate: string | null
  assignmentGroupEndDate: string | null
  assignmentCircuitId: string | null
  assignmentCircuitName: string | null
  assignmentCircuitCode: string | null
}

export type GuidePortalSafeChangeRequest = {
  changeRequestId: string
  guideId: string
  groupId: string | null
  assignmentId: string | null
  availabilityId: string | null
  requestType: SupabaseChangeRequestType
  requestStatus: SupabaseChangeRequestStatus
  requestedAt: string
  guideMessage: string
  decisionReason: string | null
  reviewedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  groupCode: string | null
  circuitId: string | null
  circuitName: string | null
  circuitCode: string | null
  groupStartDate: string | null
  groupEndDate: string | null
}

export type GuidePortalSafeAvailabilitySubmission = {
  submissionId: string
  guideId: string
  year: number
  status: SupabaseGuideAvailabilitySubmissionStatus
  submittedAt: string | null
  reviewedAt: string | null
  reviewMessage: string | null
  updatedAt: string
}

export type GuidePortalSafeData = {
  guides: GuidePortalSafeGuide[]
  groups: GuidePortalSafeGroup[]
  assignments: GuidePortalSafeAssignment[]
  availability: GuidePortalSafeAvailability[]
  availabilitySubmissions: GuidePortalSafeAvailabilitySubmission[]
  changeRequests: GuidePortalSafeChangeRequest[]
}

export type GuidePortalSafeResult<T> = {
  data: T
  error: string | null
}

const supabaseUnavailableMessage =
  "Supabase environment variables are not configured."

function getClientOrError() {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return {
      supabase: null,
      error: supabaseUnavailableMessage,
    }
  }

  return {
    supabase,
    error: null,
  }
}

export async function getSupabaseGuidePortalGuides(): Promise<
  GuidePortalSafeResult<GuidePortalSafeGuide[]>
> {
  const { supabase, error } = getClientOrError()

  if (!supabase) {
    return { data: [], error }
  }

  const { data, error: queryError } = await supabase
    .from("guide_portal_guides")
    .select(
      "guide_id, full_name, authorized_email, phone, preferred_language, languages, status, circuit_ids, circuit_names"
    )
    .order("full_name", { ascending: true })
    .returns<GuidePortalGuideRow[]>()

  if (queryError) {
    return { data: [], error: queryError.message }
  }

  return {
    data: data.map((guide) => ({
      guideId: guide.guide_id,
      fullName: guide.full_name,
      authorizedEmail: guide.authorized_email,
      phone: guide.phone,
      preferredLanguage: guide.preferred_language,
      languages: guide.languages ?? [],
      status: guide.status,
      circuitIds: guide.circuit_ids ?? [],
      circuitNames: guide.circuit_names ?? [],
    })),
    error: null,
  }
}

export async function getSupabaseGuidePortalGroups(): Promise<
  GuidePortalSafeResult<GuidePortalSafeGroup[]>
> {
  const { supabase, error } = getClientOrError()

  if (!supabase) {
    return { data: [], error }
  }

  const { data, error: queryError } = await readAllPages((start, end) => supabase
    .from("guide_portal_groups")
    .select(
      "group_id, group_code, circuit_id, circuit_name, circuit_code, start_date, end_date, group_status, assignment_status, confirmation_status, language, estimated_passengers, current_assignment_id"
    )
    .order("start_date", { ascending: true })
    .order("group_id", { ascending: true })
    .range(start, end)
    .returns<GuidePortalGroupRow[]>())

  if (queryError) {
    return { data: [], error: queryError }
  }

  return {
    data: data.map((group) => ({
      groupId: group.group_id,
      groupCode: group.group_code,
      circuitId: group.circuit_id,
      circuitName: group.circuit_name,
      circuitCode: group.circuit_code,
      startDate: group.start_date,
      endDate: group.end_date,
      groupStatus: group.group_status,
      assignmentStatus: group.assignment_status,
      confirmationStatus: group.confirmation_status,
      language: group.language,
      estimatedPassengers: group.estimated_passengers,
      currentAssignmentId: group.current_assignment_id,
    })),
    error: null,
  }
}

export async function getSupabaseGuidePortalAssignments(): Promise<
  GuidePortalSafeResult<GuidePortalSafeAssignment[]>
> {
  const { supabase, error } = getClientOrError()

  if (!supabase) {
    return { data: [], error }
  }

  const { data, error: queryError } = await readAllPages((start, end) => supabase
    .from("guide_portal_assignments")
    .select(
      "assignment_id, group_id, guide_id, group_code, circuit_id, circuit_name, circuit_code, start_date, end_date, assignment_status, confirmation_status, assigned_at, is_current"
    )
    .order("start_date", { ascending: true })
    .order("assignment_id", { ascending: true })
    .range(start, end)
    .returns<GuidePortalAssignmentRow[]>())

  if (queryError) {
    return { data: [], error: queryError }
  }

  return {
    data: data.map((assignment) => ({
      assignmentId: assignment.assignment_id,
      groupId: assignment.group_id,
      guideId: assignment.guide_id,
      groupCode: assignment.group_code,
      circuitId: assignment.circuit_id,
      circuitName: assignment.circuit_name,
      circuitCode: assignment.circuit_code,
      startDate: assignment.start_date,
      endDate: assignment.end_date,
      assignmentStatus: assignment.assignment_status,
      confirmationStatus: assignment.confirmation_status,
      assignedAt: assignment.assigned_at,
      isCurrent: assignment.is_current,
    })),
    error: null,
  }
}

export async function getSupabaseGuidePortalAvailability(): Promise<
  GuidePortalSafeResult<GuidePortalSafeAvailability[]>
> {
  const { supabase, error } = getClientOrError()

  if (!supabase) {
    return { data: [], error }
  }

  const { data, error: queryError } = await readAllPages((start, end) => supabase
    .from("guide_portal_availability")
    .select(
      "availability_id, guide_id, assignment_id, start_date, end_date, status, source, notes, assignment_group_id, assignment_group_code, assignment_group_start_date, assignment_group_end_date, assignment_circuit_id, assignment_circuit_name, assignment_circuit_code"
    )
    .order("start_date", { ascending: true })
    .order("availability_id", { ascending: true })
    .range(start, end)
    .returns<GuidePortalAvailabilityRow[]>())

  if (queryError) {
    return { data: [], error: queryError }
  }

  return {
    data: data.map((record) => ({
      availabilityId: record.availability_id,
      guideId: record.guide_id,
      assignmentId: record.assignment_id,
      startDate: record.start_date,
      endDate: record.end_date,
      status: record.status,
      source: record.source,
      notes: record.notes ?? "",
      assignmentGroupId: record.assignment_group_id,
      assignmentGroupCode: record.assignment_group_code,
      assignmentGroupStartDate: record.assignment_group_start_date,
      assignmentGroupEndDate: record.assignment_group_end_date,
      assignmentCircuitId: record.assignment_circuit_id,
      assignmentCircuitName: record.assignment_circuit_name,
      assignmentCircuitCode: record.assignment_circuit_code,
    })),
    error: null,
  }
}

export async function getSupabaseGuidePortalAvailabilitySubmissions(): Promise<
  GuidePortalSafeResult<GuidePortalSafeAvailabilitySubmission[]>
> {
  const { supabase, error } = getClientOrError()

  if (!supabase) {
    return { data: [], error }
  }

  const { data, error: queryError } = await readAllPages((start, end) => supabase
    .from("guide_availability_submissions")
    .select(
      "id, guide_id, year, status, submitted_at, reviewed_at, review_message, updated_at"
    )
    .order("year", { ascending: false })
    .order("id", { ascending: true })
    .range(start, end)
    .returns<GuideAvailabilitySubmissionRow[]>())

  if (queryError) {
    return { data: [], error: queryError }
  }

  return {
    data: data.map((submission) => ({
      submissionId: submission.id,
      guideId: submission.guide_id,
      year: submission.year,
      status: submission.status,
      submittedAt: submission.submitted_at,
      reviewedAt: submission.reviewed_at,
      reviewMessage: submission.review_message,
      updatedAt: submission.updated_at,
    })),
    error: null,
  }
}

export async function getSupabaseGuidePortalChangeRequests(): Promise<
  GuidePortalSafeResult<GuidePortalSafeChangeRequest[]>
> {
  const { supabase, error } = getClientOrError()

  if (!supabase) {
    return { data: [], error }
  }

  const { data, error: queryError } = await readAllPages((start, end) => supabase
    .from("guide_portal_change_requests")
    .select(
      "change_request_id, guide_id, group_id, assignment_id, availability_id, request_type, request_status, requested_at, guide_message, decision_reason, reviewed_at, completed_at, cancelled_at, group_code, circuit_id, circuit_name, circuit_code, group_start_date, group_end_date"
    )
    .order("requested_at", { ascending: false })
    .order("change_request_id", { ascending: true })
    .range(start, end)
    .returns<GuidePortalChangeRequestRow[]>())

  if (queryError) {
    return { data: [], error: queryError }
  }

  return {
    data: data.map((request) => ({
      changeRequestId: request.change_request_id,
      guideId: request.guide_id,
      groupId: request.group_id,
      assignmentId: request.assignment_id,
      availabilityId: request.availability_id,
      requestType: request.request_type,
      requestStatus: request.request_status,
      requestedAt: request.requested_at,
      guideMessage: request.guide_message,
      decisionReason: request.decision_reason,
      reviewedAt: request.reviewed_at,
      completedAt: request.completed_at,
      cancelledAt: request.cancelled_at,
      groupCode: request.group_code,
      circuitId: request.circuit_id,
      circuitName: request.circuit_name,
      circuitCode: request.circuit_code,
      groupStartDate: request.group_start_date,
      groupEndDate: request.group_end_date,
    })),
    error: null,
  }
}

export async function getSupabaseGuidePortalData(): Promise<
  GuidePortalSafeResult<GuidePortalSafeData>
> {
  const [
    guides,
    groups,
    assignments,
    availability,
    availabilitySubmissions,
    changeRequests,
  ] =
    await Promise.all([
      getSupabaseGuidePortalGuides(),
      getSupabaseGuidePortalGroups(),
      getSupabaseGuidePortalAssignments(),
      getSupabaseGuidePortalAvailability(),
      getSupabaseGuidePortalAvailabilitySubmissions(),
      getSupabaseGuidePortalChangeRequests(),
    ])

  const error =
    guides.error ??
    groups.error ??
    assignments.error ??
    availability.error ??
    availabilitySubmissions.error ??
    changeRequests.error

  if (error) {
    return {
      data: {
        guides: [],
        groups: [],
        assignments: [],
        availability: [],
        availabilitySubmissions: [],
        changeRequests: [],
      },
      error,
    }
  }

  return {
    data: {
      guides: guides.data,
      groups: groups.data,
      assignments: assignments.data,
      availability: availability.data,
      availabilitySubmissions: availabilitySubmissions.data,
      changeRequests: changeRequests.data,
    },
    error: null,
  }
}
