import {
  defaultAppSettings,
  emailTemplateTypes,
  notificationTypes,
  settingsModules,
  settingsRoleOptions,
} from "@/lib/mock-data/settings"
import {
  defaultPermissionSource,
  isPermissionSource,
  type PermissionSource,
} from "@/lib/auth/permission-source"
import {
  defaultAuthRequiredMode,
  isAuthRequiredMode,
  type AuthRequiredMode,
} from "@/lib/auth/auth-required-mode"
import {
  defaultGuidePortalSource,
  isGuidePortalSource,
  type GuidePortalSource,
} from "@/lib/auth/guide-portal-source"
import type { AppLanguage, AppModuleKey, AppSettings, RoleKey } from "@/lib/types/settings"
import { localStorageKeys, readLocalStorageValue } from "@/lib/utils/local-storage"
import { isDevToolsEnabled } from "@/lib/auth/runtime-mode"

const normalizedSettingsCache = new WeakMap<AppSettings, AppSettings>()
type LegacyNotificationSettings = {
  recipientRoles?: RoleKey[]
  manualEmails?: string
}

export const defaultPreviewRole: RoleKey = "super-admin"

export function cloneAppSettings(settings: AppSettings) {
  return JSON.parse(JSON.stringify(settings)) as AppSettings
}

export function normalizeAppSettings(settings: AppSettings) {
  const source = settings ?? defaultAppSettings
  const cachedSettings = normalizedSettingsCache.get(source)

  if (cachedSettings) {
    return cachedSettings
  }

  const defaults = cloneAppSettings(defaultAppSettings)
  const normalizedSettings: AppSettings = {
    ...defaults,
    ...source,
    general: { ...defaults.general, ...source.general },
    display: { ...defaults.display, ...source.display },
    availability: { ...defaults.availability, ...source.availability },
    guideMetrics: { ...defaults.guideMetrics, ...source.guideMetrics },
    notifications: Object.fromEntries(
      notificationTypes.map((type) => {
        const sourceNotification = source.notifications?.[type] as
          | (AppSettings["notifications"][typeof type] &
              LegacyNotificationSettings)
          | undefined

        return [
          type,
          {
            ...defaults.notifications[type],
            ...sourceNotification,
            internalCopyRoleIds:
              sourceNotification?.internalCopyRoleIds ??
              sourceNotification?.recipientRoles ??
              defaults.notifications[type].internalCopyRoleIds,
            manualCopyEmails:
              sourceNotification?.manualCopyEmails ??
              sourceNotification?.manualEmails ??
              defaults.notifications[type].manualCopyEmails,
            senderRoleIds:
              sourceNotification?.senderRoleIds ??
              defaults.notifications[type].senderRoleIds,
          },
        ]
      })
    ) as AppSettings["notifications"],
    emailTemplates: Object.fromEntries(
      emailTemplateTypes.map((type) => [
        type,
        {
          ...defaults.emailTemplates[type],
          ...source.emailTemplates?.[type],
          subject: {
            ...defaults.emailTemplates[type].subject,
            ...source.emailTemplates?.[type]?.subject,
          },
          body: {
            ...defaults.emailTemplates[type].body,
            ...source.emailTemplates?.[type]?.body,
          },
        },
      ])
    ) as AppSettings["emailTemplates"],
    permissions: Object.fromEntries(
      settingsRoleOptions.map((role) => [
        role.value,
        Object.fromEntries(
          settingsModules.map((module) => [
            module.key,
            {
              ...defaults.permissions[role.value][module.key],
              ...source.permissions?.[role.value]?.[module.key],
              permissions: {
                ...defaults.permissions[role.value][module.key].permissions,
                ...source.permissions?.[role.value]?.[module.key]?.permissions,
              },
            },
          ])
        ),
      ])
    ) as AppSettings["permissions"],
  }

  normalizedSettingsCache.set(source, normalizedSettings)

  return normalizedSettings
}

export function getStoredAppSettings() {
  return normalizeAppSettings(
    readLocalStorageValue<AppSettings>(
      localStorageKeys.appSettings,
      defaultAppSettings
    )
  )
}

export function getDefaultAppSettings() {
  return normalizeAppSettings(defaultAppSettings)
}

export function getStoredUiLanguage(): AppLanguage {
  const storedLanguage = readLocalStorageValue<AppLanguage | null>(
    localStorageKeys.uiLanguage,
    null
  )
  if (storedLanguage && ["en", "es", "fr", "tr"].includes(storedLanguage)) {
    return storedLanguage
  }
  return getStoredAppSettings().general.defaultLanguage
}

export function getDefaultUiLanguage(): AppLanguage {
  return defaultAppSettings.general.defaultLanguage
}

export function getStoredPreviewRole() {
  if (!isDevToolsEnabled) return defaultPreviewRole
  const storedRole = readLocalStorageValue<RoleKey>(
    localStorageKeys.previewRole,
    defaultPreviewRole
  )

  if (settingsRoleOptions.some((role) => role.value === storedRole)) {
    return storedRole
  }

  return defaultPreviewRole
}

export function getDefaultPreviewRole() {
  return defaultPreviewRole
}

export function getStoredPermissionSource() {
  if (!isDevToolsEnabled) return "auth" as const
  const storedSource = readLocalStorageValue<PermissionSource>(
    localStorageKeys.permissionSource,
    defaultPermissionSource
  )

  if (isPermissionSource(storedSource)) {
    return storedSource
  }

  return defaultPermissionSource
}

export function getDefaultPermissionSource() {
  return isDevToolsEnabled ? defaultPermissionSource : "auth" as const
}

export function getStoredAuthRequiredMode() {
  if (!isDevToolsEnabled) return "enabled" as const
  const storedMode = readLocalStorageValue<AuthRequiredMode>(
    localStorageKeys.authRequiredMode,
    defaultAuthRequiredMode
  )

  if (isAuthRequiredMode(storedMode)) {
    return storedMode
  }

  return defaultAuthRequiredMode
}

export function getDefaultAuthRequiredMode() {
  return isDevToolsEnabled ? defaultAuthRequiredMode : "enabled" as const
}

export function getStoredGuidePortalSource() {
  if (!isDevToolsEnabled) return "auth" as const
  const storedSource = readLocalStorageValue<GuidePortalSource>(
    localStorageKeys.guidePortalSource,
    defaultGuidePortalSource
  )

  if (isGuidePortalSource(storedSource)) {
    return storedSource
  }

  return defaultGuidePortalSource
}

export function getDefaultGuidePortalSource() {
  return isDevToolsEnabled ? defaultGuidePortalSource : "auth" as const
}

export function getStoredPreviewGuideId() {
  if (!isDevToolsEnabled) return ""
  return readLocalStorageValue<string>(localStorageKeys.previewGuideId, "")
}

export function getModuleForPath(pathname: string): AppModuleKey {
  if (pathname === "/guide" || pathname.startsWith("/guide/")) {
    return "dashboard"
  }

  if (pathname === "/") {
    return "dashboard"
  }

  const matchingModule = settingsModules
    .filter((module) => module.href !== "/")
    .find(
      (module) =>
        pathname === module.href || pathname.startsWith(`${module.href}/`)
    )

  return matchingModule?.key ?? "dashboard"
}

export function roleHasModuleAccess(
  settings: AppSettings,
  role: RoleKey,
  moduleKey: AppModuleKey
) {
  if (role === "super-admin") {
    return true
  }

  if (role === "guide") {
    return false
  }

  return Boolean(settings.permissions[role]?.[moduleKey]?.access)
}

export function isGuidePortalPath(pathname: string) {
  return pathname === "/guide" || pathname.startsWith("/guide/")
}
