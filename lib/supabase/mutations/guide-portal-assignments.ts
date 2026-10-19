import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export type ConfirmOwnGuideAssignmentResult = {
  success: boolean
  code: string
  message: string
  assignmentId: string | null
  groupId: string | null
}

type ConfirmOwnGuideAssignmentRow = {
  success: boolean
  code: string
  message: string
  assignment_id: string | null
  group_id: string | null
}

export async function confirmOwnGuideAssignment(
  assignmentId: string
): Promise<ConfirmOwnGuideAssignmentResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return {
      success: false,
      code: "unavailable",
      message: "Assignment confirmation is temporarily unavailable.",
      assignmentId: null,
      groupId: null,
    }
  }

  const { data, error } = await supabase
    .rpc("confirm_own_guide_assignment", { p_assignment_id: assignmentId })
    .returns<ConfirmOwnGuideAssignmentRow[]>()

  if (error) {
    return {
      success: false,
      code: "confirmation_failed",
      message: "We could not confirm this assignment. Please try again.",
      assignmentId: null,
      groupId: null,
    }
  }

  const rows = data as unknown as ConfirmOwnGuideAssignmentRow[] | null
  const result = rows?.[0]

  if (!result) {
    return {
      success: false,
      code: "confirmation_failed",
      message: "We could not confirm this assignment. Please try again.",
      assignmentId: null,
      groupId: null,
    }
  }

  return {
    success: result.success,
    code: result.code,
    message: result.message,
    assignmentId: result.assignment_id,
    groupId: result.group_id,
  }
}
