import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import type { InternalAuthorizedUserStatus } from "@/lib/types/domain"

export type InternalAuthorizedUserMutationResult = {
  error: string | null
}

export type CreateInternalAuthorizedUserInput = {
  email: string
  roleId: string
  status?: Extract<InternalAuthorizedUserStatus, "allowed" | "invited">
  notes?: string | null
}

export type UpdateInternalAuthorizedUserInput = {
  status?: Exclude<InternalAuthorizedUserStatus, "registered">
  notes?: string | null
}

type InternalAuthorizedUserRpcRow = {
  success: boolean
  code: string
  message: string
}

function getSupabaseUnavailableResult(): InternalAuthorizedUserMutationResult {
  return { error: "Supabase is required to manage internal authorized users." }
}

function validateEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase()

  if (!normalizedEmail) {
    return "Email is required."
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return "Enter a valid email address."
  }

  return null
}

function getFriendlySupabaseError(error: { code?: string; message?: string }) {
  const message = error.message ?? "Supabase write failed."

  if (
    error.code === "23505" ||
    message.includes("internal_authorized_users_active_normalized_email_key")
  ) {
    return "This email already has an active internal authorization."
  }

  return "Unable to save this authorization. Refresh and try again."
}

function parseRpcResult(
  data: unknown,
  error: { code?: string; message?: string } | null,
  fallback: string
): InternalAuthorizedUserMutationResult {
  if (error) {
    return { error: getFriendlySupabaseError(error) }
  }

  const row = (Array.isArray(data) ? data[0] : null) as
    | InternalAuthorizedUserRpcRow
    | undefined

  if (!row?.success) {
    return { error: row?.message ?? fallback }
  }

  return { error: null }
}

export async function createInternalAuthorizedUser(
  input: CreateInternalAuthorizedUserInput
): Promise<InternalAuthorizedUserMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  const emailError = validateEmail(input.email)

  if (emailError) {
    return { error: emailError }
  }

  const { data, error } = await supabase.rpc("create_internal_authorized_user", {
    p_email: input.email.trim().toLowerCase(),
    p_role_id: input.roleId,
    p_status: input.status ?? "allowed",
    p_notes: input.notes?.trim() || null,
  })

  return parseRpcResult(data, error, "Unable to authorize this internal email.")
}

export async function updateInternalAuthorizedUser(
  id: string,
  input: UpdateInternalAuthorizedUserInput
): Promise<InternalAuthorizedUserMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  const { data, error } = await supabase.rpc("update_internal_authorized_user", {
    p_authorization_id: id,
    p_status: input.status ?? null,
    p_notes: input.notes?.trim() || null,
  })

  return parseRpcResult(data, error, "Unable to update this authorization.")
}

export async function changeInternalAuthorizedUserRole(
  id: string,
  roleId: string
): Promise<InternalAuthorizedUserMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  const { data, error } = await supabase.rpc(
    "set_internal_authorized_user_role",
    {
      p_authorization_id: id,
      p_role_id: roleId,
    }
  )

  return parseRpcResult(data, error, "Unable to change this internal access level.")
}

export async function revokeInternalAuthorizedUser(
  id: string
): Promise<InternalAuthorizedUserMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  const { data, error } = await supabase.rpc("revoke_internal_authorized_user", {
    p_authorization_id: id,
  })

  return parseRpcResult(data, error, "Unable to revoke this authorization.")
}
