import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { readAllPages, readByIdBatches } from "@/lib/supabase/queries/paginated-read"
import type {
  InternalAuthorizedUser,
  InternalAuthorizedUserRole,
  InternalAuthorizedUserRoleKey,
  InternalAuthorizedUserStatus,
} from "@/lib/types/domain"

type InternalAuthorizedUserRow = {
  id: string
  email: string
  normalized_email: string
  role_id: string
  status: InternalAuthorizedUserStatus
  profile_id: string | null
  notes: string | null
  invited_at: string | null
  registered_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}

type RoleRow = {
  id: string
  role_key: InternalAuthorizedUserRoleKey
  name: string
}

export type SupabaseInternalAuthorizedUsersResult = {
  data: InternalAuthorizedUser[]
  error: string | null
}

export type SupabaseInternalAuthorizationRolesResult = {
  data: InternalAuthorizedUserRole[]
  error: string | null
}

const internalRoleKeys: InternalAuthorizedUserRoleKey[] = [
  "super-admin",
  "admin-administrativo",
  "consulta-interna",
]

function getSupabaseUnavailableError() {
  return "Supabase is required to manage internal authorized users."
}

export async function getSupabaseInternalAuthorizationRoles(): Promise<SupabaseInternalAuthorizationRolesResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return { data: [], error: getSupabaseUnavailableError() }
  }

  const { data, error } = await supabase
    .from("roles")
    .select("id, role_key, name")
    .in("role_key", internalRoleKeys)
    .order("name", { ascending: true })
    .returns<RoleRow[]>()

  if (error) {
    return { data: [], error: error.message }
  }

  return {
    data: (data ?? []).map((role) => ({
      id: role.id,
      key: role.role_key,
      name: role.name,
    })),
    error: null,
  }
}

export async function getSupabaseInternalAuthorizedUsers(): Promise<SupabaseInternalAuthorizedUsersResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return { data: [], error: getSupabaseUnavailableError() }
  }

  const { data: internalUsers, error: internalUsersError } = await readAllPages((start, end) => supabase
    .from("internal_authorized_users")
    .select(
      "id, email, normalized_email, role_id, status, profile_id, notes, invited_at, registered_at, revoked_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(start, end)
    .returns<InternalAuthorizedUserRow[]>())

  if (internalUsersError) {
    return { data: [], error: internalUsersError }
  }

  const roleIds = Array.from(
    new Set((internalUsers ?? []).map((internalUser) => internalUser.role_id))
  )

  if (roleIds.length === 0) {
    return { data: [], error: null }
  }

  const { data: roles, error: rolesError } = await readByIdBatches(
    roleIds,
    (batch, start, end) => supabase.from("roles")
      .select("id, role_key, name").in("id", batch)
      .order("id", { ascending: true }).range(start, end)
      .returns<RoleRow[]>()
  )

  if (rolesError) {
    return { data: [], error: rolesError }
  }

  const rolesById = new Map(
    (roles ?? []).map((role) => [role.id, role] as const)
  )

  return {
    data: (internalUsers ?? []).flatMap((internalUser) => {
      const role = rolesById.get(internalUser.role_id)

      if (!role) {
        return []
      }

      return [
        {
          id: internalUser.id,
          email: internalUser.email,
          normalizedEmail: internalUser.normalized_email,
          roleId: internalUser.role_id,
          roleKey: role.role_key,
          roleName: role.name,
          status: internalUser.status,
          profileId: internalUser.profile_id,
          notes: internalUser.notes,
          invitedAt: internalUser.invited_at,
          registeredAt: internalUser.registered_at,
          revokedAt: internalUser.revoked_at,
          createdAt: internalUser.created_at,
          updatedAt: internalUser.updated_at,
        },
      ]
    }),
    error: null,
  }
}
