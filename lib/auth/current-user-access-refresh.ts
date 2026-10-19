type AccessRefreshIdentity = {
  expectedUserId: string | null
  activeSessionUserId: string | null
  refreshedUserId: string | null
}

type AccessRefreshRequest = AccessRefreshIdentity & {
  requestId: number
  latestRequestId: number
}

export type AccessRefreshDisposition = "apply" | "return-only" | "reject"

export function canApplyAccessRefresh({
  expectedUserId,
  activeSessionUserId,
  refreshedUserId,
}: AccessRefreshIdentity) {
  if (refreshedUserId !== activeSessionUserId) {
    return false
  }

  return expectedUserId === null || refreshedUserId === expectedUserId
}

export function getAccessRefreshDisposition({
  requestId,
  latestRequestId,
  ...identity
}: AccessRefreshRequest): AccessRefreshDisposition {
  if (!canApplyAccessRefresh(identity)) {
    return "reject"
  }

  return requestId === latestRequestId ? "apply" : "return-only"
}
