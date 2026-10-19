"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import Link from "next/link"
import { FormEvent, useState } from "react"

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
import { requestSupabasePasswordReset } from "@/lib/auth/supabase-auth"

export function ForgotPasswordForm() {
  const { t } = useI18n()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setError(t("auth.forgot_password_form.message_enter_your_email_address"))
      return
    }

    setIsSubmitting(true)

    try {
      const result = await requestSupabasePasswordReset(normalizedEmail)

      if (!result.success) {
        setError(t("auth.forgot_password_form.message_unable_to_request_password_reset_instructions_please_try"))
        return
      }

      setIsSubmitted(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-end"><AuthLanguageSelector /></div>
          <CardTitle><T i18nKey="auth.forgot_password_form.reset_your_password" /></CardTitle>
          <CardDescription>
            <T i18nKey="auth.forgot_password_form.enter_your_email_and_we_apos_ll_send" />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSubmitted ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <T i18nKey="auth.forgot_password_form.if_an_account_exists_for_this_email_you" />
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSubmitted(false)}
              >
                <T i18nKey="auth.forgot_password_form.send_another_reset_email" />
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="forgot-password-email"><T i18nKey="common.email" /></Label>
                <Input
                  id="forgot-password-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("auth.sending_instructions") : t("auth.send_reset_instructions")}
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
