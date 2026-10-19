"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  emptyGuidePortalIdentity,
  getCurrentGuidePortalIdentity,
  type GuidePortalIdentityResult,
} from "@/lib/auth/guide-portal-auth"
import { onSupabaseAuthStateChange } from "@/lib/auth/supabase-auth"
import {
  usePersistedCircuits,
  usePersistedAvailability,
  usePersistedGroups,
  usePersistedGuides,
} from "@/lib/hooks/use-persisted-mock-data"
import { getSupabaseAvailability } from "@/lib/supabase/queries/availability"
import { getAllSupabaseCircuits } from "@/lib/supabase/queries/circuits"
import {
  getSupabaseGuidePortalData,
  type GuidePortalSafeData,
  type GuidePortalSafeChangeRequest,
  type GuidePortalSafeGuide,
} from "@/lib/supabase/queries/guide-portal"
import { getSupabaseGroups } from "@/lib/supabase/queries/groups"
import { getSupabaseGuides } from "@/lib/supabase/queries/guides"
import type {
  Circuit,
  Guide,
  GuideAvailability,
  GuideAvailabilitySubmission,
  TourGroup,
} from "@/lib/types/domain"
import { normalizeSpokenLanguages } from "@/lib/utils/language-options"
import {
  saveGuidePortalSource,
  savePreviewGuideId,
  useGuidePortalSource,
  usePreviewGuideId,
} from "@/components/settings/settings-client-store"

type GuidePortalDataSource = "local-fallback" | "supabase"

type SupabaseGuidePortalData = {
  guides: Guide[]
  groups: TourGroup[]
  availability: GuideAvailability[]
  availabilitySubmissions: GuideAvailabilitySubmission[]
  circuits: Circuit[]
  changeRequests: GuidePortalChangeRequest[]
}

type SupportedLanguage =
  | "english"
  | "french"
  | "spanish"
  | "turkish"

type SupabaseGuideStatus =
  | "pending_invitation"
  | "invited"
  | "active"
  | "inactive"
  | "blocked"

type SupabaseAssignmentStatus = "without_guide" | "assigned"
type SupabaseConfirmationStatus =
  | "not_required"
  | "pending_confirmation"
  | "confirmed"
type SupabaseAvailabilityStatus =
  | "available"
  | "not_available"
  | "occupied_by_assignment"
  | "pending_review"
type SupabaseAvailabilitySource =
  | "guide_submitted"
  | "admin_updated"
  | "assignment_generated"
type SupabaseGuideAvailabilitySubmissionStatus =
  | "draft"
  | "pending_review"
  | "changes_requested"
  | "approved"
type SupabaseChangeRequestType =
  | "group_change"
  | "availability_change"
  | "profile_change"
  | "other"
type SupabaseChangeRequestStatus =
  | "pending"
  | "in_progress"
  | "approved"
  | "rejected"
  | "completed"
  | "cancelled"

export type GuidePortalChangeRequest = {
  id: string
  guideId: string
  groupId: string | null
  assignmentId: string | null
  availabilityId: string | null
  groupCode: string | null
  circuitName: string | null
  circuitCode: string | null
  groupStartDate: string | null
  groupEndDate: string | null
  requestType: SupabaseChangeRequestType
  status: SupabaseChangeRequestStatus
  requestedAtIso: string
  notes: string
  decisionReason: string | null
  reviewedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
}

const languageCodeBySupabaseValue: Record<SupportedLanguage, string> = {
  english: "EN",
  french: "FR",
  spanish: "ES",
  turkish: "TR",
}

const guideStatusBySupabaseValue: Record<SupabaseGuideStatus, Guide["status"]> = {
  pending_invitation: "pending-invitation",
  invited: "invited",
  active: "active",
  inactive: "inactive",
  blocked: "blocked",
}

const assignmentStatusBySupabaseValue: Record<
  SupabaseAssignmentStatus,
  TourGroup["assignmentStatus"]
> = {
  without_guide: "without-guide",
  assigned: "assigned",
}

const confirmationStatusBySupabaseValue: Record<
  SupabaseConfirmationStatus,
  TourGroup["confirmationStatus"]
> = {
  not_required: "not-required",
  pending_confirmation: "pending-confirmation",
  confirmed: "confirmed",
}

const availabilityStatusBySupabaseValue: Record<
  SupabaseAvailabilityStatus,
  GuideAvailability["status"]
> = {
  available: "available",
  not_available: "not-available",
  occupied_by_assignment: "occupied-by-assignment",
  pending_review: "pending-review",
}

const availabilitySourceBySupabaseValue: Record<
  SupabaseAvailabilitySource,
  GuideAvailability["source"]
> = {
  guide_submitted: "guide-submitted",
  admin_updated: "admin-updated",
  assignment_generated: "assignment-generated",
}

const availabilitySubmissionStatusBySupabaseValue: Record<
  SupabaseGuideAvailabilitySubmissionStatus,
  GuideAvailabilitySubmission["status"]
> = {
  draft: "draft",
  pending_review: "pending-review",
  changes_requested: "changes-requested",
  approved: "approved",
}

function mapLanguage(language: SupportedLanguage | null) {
  return language ? languageCodeBySupabaseValue[language] : ""
}

function mapSafeGuide(guide: GuidePortalSafeGuide): Guide {
  return {
    id: guide.guideId,
    name: guide.fullName,
    email: guide.authorizedEmail,
    phone: guide.phone,
    languages: normalizeSpokenLanguages(
      guide.languages.map((language) => languageCodeBySupabaseValue[language]),
      mapLanguage(guide.preferredLanguage)
    ),
    preferredLanguage: mapLanguage(guide.preferredLanguage),
    circuitIds: guide.circuitIds,
    status: guideStatusBySupabaseValue[guide.status],
  }
}

function buildSafeCircuits(data: GuidePortalSafeData): Circuit[] {
  const circuitsById = new Map<string, Circuit>()

  function addCircuit(id: string | null, name: string | null, code?: string | null) {
    if (!id || circuitsById.has(id)) {
      return
    }

    circuitsById.set(id, {
      id,
      name: name ?? code ?? id,
      code: code ?? "",
      region: "",
      isActive: true,
    })
  }

  data.guides.forEach((guide) => {
    guide.circuitIds.forEach((circuitId, index) => {
      addCircuit(circuitId, guide.circuitNames[index] ?? null)
    })
  })

  data.groups.forEach((group) => {
    addCircuit(group.circuitId, group.circuitName, group.circuitCode)
  })

  data.availability.forEach((record) => {
    addCircuit(
      record.assignmentCircuitId,
      record.assignmentCircuitName,
      record.assignmentCircuitCode
    )
  })

  return Array.from(circuitsById.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  )
}

function mapSafeChangeRequest(
  request: GuidePortalSafeChangeRequest
): GuidePortalChangeRequest {
  return {
    id: request.changeRequestId,
    guideId: request.guideId,
    groupId: request.groupId,
    assignmentId: request.assignmentId,
    availabilityId: request.availabilityId,
    groupCode: request.groupCode,
    circuitName: request.circuitName,
    circuitCode: request.circuitCode,
    groupStartDate: request.groupStartDate,
    groupEndDate: request.groupEndDate,
    requestType: request.requestType,
    status: request.requestStatus,
    requestedAtIso: request.requestedAt,
    notes: request.guideMessage,
    decisionReason: request.decisionReason,
    reviewedAt: request.reviewedAt,
    completedAt: request.completedAt,
    cancelledAt: request.cancelledAt,
  }
}

function mapSafeData(
  data: GuidePortalSafeData,
  identity: GuidePortalIdentityResult
): SupabaseGuidePortalData {
  const guideId = identity.guideId

  return {
    guides: data.guides.map(mapSafeGuide),
    groups: data.groups.map((group) => ({
      id: group.groupId,
      code: group.groupCode,
      circuitId: group.circuitId,
      startDate: group.startDate,
      endDate: group.endDate,
      startDateIso: group.startDate,
      endDateIso: group.endDate,
      guideId,
      currentAssignmentId: group.currentAssignmentId,
      groupStatus: group.groupStatus,
      assignmentStatus:
        assignmentStatusBySupabaseValue[group.assignmentStatus],
      confirmationStatus:
        confirmationStatusBySupabaseValue[group.confirmationStatus],
      requiredLanguage: group.language,
      travelers: group.estimatedPassengers ?? 0,
    })),
    availability: data.availability.map((record) => ({
      id: record.availabilityId,
      guideId: record.guideId,
      assignmentGroupId: record.assignmentGroupId ?? undefined,
      assignmentGroupCode: record.assignmentGroupCode ?? undefined,
      assignmentGroupStartDateIso: record.assignmentGroupStartDate ?? undefined,
      assignmentGroupEndDateIso: record.assignmentGroupEndDate ?? undefined,
      assignmentCircuitName: record.assignmentCircuitName ?? undefined,
      assignmentCircuitCode: record.assignmentCircuitCode ?? undefined,
      startDate: record.startDate,
      endDate: record.endDate,
      startDateIso: record.startDate,
      endDateIso: record.endDate,
      status: availabilityStatusBySupabaseValue[record.status],
      source: availabilitySourceBySupabaseValue[record.source],
      notes: record.notes,
    })),
    availabilitySubmissions: data.availabilitySubmissions.map((submission) => ({
      id: submission.submissionId,
      guideId: submission.guideId,
      year: submission.year,
      status: availabilitySubmissionStatusBySupabaseValue[submission.status],
      submittedAt: submission.submittedAt,
      reviewedAt: submission.reviewedAt,
      reviewMessage: submission.reviewMessage,
      updatedAt: submission.updatedAt,
    })),
    circuits: buildSafeCircuits(data),
    changeRequests: data.changeRequests.map(mapSafeChangeRequest),
  }
}

function getAuthModeNotice(identity: GuidePortalIdentityResult) {
  switch (identity.status) {
    case "not_signed_in":
      return "Sign in with an email authorized by the operations team to load Guide Portal data."
    case "no_profile":
      return "This signed-in account is not authorized for Guide Portal access. Sign in with an email authorized by the operations team."
    case "no_guide_linked":
      return "This signed-in account is not linked to a guide profile. Sign in with an email authorized by the operations team."
    case "access_denied":
      return "Guide Portal access is unavailable for this account."
    case "ready":
      return "Guide Portal Auth mode is using guide-safe Supabase views. Change requests can be submitted for internal review; operational update actions remain read-only."
    case "error":
      return identity.error ?? "Guide Portal Auth identity could not be resolved."
  }
}

export function useGuidePortalData() {
  const localGuides = usePersistedGuides()
  const localGroups = usePersistedGroups()
  const localAvailability = usePersistedAvailability()
  const localCircuits = usePersistedCircuits()
  const previewGuideId = usePreviewGuideId()
  const guidePortalSource = useGuidePortalSource()
  const [supabaseData, setSupabaseData] =
    useState<SupabaseGuidePortalData | null>(null)
  const [supabaseError, setSupabaseError] = useState<string | null>(null)
  const [authIdentity, setAuthIdentity] =
    useState<GuidePortalIdentityResult>(emptyGuidePortalIdentity)
  const [authSupabaseData, setAuthSupabaseData] =
    useState<SupabaseGuidePortalData | null>(null)
  const [authSupabaseError, setAuthSupabaseError] = useState<string | null>(null)
  const [authReloadCounter, setAuthReloadCounter] = useState(0)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [hasResolvedAuthIdentity, setHasResolvedAuthIdentity] = useState(false)
  const authUserIdRef = useRef<string | null>(null)
  const authRequestIdRef = useRef(0)
  const canUsePreviewSupabaseData =
    guidePortalSource === "preview" &&
    supabaseData !== null &&
    supabaseData.guides.length > 0
  const canUseAuthSupabaseData =
    guidePortalSource === "auth" &&
    authIdentity.status === "ready" &&
    authSupabaseData !== null &&
    authSupabaseData.guides.length > 0
  const canUseSupabaseData =
    canUsePreviewSupabaseData || canUseAuthSupabaseData
  const dataSource: GuidePortalDataSource = guidePortalSource === "auth" || canUseSupabaseData
    ? "supabase"
    : "local-fallback"
  const activeSupabaseData =
    guidePortalSource === "auth" ? authSupabaseData : supabaseData
  const fallbackGuides = guidePortalSource === "auth" ? [] : localGuides
  const fallbackGroups = guidePortalSource === "auth" ? [] : localGroups
  const fallbackAvailability =
    guidePortalSource === "auth" ? [] : localAvailability
  const fallbackAvailabilitySubmissions: GuideAvailabilitySubmission[] = []
  const fallbackCircuits = guidePortalSource === "auth" ? [] : localCircuits
  const fallbackChangeRequests: GuidePortalChangeRequest[] = []
  const guides =
    canUseSupabaseData && activeSupabaseData
      ? activeSupabaseData.guides
      : fallbackGuides
  const groups =
    canUseSupabaseData && activeSupabaseData
      ? activeSupabaseData.groups
      : fallbackGroups
  const availability =
    canUseSupabaseData && activeSupabaseData
      ? activeSupabaseData.availability
      : fallbackAvailability
  const availabilitySubmissions =
    canUseSupabaseData && activeSupabaseData
      ? activeSupabaseData.availabilitySubmissions
      : fallbackAvailabilitySubmissions
  const circuits =
    canUseSupabaseData && activeSupabaseData
      ? activeSupabaseData.circuits
      : fallbackCircuits
  const changeRequests =
    canUseSupabaseData && activeSupabaseData
      ? activeSupabaseData.changeRequests
      : fallbackChangeRequests
  const selectedGuide =
    guidePortalSource === "auth"
      ? activeSupabaseData?.guides[0]
      : guides.find((guide) => guide.id === previewGuideId) ??
        guides.find((guide) => guide.status === "active") ??
        guides[0]
  const selectedPreviewGuideExistsInSupabase = previewGuideId
    ? Boolean(supabaseData?.guides.some((guide) => guide.id === previewGuideId))
    : true
  const dataSourceMessage =
    guidePortalSource === "auth"
      ? "Guide Portal Auth mode can submit pending change requests. Other update actions will be enabled after internal approval workflow is connected."
      : dataSource === "supabase"
      ? "Guide Portal is currently read-only. Update actions will be enabled after internal approval workflow is connected."
      : "Using local mock guide portal data in this browser."
  const fallbackReason =
    supabaseData && supabaseData.guides.length === 0
      ? "No Supabase guides are available."
      : supabaseError
  const stalePreviewGuideNotice =
    guidePortalSource === "preview" &&
    dataSource === "supabase" &&
    previewGuideId &&
    !selectedPreviewGuideExistsInSupabase
      ? "The previous preview guide was not found in Supabase. A Supabase guide was selected for preview."
      : null
  const authModeNotice =
    guidePortalSource === "auth" ? getAuthModeNotice(authIdentity) : null
  const authModeError =
    guidePortalSource === "auth" && authIdentity.status === "error"
      ? authIdentity.error
      : authSupabaseError
  const dataSourceNotice =
    guidePortalSource === "auth"
      ? authModeError ?? authModeNotice
      : dataSource === "supabase" ? stalePreviewGuideNotice : fallbackReason

  const handleSelectedGuideIdChange = useCallback((guideId: string) => {
    savePreviewGuideId(guideId)
  }, [])

  const handleGuidePortalSourceChange = useCallback(
    (source: "preview" | "auth") => {
      saveGuidePortalSource(source)
    },
    []
  )

  const refreshGuidePortalData = useCallback(() => {
    if (guidePortalSource === "auth") {
      setAuthReloadCounter((current) => current + 1)
    }
  }, [guidePortalSource])

  useEffect(() => {
    if (guidePortalSource !== "preview") {
      return
    }

    let isMounted = true

    async function loadSupabaseGuidePortalData() {
      setIsPreviewLoading(true)
      try {
        const [guidesResult, groupsResult, availabilityResult, circuitsResult] =
          await Promise.all([
            getSupabaseGuides(),
            getSupabaseGroups(),
            getSupabaseAvailability(),
            getAllSupabaseCircuits(),
          ])

        if (!isMounted) {
          return
        }

        const readError =
          guidesResult.error ??
          groupsResult.error ??
          availabilityResult.error ??
          circuitsResult.error

        if (readError) {
          setSupabaseData(null)
          setSupabaseError(readError)
          return
        }

        setSupabaseData({
          guides: guidesResult.data,
          groups: groupsResult.data,
          availability: availabilityResult.data,
          availabilitySubmissions: [],
          circuits: circuitsResult.data,
          changeRequests: [],
        })
        setSupabaseError(null)
      } catch (error) {
        if (!isMounted) {
          return
        }

        setSupabaseData(null)
        setSupabaseError(
          error instanceof Error
            ? error.message
            : "Unable to read Guide Portal data from Supabase."
        )
      } finally {
        if (isMounted) {
          setIsPreviewLoading(false)
        }
      }
    }

    loadSupabaseGuidePortalData()

    return () => {
      isMounted = false
    }
  }, [guidePortalSource])

  useEffect(() => {
    if (guidePortalSource !== "auth") {
      return
    }

    let isMounted = true

    async function loadAuthGuidePortalData(expectedUserId: string | null) {
      const requestId = ++authRequestIdRef.current
      const isCurrent = () => isMounted && requestId === authRequestIdRef.current
      setAuthSupabaseError(null)

      try {
        const nextIdentity = await getCurrentGuidePortalIdentity()

        if (!isCurrent()) {
          return
        }

        if (expectedUserId && nextIdentity.userId !== expectedUserId) {
          setAuthIdentity(emptyGuidePortalIdentity)
          setAuthSupabaseData(null)
          return
        }

        setAuthIdentity(nextIdentity)
        setHasResolvedAuthIdentity(true)

        if (nextIdentity.status !== "ready") {
          setAuthSupabaseData(null)
          return
        }

        const result = await getSupabaseGuidePortalData()

        if (!isCurrent()) {
          return
        }

        if (result.error) {
          setAuthSupabaseData(null)
          setAuthSupabaseError(result.error)
          return
        }

        setAuthSupabaseData(mapSafeData(result.data, nextIdentity))
      } catch (error) {
        if (!isCurrent()) {
          return
        }

        setAuthSupabaseData(null)
        setAuthSupabaseError(
          error instanceof Error
            ? error.message
            : "Unable to read Guide Portal Auth data from Supabase."
        )
      } finally {
        if (isCurrent()) {
          setHasResolvedAuthIdentity(true)
          setIsAuthLoading(false)
        }
      }
    }

    if (authUserIdRef.current === null) {
      setIsAuthLoading(true)
    }
    void loadAuthGuidePortalData(authUserIdRef.current)

    const unsubscribe = onSupabaseAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null

      if (!nextUserId || event === "SIGNED_OUT") {
        authRequestIdRef.current += 1
        authUserIdRef.current = null
        setAuthIdentity(emptyGuidePortalIdentity)
        setAuthSupabaseData(null)
        setAuthSupabaseError(null)
        setHasResolvedAuthIdentity(true)
        setIsAuthLoading(false)
        return
      }

      if (nextUserId !== authUserIdRef.current) {
        authRequestIdRef.current += 1
        authUserIdRef.current = nextUserId
        setAuthIdentity(emptyGuidePortalIdentity)
        setAuthSupabaseData(null)
        setAuthSupabaseError(null)
        setHasResolvedAuthIdentity(false)
        setIsAuthLoading(true)
      }

      // Supabase Auth callbacks must complete before protected reads begin.
      window.setTimeout(() => {
        if (isMounted && authUserIdRef.current === nextUserId) {
          void loadAuthGuidePortalData(nextUserId)
        }
      }, 0)
    })

    return () => {
      isMounted = false
      authRequestIdRef.current += 1
      unsubscribe()
    }
  }, [authReloadCounter, guidePortalSource])

  useEffect(() => {
    if (guidePortalSource !== "auth") return

    let lastRefreshAt = 0
    const requestRefresh = () => {
      const now = Date.now()
      if (now - lastRefreshAt < 500) return
      lastRefreshAt = now
      setAuthReloadCounter((current) => current + 1)
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") requestRefresh()
    }

    window.addEventListener("focus", requestRefresh)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      window.removeEventListener("focus", requestRefresh)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [guidePortalSource])

  useEffect(() => {
    if (
      guidePortalSource !== "preview" ||
      dataSource !== "supabase" ||
      !previewGuideId ||
      selectedPreviewGuideExistsInSupabase ||
      !selectedGuide
    ) {
      return
    }

    savePreviewGuideId(selectedGuide.id)
  }, [
    dataSource,
    guidePortalSource,
    previewGuideId,
    selectedGuide,
    selectedPreviewGuideExistsInSupabase,
  ])

  return useMemo(
    () => ({
      guides,
      groups,
      availability,
      availabilitySubmissions,
      changeRequests,
      circuits,
      selectedGuide,
      selectedGuideId: selectedGuide?.id ?? "",
      setSelectedGuideId: handleSelectedGuideIdChange,
      guidePortalSource,
      setGuidePortalSource: handleGuidePortalSourceChange,
      guidePortalAuthStatus: authIdentity.status,
      isLoading:
        guidePortalSource === "auth"
          ? isAuthLoading || !hasResolvedAuthIdentity
          : isPreviewLoading,
      refreshGuidePortalData,
      dataSource,
      dataSourceMessage,
      supabaseError: guidePortalSource === "auth" ? authModeError : fallbackReason,
      dataSourceNotice,
    }),
    [
      availability,
      availabilitySubmissions,
      authIdentity.status,
      authModeError,
      circuits,
      changeRequests,
      dataSource,
      dataSourceMessage,
      dataSourceNotice,
      fallbackReason,
      guidePortalSource,
      groups,
      guides,
      handleGuidePortalSourceChange,
      handleSelectedGuideIdChange,
      hasResolvedAuthIdentity,
      refreshGuidePortalData,
      isAuthLoading,
      isPreviewLoading,
      selectedGuide,
    ]
  )
}
