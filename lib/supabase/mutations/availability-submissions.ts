import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export type AvailabilityReviewAction = "approve" | "request_changes"

export type AvailabilityReviewResult = {
  success: boolean
  code: string
  message: string
}

type ReviewRpcRow = AvailabilityReviewResult & {
  submission_status: string | null
  reviewed_at: string | null
}

export async function reviewGuideAnnualAvailability(input: {
  submissionId: string
  action: AvailabilityReviewAction
  reviewMessage?: string
}): Promise<AvailabilityReviewResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return {
      success: false,
      code: "supabase_unavailable",
      message: "Annual availability cannot be reviewed right now.",
    }
  }

  const { data, error } = await supabase.rpc(
    "review_guide_annual_availability",
    {
      p_submission_id: input.submissionId,
      p_action: input.action,
      p_review_message: input.reviewMessage?.trim() || null,
    }
  )

  if (error || !Array.isArray(data) || data.length === 0) {
    return {
      success: false,
      code: "review_failed",
      message: "Annual availability could not be reviewed. Refresh and try again.",
    }
  }

  const result = data[0] as ReviewRpcRow
  return {
    success: result.success,
    code: result.code,
    message: result.message,
  }
}
