import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import type {
  AssignmentStatus,
  ConfirmationStatus,
  GroupStatus,
  TourGroup,
} from "@/lib/types/domain"

type SupabaseSupportedLanguage = "english" | "french" | "spanish" | "turkish"

export type SupabaseGroupMutationInput = {
  groupCode: string
  circuitId: string
  startDateIso: string
  endDateIso: string
  groupStatus: GroupStatus
  guideId: string | null
  assignmentStatus: AssignmentStatus
  confirmationStatus: ConfirmationStatus
  travelers: number
  requiredLanguage?: string | null
  internalNotes?: string
}

export type SupabaseGroupMutationResult = {
  error: string | null
}

const supabaseConfirmationStatusByAppValue: Record<ConfirmationStatus, string> = {
  "not-required": "not_required",
  "pending-confirmation": "pending_confirmation",
  confirmed: "confirmed",
}

const supabaseLanguageByAppValue: Record<string, SupabaseSupportedLanguage> = {
  EN: "english",
  FR: "french",
  ES: "spanish",
  TR: "turkish",
}

function mapRequiredLanguage(language?: string | null) {
  const normalizedLanguage = language?.trim().toUpperCase()

  return normalizedLanguage
    ? (supabaseLanguageByAppValue[normalizedLanguage] ?? null)
    : null
}

function getSupabaseUnavailableResult(): SupabaseGroupMutationResult {
  return {
    error: "Supabase environment variables are not configured.",
  }
}

function getFriendlySupabaseError(error: { code?: string; message?: string }) {
  const message = error.message ?? "Supabase write failed."

  if (error.code === "23505" || message.includes("duplicate key")) {
    if (message.includes("groups_group_code_key")) {
      return "This group code already exists."
    }

    if (message.includes("assignments_one_current_per_group_idx")) {
      return "This group already has a current assignment."
    }

    return "This group conflicts with existing group or assignment data."
  }

  if (error.code === "23503" || message.includes("foreign key")) {
    return "The selected circuit or guide no longer exists."
  }

  return "Unable to save this group. Refresh and try again."
}

function buildGroupDetails(input: SupabaseGroupMutationInput) {
  return {
    p_group_code: input.groupCode.trim(),
    p_circuit_id: input.circuitId,
    p_start_date: input.startDateIso,
    p_end_date: input.endDateIso,
    p_language: mapRequiredLanguage(input.requiredLanguage),
    p_estimated_passengers: input.travelers,
    p_internal_notes: input.internalNotes?.trim() || null,
  }
}

type GroupRpcRow = { success: boolean; code: string; message: string }

function groupRpcError(data: GroupRpcRow[] | GroupRpcRow | null) {
  const result = Array.isArray(data) ? data[0] : data
  return result?.success ? null : result?.message ?? "Unable to save this group. Refresh and try again."
}

export function buildSupabaseGroupMutationInput(
  group: TourGroup
): SupabaseGroupMutationInput {
  return {
    groupCode: group.code,
    circuitId: group.circuitId,
    startDateIso: group.startDateIso,
    endDateIso: group.endDateIso,
    groupStatus: group.groupStatus,
    guideId: group.guideId,
    assignmentStatus: group.assignmentStatus,
    confirmationStatus: group.confirmationStatus,
    travelers: group.travelers,
    requiredLanguage: group.requiredLanguage ?? group.language ?? null,
    internalNotes: group.internalNotes,
  }
}

export async function createSupabaseGroup(
  input: SupabaseGroupMutationInput
): Promise<SupabaseGroupMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  const { data, error } = await supabase.rpc("create_internal_group", {
    ...buildGroupDetails(input),
    p_guide_id: input.guideId,
    p_confirm_guide: input.guideId !== null && input.confirmationStatus === "confirmed",
  })
  return { error: error ? getFriendlySupabaseError(error) : groupRpcError(data as GroupRpcRow[] | GroupRpcRow | null) }
}

export async function updateSupabaseGroup(
  id: string,
  input: SupabaseGroupMutationInput,
  original: TourGroup
): Promise<SupabaseGroupMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  if (input.groupStatus !== original.groupStatus) {
    const originalPayload = buildGroupDetails(buildSupabaseGroupMutationInput(original))
    const nextPayload = buildGroupDetails(input)
    if (JSON.stringify(originalPayload) !== JSON.stringify(nextPayload) ||
      input.guideId !== original.guideId ||
      input.assignmentStatus !== original.assignmentStatus ||
      input.confirmationStatus !== original.confirmationStatus) {
      return { error: "Save the status change separately from other group edits." }
    }
    return setSupabaseGroupStatus(original, input.groupStatus)
  }
  if (!original.updatedAtIso) {
    return { error: "Refresh this group before saving changes." }
  }

  const { data, error } = await supabase.rpc("update_internal_group", {
    ...buildGroupDetails(input),
    p_group_id: id,
    p_expected_updated_at: original.updatedAtIso,
    p_expected_assignment_id: original.currentAssignmentId ?? null,
    p_guide_id: input.guideId,
    p_confirmation_status: supabaseConfirmationStatusByAppValue[input.confirmationStatus],
  })
  return { error: error ? getFriendlySupabaseError(error) : groupRpcError(data as GroupRpcRow[] | GroupRpcRow | null) }
}

export async function setSupabaseGroupStatus(
  group: TourGroup,
  status: GroupStatus
): Promise<SupabaseGroupMutationResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase || !group.updatedAtIso) {
    return { error: "Refresh this group before changing its status." }
  }
  const { data, error } = await supabase.rpc("set_internal_group_status", {
    p_group_id: group.id,
    p_status: status,
    p_expected_updated_at: group.updatedAtIso,
    p_expected_assignment_id: group.currentAssignmentId ?? null,
  })
  if (error) return { error: "Unable to change group status. Refresh and try again." }
  const result = Array.isArray(data) ? data[0] : data
  return {
    error: result?.success ? null : result?.message ?? "Unable to change group status.",
  }
}
