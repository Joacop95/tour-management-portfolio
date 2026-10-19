import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type ReplaceRolePermissionsRow = {
  success: boolean
  code: string
  message: string
}

export async function replaceRealRolePermissions(
  roleId: string,
  permissionKeys: string[]
) {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    return { success: false, message: "Supabase is unavailable." }
  }

  const { data, error } = await supabase.rpc("replace_role_permissions", {
    p_role_id: roleId,
    p_permission_keys: permissionKeys,
  })

  if (error) {
    return { success: false, message: "Role permissions could not be saved." }
  }

  const row = (Array.isArray(data) ? data[0] : null) as
    | ReplaceRolePermissionsRow
    | undefined
  return {
    success: Boolean(row?.success),
    message: row?.message ?? "Role permissions could not be saved.",
  }
}
