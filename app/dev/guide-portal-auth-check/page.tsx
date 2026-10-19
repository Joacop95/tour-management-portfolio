"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  saveGuidePortalSource,
  useGuidePortalSource,
} from "@/components/settings/settings-client-store"
import {
  emptyGuidePortalIdentity,
  getCurrentGuidePortalIdentity,
  type GuidePortalIdentityResult,
} from "@/lib/auth/guide-portal-auth"
import { onSupabaseAuthStateChange } from "@/lib/auth/supabase-auth"

function getStateLabel(status: GuidePortalIdentityResult["status"]) {
  switch (status) {
    case "not_signed_in":
      return "Not signed in"
    case "no_profile":
      return "No profile"
    case "no_guide_linked":
      return "No guide linked"
    case "ready":
      return "Ready"
    case "error":
      return "Error"
  }
}

function getStateVariant(status: GuidePortalIdentityResult["status"]) {
  return status === "ready" ? "default" : "outline"
}

function formatValue(value: string | null) {
  return value ?? "-"
}

export default function GuidePortalAuthCheckPage() {
  const guidePortalSource = useGuidePortalSource()
  const [identity, setIdentity] = useState<GuidePortalIdentityResult>(
    emptyGuidePortalIdentity
  )
  const [isLoading, setIsLoading] = useState(true)

  const loadIdentity = useCallback(async () => {
    setIsLoading(true)
    const nextIdentity = await getCurrentGuidePortalIdentity()
    setIdentity(nextIdentity)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => {
      void loadIdentity()
    }, 0)

    const unsubscribe = onSupabaseAuthStateChange(() => {
      void loadIdentity()
    })

    return () => {
      window.clearTimeout(initialLoadId)
      unsubscribe()
    }
  }, [loadIdentity])

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div>
          <Badge variant="outline">Development only</Badge>
          <h1 className="mt-3 text-2xl font-semibold">
            Guide Portal Auth Check
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Verifies the Guide Portal Auth identity resolver and source mode.
            This page does not enforce permissions or change admin routes.
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <Link
              href="/dev/auth-status"
              className="text-primary underline-offset-4 hover:underline"
            >
              Auth status
            </Link>
            <Link
              href="/dev/rls-helper-check"
              className="text-primary underline-offset-4 hover:underline"
            >
              RLS helper check
            </Link>
            <Link
              href="/guide"
              className="text-primary underline-offset-4 hover:underline"
            >
              Guide Portal preview
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Guide Portal Source Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-[260px_1fr] md:items-center">
            <Select
              value={guidePortalSource}
              onValueChange={(value) =>
                saveGuidePortalSource(value as "preview" | "auth")
              }
            >
              <SelectTrigger aria-label="Guide Portal source mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="preview">Preview guide</SelectItem>
                <SelectItem value="auth">Auth guide</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-slate-600">
              Current mode:{" "}
              <Badge
                variant={guidePortalSource === "auth" ? "default" : "outline"}
              >
                {guidePortalSource === "auth" ? "Auth guide" : "Preview guide"}
              </Badge>{" "}
              <span className="ml-1">
                Auth is the default. Preview remains available as a local
                development fallback.
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="text-base">Resolver State</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadIdentity()}
              disabled={isLoading}
            >
              {isLoading ? "Checking..." : "Refresh"}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-4">
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                State
              </div>
              <Badge variant={getStateVariant(identity.status)}>
                {isLoading ? "Checking" : getStateLabel(identity.status)}
              </Badge>
            </div>
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Auth email
              </div>
              <div>{formatValue(identity.userEmail)}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Profile
              </div>
              <div>{formatValue(identity.profileFullName)}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Guide
              </div>
              <div>{formatValue(identity.guideDisplayName)}</div>
            </div>
          </CardContent>
        </Card>

        {identity.error ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4 text-sm text-red-800">
              {identity.error}
            </CardContent>
          </Card>
        ) : null}

        {!isLoading && identity.status === "not_signed_in" ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-4 text-sm text-amber-900">
              Sign in through{" "}
              <Link
                href="/dev/auth-status"
                className="font-medium underline-offset-4 hover:underline"
              >
                /dev/auth-status
              </Link>{" "}
              to test Guide Portal Auth identity mapping.
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Safe Debug Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Auth user id
              </div>
              <div className="break-all font-mono text-xs">
                {formatValue(identity.userId)}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Profile id
              </div>
              <div className="break-all font-mono text-xs">
                {formatValue(identity.profileId)}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Guide id
              </div>
              <div className="break-all font-mono text-xs">
                {formatValue(identity.guideId)}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Guide status
              </div>
              <div>{formatValue(identity.guideStatus)}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Guide email
              </div>
              <div>{formatValue(identity.guideEmail)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Expected States</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p>
              Logged out: <span className="font-medium">not_signed_in</span>.
            </p>
            <p>
              Signed in without a mapped profile:{" "}
              <span className="font-medium">no_profile</span>.
            </p>
            <p>
              Signed in with a profile but no linked guide:{" "}
              <span className="font-medium">no_guide_linked</span>.
            </p>
            <p>
              Signed in with `profiles.guide_id`:{" "}
              <span className="font-medium">ready</span>.
            </p>
          </CardContent>
        </Card>

        <p className="text-xs text-slate-500">
          This page uses the browser anon client and authenticated browser
          session for local development verification only. It does not display
          access tokens, refresh tokens, anon keys, service role keys, database
          URLs, passwords, or environment variable values.
        </p>
      </div>
    </main>
  )
}
