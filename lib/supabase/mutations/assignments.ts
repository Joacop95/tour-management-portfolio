import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export type SupabaseAssignmentMutationInput = {
  groupId: string
  guideId?: string | null
  currentAssignmentId?: string | null
}

export type SupabaseAssignmentMutationResult = {
  error: string | null
  code?: string
  operation?: string | null
  assignmentId?: string | null
}

type AssignmentRpcRow = {
  success: boolean
  code: string
  message: string
  operation?: string | null
  assignment_id?: string | null
}

const missingSupabaseError =
  "Supabase environment variables are not configured."
const stateChangedError =
  "The assignment changed while you were working. Refresh and try again."

function getRpcError(error: { code?: string; message?: string }) {
  if (error.code === "40001" || error.message?.includes("concurrently")) {
    return stateChangedError
  }

  return "The assignment could not be updated. Refresh and try again."
}

function mapRpcResult(
  data: AssignmentRpcRow[] | AssignmentRpcRow | null,
  fallbackMessage: string
): SupabaseAssignmentMutationResult {
  const row = Array.isArray(data) ? data[0] : data

  if (!row) return { error: fallbackMessage }

  return {
    error: row.success ? null : row.message || fallbackMessage,
    code: row.code,
    operation: row.operation ?? null,
    assignmentId: row.assignment_id ?? null,
  }
}

async function setInternalGroupGuide(
  input: SupabaseAssignmentMutationInput
): Promise<SupabaseAssignmentMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) return { error: missingSupabaseError }

  const { data, error } = await supabase.rpc("set_internal_group_guide", {
    p_group_id: input.groupId,
    p_new_guide_id: input.guideId ?? null,
    p_expected_assignment_id: input.currentAssignmentId ?? null,
  })

  if (error) return { error: getRpcError(error) }

  return mapRpcResult(
    data as AssignmentRpcRow[] | AssignmentRpcRow | null,
    "The assignment could not be updated."
  )
}

export async function assignSupabaseGuideToGroup(
  input: SupabaseAssignmentMutationInput
) {
  if (!input.guideId) return { error: "Guide is required to assign this group." }
  return setInternalGroupGuide(input)
}

export async function changeSupabaseGuideForGroup(
  input: SupabaseAssignmentMutationInput
) {
  if (!input.guideId) {
    return { error: "Guide is required to change this group assignment." }
  }
  return setInternalGroupGuide(input)
}

export async function removeSupabaseGuideFromGroup(
  input: SupabaseAssignmentMutationInput
) {
  return setInternalGroupGuide({ ...input, guideId: null })
}

export async function confirmSupabaseGroupGuide(
  input: SupabaseAssignmentMutationInput
): Promise<SupabaseAssignmentMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) return { error: missingSupabaseError }
  if (!input.currentAssignmentId) return { error: stateChangedError }

  const { data, error } = await supabase.rpc("confirm_internal_group_guide", {
    p_group_id: input.groupId,
    p_expected_assignment_id: input.currentAssignmentId,
  })

  if (error) return { error: getRpcError(error) }

  return mapRpcResult(
    data as AssignmentRpcRow[] | AssignmentRpcRow | null,
    "The guide could not be confirmed."
  )
}
