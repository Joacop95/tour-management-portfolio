import { getCurrentSupabaseUser } from "@/lib/auth/supabase-auth"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export type InternalChangeRequestReviewStatus =
  | "in_progress"
  | "approved"
  | "rejected"
  | "completed"

type UpdateChangeRequestReviewInput = {
  requestId: string
  status: InternalChangeRequestReviewStatus
  note?: string
}

type ArchiveChangeRequestInput = {
  requestId: string
}

type ChangeRequestMutationResult = {
  success: boolean
  error: string | null
}

type ChangeRequestStatus =
  | "pending"
  | "in_progress"
  | "approved"
  | "rejected"
  | "completed"
  | "cancelled"

type ChangeRequestStatusRow = {
  request_status: ChangeRequestStatus
}

const resolvedStatuses: InternalChangeRequestReviewStatus[] = [
  "approved",
  "rejected",
  "completed",
]

const allowedReviewTransitions: Record<
  ChangeRequestStatus,
  InternalChangeRequestReviewStatus[]
> = {
  pending: ["in_progress", "approved", "rejected", "completed"],
  in_progress: ["approved", "rejected", "completed"],
  approved: ["completed"],
  rejected: [],
  completed: [],
  cancelled: [],
}

function getErrorMessage() {
  return "Unable to update this change request. Refresh and try again."
}

async function getMutationContext() {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return {
      supabase: null,
      profileId: null,
      error: "Supabase environment variables are not configured.",
    }
  }

  const user = await getCurrentSupabaseUser()

  if (!user) {
    return {
      supabase,
      profileId: null,
      error: "Sign in before updating change requests.",
    }
  }

  return {
    supabase,
    profileId: user.id,
    error: null,
  }
}

export async function updateChangeRequestReviewStatus(
  input: UpdateChangeRequestReviewInput
): Promise<ChangeRequestMutationResult> {
  try {
    const { supabase, profileId, error } = await getMutationContext()

    if (!supabase || !profileId) {
      return { success: false, error }
    }

    const requestId = input.requestId.trim()

    if (!requestId) {
      return { success: false, error: "Select a change request to update." }
    }

    const { data: request, error: requestError } = await supabase
      .from("change_requests")
      .select("request_status")
      .eq("id", requestId)
      .maybeSingle()
      .returns<ChangeRequestStatusRow | null>()

    if (requestError) {
      return { success: false, error: getErrorMessage() }
    }

    if (!request) {
      return {
        success: false,
        error: "Change request was not found or is no longer active.",
      }
    }

    if (!allowedReviewTransitions[request.request_status].includes(input.status)) {
      return {
        success: false,
        error: "This status transition is not allowed.",
      }
    }

    const now = new Date().toISOString()
    const note = input.note?.trim() ?? ""
    const updates: Record<string, string | null> = {
      request_status: input.status,
      reviewed_by_profile_id: profileId,
      reviewed_at: now,
      updated_by: profileId,
      updated_at: now,
    }

    if (note) {
      updates.internal_notes = note
    }

    if (resolvedStatuses.includes(input.status)) {
      updates.resolved_by = profileId
      updates.resolved_at = now
      if (note) {
        updates.decision_reason = note
      }
    }

    if (input.status === "completed") {
      updates.completed_at = now
    }

    const { error: updateError } = await supabase
      .from("change_requests")
      .update(updates)
      .eq("id", requestId)

    if (updateError) {
      return { success: false, error: getErrorMessage() }
    }

    return { success: true, error: null }
  } catch {
    return { success: false, error: getErrorMessage() }
  }
}

export async function archiveChangeRequest(
  input: ArchiveChangeRequestInput
): Promise<ChangeRequestMutationResult> {
  try {
    const { supabase, profileId, error } = await getMutationContext()

    if (!supabase || !profileId) {
      return { success: false, error }
    }

    const requestId = input.requestId.trim()

    if (!requestId) {
      return { success: false, error: "Select a change request to archive." }
    }

    const { data, error: updateError } = await supabase.rpc(
      "archive_internal_change_request",
      { p_request_id: requestId }
    )

    if (updateError) {
      return { success: false, error: getErrorMessage() }
    }

    const result = Array.isArray(data) ? data[0] : data
    return {
      success: result?.success === true,
      error: result?.success === true ? null : result?.message ?? getErrorMessage(),
    }
  } catch {
    return { success: false, error: getErrorMessage() }
  }
}
