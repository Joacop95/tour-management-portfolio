import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { getCurrentUserAccess } from "@/lib/auth/current-user-access"
import type {
  Guide,
  GuideAuthorizedEmailSource,
  GuideAuthorizedEmailStatus,
  GuideStatus,
} from "@/lib/types/domain"

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

export type SupabaseGuideMutationInput = {
  name: string
  authorizedEmail: string
  phone: string | null
  preferredLanguage: string
  languages: string[]
  status: GuideStatus
  circuitIds: string[]
  internalNotes?: string
  internalRating?: number | null
  salesRanking?: number | null
  salesScore?: number | null
  authorizedEmailSource?: GuideAuthorizedEmailSource
  authorizedEmailNotes?: string | null
  replaceCircuitCapabilities?: boolean
}

export type SupabaseGuideMutationResult = {
  error: string | null
}

export type SupabaseGuideAuthorizedEmailMutationInput = {
  guideId: string
  email: string
  status: GuideAuthorizedEmailStatus
  notes?: string | null
}

export type SupabaseGuideAuthorizedEmailUpdateInput = {
  email?: string
  status: GuideAuthorizedEmailStatus
  notes?: string | null
}

export type SupabasePrimaryGuideAuthorizedEmailInput = {
  guideId: string
  email: string
  status: Exclude<GuideAuthorizedEmailStatus, "revoked">
  notes?: string | null
  source?: GuideAuthorizedEmailSource
}

export type SupabasePrimaryGuideAuthorizedEmailResult =
  SupabaseGuideMutationResult & {
    created?: number
    updated?: number
    revoked?: number
  }

type ActiveGuideAuthorizedEmailRow = {
  id: string
  email: string
  normalized_email: string
  status: Exclude<GuideAuthorizedEmailStatus, "revoked">
  profile_id: string | null
}

const supabaseLanguageByAppValue: Record<string, SupportedLanguage> = {
  EN: "english",
  FR: "french",
  ES: "spanish",
  TR: "turkish",
}

const supabaseGuideStatusByAppValue: Record<GuideStatus, SupabaseGuideStatus> =
  {
    "pending-invitation": "pending_invitation",
    invited: "invited",
    active: "active",
    inactive: "inactive",
    blocked: "blocked",
  }

function getSupabaseUnavailableResult(): SupabaseGuideMutationResult {
  return {
    error: "Supabase environment variables are not configured.",
  }
}

function getFriendlySupabaseError(error: { code?: string; message?: string }) {
  const message = error.message ?? "Supabase write failed."

  if (error.code === "23505" || message.includes("duplicate key")) {
    if (message.includes("guides_authorized_email_key")) {
      return "This authorized email already exists."
    }

    if (message.includes("guide_authorized_emails_active_normalized_email_key")) {
      return "This login email is already authorized for an active guide record."
    }

    if (message.includes("guide_circuit_capabilities_guide_circuit_key")) {
      return "This guide already has one of the selected circuit capabilities."
    }

    return "This guide conflicts with an existing guide."
  }

  return "Unable to save this guide. Refresh and try again."
}

async function getCurrentProfileId() {
  const access = await getCurrentUserAccess()

  return access.profileFound ? access.userId : null
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validateAuthorizedEmail(email: string) {
  const trimmedEmail = email.trim()

  if (!trimmedEmail) {
    return "Authorized login email is required."
  }

  if (!isValidEmail(trimmedEmail)) {
    return "Enter a valid authorized login email."
  }

  return null
}

function getStatusTimestampPayload(status: GuideAuthorizedEmailStatus) {
  const nowIso = new Date().toISOString()

  return {
    invited_at: status === "invited" ? nowIso : null,
    registered_at: status === "registered" ? nowIso : null,
    revoked_at: status === "revoked" ? nowIso : null,
  }
}

function getAuthorizedEmailUpdateTimestampPayload(
  status: GuideAuthorizedEmailStatus
) {
  const nowIso = new Date().toISOString()

  if (status === "registered") {
    return {
      revoked_at: null,
    }
  }

  return {
    invited_at: status === "invited" ? nowIso : null,
    registered_at: null,
    revoked_at: status === "revoked" ? nowIso : null,
  }
}

async function insertGuideAuthorizedEmailRecord({
  guideId,
  email,
  status,
  notes,
  source = "manual",
}: SupabaseGuideAuthorizedEmailMutationInput & {
  source?: "manual" | "bulk_import" | "migration" | "invitation"
}): Promise<SupabaseGuideMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  const emailError = validateAuthorizedEmail(email)

  if (emailError) {
    return { error: emailError }
  }

  const profileId = await getCurrentProfileId()

  const { error } = await supabase.from("guide_authorized_emails").insert({
    guide_id: guideId,
    email: email.trim(),
    status,
    source,
    notes: notes?.trim() || null,
    created_by_profile_id: profileId,
    updated_by_profile_id: profileId,
    ...getStatusTimestampPayload(status),
  })

  return {
    error: error ? getFriendlySupabaseError(error) : null,
  }
}

function mapLanguageToSupabase(language: string) {
  return supabaseLanguageByAppValue[language.trim().toUpperCase()] ?? null
}

function mapLanguagesToSupabase(languages: string[]) {
  return Array.from(
    new Set(
      languages
        .map((language) => mapLanguageToSupabase(language))
        .filter((language): language is SupportedLanguage => Boolean(language))
    )
  )
}

function buildGuidePayload(input: SupabaseGuideMutationInput) {
  const preferredLanguage = mapLanguageToSupabase(input.preferredLanguage)
  const languages = mapLanguagesToSupabase(input.languages)
  const languagesWithPreference = preferredLanguage
    ? Array.from(new Set([preferredLanguage, ...languages]))
    : languages

  return {
    full_name: input.name.trim(),
    authorized_email: input.authorizedEmail.trim(),
    phone: input.phone?.trim() || null,
    preferred_language: preferredLanguage,
    languages: languagesWithPreference,
    status: supabaseGuideStatusByAppValue[input.status],
    internal_notes: input.internalNotes?.trim() || null,
    internal_rating: input.internalRating ?? null,
    sales_ranking: input.salesRanking ?? null,
    sales_score: input.salesScore ?? null,
  }
}

function dedupeCircuitIds(circuitIds: string[]) {
  return Array.from(new Set(circuitIds.filter(Boolean)))
}

async function upsertGuideCircuitCapabilities(
  guideId: string,
  circuitIds: string[]
) {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  const nowIso = new Date().toISOString()
  const uniqueCircuitIds = dedupeCircuitIds(circuitIds)

  const { error: deactivateError } = await supabase
    .from("guide_circuit_capabilities")
    .update({
      is_active: false,
      updated_at: nowIso,
    })
    .eq("guide_id", guideId)

  if (deactivateError) {
    return { error: getFriendlySupabaseError(deactivateError) }
  }

  if (uniqueCircuitIds.length === 0) {
    return { error: null }
  }

  const { error: capabilitiesError } = await supabase
    .from("guide_circuit_capabilities")
    .upsert(
      uniqueCircuitIds.map((circuitId) => ({
        guide_id: guideId,
        circuit_id: circuitId,
        is_active: true,
        updated_at: nowIso,
      })),
      { onConflict: "guide_id,circuit_id" }
    )

  if (capabilitiesError) {
    return { error: getFriendlySupabaseError(capabilitiesError) }
  }

  return { error: null }
}

export function buildSupabaseGuideMutationInput(
  guide: Guide
): SupabaseGuideMutationInput {
  return {
    name: guide.name,
    authorizedEmail: guide.email,
    phone: guide.phone,
    preferredLanguage: guide.preferredLanguage,
    languages: guide.languages,
    status: guide.status,
    circuitIds: guide.circuitIds,
    internalNotes: guide.internalNotes,
    internalRating: guide.internalRating,
    salesRanking: guide.salesRanking,
    salesScore: guide.salesScore,
  }
}

export async function createSupabaseGuide(
  input: SupabaseGuideMutationInput
): Promise<SupabaseGuideMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  const { data: guide, error: guideError } = await supabase
    .from("guides")
    .insert(buildGuidePayload(input))
    .select("id")
    .single()

  if (guideError) {
    return { error: getFriendlySupabaseError(guideError) }
  }

  const guideId = typeof guide?.id === "string" && guide.id ? guide.id : null

  if (!guideId) {
    return { error: "Guide was created but Supabase did not return an id." }
  }

  if (input.replaceCircuitCapabilities !== false) {
    const capabilitiesResult = await upsertGuideCircuitCapabilities(
      guideId,
      input.circuitIds
    )

    if (capabilitiesResult.error) {
      return capabilitiesResult
    }
  }

  return insertGuideAuthorizedEmailRecord({
    guideId,
    email: input.authorizedEmail,
    status: input.status === "invited" ? "invited" : "allowed",
    source: input.authorizedEmailSource ?? "manual",
    notes:
      input.authorizedEmailNotes ??
      "Created from the guide primary authorized email.",
  })
}

export async function updateSupabaseGuide(
  id: string,
  input: SupabaseGuideMutationInput,
  options: { statusOnly?: boolean } = {}
): Promise<SupabaseGuideMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  const { error: guideError } = await supabase
    .from("guides")
    .update({
      ...(options.statusOnly
        ? { status: supabaseGuideStatusByAppValue[input.status] }
        : buildGuidePayload(input)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (guideError) {
    return { error: getFriendlySupabaseError(guideError) }
  }

  if (options.statusOnly || input.replaceCircuitCapabilities === false) {
    return { error: null }
  }

  const capabilitiesResult = await upsertGuideCircuitCapabilities(id, input.circuitIds)

  if (capabilitiesResult.error) {
    return capabilitiesResult
  }

  return { error: null }
}

export async function upsertPrimaryGuideAuthorizedEmail({
  guideId,
  email,
  status,
  notes,
  source = "manual",
}: SupabasePrimaryGuideAuthorizedEmailInput): Promise<SupabasePrimaryGuideAuthorizedEmailResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  const emailError = validateAuthorizedEmail(email)

  if (emailError) {
    return { error: emailError }
  }

  const normalizedEmail = email.trim().toLowerCase()
  const { data: activeEmails, error: activeEmailsError } = await supabase
    .from("guide_authorized_emails")
    .select("id, email, normalized_email, status, profile_id")
    .eq("guide_id", guideId)
    .neq("status", "revoked")
    .order("created_at", { ascending: true })
    .returns<ActiveGuideAuthorizedEmailRow[]>()

  if (activeEmailsError) {
    return { error: getFriendlySupabaseError(activeEmailsError) }
  }

  const currentEmails = activeEmails ?? []
  const matchingEmail = currentEmails.find(
    (currentEmail) => currentEmail.normalized_email === normalizedEmail
  )
  const nextStatus =
    status === "registered" && !matchingEmail ? "allowed" : status

  if (nextStatus === "registered" && !matchingEmail?.profile_id) {
    return {
      error:
        "Only an existing registered login email linked to a profile can remain registered.",
    }
  }

  const profileId = await getCurrentProfileId()
  const nowIso = new Date().toISOString()

  if (matchingEmail) {
    const { error: updateError } = await supabase
      .from("guide_authorized_emails")
      .update({
        email: email.trim(),
        status: nextStatus,
        notes: notes?.trim() || null,
        source,
        updated_by_profile_id: profileId,
        updated_at: nowIso,
        ...getAuthorizedEmailUpdateTimestampPayload(nextStatus),
      })
      .eq("id", matchingEmail.id)

    if (updateError) {
      return { error: getFriendlySupabaseError(updateError) }
    }

    const extraActiveIds = currentEmails
      .filter((currentEmail) => currentEmail.id !== matchingEmail.id)
      .map((currentEmail) => currentEmail.id)

    if (extraActiveIds.length > 0) {
      const { error: revokeExtrasError } = await supabase
        .from("guide_authorized_emails")
        .update({
          status: "revoked",
          revoked_at: nowIso,
          updated_by_profile_id: profileId,
          updated_at: nowIso,
        })
        .in("id", extraActiveIds)

      if (revokeExtrasError) {
        return { error: getFriendlySupabaseError(revokeExtrasError) }
      }
    }

    return {
      error: null,
      created: 0,
      updated: 1,
      revoked: extraActiveIds.length,
    }
  }

  const { data: conflictingEmails, error: conflictError } = await supabase
    .from("guide_authorized_emails")
    .select("id")
    .eq("normalized_email", normalizedEmail)
    .neq("status", "revoked")
    .neq("guide_id", guideId)

  if (conflictError) {
    return { error: getFriendlySupabaseError(conflictError) }
  }

  if ((conflictingEmails ?? []).length > 0) {
    return { error: "This login email is already authorized for another guide." }
  }

  if (currentEmails.length > 0) {
    const { error: revokeCurrentError } = await supabase
      .from("guide_authorized_emails")
      .update({
        status: "revoked",
        revoked_at: nowIso,
        updated_by_profile_id: profileId,
        updated_at: nowIso,
      })
      .in(
        "id",
        currentEmails.map((currentEmail) => currentEmail.id)
      )

    if (revokeCurrentError) {
      return { error: getFriendlySupabaseError(revokeCurrentError) }
    }
  }

  const insertResult = await insertGuideAuthorizedEmailRecord({
    guideId,
    email,
    status: nextStatus,
    source,
    notes,
  })

  return {
    ...insertResult,
    created: insertResult.error ? 0 : 1,
    updated: 0,
    revoked: currentEmails.length,
  }
}

export async function createSupabaseGuideAuthorizedEmail(
  input: SupabaseGuideAuthorizedEmailMutationInput
): Promise<SupabaseGuideMutationResult> {
  return insertGuideAuthorizedEmailRecord(input)
}

export async function updateSupabaseGuideAuthorizedEmail(
  id: string,
  input: SupabaseGuideAuthorizedEmailUpdateInput
): Promise<SupabaseGuideMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  if (input.email) {
    const emailError = validateAuthorizedEmail(input.email)

    if (emailError) {
      return { error: emailError }
    }
  }

  const profileId = await getCurrentProfileId()
  const { error } = await supabase
    .from("guide_authorized_emails")
    .update({
      ...(input.email ? { email: input.email.trim() } : {}),
      status: input.status,
      notes: input.notes?.trim() || null,
      updated_by_profile_id: profileId,
      updated_at: new Date().toISOString(),
      ...getAuthorizedEmailUpdateTimestampPayload(input.status),
    })
    .eq("id", id)

  return {
    error: error ? getFriendlySupabaseError(error) : null,
  }
}

export async function revokeSupabaseGuideAuthorizedEmail(
  id: string
): Promise<SupabaseGuideMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  const profileId = await getCurrentProfileId()
  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from("guide_authorized_emails")
    .update({
      status: "revoked",
      revoked_at: nowIso,
      updated_by_profile_id: profileId,
      updated_at: nowIso,
    })
    .eq("id", id)

  return {
    error: error ? getFriendlySupabaseError(error) : null,
  }
}
