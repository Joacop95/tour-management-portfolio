import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import type {
  AvailabilitySource,
  AvailabilityStatus,
  GuideAvailability,
} from "@/lib/types/domain"

type SupabaseAvailabilityStatus =
  | "available"
  | "not_available"
  | "occupied_by_assignment"
  | "pending_review"

type SupabaseAvailabilitySource =
  | "guide_submitted"
  | "admin_updated"
  | "assignment_generated"

type ExistingAvailabilityRow = {
  status: SupabaseAvailabilityStatus
  source: SupabaseAvailabilitySource
}

export type SupabaseAvailabilityMutationInput = {
  guideId: string
  startDateIso: string
  endDateIso: string
  status: AvailabilityStatus
  source: AvailabilitySource
  notes: string
  assignmentId?: string | null
}

export type SupabaseAvailabilityMutationResult = {
  error: string | null
}

const protectedRecordMessage =
  "This period was generated from an assigned group. Change the assignment instead."

const supabaseStatusByAppValue: Record<
  AvailabilityStatus,
  SupabaseAvailabilityStatus
> = {
  available: "available",
  "not-available": "not_available",
  "occupied-by-assignment": "occupied_by_assignment",
  "pending-review": "pending_review",
}

const supabaseSourceByAppValue: Record<
  AvailabilitySource,
  SupabaseAvailabilitySource
> = {
  "guide-submitted": "guide_submitted",
  "admin-updated": "admin_updated",
  "assignment-generated": "assignment_generated",
}

function getSupabaseUnavailableResult(): SupabaseAvailabilityMutationResult {
  return {
    error: "Supabase environment variables are not configured.",
  }
}

function getFriendlySupabaseError(error: { code?: string; message?: string }) {
  const message = error.message ?? "Supabase write failed."

  if (error.code === "23503" || message.includes("foreign key")) {
    return "The selected guide or assignment no longer exists."
  }

  if (
    error.code === "23514" ||
    message.includes("availability_date_order_check")
  ) {
    return "Date to cannot be before date from."
  }

  return "Unable to save this availability. Refresh and try again."
}

function isProtectedAvailabilityRecord(
  record: Pick<ExistingAvailabilityRow, "status" | "source">
) {
  return (
    record.source === "assignment_generated" ||
    record.status === "occupied_by_assignment"
  )
}

function isProtectedMutationInput(input: SupabaseAvailabilityMutationInput) {
  return (
    input.source === "assignment-generated" ||
    input.status === "occupied-by-assignment"
  )
}

function buildAvailabilityPayload(
  input: SupabaseAvailabilityMutationInput,
  nowIso: string
) {
  return {
    guide_id: input.guideId,
    assignment_id: input.assignmentId ?? null,
    start_date: input.startDateIso,
    end_date: input.endDateIso,
    status: supabaseStatusByAppValue[input.status],
    source: supabaseSourceByAppValue[input.source],
    notes: input.notes.trim() || null,
    updated_at: nowIso,
  }
}

export function buildSupabaseAvailabilityMutationInput(
  availability: GuideAvailability & { assignmentId?: string | null }
): SupabaseAvailabilityMutationInput {
  return {
    guideId: availability.guideId,
    startDateIso: availability.startDateIso,
    endDateIso: availability.endDateIso,
    status: availability.status,
    source: availability.source,
    notes: availability.notes,
    assignmentId: availability.assignmentId ?? null,
  }
}

export async function createSupabaseAvailability(
  input: SupabaseAvailabilityMutationInput
): Promise<SupabaseAvailabilityMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  if (isProtectedMutationInput(input)) {
    return { error: protectedRecordMessage }
  }

  const nowIso = new Date().toISOString()

  try {
    const { error } = await supabase.from("availability").insert({
      ...buildAvailabilityPayload(input, nowIso),
      created_at: nowIso,
    })

    if (error) {
      return { error: getFriendlySupabaseError(error) }
    }

    return { error: null }
  } catch {
    return { error: "Unable to save this availability. Refresh and try again." }
  }
}

export async function updateSupabaseAvailability(
  id: string,
  input: SupabaseAvailabilityMutationInput
): Promise<SupabaseAvailabilityMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  if (isProtectedMutationInput(input)) {
    return { error: protectedRecordMessage }
  }

  const nowIso = new Date().toISOString()

  try {
    const { data: existingRecord, error: existingError } = await supabase
      .from("availability")
      .select("status, source")
      .eq("id", id)
      .eq("is_archived", false)
      .maybeSingle()
      .returns<ExistingAvailabilityRow | null>()

    if (existingError) {
      return { error: getFriendlySupabaseError(existingError) }
    }

    if (!existingRecord) {
      return { error: "Availability record was not found." }
    }

    if (isProtectedAvailabilityRecord(existingRecord)) {
      return { error: protectedRecordMessage }
    }

    const { error } = await supabase
      .from("availability")
      .update(buildAvailabilityPayload(input, nowIso))
      .eq("id", id)
      .eq("is_archived", false)

    if (error) {
      return { error: getFriendlySupabaseError(error) }
    }

    return { error: null }
  } catch {
    return { error: "Unable to save this availability. Refresh and try again." }
  }
}

export async function deleteSupabaseAvailability(
  id: string
): Promise<SupabaseAvailabilityMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  const nowIso = new Date().toISOString()

  try {
    const { data: existingRecord, error: existingError } = await supabase
      .from("availability")
      .select("status, source")
      .eq("id", id)
      .eq("is_archived", false)
      .maybeSingle()
      .returns<ExistingAvailabilityRow | null>()

    if (existingError) {
      return { error: getFriendlySupabaseError(existingError) }
    }

    if (!existingRecord) {
      return { error: "Availability record was not found." }
    }

    if (isProtectedAvailabilityRecord(existingRecord)) {
      return { error: protectedRecordMessage }
    }

    const { error } = await supabase
      .from("availability")
      .update({
        is_archived: true,
        archived_at: nowIso,
        archive_reason: "Deleted from Availability module.",
        updated_at: nowIso,
      })
      .eq("id", id)
      .eq("is_archived", false)

    if (error) {
      return { error: getFriendlySupabaseError(error) }
    }

    return { error: null }
  } catch {
    return { error: "Unable to save this availability. Refresh and try again." }
  }
}
