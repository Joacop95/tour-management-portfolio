import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { readAllPages } from "@/lib/supabase/queries/paginated-read"

export type RealRole = {
  id: string
  key: string
  name: string
}

export type RealPermission = {
  id: string
  key: string
  moduleKey: string
  name: string
  description: string | null
}

export type RealRolePermissionMatrix = {
  roles: RealRole[]
  permissions: RealPermission[]
  permissionKeysByRoleId: Record<string, string[]>
}

export async function getRealRolePermissionMatrix(): Promise<{
  data: RealRolePermissionMatrix | null
  error: string | null
}> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return { data: null, error: "Supabase is unavailable." }
  }

  const [rolesResult, permissionsResult, grantsResult] = await Promise.all([
    readAllPages((start, end) => supabase
      .from("roles")
      .select("id, role_key, name")
      .neq("role_key", "guide")
      .order("name")
      .order("id")
      .range(start, end)),
    readAllPages((start, end) => supabase
      .from("permissions")
      .select("id, permission_key, module_key, name, description")
      .order("module_key")
      .order("permission_key")
      .order("id")
      .range(start, end)),
    readAllPages((start, end) => supabase.from("role_permissions")
      .select("role_id, permission_id")
      .order("role_id")
      .order("permission_id")
      .range(start, end)),
  ])

  const error = rolesResult.error ?? permissionsResult.error ?? grantsResult.error
  if (error) {
    return { data: null, error: "Unable to load real role permissions." }
  }

  const roles = (rolesResult.data ?? []).map((role) => ({
    id: role.id,
    key: role.role_key,
    name: role.name,
  }))
  const permissions = (permissionsResult.data ?? []).map((permission) => ({
    id: permission.id,
    key: permission.permission_key,
    moduleKey: permission.module_key,
    name: permission.name,
    description: permission.description,
  }))
  const permissionKeyById = new Map(
    permissions.map((permission) => [permission.id, permission.key])
  )
  const permissionKeysByRoleId = Object.fromEntries(
    roles.map((role) => [role.id, [] as string[]])
  )

  for (const grant of grantsResult.data ?? []) {
    const permissionKey = permissionKeyById.get(grant.permission_id)
    if (permissionKey && permissionKeysByRoleId[grant.role_id]) {
      permissionKeysByRoleId[grant.role_id].push(permissionKey)
    }
  }

  return {
    data: { roles, permissions, permissionKeysByRoleId },
    error: null,
  }
}
