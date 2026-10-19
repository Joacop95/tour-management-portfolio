"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { FormEvent, useEffect, useState } from "react"

import {
  classifySupabaseAuthError,
  getCurrentSupabaseSession,
  isLikelyExistingSupabaseAccount,
  resendSupabaseSignupConfirmation,
  signInSupabaseUserWithPassword,
  signOutSupabaseUser,
  signUpSupabaseUserWithPassword,
} from "@/lib/auth/supabase-auth"
import { claimAuthorizedGuideProfile } from "@/lib/supabase/mutations/guide-profile-claim"
import { Button } from "@/components/ui/button"
import { AuthLanguageSelector } from "@/components/auth/auth-language-selector"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type GuideAuthFormProps = {
  mode: "login" | "register"
}

const guidePortalRoutes = [
  "/guide",
  "/guide/groups",
  "/guide/availability",
  "/guide/change-requests",
  "/guide/profile",
]

function getSafeGuideNext(value: string | null) {
  if (!value) return "/guide"

  const internalOrigin = "https://tour-guide-operations.local"
  try {
    const nextUrl = new URL(value, internalOrigin)
    if (nextUrl.origin !== internalOrigin) return "/guide"
    const allowed = guidePortalRoutes.some(
      (route) =>
        nextUrl.pathname === route ||
        (route !== "/guide" && nextUrl.pathname.startsWith(`${route}/`))
    )
    return allowed
      ? `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
      : "/guide"
  } catch {
    return "/guide"
  }
}

export function GuideAuthForm({ mode }: GuideAuthFormProps) {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isRegister = mode === "register"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false)
  const [existingSessionEmail, setExistingSessionEmail] = useState<string | null>(
    null
  )
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isSigningOutExistingSession, setIsSigningOutExistingSession] =
    useState(false)
  const [showExistingAccountHelp, setShowExistingAccountHelp] =
    useState(false)
  const accessWasRevoked = searchParams.get("reason") === "access-revoked"
  const nextPath = getSafeGuideNext(searchParams.get("next"))

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
    setMessage(null)
    setShowExistingAccountHelp(false)

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail || !password) {
      setError(t("guide_portal.guide_auth_form.message_enter_your_authorized_email_and_password"))
      return
    }

    if (isRegister && password !== passwordConfirmation) {
      setError(t("guide_portal.guide_auth_form.message_passwords_do_not_match"))
      return
    }

    setIsSubmitting(true)

    try {
      const authResult = isRegister
        ? await signUpSupabaseUserWithPassword(normalizedEmail, password, {
          emailRedirectPath: "/guide/login",
          signupIntent: "guide",
        })
        : await signInSupabaseUserWithPassword(normalizedEmail, password)

      if (!authResult.success) {
        const errorKind = classifySupabaseAuthError(authResult.error)

        if (isRegister && errorKind === "existing_account") {
          setShowExistingAccountHelp(true)
          setError(t("guide_portal.guide_auth_form.message_this_account_may_already_exist_please_log_in"))
          return
        }

        if (isRegister && errorKind === "unauthorized") {
          setError(t("guide_portal.guide_auth_form.message_this_email_is_not_authorized_for_guide_portal"))
          return
        }

        setError(
          isRegister
            ? t("guide_portal.auth.register_failed")
            : errorKind === "invalid_credentials"
              ? t("guide_portal.auth.invalid_credentials")
              : t("guide_portal.auth.sign_in_failed")
        )
        return
      }

      if (isRegister && !authResult.session) {
        if (isLikelyExistingSupabaseAccount(authResult.user)) {
          setShowExistingAccountHelp(true)
          setError(t("guide_portal.guide_auth_form.message_this_account_may_already_exist_please_log_in"))
          return
        }

        setConfirmationEmail(normalizedEmail)
        setMessage(t("guide_portal.guide_auth_form.message_check_your_email_to_confirm_your_account_then"))
        return
      }

      if (!authResult.session) {
        setError(t("guide_portal.guide_auth_form.message_unable_to_establish_a_guide_portal_session_please"))
        return
      }

      const claimResult = await claimAuthorizedGuideProfile()

      if (!claimResult.success) {
        await signOutSupabaseUser()
        setError(
          claimResult.code === "email_not_authorized"
            ? t("guide_portal.shell.access_unavailable")
            : t("guide_portal.guide_auth_form.message_guide_portal_access_could_not_be_activated_for")
        )
        return
      }

      router.replace(nextPath)
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResendConfirmation() {
    if (!confirmationEmail) {
      return
    }

    setError(null)
    setMessage(null)
    setIsResendingConfirmation(true)

    try {
      const result = await resendSupabaseSignupConfirmation(confirmationEmail)

      if (!result.success) {
        setError(t("guide_portal.guide_auth_form.message_unable_to_resend_the_confirmation_email_please_try"))
        return
      }

      setMessage(t("guide_portal.guide_auth_form.message_if_this_account_needs_confirmation_you_will_receive"))
    } finally {
      setIsResendingConfirmation(false)
    }
  }

  async function handleSignOutExistingSession() {
    setError(null)
    setMessage(null)
    setIsSigningOutExistingSession(true)

    try {
      const result = await signOutSupabaseUser()

      if (result.error) {
        setError(t("guide_portal.guide_auth_form.message_unable_to_sign_out_the_existing_session_please"))
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
          <CardTitle>{isRegister ? t("guide_portal.auth.create_access") : t("guide_portal.auth.login")}</CardTitle>
          <CardDescription>
            {isRegister
              ? t("guide_portal.auth.registration_help")
              : t("guide_portal.auth.login_help")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isCheckingSession ? (
            <p className="text-sm text-muted-foreground"><T i18nKey="guide_portal.guide_auth_form.checking_existing_session" /></p>
          ) : existingSessionEmail ? (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                {accessWasRevoked ? (
                  <T i18nKey="guide_portal.shell.access_help" />
                ) : (
                  <><T i18nKey="guide_portal.guide_auth_form.you_are_already_signed_in_as" /> {existingSessionEmail}<T i18nKey="guide_portal.guide_auth_form.sign_out_before_using_a_different_guide_portal" /></>
                )}
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
                {!accessWasRevoked ? (
                  <Button asChild type="button">
                    <Link href={nextPath}><T i18nKey="auth.open_guide_portal" /></Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="guide-email"><T i18nKey="common.email" /></Label>
              <Input
                id="guide-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guide-password"><T i18nKey="guide_portal.guide_auth_form.password" /></Label>
              <Input
                id="guide-password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            {isRegister ? (
              <div className="space-y-2">
                <Label htmlFor="guide-password-confirmation"><T i18nKey="guide_portal.guide_auth_form.confirm_password" /></Label>
                <Input
                  id="guide-password-confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? (
              <p className="text-sm text-muted-foreground">{message}</p>
            ) : null}
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isRegister
                  ? t("guide_portal.auth.creating_account")
                  : t("auth.signing_in")
                : isRegister
                  ? t("guide_portal.auth.create_account")
                  : t("auth.sign_in")}
            </Button>
            </form>
          )}
          {isRegister && confirmationEmail ? (
            <Button
              className="mt-3 w-full"
              type="button"
              variant="outline"
              onClick={handleResendConfirmation}
              disabled={isSubmitting || isResendingConfirmation}
            >
              {isResendingConfirmation
                ? t("guide_portal.auth.resending_confirmation")
                : t("guide_portal.auth.resend_confirmation")}
            </Button>
          ) : null}
          {!isRegister ? (
            <p className="mt-3 text-center text-sm">
              <Link
                className="text-primary underline-offset-4 hover:underline"
                href="/forgot-password"
              >
                <T i18nKey="guide_portal.guide_auth_form.forgot_password" />
              </Link>
            </p>
          ) : null}
          {isRegister && showExistingAccountHelp ? (
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <Link
                className="text-primary underline-offset-4 hover:underline"
                href="/guide/login"
              >
                <T i18nKey="guide_portal.guide_auth_form.guide_portal_login" />
              </Link>
              <Link
                className="text-primary underline-offset-4 hover:underline"
                href="/forgot-password"
              >
                <T i18nKey="guide_portal.guide_auth_form.reset_password" />
              </Link>
            </div>
          ) : null}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {isRegister ? t("guide_portal.auth.already_have_account") : t("guide_portal.auth.need_register")}{" "}
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href={isRegister ? "/guide/login" : "/guide/register"}
            >
              {isRegister ? t("auth.sign_in") : t("guide_portal.auth.create_access")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
