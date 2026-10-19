import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export type GuideProfileClaimResult = {
  success: boolean
  code: string
  message: string
  guideId: string | null
  profileId: string | null
  error: string | null
}

type GuideProfileClaimRow = {
  success: boolean
  code: string
  message: string
  guide_id: string | null
  profile_id: string | null
}

export async function claimAuthorizedGuideProfile(): Promise<GuideProfileClaimResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return {
      success: false,
      code: "supabase_unavailable",
      message: "Supabase environment variables are not configured.",
      guideId: null,
      profileId: null,
      error: "Supabase environment variables are not configured.",
    }
  }

  const { data, error } = await supabase
    .rpc("claim_authorized_guide_profile")
    .returns<GuideProfileClaimRow[]>()

  if (error) {
    return {
      success: false,
      code: "claim_failed",
      message: "Guide Portal access could not be activated. Please try again.",
      guideId: null,
      profileId: null,
      error: "Guide Portal access could not be activated. Please try again.",
    }
  }

  const claimRows = data as unknown as GuideProfileClaimRow[] | null
  const result = claimRows?.[0]

  if (!result) {
    return {
      success: false,
      code: "claim_failed",
      message: "The guide profile claim did not return a result.",
      guideId: null,
      profileId: null,
      error: "The guide profile claim did not return a result.",
    }
  }

  return {
    success: result.success,
    code: result.code,
    message: result.message,
    guideId: result.guide_id,
    profileId: result.profile_id,
    error: result.success ? null : result.message,
  }
}
