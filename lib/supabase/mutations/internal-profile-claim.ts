import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export type InternalProfileClaimResult = {
  success: boolean
  code: string
  message: string
  profileId: string | null
  roleKey: string | null
  error: string | null
}

type InternalProfileClaimRow = {
  success: boolean
  code: string
  message: string
  profile_id: string | null
  role_key: string | null
}

export async function claimAuthorizedInternalProfile(): Promise<InternalProfileClaimResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return {
      success: false,
      code: "supabase_unavailable",
      message: "Supabase environment variables are not configured.",
      profileId: null,
      roleKey: null,
      error: "Supabase environment variables are not configured.",
    }
  }

  const { data, error } = await supabase
    .rpc("claim_authorized_internal_profile")
    .returns<InternalProfileClaimRow[]>()

  if (error) {
    return {
      success: false,
      code: "claim_failed",
      message: "Internal access could not be activated. Please try again.",
      profileId: null,
      roleKey: null,
      error: "Internal access could not be activated. Please try again.",
    }
  }

  const result = (data as unknown as InternalProfileClaimRow[] | null)?.[0]

  if (!result) {
    return {
      success: false,
      code: "claim_failed",
      message: "The internal profile claim did not return a result.",
      profileId: null,
      roleKey: null,
      error: "The internal profile claim did not return a result.",
    }
  }

  return {
    success: result.success,
    code: result.code,
    message: result.message,
    profileId: result.profile_id,
    roleKey: result.role_key,
    error: result.success ? null : result.message,
  }
}
