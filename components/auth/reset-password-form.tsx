"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import Link from "next/link"
import { FormEvent, useEffect, useRef, useState } from "react"

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
import {
  getCurrentSupabaseSession,
  onSupabaseAuthStateChange,
  updateSupabaseUserPassword,
} from "@/lib/auth/supabase-auth"

const minimumPasswordLength = 8

export function ResetPasswordForm() {
  const { t } = useI18n()
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [isRecoverySessionReady, setIsRecoverySessionReady] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [hasInvalidLink, setHasInvalidLink] = useState(false)
  const recoveryUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const query = new URLSearchParams(window.location.search)
    const invalidLink = hash.has("error") || query.has("error") ||
      hash.has("error_code") || query.has("error_code")
    queueMicrotask(() => {
      if (isMounted) setHasInvalidLink(invalidLink)
    })

    const unsubscribe = onSupabaseAuthStateChange((event, session) => {
      if (!isMounted) return

      if (event === "PASSWORD_RECOVERY" && session && !invalidLink) {
        recoveryUserIdRef.current = session.user.id
        setIsRecoverySessionReady(true)
        setIsCheckingSession(false)
      } else if (event === "SIGNED_OUT" ||
        (event === "SIGNED_IN" && session?.user.id !== recoveryUserIdRef.current)) {
        recoveryUserIdRef.current = null
        setIsRecoverySessionReady(false)
      }
    })

    void getCurrentSupabaseSession().then(() => {
      if (isMounted) setIsCheckingSession(false)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password.length < minimumPasswordLength) {
      setError(t("validation.password_minimum_length", { count: minimumPasswordLength }))
      return
    }

    if (password !== passwordConfirmation) {
      setError(t("auth.internal_activation_form.message_passwords_do_not_match"))
      return
    }

    if (!isRecoverySessionReady) {
      setError(t("auth.reset_password_form.message_open_the_password_reset_link_from_your_email"))
      return
    }

    setIsSubmitting(true)

    try {
      const session = await getCurrentSupabaseSession()
      if (!session || session.user.id !== recoveryUserIdRef.current) {
        setIsRecoverySessionReady(false)
        setError(t("auth.reset_password_form.message_open_the_password_reset_link_from_your_email"))
        return
      }

      const result = await updateSupabaseUserPassword(password)

      if (!result.success) {
        setError(t("auth.reset_password_form.message_unable_to_update_your_password_request_a_new"))
        return
      }

      setPassword("")
      setPasswordConfirmation("")
      recoveryUserIdRef.current = null
      setIsRecoverySessionReady(false)
      setIsComplete(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-end"><AuthLanguageSelector /></div>
          <CardTitle><T i18nKey="auth.reset_password_form.choose_a_new_password" /></CardTitle>
          <CardDescription>
            <T i18nKey="auth.reset_password_form.set_a_new_password_for_your_existing_account" />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isComplete ? (
            <p className="text-sm text-muted-foreground">
              <T i18nKey="auth.reset_password_form.your_password_has_been_updated_you_can_now" />
            </p>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="reset-password"><T i18nKey="auth.reset_password_form.new_password" /></Label>
                <Input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isSubmitting || isCheckingSession}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-password-confirmation">
                  <T i18nKey="auth.reset_password_form.confirm_new_password" />
                </Label>
                <Input
                  id="reset-password-confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  disabled={isSubmitting || isCheckingSession}
                  required
                />
              </div>
              {isCheckingSession ? (
                <p className="text-sm text-muted-foreground">
                  <T i18nKey="auth.reset_password_form.checking_password_reset_session" />
                </p>
              ) : null}
              {!isCheckingSession && !isRecoverySessionReady ? (
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    <T i18nKey={hasInvalidLink
                      ? "auth.reset_password_form.message_unable_to_update_your_password_request_a_new"
                      : "auth.reset_password_form.open_this_page_from_the_password_reset_email"} />
                  </p>
                  <Link
                    href="/forgot-password"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    <T i18nKey="auth.reset_password_form.request_a_new_reset_link" />
                  </Link>
                </div>
              ) : null}
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button
                className="w-full"
                type="submit"
                disabled={isSubmitting || isCheckingSession || !isRecoverySessionReady}
              >
                {isSubmitting ? t("auth.updating_password") : t("auth.update_password")}
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
              href="/guide/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              <T i18nKey="auth.forgot_password_form.guide_portal_login" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
