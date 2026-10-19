import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export type GuideAvailabilityPeriodInput = {
  availabilityId?: string | null
  year: number
  startDate: string
  endDate: string
  status: "available" | "not_available"
  notes?: string
}

export type GuideAvailabilityMutationResult = {
  success: boolean
  code: string
  message: string
}

type RpcResultRow = {
  success: boolean
  code: string
  message: string
}

function unavailableResult(): GuideAvailabilityMutationResult {
  return {
    success: false,
    code: "supabase_unavailable",
    message: "Availability cannot be updated right now.",
  }
}

function safeFailure(message = "Availability could not be updated.") {
  return {
    success: false,
    code: "request_failed",
    message,
  }
}

function firstResult(data: unknown): GuideAvailabilityMutationResult | null {
  if (!Array.isArray(data) || data.length === 0) {
    return null
  }

  const row = data[0] as Partial<RpcResultRow>
  if (
    typeof row.success !== "boolean" ||
    typeof row.code !== "string" ||
    typeof row.message !== "string"
  ) {
    return null
  }

  return {
    success: row.success,
    code: row.code,
    message: row.message,
  }
}

export async function saveOwnGuideAvailabilityPeriod(
  input: GuideAvailabilityPeriodInput
): Promise<GuideAvailabilityMutationResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return unavailableResult()

  const { data, error } = await supabase.rpc(
    "save_own_guide_availability_period",
    {
      p_availability_id: input.availabilityId ?? null,
      p_year: input.year,
      p_start_date: input.startDate,
      p_end_date: input.endDate,
      p_status: input.status,
      p_notes: input.notes?.trim() || null,
    }
  )

  if (error) return safeFailure()
  return firstResult(data) ?? safeFailure()
}

export async function archiveOwnGuideAvailabilityPeriod(
  availabilityId: string,
  year: number
): Promise<GuideAvailabilityMutationResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return unavailableResult()

  const { data, error } = await supabase.rpc(
    "archive_own_guide_availability_period",
    { p_availability_id: availabilityId, p_year: year }
  )

  if (error) return safeFailure()
  return firstResult(data) ?? safeFailure()
}

export async function submitOwnGuideAnnualAvailability(
  year: number
): Promise<GuideAvailabilityMutationResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return unavailableResult()

  const { data, error } = await supabase.rpc(
    "submit_own_guide_annual_availability",
    { p_year: year }
  )

  if (error) return safeFailure("Availability could not be submitted.")
  return firstResult(data) ?? safeFailure("Availability could not be submitted.")
}

export async function reopenOwnGuideAnnualAvailability(
  year: number
): Promise<GuideAvailabilityMutationResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return unavailableResult()

  const { data, error } = await supabase.rpc(
    "reopen_own_guide_annual_availability",
    { p_year: year }
  )

  if (error) return safeFailure()
  return firstResult(data) ?? safeFailure()
}

export async function beginOwnGuideAvailabilityRevision(
  year: number
): Promise<GuideAvailabilityMutationResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return unavailableResult()

  const { data, error } = await supabase.rpc(
    "begin_own_guide_availability_revision",
    { p_year: year }
  )

  if (error) return safeFailure()
  return firstResult(data) ?? safeFailure()
}

export async function beginOwnAutoAcceptedAvailabilityRevision(
  year: number
): Promise<GuideAvailabilityMutationResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return unavailableResult()

  const { data, error } = await supabase.rpc(
    "begin_own_auto_accepted_availability_revision",
    { p_year: year }
  )

  if (error) return safeFailure()
  return firstResult(data) ?? safeFailure()
}
