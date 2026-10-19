"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useEffect, useRef, useState } from "react"

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
  classifySupabaseAuthError,
  getCurrentSupabaseSession,
  isLikelyExistingSupabaseAccount,
  onSupabaseAuthStateChange,
  signOutSupabaseUser,
  signUpSupabaseUserWithPassword,
  updateSupabaseUserPassword,
} from "@/lib/auth/supabase-auth"
import { claimAuthorizedInternalProfile } from "@/lib/supabase/mutations/internal-profile-claim"
import { getCurrentUserAccess, hasInternalAdminAccess } from "@/lib/auth/current-user-access"

const minimumPasswordLength = 8

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function InternalActivationForm() {
  const { t } = useI18n()
  const { refresh: refreshAccess } = useCurrentUserAccess()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [existingSessionEmail, setExistingSessionEmail] = useState<string | null>(
    null
  )
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isSigningOutExistingSession, setIsSigningOutExistingSession] =
    useState(false)
  const [inviteSessionUserId, setInviteSessionUserId] = useState<string | null>(null)
  const [hasInvalidLink, setHasInvalidLink] = useState(false)
  const inviteTokenRef = useRef<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const query = new URLSearchParams(window.location.search)
    inviteTokenRef.current = hash.get("type") === "invite" ? hash.get("access_token") : null
    const invalidLink = hash.has("error") || query.has("error") ||
      hash.has("error_code") || query.has("error_code")
    queueMicrotask(() => {
      if (isMounted) setHasInvalidLink(invalidLink)
    })

    function checkInviteSession(session: Awaited<ReturnType<typeof getCurrentSupabaseSession>>) {
      if (!isMounted || !session || !inviteTokenRef.current ||
        session.access_token !== inviteTokenRef.current) return
      setInviteSessionUserId(session.user.id)
      setExistingSessionEmail(session.user.email ?? null)
      setIsCheckingSession(false)
    }

    const unsubscribe = onSupabaseAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") checkInviteSession(session)
      if (event === "SIGNED_OUT" && isMounted) setInviteSessionUserId(null)
    })

    async function loadExistingSession() {
      const session = await getCurrentSupabaseSession()

      if (isMounted) {
        checkInviteSession(session)
        setExistingSessionEmail(session?.user.email ?? null)
        setIsCheckingSession(false)
      }
    }

    void loadExistingSession()

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  async function completeInternalClaim() {
    const claimResult = await claimAuthorizedInternalProfile()
    if (!claimResult.success) {
      await signOutSupabaseUser()
      setError(t("auth.internal_activation_form.message_internal_access_could_not_be_activated_please_contact"))
      return false
    }

    const access = await getCurrentUserAccess()
    if (!hasInternalAdminAccess(access)) {
      setError(t("auth.internal_activation_form.message_internal_access_could_not_be_activated_please_contact"))
      return false
    }

    const refreshedAccess = await refreshAccess()
    if (!refreshedAccess || !hasInternalAdminAccess(refreshedAccess)) {
      setError(t("auth.internal_activation_form.message_internal_access_could_not_be_activated_please_contact"))
      return false
    }
    router.replace("/")
    router.refresh()
    return true
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    const normalizedEmail = email.trim().toLowerCase()

    if (!inviteSessionUserId && !isValidEmail(normalizedEmail)) {
      setError(t("auth.internal_activation_form.message_enter_a_valid_email_address"))
      return
    }

    if (password.length < minimumPasswordLength) {
      setError(t("validation.password_minimum_length", { count: minimumPasswordLength }))
      return
    }

    if (password !== passwordConfirmation) {
      setError(t("auth.internal_activation_form.message_passwords_do_not_match"))
      return
    }

    setIsSubmitting(true)

    try {
      if (inviteSessionUserId) {
        const session = await getCurrentSupabaseSession()
        if (!session || session.user.id !== inviteSessionUserId || hasInvalidLink) {
          setError(t("auth.internal_activation_form.message_internal_access_could_not_be_activated_please_contact"))
          return
        }

        const passwordResult = await updateSupabaseUserPassword(password)
        if (!passwordResult.success) {
          setError(t("auth.reset_password_form.message_unable_to_update_your_password_request_a_new"))
          return
        }

        await completeInternalClaim()
        return
      }

      const authResult = await signUpSupabaseUserWithPassword(
        normalizedEmail,
        password,
        { emailRedirectPath: "/login", signupIntent: "internal" }
      )

      if (!authResult.success) {
        const errorKind = classifySupabaseAuthError(authResult.error)

        setError(
          errorKind === "existing_account"
            ? "If your account already exists, use login or reset your password."
            : errorKind === "unauthorized"
              ? "This email is not authorized for internal access. Please contact an administrator."
              : "Unable to activate internal access. Please try again."
        )
        return
      }

      if (!authResult.session) {
        if (isLikelyExistingSupabaseAccount(authResult.user)) {
          setError(t("auth.internal_activation_form.message_this_account_may_already_exist_please_use_login"))
          return
        }

        setMessage(t("auth.internal_activation_form.message_check_your_email_to_confirm_your_account_then"))
        return
      }

      await completeInternalClaim()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSignOutExistingSession() {
    setError(null)
    setMessage(null)
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
          <CardTitle><T i18nKey="auth.internal_activation_form.activate_internal_access" /></CardTitle>
          <CardDescription>
            <T i18nKey="auth.internal_activation_form.use_the_email_authorized_by_your_administrator_this" />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasInvalidLink ? (
            <p className="text-sm text-destructive">
              <T i18nKey="auth.internal_activation_form.message_internal_access_could_not_be_activated_please_contact" />
            </p>
          ) : null}
          {isCheckingSession ? (
            <p className="text-sm text-muted-foreground"><T i18nKey="auth.internal_activation_form.checking_existing_session" /></p>
          ) : existingSessionEmail && !inviteSessionUserId ? (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                <T i18nKey="auth.internal_activation_form.you_are_already_signed_in_as" /> {existingSessionEmail}<T i18nKey="auth.internal_activation_form.sign_out_before_activating_a_different_internal_account" />
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
                  <Link href="/login"><T i18nKey="auth.forgot_password_form.internal_login" /></Link>
                </Button>
              </div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {!inviteSessionUserId ? (
                <div className="space-y-2">
                  <Label htmlFor="internal-activation-email"><T i18nKey="common.email" /></Label>
                  <Input
                    id="internal-activation-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              ) : null}
            <div className="space-y-2">
              <Label htmlFor="internal-activation-password"><T i18nKey="auth.internal_activation_form.password" /></Label>
              <Input
                id="internal-activation-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internal-activation-password-confirmation">
                <T i18nKey="auth.internal_activation_form.confirm_password" />
              </Label>
              <Input
                id="internal-activation-password-confirmation"
                type="password"
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? (
              <p className="text-sm text-muted-foreground">{message}</p>
            ) : null}
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("auth.activating") : t("auth.activate")}
            </Button>
            </form>
          )}
          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href="/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              <T i18nKey="auth.forgot_password_form.internal_login" />
            </Link>
            <Link
              href="/forgot-password"
              className="text-primary underline-offset-4 hover:underline"
            >
              <T i18nKey="auth.internal_activation_form.reset_password" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
