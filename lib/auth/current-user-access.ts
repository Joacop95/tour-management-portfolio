import { getCurrentSupabaseUser } from "@/lib/auth/supabase-auth"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export type CurrentUserAccessResult = {
  isAuthenticated: boolean
  userEmail: string | null
  userId: string | null
  profileFound: boolean
  profileFullName: string | null
  linkedGuideId: string | null
  roleKeys: string[]
  roleNames: string[]
  permissionKeys: string[]
  error: string | null
}

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  guide_id: string | null
}

type UserRoleRow = {
  role_id: string
}

type RoleRow = {
  id: string
  role_key: string | null
  name: string | null
}

type RolePermissionRow = {
  permission_id: string
}

type PermissionRow = {
  permission_key: string | null
}

export const emptyCurrentUserAccess: CurrentUserAccessResult = {
  isAuthenticated: false,
  userEmail: null,
  userId: null,
  profileFound: false,
  profileFullName: null,
  linkedGuideId: null,
  roleKeys: [],
  roleNames: [],
  permissionKeys: [],
  error: null,
}

const internalRoleKeys = new Set([
  "super-admin",
  "admin-administrativo",
  "consulta-interna",
])

export function hasInternalAdminAccess(access: CurrentUserAccessResult) {
  return (
    access.profileFound &&
    access.roleKeys.some((roleKey) => internalRoleKeys.has(roleKey))
  )
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values))
}

export async function getCurrentUserAccess(): Promise<CurrentUserAccessResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return {
      ...emptyCurrentUserAccess,
      error: "Supabase environment variables are not configured.",
    }
  }

  const user = await getCurrentSupabaseUser()

  if (!user) {
    return emptyCurrentUserAccess
  }

  const baseAccess: CurrentUserAccessResult = {
    ...emptyCurrentUserAccess,
    isAuthenticated: true,
    userEmail: user.email ?? null,
    userId: user.id,
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, guide_id")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    return {
      ...baseAccess,
      error: profileError.message,
    }
  }

  if (!profileData) {
    return baseAccess
  }

  const profile = profileData as ProfileRow
  const accessWithProfile: CurrentUserAccessResult = {
    ...baseAccess,
    userEmail: profile.email ?? baseAccess.userEmail,
    profileFound: true,
    profileFullName: profile.full_name,
    linkedGuideId: profile.guide_id,
  }

  const { data: userRoleData, error: userRoleError } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("profile_id", profile.id)

  if (userRoleError) {
    return {
      ...accessWithProfile,
      error: userRoleError.message,
    }
  }

  const roleIds = uniqueValues(
    ((userRoleData ?? []) as UserRoleRow[])
      .map((userRole) => userRole.role_id)
      .filter(Boolean)
  )

  if (roleIds.length === 0) {
    return accessWithProfile
  }

  const { data: roleData, error: roleError } = await supabase
    .from("roles")
    .select("id, role_key, name")
    .in("id", roleIds)

  if (roleError) {
    return {
      ...accessWithProfile,
      error: roleError.message,
    }
  }

  const roles = (roleData ?? []) as RoleRow[]
  const accessWithRoles: CurrentUserAccessResult = {
    ...accessWithProfile,
    roleKeys: uniqueValues(
      roles.map((role) => role.role_key).filter((key): key is string => Boolean(key))
    ),
    roleNames: uniqueValues(
      roles.map((role) => role.name).filter((name): name is string => Boolean(name))
    ),
  }

  const { data: rolePermissionData, error: rolePermissionError } = await supabase
    .from("role_permissions")
    .select("permission_id")
    .in("role_id", roleIds)

  if (rolePermissionError) {
    return {
      ...accessWithRoles,
      error: rolePermissionError.message,
    }
  }

  const permissionIds = uniqueValues(
    ((rolePermissionData ?? []) as RolePermissionRow[])
      .map((rolePermission) => rolePermission.permission_id)
      .filter(Boolean)
  )

  if (permissionIds.length === 0) {
    return accessWithRoles
  }

  const { data: permissionData, error: permissionError } = await supabase
    .from("permissions")
    .select("permission_key")
    .in("id", permissionIds)

  if (permissionError) {
    return {
      ...accessWithRoles,
      error: permissionError.message,
    }
  }

  return {
    ...accessWithRoles,
    permissionKeys: uniqueValues(
      ((permissionData ?? []) as PermissionRow[])
        .map((permission) => permission.permission_key)
        .filter((permission): permission is string => Boolean(permission))
    ),
  }
}
