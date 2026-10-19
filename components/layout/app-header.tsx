"use client"

import { Languages, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { useCurrentUserAccess } from "@/components/layout/current-user-access-provider"

import {
  saveUiLanguage,
  useUiLanguage,
  savePreviewRole,
  usePermissionSource,
  usePreviewRole,
} from "@/components/settings/settings-client-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { signOutSupabaseUser } from "@/lib/auth/supabase-auth"
import { isDevToolsEnabled } from "@/lib/auth/runtime-mode"
import { settingsRoleOptions } from "@/lib/mock-data/settings"
import type { RoleKey } from "@/lib/types/settings"
import type { AppLanguage } from "@/lib/types/settings"
import { useI18n, T } from "@/components/i18n/i18n-provider"

type AppHeaderProps = {
  title?: string
  description?: string
}

const authRolePreviewRoleMap: Partial<Record<string, RoleKey>> = {
  "super-admin": "super-admin",
  "admin-administrativo": "admin-administrativo",
  "consulta-interna": "consulta-interna",
  guide: "guide",
}

export function AppHeader({ title, description }: AppHeaderProps) {
  const router = useRouter()
  const { t } = useI18n()
  const uiLanguage = useUiLanguage()
  const previewRole = usePreviewRole()
  const permissionSource = usePermissionSource()
  const { access: authAccess, isInitialLoading: isAuthAccessLoading } =
    useCurrentUserAccess()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const previewRoleLabel =
    settingsRoleOptions.find((role) => role.value === previewRole)?.label ??
    "Super Admin"
  const authUserTypeLabel = isAuthAccessLoading
    ? t("auth.checking")
    : !authAccess.isAuthenticated
      ? t("auth.not_signed_in")
      : authAccess.roleNames.length > 0
        ? authAccess.roleNames.join(", ")
        : t("auth.no_role_mapped")
  const mappedPreviewRole =
    authAccess.roleKeys.length === 1
      ? authRolePreviewRoleMap[authAccess.roleKeys[0]]
      : undefined
  const canSyncAuthRoleToPreviewRole =
    authAccess.isAuthenticated && Boolean(mappedPreviewRole)
  const previewRoleSyncMessage = !authAccess.isAuthenticated
    ? null
    : authAccess.roleKeys.length === 0
      ? t("auth.preview.no_role_sync")
      : authAccess.roleKeys.length > 1
        ? t("auth.preview.multiple_roles")
        : !mappedPreviewRole
          ? t("auth.preview.unmapped_role")
          : mappedPreviewRole === previewRole
            ? t("auth.preview.matches")
            : null

  function handleUseAuthRoleAsPreviewRole() {
    if (!mappedPreviewRole) {
      return
    }

    savePreviewRole(mappedPreviewRole)
  }

  async function handleSignOut() {
    setIsSigningOut(true)
    setSignOutError(null)

    try {
      const result = await signOutSupabaseUser()

      if (!result.error) {
        router.replace("/login")
        router.refresh()
      } else {
        setSignOutError(result.error)
      }
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 px-4 py-3.5 shadow-[0_1px_0_rgb(15_23_42/0.03)] backdrop-blur md:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold text-foreground">
            {title ?? t("app.name")}
          </h1>
          <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
            {description ?? t("dashboard.header_default_description")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isDevToolsEnabled ? (
          <>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-card/70 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm">
            <Badge variant="secondary" className="h-5 rounded-md px-2 text-[10px]">
              <T i18nKey="layout.app_header.dev_only" />
            </Badge>
            <span>
              <T i18nKey="layout.app_header.auth_user_type" />{" "}
              <span className="font-medium text-foreground">
                {authUserTypeLabel}
              </span>
            </span>
            <span>
              <T i18nKey="layout.app_header.preview_role" />{" "}
              <span className="font-medium text-foreground">
                {previewRoleLabel}
              </span>
            </span>
            <span>
              <T i18nKey="layout.app_header.permission_source" />{" "}
              <span className="font-medium text-foreground">
                {permissionSource === "auth" ? t("auth.user_label") : t("auth.preview_label")}
              </span>
            </span>
            {permissionSource === "auth" &&
            (!authAccess.isAuthenticated ||
              authAccess.permissionKeys.length === 0) ? (
              <span className="text-amber-700">
                <T i18nKey="layout.app_header.auth_permissions_unavailable_using_preview_fallback" />
              </span>
            ) : null}
            {canSyncAuthRoleToPreviewRole ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleUseAuthRoleAsPreviewRole}
              >
                <T i18nKey="layout.app_header.use_auth_role_as_preview_role" />
              </Button>
            ) : null}
            {previewRoleSyncMessage ? (
              <span className="text-muted-foreground">
                {previewRoleSyncMessage}
              </span>
            ) : null}
          </div>
          <Badge variant="outline" className="h-8 rounded-lg border-revival-primary/25 bg-revival-primary/10 px-3 text-foreground">
            {previewRoleLabel}
          </Badge>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground"><T i18nKey="layout.app_header.preview_role_2" /></span>
            <Select
              value={previewRole}
              onValueChange={(value) => savePreviewRole(value as RoleKey)}
            >
              <SelectTrigger aria-label={t("layout.app_header.aria_label_preview_app_as_role")} className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {settingsRoleOptions.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </>
          ) : null}
          <Select
            value={uiLanguage}
            onValueChange={(value) => saveUiLanguage(value as AppLanguage)}
          >
            <SelectTrigger aria-label={t("settings.language.label")} className="h-8">
              <Languages className="size-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="es">ES</SelectItem>
              <SelectItem value="en">EN</SelectItem>
              <SelectItem value="fr">FR</SelectItem>
              <SelectItem value="tr">TR</SelectItem>
            </SelectContent>
          </Select>
          {authAccess.isAuthenticated ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                <LogOut className="size-3.5" />
                {isSigningOut ? t("auth.signing_out") : t("auth.sign_out")}
              </Button>
              {signOutError ? (
                <span className="text-xs text-destructive">{signOutError}</span>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </header>
  )
}
