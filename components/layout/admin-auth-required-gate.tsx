"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LoaderCircle, Lock, UserRoundX } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useCurrentUserAccess } from "@/components/layout/current-user-access-provider"
import { useI18n, T } from "@/components/i18n/i18n-provider"

import {
  useAuthRequiredMode,
  useIsHydrated,
  usePermissionSource,
} from "@/components/settings/settings-client-store"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatePanel } from "@/components/ui/state-panel"
import { getCurrentUserAccess, hasInternalAdminAccess } from "@/lib/auth/current-user-access"
import { isAuthRequiredEnabled } from "@/lib/auth/auth-required-mode"
import { claimAuthorizedInternalProfile } from "@/lib/supabase/mutations/internal-profile-claim"

function isAdminRoute(pathname: string) {
  if (pathname === "/dev" || pathname.startsWith("/dev/")) {
    return false
  }

  if (pathname === "/guide" || pathname.startsWith("/guide/")) {
    return false
  }

  return (
    pathname === "/" ||
    pathname === "/guides" ||
    pathname === "/groups" ||
    pathname === "/availability" ||
    pathname === "/assignments" ||
    pathname === "/change-requests" ||
    pathname === "/planning" ||
    pathname === "/import-export" ||
    pathname === "/settings"
  )
}

function BlockedState({
  title,
  description,
  detail,
  primaryHref,
  primaryLabel,
  actionLabel,
  onAction,
  isActionPending,
  actionError,
}: {
  title: string
  description: string
  detail: string
  primaryHref: string
  primaryLabel: string
  actionLabel?: string
  onAction?: () => void
  isActionPending?: boolean
  actionError?: string | null
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
              <Lock className="size-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{detail}</p>
          {actionError ? <p className="text-destructive">{actionError}</p> : null}
          <div className="flex flex-wrap gap-3 pt-1">
            {onAction ? (
              <Button type="button" size="sm" disabled={isActionPending} onClick={onAction}>
                {actionLabel}
              </Button>
            ) : null}
            <Link
              href={primaryHref}
              className="inline-flex text-primary underline-offset-4 hover:underline"
            >
              {primaryLabel}
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

export function AdminAuthRequiredGate({
  children,
}: {
  children: React.ReactNode
}) {
  const { t } = useI18n()
  const pathname = usePathname()
  const router = useRouter()
  const isHydrated = useIsHydrated()
  const authRequiredMode = useAuthRequiredMode()
  const permissionSource = usePermissionSource()
  const { access: authAccess, isInitialLoading: isLoadingAuthAccess, refresh: refreshAccess } =
    useCurrentUserAccess()
  const [isCompletingSetup, setIsCompletingSetup] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const completingSetupRef = useRef(false)
  const isEnabled = isAuthRequiredEnabled(authRequiredMode)
  const shouldGuardRoute = isAdminRoute(pathname)
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`

  useEffect(() => {
    if (
      isHydrated &&
      isEnabled &&
      shouldGuardRoute &&
      !isLoadingAuthAccess &&
      !authAccess.isAuthenticated
    ) {
      router.replace(loginHref)
    }
  }, [
    authAccess.isAuthenticated,
    isEnabled,
    isHydrated,
    isLoadingAuthAccess,
    loginHref,
    router,
    shouldGuardRoute,
  ])

  async function handleCompleteSetup() {
    if (completingSetupRef.current || !authAccess.isAuthenticated) return
    completingSetupRef.current = true
    setIsCompletingSetup(true)
    setSetupError(null)

    try {
      const claim = await claimAuthorizedInternalProfile()
      if (!claim.success) {
        setSetupError(t("auth.internal_activation_form.message_internal_access_could_not_be_activated_please_contact"))
        return
      }

      const nextAccess = await getCurrentUserAccess()
      if (!hasInternalAdminAccess(nextAccess)) {
        setSetupError(t("auth.internal_activation_form.message_internal_access_could_not_be_activated_please_contact"))
        return
      }

      const refreshedAccess = await refreshAccess()
      if (!refreshedAccess || !hasInternalAdminAccess(refreshedAccess)) {
        setSetupError(t("auth.internal_activation_form.message_internal_access_could_not_be_activated_please_contact"))
      }
    } catch {
      setSetupError(t("auth.internal_activation_form.message_internal_access_could_not_be_activated_please_contact"))
    } finally {
      completingSetupRef.current = false
      setIsCompletingSetup(false)
    }
  }

  const completeSetupAction = {
    actionLabel: t("auth.internal_activation_form.activate_internal_access"),
    onAction: handleCompleteSetup,
    isActionPending: isCompletingSetup,
    actionError: setupError,
  }

  if (!isHydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <StatePanel
          className="w-full max-w-xl bg-background"
          icon={LoaderCircle}
          title={t("auth.loading_workspace.title")}
          description={t("auth.loading_workspace.description")}
        />
      </main>
    )
  }

  if (!isEnabled || !shouldGuardRoute) {
    return <>{children}</>
  }

  if (isLoadingAuthAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <StatePanel
          className="w-full max-w-xl bg-background"
          icon={LoaderCircle}
          title={t("auth.checking_access.title")}
          description={t("auth.checking_access.description")}
        />
      </main>
    )
  }

  if (!authAccess.isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <StatePanel
          className="w-full max-w-xl bg-background"
          icon={LoaderCircle}
          title={t("auth.checking_access.title")}
          description={t("auth.checking_access.description")}
        />
      </main>
    )
  }

  if (authAccess.error) {
    return (
      <BlockedState
        title={t("auth.access_denied.title")}
        description={t("auth.internal_login_form.message_your_account_was_signed_in_but_internal_access")}
        detail={t("auth.account_setup_incomplete.detail")}
        primaryHref={loginHref}
        primaryLabel={t("auth.open_internal_login")}
      />
    )
  }

  if (!authAccess.profileFound) {
    return (
      <BlockedState
        {...completeSetupAction}
        title={t("auth.account_setup_incomplete.title")}
        description={t("auth.account_setup_incomplete.description")}
        detail={t("auth.account_setup_incomplete.detail")}
        primaryHref={loginHref}
        primaryLabel={t("auth.open_internal_login")}
      />
    )
  }

  if (authAccess.roleKeys.length === 0) {
    return (
      <BlockedState
        {...completeSetupAction}
        title={t("auth.role_required.title")}
        description={t("auth.role_required.description")}
        detail={t("auth.role_required.detail")}
        primaryHref={loginHref}
        primaryLabel={t("auth.open_internal_login")}
      />
    )
  }

  if (!hasInternalAdminAccess(authAccess)) {
    if (authAccess.roleKeys.includes("guide")) {
      return (
        <BlockedState
          {...completeSetupAction}
          title={t("auth.internal_access_required.title")}
          description={t("auth.guide_internal_denied.description")}
          detail={t("auth.guide_internal_denied.detail")}
          primaryHref="/guide"
          primaryLabel={t("auth.open_guide_portal")}
        />
      )
    }

    return (
      <BlockedState
        {...completeSetupAction}
        title={t("auth.internal_access_required.title")}
        description={t("auth.internal_role_missing.description")}
        detail={t("auth.internal_role_missing.detail")}
        primaryHref={loginHref}
        primaryLabel={t("auth.open_internal_login")}
      />
    )
  }

  return (
    <div className="space-y-4">
      {permissionSource === "preview" ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex gap-2 py-3 text-sm text-amber-900">
            <UserRoundX className="mt-0.5 size-4 shrink-0" />
            <span>
              <T i18nKey="layout.admin_auth_required_gate.auth_required_mode_is_enabled_use_auth_permission" />
            </span>
          </CardContent>
        </Card>
      ) : null}
      {children}
    </div>
  )
}
