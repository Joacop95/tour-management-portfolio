"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  saveAuthRequiredMode,
  useAuthRequiredMode,
} from "@/components/settings/settings-client-store"
import {
  emptyCurrentUserAccess,
  getCurrentUserAccess,
  type CurrentUserAccessResult,
} from "@/lib/auth/current-user-access"
import {
  getCurrentSupabaseSession,
  onSupabaseAuthStateChange,
  signInSupabaseUserWithPassword,
  signOutSupabaseUser,
} from "@/lib/auth/supabase-auth"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type AuthStatus = {
  clientAvailable: boolean
  sessionExists: boolean
  userEmail: string | null
  userId: string | null
  error: string | null
}

const emptyStatus: AuthStatus = {
  clientAvailable: false,
  sessionExists: false,
  userEmail: null,
  userId: null,
  error: null,
}

export default function SupabaseAuthStatusPage() {
  const authRequiredMode = useAuthRequiredMode()
  const [status, setStatus] = useState<AuthStatus>(emptyStatus)
  const [accessStatus, setAccessStatus] =
    useState<CurrentUserAccessResult>(emptyCurrentUserAccess)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingAccess, setIsLoadingAccess] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signInEmail, setSignInEmail] = useState("")
  const [signInPassword, setSignInPassword] = useState("")
  const [authActionMessage, setAuthActionMessage] = useState<string | null>(null)
  const [authActionError, setAuthActionError] = useState<string | null>(null)

  const envStatus = useMemo(
    () => ({
      hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    }),
    []
  )

  useEffect(() => {
    let isMounted = true
    const clientAvailable = Boolean(getSupabaseBrowserClient())

    async function loadAccessStatus() {
      setIsLoadingAccess(true)
      try {
        const nextAccessStatus = await getCurrentUserAccess()

        if (isMounted) {
          setAccessStatus(nextAccessStatus)
          setStatus((current) => ({
            ...current,
            userEmail: nextAccessStatus.userEmail ?? current.userEmail,
            userId: nextAccessStatus.userId ?? current.userId,
            error: nextAccessStatus.error,
          }))
        }
      } catch (error) {
        if (isMounted) {
          setAccessStatus({
            ...emptyCurrentUserAccess,
            error:
              error instanceof Error
                ? error.message
                : "Profile/role query error.",
          })
        }
      } finally {
        if (isMounted) {
          setIsLoadingAccess(false)
        }
      }
    }

    async function loadAuthStatus() {
      if (!clientAvailable) {
        if (isMounted) {
          setStatus({
            ...emptyStatus,
            error: "Supabase environment variables are not configured.",
          })
          setAccessStatus(emptyCurrentUserAccess)
          setIsLoading(false)
        }
        return
      }

      const [session, nextAccessStatus] = await Promise.all([
        getCurrentSupabaseSession(),
        getCurrentUserAccess(),
      ])

      if (isMounted) {
        setStatus({
          clientAvailable,
          sessionExists: Boolean(session),
          userEmail: nextAccessStatus.userEmail ?? session?.user.email ?? null,
          userId: nextAccessStatus.userId ?? session?.user.id ?? null,
          error: nextAccessStatus.error,
        })
        setAccessStatus(nextAccessStatus)
        setIsLoading(false)
      }
    }

    loadAuthStatus()

    const unsubscribe = onSupabaseAuthStateChange(async (_event, session) => {
      setStatus({
        clientAvailable,
        sessionExists: Boolean(session),
        userEmail: session?.user.email ?? null,
        userId: session?.user.id ?? null,
        error: null,
      })

      if (session?.user.id) {
        console.info("loading user access")
        loadAccessStatus()
      } else {
        setAccessStatus(emptyCurrentUserAccess)
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  const trimmedSignInEmail = signInEmail.trim()
  const canSubmitSignIn =
    !isSigningIn &&
    Boolean(trimmedSignInEmail) &&
    Boolean(signInPassword) &&
    envStatus.hasUrl &&
    envStatus.hasAnonKey
  const userTypeDisplay =
    accessStatus.roleNames.length > 0
      ? accessStatus.roleNames.join(", ")
      : "No user type assigned"

  async function handleSignOut() {
    setIsSigningOut(true)
    setAuthActionError(null)
    setAuthActionMessage(null)
    const result = await signOutSupabaseUser()
    setIsSigningOut(false)

    if (result.error) {
      setStatus((current) => ({
        ...current,
        error: result.error,
      }))
      return
    }

    setStatus((current) => ({
      ...current,
      sessionExists: false,
      userEmail: null,
      userId: null,
      error: null,
    }))
    setAccessStatus(emptyCurrentUserAccess)
    setAuthActionMessage("Signed out.")
  }

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthActionError(null)
    setAuthActionMessage(null)

    if (!trimmedSignInEmail || !signInPassword) {
      setAuthActionError("Email and password are required.")
      return
    }

    setIsSigningIn(true)
    console.info("sign-in started")

    try {
      const result = await signInSupabaseUserWithPassword(
        trimmedSignInEmail,
        signInPassword
      )

      if (!result.success) {
        console.info("sign-in returned error")
        setAuthActionError(result.error ?? "Sign-in failed.")
        return
      }

      console.info("sign-in succeeded")
      setStatus({
        clientAvailable: Boolean(getSupabaseBrowserClient()),
        sessionExists: Boolean(result.session),
        userEmail: result.user?.email ?? result.session?.user.email ?? null,
        userId: result.user?.id ?? result.session?.user.id ?? null,
        error: null,
      })
      setSignInPassword("")
      setAuthActionMessage("Signed in for local development testing.")

      console.info("loading user access")
      setIsLoadingAccess(true)
      getCurrentUserAccess()
        .then((nextAccessStatus) => {
          setAccessStatus(nextAccessStatus)
          setStatus((current) => ({
            ...current,
            userEmail: nextAccessStatus.userEmail ?? current.userEmail,
            userId: nextAccessStatus.userId ?? current.userId,
            error: nextAccessStatus.error,
          }))
        })
        .catch((error) => {
          setAccessStatus({
            ...emptyCurrentUserAccess,
            isAuthenticated: true,
            userEmail: result.user?.email ?? result.session?.user.email ?? null,
            userId: result.user?.id ?? result.session?.user.id ?? null,
            error:
              error instanceof Error
                ? error.message
                : "Profile/role query error.",
          })
        })
        .finally(() => {
          setIsLoadingAccess(false)
        })
    } catch (error) {
      setAuthActionError(
        error instanceof Error ? error.message : "Unexpected sign-in error."
      )
    } finally {
      setIsSigningIn(false)
    }
  }

  const hasEnv = envStatus.hasUrl && envStatus.hasAnonKey
  const isAuthRequiredModeEnabled = authRequiredMode === "enabled"

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <div>
          <Badge variant="outline">Development only</Badge>
          <h1 className="mt-3 text-2xl font-semibold">
            Supabase Auth Status
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Temporary page for inspecting the current Supabase browser auth
            state. Remove or protect before production.
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <Link
              href="/dev/permissions-comparison"
              className="text-primary underline-offset-4 hover:underline"
            >
              Compare Auth permissions with preview role
            </Link>
            <Link
              href="/dev/rls-helper-check"
              className="text-primary underline-offset-4 hover:underline"
            >
              Check RLS helper functions
            </Link>
            <Link
              href="/dev/guide-portal-auth-check"
              className="text-primary underline-offset-4 hover:underline"
            >
              Check Guide Portal Auth identity
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Client Status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-3">
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Supabase URL
              </div>
              <Badge variant={envStatus.hasUrl ? "default" : "outline"}>
                {envStatus.hasUrl ? "Configured" : "Missing"}
              </Badge>
            </div>
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Supabase anon key
              </div>
              <Badge variant={envStatus.hasAnonKey ? "default" : "outline"}>
                {envStatus.hasAnonKey ? "Configured" : "Missing"}
              </Badge>
            </div>
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Browser client
              </div>
              <Badge
                variant={status.clientAvailable && hasEnv ? "default" : "outline"}
              >
                {isLoading
                  ? "Checking"
                  : status.clientAvailable
                    ? "Available"
                    : "Unavailable"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {status.error ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4 text-sm text-red-800">
              {status.error}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Dev Auth-Required Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Checkbox
                id="dev-auth-required-mode"
                checked={isAuthRequiredModeEnabled}
                onCheckedChange={(checked) =>
                  saveAuthRequiredMode(checked === true ? "enabled" : "disabled")
                }
              />
              <div className="space-y-1">
                <Label
                  htmlFor="dev-auth-required-mode"
                  className="cursor-pointer"
                >
                  Dev auth-required mode
                </Label>
                <div>
                  Current state:{" "}
                  <Badge
                    variant={
                      isAuthRequiredModeEnabled ? "default" : "outline"
                    }
                  >
                    {isAuthRequiredModeEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600">
                  When enabled, admin routes require a signed-in Supabase Auth
                  user. This is for local RLS preparation only.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Local Development Sign In
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-sm text-slate-600">
              Use this only with manually created local Supabase Auth test
              users. This form does not enforce permissions or change app
              navigation.
            </p>

            <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={handleSignIn}>
              <div className="space-y-1">
                <Label htmlFor="dev-auth-email">Email</Label>
                <Input
                  id="dev-auth-email"
                  type="email"
                  value={signInEmail}
                  onChange={(event) => setSignInEmail(event.target.value)}
                  placeholder="super-admin@test.local"
                  autoComplete="username"
                  disabled={isSigningIn}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dev-auth-password">Password</Label>
                <Input
                  id="dev-auth-password"
                  type="password"
                  value={signInPassword}
                  onChange={(event) => setSignInPassword(event.target.value)}
                  placeholder="Local test password"
                  autoComplete="current-password"
                  disabled={isSigningIn}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={!canSubmitSignIn}
                >
                  {isSigningIn ? "Signing in..." : "Sign in"}
                </Button>
              </div>
            </form>

            {authActionError ? (
              <p className="text-sm text-red-700">{authActionError}</p>
            ) : null}
            {authActionMessage ? (
              <p className="text-sm text-slate-600">{authActionMessage}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">
                  Session
                </div>
                <Badge variant={status.sessionExists ? "default" : "outline"}>
                  {isLoading
                    ? "Checking"
                    : status.sessionExists
                      ? "Logged in"
                      : "Not logged in"}
                </Badge>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">
                  User email
                </div>
                <div>{status.userEmail ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">
                  User id
                </div>
                <div className="break-all font-mono text-xs">
                  {status.userId ?? "—"}
                </div>
              </div>
            </div>

            {!isLoading && !status.sessionExists ? (
              <p className="text-sm text-slate-600">
                No Supabase Auth session is active in this browser.
              </p>
            ) : null}

            {status.sessionExists ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                {isSigningOut ? "Signing out..." : "Sign out"}
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Profile and Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3 md:grid-cols-5">
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">
                  Profile
                </div>
                <Badge
                  variant={accessStatus.profileFound ? "default" : "outline"}
                >
                  {isLoading
                    ? "Checking"
                    : status.sessionExists
                      ? isLoadingAccess
                        ? "Loading"
                        : accessStatus.error
                          ? "Query error"
                          : accessStatus.profileFound
                            ? "Profile found"
                            : "No profile found"
                  : "No session"}
                </Badge>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">
                  User type
                </div>
                <div>{userTypeDisplay}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">
                  Profile email
                </div>
                <div>{accessStatus.userEmail ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">
                  Full name
                </div>
                <div>{accessStatus.profileFullName ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">
                  Guide link
                </div>
                <div className="break-all font-mono text-xs">
                  {accessStatus.linkedGuideId ?? "—"}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Assigned roles
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {accessStatus.roleNames.length > 0 ? (
                  accessStatus.roleNames.map((role) => (
                    <Badge key={role} variant="secondary">
                      {role}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-slate-600">
                    {accessStatus.profileFound
                      ? "No roles assigned"
                      : "No matching profile found"}
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Role keys
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {accessStatus.roleKeys.length > 0 ? (
                  accessStatus.roleKeys.map((roleKey) => (
                    <Badge key={roleKey} variant="outline">
                      {roleKey}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-slate-600">—</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Permission keys
              </div>
              <div className="text-sm text-slate-600">
                {accessStatus.permissionKeys.length > 0
                  ? `${accessStatus.permissionKeys.length} loaded`
                  : "—"}
              </div>
            </div>

            {accessStatus.error ? (
              <p className="text-sm text-red-700">{accessStatus.error}</p>
            ) : null}

            <p className="text-xs text-slate-500">
              Profile and role checks use the browser anon client and are for
              local development only during staged RLS rollout. They do not
              enforce app permissions.
            </p>
          </CardContent>
        </Card>

        <p className="text-xs text-slate-500">
          This page does not display access tokens, refresh tokens, anon keys,
          service role keys, database URLs, passwords, or environment variable
          values. It does not force login or change app navigation.
        </p>
      </div>
    </main>
  )
}
