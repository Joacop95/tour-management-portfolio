"use client"

import { usePathname } from "next/navigation"
import { LoaderCircle, Lock } from "lucide-react"
import { useCurrentUserAccess } from "@/components/layout/current-user-access-provider"
import { useI18n } from "@/components/i18n/i18n-provider"

import {
  useIsHydrated,
  useAppSettings,
  usePermissionSource,
  usePreviewRole,
} from "@/components/settings/settings-client-store"
import { StatePanel } from "@/components/ui/state-panel"
import { hasInternalAdminAccess } from "@/lib/auth/current-user-access"
import {
  permissionKeysAllowModule,
  resolveActivePermissionKeys,
} from "@/lib/auth/permission-source"
import {
  getModuleForPath,
  isGuidePortalPath,
} from "@/lib/utils/settings-access"

export function MockAccessGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n()
  const pathname = usePathname()
  const isHydrated = useIsHydrated()
  const appSettings = useAppSettings()
  const previewRole = usePreviewRole()
  const permissionSource = usePermissionSource()
  const { access: authAccess, isInitialLoading: isLoadingAuthAccess } =
    useCurrentUserAccess()
  const moduleKey = getModuleForPath(pathname)
  const isPortalPath = isGuidePortalPath(pathname)
  const activePermissionResolution = resolveActivePermissionKeys({
    permissionSource,
    appSettings,
    previewRole,
    authAccess,
  })
  const hasAccess = isPortalPath
    ? true
    : authAccess.isAuthenticated
      ? hasInternalAdminAccess(authAccess) &&
        permissionKeysAllowModule(authAccess.permissionKeys, moduleKey)
      : permissionKeysAllowModule(
          activePermissionResolution.activePermissionKeys,
          moduleKey
        )

  if (!isHydrated || isLoadingAuthAccess) {
    return (
      <StatePanel
        icon={LoaderCircle}
        title={t("auth.checking_access.title")}
        description={t("auth.module_loading.description")}
      />
    )
  }

  if (!hasAccess) {
    return (
      <StatePanel
        icon={Lock}
        title={t("auth.access_denied.title")}
        description={t("auth.access_denied.description")}
      >
        {!authAccess.isAuthenticated && activePermissionResolution.warning ? (
          <p className="text-xs text-muted-foreground">
            {activePermissionResolution.warning}
          </p>
        ) : null}
      </StatePanel>
    )
  }

  return <>{children}</>
}
