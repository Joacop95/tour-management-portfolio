import { settingsModules } from "@/lib/mock-data/settings"
import type { CurrentUserAccessResult } from "@/lib/auth/current-user-access"
import { isDevToolsEnabled } from "@/lib/auth/runtime-mode"
import type {
  AppModuleKey,
  AppSettings,
  ModulePermissionKey,
  RoleKey,
} from "@/lib/types/settings"

export const permissionSourceOptions = ["preview", "auth"] as const

export type PermissionSource = (typeof permissionSourceOptions)[number]

export const defaultPermissionSource: PermissionSource = "preview"
export const permissionsUpdatedEvent =
  "tour-guide-operations:real-permissions-updated"

export const previewPermissionKeyMap: Record<ModulePermissionKey, string> = {
  "view-dashboard": "dashboard.view",
  "view-planning": "planning.view",
  "view-groups": "groups.view",
  "create-groups": "groups.create",
  "edit-groups": "groups.edit",
  "assign-guides": "groups.assign_guide",
  "confirm-guides": "groups.confirm_guide",
  "export-groups": "groups.export",
  "view-guides": "guides.view",
  "create-guides": "guides.create",
  "edit-guides": "guides.edit",
  "view-internal-metrics": "guides.view_internal_metrics",
  "view-change-request-metrics": "guides.view_change_request_metrics",
  "view-availability": "availability.view",
  "create-availability": "availability.create",
  "edit-availability": "availability.edit",
  "delete-availability": "availability.delete",
  "view-assignments": "assignments.view",
  "assign-guide": "assignments.assign_guide",
  "change-guide": "assignments.change_guide",
  "confirm-guide": "assignments.confirm_guide",
  "view-change-requests": "change_requests.view",
  "view-import-export": "import_export.view",
  "import-excel": "import_export.import_excel",
  "export-excel": "import_export.export_excel",
  "view-settings": "settings.view",
  "manage-settings": "settings.manage_settings",
  "manage-roles-permissions": "settings.manage_roles_permissions",
  "manage-email-templates": "settings.manage_email_templates",
  "manage-notification-settings": "settings.manage_notification_settings",
  "view-own-profile": "guide_portal.view_own_profile",
  "view-own-groups": "guide_portal.view_own_groups",
  "edit-own-availability": "guide_portal.edit_own_availability",
  "request-group-change": "guide_portal.request_group_change",
}

const moduleViewPermissionKeyMap: Record<AppModuleKey, string> = {
  dashboard: "dashboard.view",
  planning: "planning.view",
  groups: "groups.view",
  guides: "guides.view",
  availability: "availability.view",
  assignments: "assignments.view",
  "change-requests": "change_requests.view",
  "import-export": "import_export.view",
  settings: "settings.view",
  "guide-portal": "guide_portal.view_own_profile",
}

function sortedUnique(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right)
  )
}

export function isPermissionSource(value: unknown): value is PermissionSource {
  return permissionSourceOptions.includes(value as PermissionSource)
}

export function getPreviewPermissionKeys(
  settings: AppSettings,
  role: RoleKey
) {
  const rolePermissions = settings.permissions[role]

  return sortedUnique(
    settingsModules.flatMap((module) => {
      const moduleSettings = rolePermissions[module.key]

      if (!moduleSettings?.access) {
        return []
      }

      return module.permissions
        .filter((permission) => moduleSettings.permissions[permission])
        .map((permission) => previewPermissionKeyMap[permission])
    })
  )
}

export function resolveActivePermissionKeys({
  permissionSource,
  appSettings,
  previewRole,
  authAccess,
}: {
  permissionSource: PermissionSource
  appSettings: AppSettings
  previewRole: RoleKey
  authAccess: CurrentUserAccessResult
}) {
  if (!isDevToolsEnabled) {
    return {
      activePermissionKeys: authAccess.isAuthenticated && authAccess.profileFound
        ? sortedUnique(authAccess.permissionKeys)
        : [],
      effectiveSource: "auth" as const,
      previewPermissionKeys: [],
      warning: null,
    }
  }

  const previewPermissionKeys = getPreviewPermissionKeys(appSettings, previewRole)

  if (permissionSource === "preview") {
    if (authAccess.isAuthenticated && authAccess.profileFound) {
      const realPermissions = new Set(authAccess.permissionKeys)
      return {
        activePermissionKeys: previewPermissionKeys.filter((permissionKey) =>
          realPermissions.has(permissionKey)
        ),
        effectiveSource: "preview" as const,
        previewPermissionKeys,
        warning:
          "Preview can restrict the interface, but it cannot grant permissions the authenticated user does not have.",
      }
    }

    return {
      activePermissionKeys: previewPermissionKeys,
      effectiveSource: "preview" as const,
      previewPermissionKeys,
      warning: null,
    }
  }

  if (authAccess.isAuthenticated && authAccess.permissionKeys.length > 0) {
    return {
      activePermissionKeys: sortedUnique(authAccess.permissionKeys),
      effectiveSource: "auth" as const,
      previewPermissionKeys,
      warning: null,
    }
  }

  return {
    activePermissionKeys: previewPermissionKeys,
    effectiveSource: "preview-fallback" as const,
    previewPermissionKeys,
    warning: authAccess.isAuthenticated
      ? "Auth permissions are not mapped. Falling back to preview role permissions."
      : "No Auth session is active. Falling back to preview role permissions.",
  }
}

export function permissionKeysAllowModule(
  permissionKeys: string[],
  moduleKey: AppModuleKey
) {
  return permissionKeys.includes(moduleViewPermissionKeyMap[moduleKey])
}

export function hasActivePermission(
  permissionKeys: string[],
  permissionKey: string
) {
  return permissionKeys.includes(permissionKey)
}

export function hasAnyActivePermission(
  permissionKeys: string[],
  permissionKeysToCheck: string[]
) {
  return permissionKeysToCheck.some((permissionKey) =>
    hasActivePermission(permissionKeys, permissionKey)
  )
}
