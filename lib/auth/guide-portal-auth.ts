import { getCurrentSupabaseUser } from "@/lib/auth/supabase-auth"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export type GuidePortalIdentityStatus =
  | "not_signed_in"
  | "no_profile"
  | "no_guide_linked"
  | "access_denied"
  | "ready"
  | "error"

export type GuidePortalIdentityResult = {
  status: GuidePortalIdentityStatus
  userId: string | null
  userEmail: string | null
  profileId: string | null
  profileFullName: string | null
  guideId: string | null
  guideDisplayName: string | null
  guideEmail: string | null
  guideStatus: string | null
  error: string | null
}

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  guide_id: string | null
}

type GuidePortalGuideIdentityRow = {
  guide_id: string
  full_name: string
  authorized_email: string
  status: string
}

export const emptyGuidePortalIdentity: GuidePortalIdentityResult = {
  status: "not_signed_in",
  userId: null,
  userEmail: null,
  profileId: null,
  profileFullName: null,
  guideId: null,
  guideDisplayName: null,
  guideEmail: null,
  guideStatus: null,
  error: null,
}

function errorResult(message: string): GuidePortalIdentityResult {
  return {
    ...emptyGuidePortalIdentity,
    status: "error",
    error: message,
  }
}

export async function getCurrentGuidePortalIdentity(): Promise<GuidePortalIdentityResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return errorResult("Supabase environment variables are not configured.")
  }

  const user = await getCurrentSupabaseUser()

  if (!user) {
    return emptyGuidePortalIdentity
  }

  const baseIdentity: GuidePortalIdentityResult = {
    ...emptyGuidePortalIdentity,
    status: "no_profile",
    userId: user.id,
    userEmail: user.email ?? null,
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, guide_id")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    return {
      ...baseIdentity,
      status: "error",
      error: profileError.message,
    }
  }

  if (!profileData) {
    return baseIdentity
  }

  const profile = profileData as ProfileRow
  const identityWithProfile: GuidePortalIdentityResult = {
    ...baseIdentity,
    status: "no_guide_linked",
    userEmail: profile.email ?? baseIdentity.userEmail,
    profileId: profile.id,
    profileFullName: profile.full_name,
    guideId: profile.guide_id,
  }

  if (!profile.guide_id) {
    return identityWithProfile
  }

  const { data: guideData, error: guideError } = await supabase
    .from("guide_portal_guides")
    .select("guide_id, full_name, authorized_email, status")
    .eq("guide_id", profile.guide_id)
    .maybeSingle()

  if (guideError) {
    return {
      ...identityWithProfile,
      status: "error",
      error: guideError.message,
    }
  }

  if (!guideData) {
    return {
      ...identityWithProfile,
      status: "access_denied",
      error: null,
    }
  }

  const guide = guideData as GuidePortalGuideIdentityRow

  return {
    ...identityWithProfile,
    status: "ready",
    guideId: guide.guide_id,
    guideDisplayName: guide.full_name,
    guideEmail: guide.authorized_email,
    guideStatus: guide.status,
    error: null,
  }
}
