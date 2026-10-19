import type {
  Guide,
  GuideAuthorizedEmail,
  GuideAuthorizedEmailSource,
  GuideAuthorizedEmailStatus,
  GuideStatus,
} from "@/lib/types/domain"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { normalizeSpokenLanguages } from "@/lib/utils/language-options"
import { readAllPages, readByIdBatches } from "@/lib/supabase/queries/paginated-read"

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

type GuideRow = {
  id: string
  full_name: string
  authorized_email: string | null
  phone: string | null
  preferred_language: SupportedLanguage | null
  languages: SupportedLanguage[] | null
  status: SupabaseGuideStatus
  internal_notes: string | null
  internal_rating: number | null
  sales_ranking: number | null
  sales_score: number | null
  change_requests_count: number
  completed_change_requests_count: number
  rejected_change_requests_count: number
  pending_change_requests_count: number
  birth_date: string | null
  city: string | null
}

type GuideCircuitCapabilityRow = {
  guide_id: string
  circuit_id: string
}

type GuideAuthorizedEmailRow = {
  id: string
  guide_id: string
  email: string
  normalized_email: string
  status: GuideAuthorizedEmailStatus
  source: GuideAuthorizedEmailSource
  notes: string | null
  invited_at: string | null
  registered_at: string | null
  revoked_at: string | null
  profile_id: string | null
}

export type SupabaseGuidesResult = {
  data: Guide[]
  error: string | null
}

type GuideAssignmentCountRow = {
  guide_id: string
  assigned_group_count: number
}

export async function getCurrentGuideAssignmentCounts(guideIds: string[]): Promise<{
  data: Record<string, number>
  error: string | null
}> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return { data: {}, error: "Supabase environment variables are not configured." }

  const counts: Record<string, number> = {}
  for (let start = 0; start < guideIds.length; start += 100) {
    const { data, error } = await supabase.rpc(
      "get_current_guide_assignment_counts",
      { p_guide_ids: guideIds.slice(start, start + 100) }
    )
    if (error) return { data: {}, error: "Unable to load assigned-group counts." }
    for (const row of (data ?? []) as GuideAssignmentCountRow[]) {
      counts[row.guide_id] = Number(row.assigned_group_count)
    }
  }
  return { data: counts, error: null }
}

const languageCodeBySupabaseValue: Record<SupportedLanguage, string> = {
  english: "EN",
  french: "FR",
  spanish: "ES",
  turkish: "TR",
}

const guideStatusBySupabaseValue: Record<SupabaseGuideStatus, GuideStatus> = {
  pending_invitation: "pending-invitation",
  invited: "invited",
  active: "active",
  inactive: "inactive",
  blocked: "blocked",
}

function mapLanguage(language: SupportedLanguage | null) {
  return language ? languageCodeBySupabaseValue[language] : ""
}

export async function getSupabaseGuides(): Promise<SupabaseGuidesResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return {
      data: [],
      error: "Supabase environment variables are not configured.",
    }
  }

  const { data: guides, error: guidesError } = await readAllPages((start, end) =>
    supabase
      .from("guides")
      .select(
        "id, full_name, authorized_email, phone, preferred_language, languages, status, internal_notes, internal_rating, sales_ranking, sales_score, change_requests_count, completed_change_requests_count, rejected_change_requests_count, pending_change_requests_count, birth_date, city"
      )
      .eq("is_archived", false)
      .order("full_name", { ascending: true })
      .order("id", { ascending: true })
      .range(start, end)
      .returns<GuideRow[]>()
  )

  if (guidesError) {
    return {
      data: [],
      error: guidesError,
    }
  }

  const guideIds = guides.map((guide) => guide.id)

  if (guideIds.length === 0) {
    return {
      data: [],
      error: null,
    }
  }

  const { data: capabilities, error: capabilitiesError } = await readByIdBatches(
    guideIds,
    (batch, start, end) => supabase
      .from("guide_circuit_capabilities")
      .select("guide_id, circuit_id")
      .in("guide_id", batch)
      .eq("is_active", true)
      .order("guide_id", { ascending: true })
      .order("circuit_id", { ascending: true })
      .range(start, end)
      .returns<GuideCircuitCapabilityRow[]>()
  )

  if (capabilitiesError) {
    return {
      data: [],
      error: capabilitiesError,
    }
  }

  const circuitIdsByGuideId = new Map<string, string[]>()
  const authorizedEmailsByGuideId = new Map<string, GuideAuthorizedEmail[]>()

  capabilities.forEach((capability) => {
    const currentCircuitIds =
      circuitIdsByGuideId.get(capability.guide_id) ?? []

    circuitIdsByGuideId.set(capability.guide_id, [
      ...currentCircuitIds,
      capability.circuit_id,
    ])
  })

  const { data: authorizedEmailRows, error: authorizedEmailError } =
    await readByIdBatches(guideIds, (batch, start, end) => supabase
      .from("guide_authorized_emails")
      .select(
        "id, guide_id, email, normalized_email, status, source, notes, invited_at, registered_at, revoked_at, profile_id"
      )
      .in("guide_id", batch)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(start, end)
      .returns<GuideAuthorizedEmailRow[]>())

  if (authorizedEmailError) {
    return {
      data: [],
      error: authorizedEmailError,
    }
  }

  for (const row of authorizedEmailRows ?? []) {
    const currentRows = authorizedEmailsByGuideId.get(row.guide_id) ?? []

    authorizedEmailsByGuideId.set(row.guide_id, [
      ...currentRows,
      {
        id: row.id,
        guideId: row.guide_id,
        email: row.email,
        normalizedEmail: row.normalized_email,
        status: row.status,
        source: row.source,
        notes: row.notes,
        invitedAt: row.invited_at,
        registeredAt: row.registered_at,
        revokedAt: row.revoked_at,
        profileId: row.profile_id,
      },
    ])
  }

  return {
    data: guides.map((guide) => ({
      id: guide.id,
      name: guide.full_name,
      email: guide.authorized_email ?? "",
      phone: guide.phone,
      languages: normalizeSpokenLanguages(
        (guide.languages ?? []).map(
          (language) => languageCodeBySupabaseValue[language]
        ),
        mapLanguage(guide.preferred_language)
      ),
      preferredLanguage: mapLanguage(guide.preferred_language),
      circuitIds: circuitIdsByGuideId.get(guide.id) ?? [],
      status: guideStatusBySupabaseValue[guide.status],
      internalNotes: guide.internal_notes ?? undefined,
      changeRequestsCount: guide.change_requests_count,
      completedChangeRequestsCount: guide.completed_change_requests_count,
      rejectedChangeRequestsCount: guide.rejected_change_requests_count,
      pendingChangeRequestsCount: guide.pending_change_requests_count,
      internalRating: guide.internal_rating,
      salesRanking: guide.sales_ranking,
      salesScore: guide.sales_score,
      authorizedEmails: authorizedEmailsByGuideId.get(guide.id) ?? [],
      birthDateIso: guide.birth_date,
      city: guide.city,
    })),
    error: null,
  }
}
