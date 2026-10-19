"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { FormEvent, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { AuthLanguageSelector } from "@/components/auth/auth-language-selector"
import { useCurrentUserAccess } from "@/components/layout/current-user-access-provider"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  getCurrentUserAccess,
  hasInternalAdminAccess,
} from "@/lib/auth/current-user-access"
import {
  classifySupabaseAuthError,
  getCurrentSupabaseSession,
  signInSupabaseUserWithPassword,
  signOutSupabaseUser,
} from "@/lib/auth/supabase-auth"
import { claimAuthorizedInternalProfile } from "@/lib/supabase/mutations/internal-profile-claim"

const internalRoutes = [
  "/",
  "/guides",
  "/groups",
  "/availability",
  "/assignments",
  "/change-requests",
  "/planning",
  "/import-export",
  "/settings",
]

function getSafeInternalNext(value: string | null) {
  if (!value) {
    return "/"
  }

  const internalOrigin = "https://tour-guide-operations.local"

  let nextUrl: URL

  try {
    nextUrl = new URL(value, internalOrigin)
  } catch {
    return "/"
  }

  if (nextUrl.origin !== internalOrigin) {
    return "/"
  }

  const pathname = nextUrl.pathname
  const isAllowed = internalRoutes.some(
    (route) =>
      pathname === route ||
      (route !== "/" && pathname.startsWith(`${route}/`))
  )

  return isAllowed ? `${pathname}${nextUrl.search}${nextUrl.hash}` : "/"
}

export function InternalLoginForm() {
  const { t } = useI18n()
  const { refresh: refreshAccess } = useCurrentUserAccess()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [existingSessionEmail, setExistingSessionEmail] = useState<string | null>(
    null
  )
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isSigningOutExistingSession, setIsSigningOutExistingSession] =
    useState(false)
  const [isGuideOnlyUser, setIsGuideOnlyUser] = useState(false)
  const nextPath = getSafeInternalNext(searchParams.get("next"))

  useEffect(() => {
    let isMounted = true

    async function loadExistingSession() {
      const session = await getCurrentSupabaseSession()

      if (isMounted) {
        setExistingSessionEmail(session?.user.email ?? null)
        setIsCheckingSession(false)
      }
    }

    void loadExistingSession()

    return () => {
      isMounted = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsGuideOnlyUser(false)

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail || !password) {
      setError(t("auth.internal_login_form.message_enter_your_email_and_password"))
      return
    }

    setIsSubmitting(true)

    try {
      const authResult = await signInSupabaseUserWithPassword(
        normalizedEmail,
        password
      )

      if (!authResult.success) {
        setError(
          classifySupabaseAuthError(authResult.error) === "invalid_credentials"
            ? "Invalid email or password."
            : "Unable to sign in to internal access."
        )
        return
      }

      let access = await getCurrentUserAccess()

      if (!hasInternalAdminAccess(access) && !access.error) {
        const claimResult = await claimAuthorizedInternalProfile()

        if (!claimResult.success) {
          if (!access.profileFound) {
            await signOutSupabaseUser()
            setError(t("auth.internal_login_form.message_this_account_is_not_authorized_for_internal_access"))
            return
          }
        } else {
          access = await getCurrentUserAccess()
        }
      }

      if (access.error) {
        setError(t("auth.internal_login_form.message_your_account_was_signed_in_but_internal_access"))
        return
      }

      if (hasInternalAdminAccess(access)) {
        const refreshedAccess = await refreshAccess()
        if (!refreshedAccess || !hasInternalAdminAccess(refreshedAccess)) {
          setError(t("auth.internal_login_form.message_your_account_was_signed_in_but_internal_access"))
          return
        }
        router.replace(nextPath)
        router.refresh()
        return
      }

      if (access.roleKeys.includes("guide")) {
        await signOutSupabaseUser()
        setIsGuideOnlyUser(true)
        setError(t("auth.internal_login_form.message_this_login_is_for_internal_users_please_use"))
        return
      }

      if (!access.profileFound) {
        await signOutSupabaseUser()
        setError(t("auth.internal_login_form.message_this_account_has_no_internal_profile_contact_an"))
        return
      }

      await signOutSupabaseUser()
      setError(t("auth.internal_login_form.message_this_account_does_not_have_an_internal_role"))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSignOutExistingSession() {
    setError(null)
    setIsGuideOnlyUser(false)
    setIsSigningOutExistingSession(true)

    try {
      const result = await signOutSupabaseUser()

      if (result.error) {
        setError(t("auth.internal_activation_form.message_unable_to_sign_out_the_existing_session_please"))
        return
      }

      setExistingSessionEmail(null)
    } finally {
      setIsSigningOutExistingSession(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-end"><AuthLanguageSelector /></div>
          <CardTitle><T i18nKey="auth.forgot_password_form.internal_login" /></CardTitle>
          <CardDescription>
            <T i18nKey="auth.internal_login_form.sign_in_with_your_internal_operations_account" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isCheckingSession ? (
            <p className="text-sm text-muted-foreground"><T i18nKey="auth.internal_activation_form.checking_existing_session" /></p>
          ) : existingSessionEmail ? (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                <T i18nKey="auth.internal_activation_form.you_are_already_signed_in_as" /> {existingSessionEmail}<T i18nKey="auth.internal_login_form.sign_out_before_using_a_different_internal_account" />
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSignOutExistingSession}
                  disabled={isSigningOutExistingSession}
                >
                  {isSigningOutExistingSession ? t("auth.signing_out") : t("auth.sign_out")}
                </Button>
                <Button asChild type="button">
                  <Link href="/"><T i18nKey="auth.internal_login_form.open_internal_app" /></Link>
                </Button>
              </div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="internal-email"><T i18nKey="common.email" /></Label>
              <Input
                id="internal-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internal-password"><T i18nKey="auth.internal_activation_form.password" /></Label>
              <Input
                id="internal-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("auth.signing_in") : t("auth.sign_in")}
            </Button>
            </form>
          )}
          {isGuideOnlyUser ? (
            <p className="mt-3 text-center text-sm">
              <Link
                className="text-primary underline-offset-4 hover:underline"
                href="/guide"
              >
                <T i18nKey="auth.open_guide_portal" />
              </Link>
            </p>
          ) : null}
          <p className="mt-3 text-center text-sm">
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="/forgot-password"
            >
              <T i18nKey="auth.internal_login_form.forgot_password" />
            </Link>
          </p>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            <T i18nKey="auth.internal_login_form.first_time_here" />{" "}
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="/activate"
            >
              <T i18nKey="auth.internal_login_form.activate_your_internal_access" />
            </Link>
          </p>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <T i18nKey="auth.internal_login_form.are_you_a_guide" />{" "}
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="/guide"
            >
              <T i18nKey="auth.internal_login_form.open_the_guide_portal" />
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
