import { getCurrentGuidePortalIdentity } from "@/lib/auth/guide-portal-auth"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export type GuidePortalChangeRequestType =
  | "group_change"
  | "availability_change"
  | "profile_change"
  | "other"

type CreateGuidePortalChangeRequestInput = {
  requestType: GuidePortalChangeRequestType
  message: string
  groupId?: string | null
  assignmentId?: string | null
  availabilityId?: string | null
  allowedGroupIds?: string[]
  allowedAssignmentIds?: string[]
  allowedAvailabilityIds?: string[]
}

type CreateGuidePortalChangeRequestResult = {
  success: boolean
  changeRequestId: string | null
  error: string | null
}

const allowedRequestTypes: GuidePortalChangeRequestType[] = [
  "group_change",
  "availability_change",
  "profile_change",
  "other",
]

function isAllowedRequestType(
  requestType: string
): requestType is GuidePortalChangeRequestType {
  return allowedRequestTypes.includes(requestType as GuidePortalChangeRequestType)
}

function isAllowedRelatedId(id: string | null, allowedIds?: string[]) {
  return !id || Boolean(allowedIds?.includes(id))
}

export async function createGuidePortalChangeRequest(
  input: CreateGuidePortalChangeRequestInput
): Promise<CreateGuidePortalChangeRequestResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return {
      success: false,
      changeRequestId: null,
      error: "Supabase environment variables are not configured.",
    }
  }

  const message = input.message.trim()
  const groupId = input.groupId ?? null
  const assignmentId = input.assignmentId ?? null
  const availabilityId = input.availabilityId ?? null

  if (!isAllowedRequestType(input.requestType)) {
    return {
      success: false,
      changeRequestId: null,
      error: "Select a valid request type.",
    }
  }

  if (!message) {
    return {
      success: false,
      changeRequestId: null,
      error: "Describe what you need the operations team to review.",
    }
  }

  if (!isAllowedRelatedId(groupId, input.allowedGroupIds)) {
    return {
      success: false,
      changeRequestId: null,
      error: "Choose one of your assigned groups, or leave the group field blank.",
    }
  }

  if (!isAllowedRelatedId(assignmentId, input.allowedAssignmentIds)) {
    return {
      success: false,
      changeRequestId: null,
      error: "Select one of your assigned records.",
    }
  }

  if (!isAllowedRelatedId(availabilityId, input.allowedAvailabilityIds)) {
    return {
      success: false,
      changeRequestId: null,
      error: "Select one of your availability records.",
    }
  }

  const identity = await getCurrentGuidePortalIdentity()

  if (identity.status !== "ready" || !identity.guideId || !identity.profileId) {
    return {
      success: false,
      changeRequestId: null,
      error: "Sign in as a linked guide before creating a change request.",
    }
  }

  const { error } = await supabase
    .from("change_requests")
    .insert({
      guide_id: identity.guideId,
      request_type: input.requestType,
      request_status: "pending",
      guide_message: message,
      group_id: groupId,
      assignment_id: assignmentId,
      availability_id: availabilityId,
      created_by_profile_id: identity.profileId,
    })

  if (error) {
    return {
      success: false,
      changeRequestId: null,
      error: "Unable to submit this request. Refresh and try again.",
    }
  }

  return {
    success: true,
    changeRequestId: null,
    error: null,
  }
}
