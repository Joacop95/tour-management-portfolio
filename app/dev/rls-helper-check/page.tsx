"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  emptyCurrentUserAccess,
  getCurrentUserAccess,
  type CurrentUserAccessResult,
} from "@/lib/auth/current-user-access"
import { onSupabaseAuthStateChange } from "@/lib/auth/supabase-auth"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

const samplePermissionKeys = [
  "guides.view",
  "guides.create",
  "groups.view",
  "assignments.assign_guide",
  "settings.manage_settings",
]

type HelperCheckState = {
  roleKeys: string[]
  permissionKeys: string[]
  guideId: string | null
  samplePermissions: Record<string, boolean | null>
  errors: string[]
}

const emptyHelperCheckState: HelperCheckState = {
  roleKeys: [],
  permissionKeys: [],
  guideId: null,
  samplePermissions: Object.fromEntries(
    samplePermissionKeys.map((permissionKey) => [permissionKey, null])
  ),
  errors: [],
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === "string")
}

function formatBoolean(value: boolean | null) {
  if (value === null) {
    return "Not checked"
  }

  return value ? "true" : "false"
}

export default function RlsHelperCheckPage() {
  const [accessStatus, setAccessStatus] =
    useState<CurrentUserAccessResult>(emptyCurrentUserAccess)
  const [helperState, setHelperState] =
    useState<HelperCheckState>(emptyHelperCheckState)
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingHelpers, setIsCheckingHelpers] = useState(false)

  const loadHelperChecks = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()

    setIsLoading(true)
    setHelperState(emptyHelperCheckState)

    if (!supabase) {
      setAccessStatus({
        ...emptyCurrentUserAccess,
        error: "Supabase environment variables are not configured.",
      })
      setHelperState({
        ...emptyHelperCheckState,
        errors: ["Supabase environment variables are not configured."],
      })
      setIsLoading(false)
      return
    }

    const nextAccessStatus = await getCurrentUserAccess()
    setAccessStatus(nextAccessStatus)

    if (!nextAccessStatus.isAuthenticated) {
      setIsLoading(false)
      return
    }

    setIsCheckingHelpers(true)

    const errors: string[] = []
    const nextHelperState: HelperCheckState = {
      ...emptyHelperCheckState,
      samplePermissions: { ...emptyHelperCheckState.samplePermissions },
      errors,
    }

    const roleResult = await supabase.rpc("current_user_role_keys")
    if (roleResult.error) {
      errors.push(`current_user_role_keys: ${roleResult.error.message}`)
    } else {
      nextHelperState.roleKeys = toStringArray(roleResult.data)
    }

    const permissionResult = await supabase.rpc("current_user_permission_keys")
    if (permissionResult.error) {
      errors.push(
        `current_user_permission_keys: ${permissionResult.error.message}`
      )
    } else {
      nextHelperState.permissionKeys = toStringArray(permissionResult.data)
    }

    const guideResult = await supabase.rpc("current_user_guide_id")
    if (guideResult.error) {
      errors.push(`current_user_guide_id: ${guideResult.error.message}`)
    } else {
      nextHelperState.guideId =
        typeof guideResult.data === "string" ? guideResult.data : null
    }

    for (const permissionKey of samplePermissionKeys) {
      const result = await supabase.rpc("has_permission", {
        target_permission_key: permissionKey,
      })

      if (result.error) {
        errors.push(`has_permission(${permissionKey}): ${result.error.message}`)
        nextHelperState.samplePermissions[permissionKey] = null
      } else {
        nextHelperState.samplePermissions[permissionKey] =
          typeof result.data === "boolean" ? result.data : null
      }
    }

    nextHelperState.errors = errors
    setHelperState(nextHelperState)
    setIsCheckingHelpers(false)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => {
      void loadHelperChecks()
    }, 0)

    const unsubscribe = onSupabaseAuthStateChange(() => {
      void loadHelperChecks()
    })

    return () => {
      window.clearTimeout(initialLoadId)
      unsubscribe()
    }
  }, [loadHelperChecks])

  const isAuthenticated = accessStatus.isAuthenticated

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div>
          <Badge variant="outline">Development only</Badge>
          <h1 className="mt-3 text-2xl font-semibold">
            RLS Helper Check
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Verifies local Supabase helper functions through the current
            browser Auth session. This page does not enable RLS, create
            policies, or enforce permissions.
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <Link
              href="/dev/auth-status"
              className="text-primary underline-offset-4 hover:underline"
            >
              Auth status
            </Link>
            <Link
              href="/dev/permissions-comparison"
              className="text-primary underline-offset-4 hover:underline"
            >
              Permissions comparison
            </Link>
            <Link
              href="/dev/guide-portal-auth-check"
              className="text-primary underline-offset-4 hover:underline"
            >
              Guide Portal Auth check
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="text-base">Current Auth Context</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadHelperChecks()}
              disabled={isLoading || isCheckingHelpers}
            >
              {isLoading || isCheckingHelpers ? "Checking..." : "Refresh"}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-4">
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Session
              </div>
              <Badge variant={isAuthenticated ? "default" : "outline"}>
                {isLoading
                  ? "Checking"
                  : isAuthenticated
                    ? "Signed in"
                    : "Not signed in"}
              </Badge>
            </div>
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Auth email
              </div>
              <div>{accessStatus.userEmail ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Profile
              </div>
              <div>
                {accessStatus.profileFound
                  ? accessStatus.profileFullName ?? "Profile found"
                  : isAuthenticated
                    ? "No profile found"
                    : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Auth role names
              </div>
              <div>
                {accessStatus.roleNames.length > 0
                  ? accessStatus.roleNames.join(", ")
                  : isAuthenticated
                    ? "No roles mapped"
                    : "—"}
              </div>
            </div>
          </CardContent>
        </Card>

        {!isLoading && !isAuthenticated ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-4 text-sm text-amber-900">
              Sign in through{" "}
              <Link
                href="/dev/auth-status"
                className="font-medium underline-offset-4 hover:underline"
              >
                /dev/auth-status
              </Link>{" "}
              to test helper functions.
            </CardContent>
          </Card>
        ) : null}

        {accessStatus.error ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4 text-sm text-red-800">
              {accessStatus.error}
            </CardContent>
          </Card>
        ) : null}

        {helperState.errors.length > 0 ? (
          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">RPC Errors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-red-800">
              {helperState.errors.map((error) => (
                <div key={error}>{error}</div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Helper Function Output</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">
                  current_user_role_keys()
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {helperState.roleKeys.length > 0 ? (
                    helperState.roleKeys.map((roleKey) => (
                      <Badge key={roleKey} variant="outline">
                        {roleKey}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">
                  current_user_permission_keys()
                </div>
                <div>
                  {helperState.permissionKeys.length > 0
                    ? `${helperState.permissionKeys.length} permissions`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">
                  current_user_guide_id()
                </div>
                <div className="break-all font-mono text-xs">
                  {helperState.guideId ?? "—"}
                </div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RPC check</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {samplePermissionKeys.map((permissionKey) => (
                  <TableRow key={permissionKey}>
                    <TableCell className="font-mono text-xs">
                      has_permission({permissionKey})
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          helperState.samplePermissions[permissionKey]
                            ? "default"
                            : "outline"
                        }
                      >
                        {formatBoolean(
                          helperState.samplePermissions[permissionKey]
                        )}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Expected Local Personas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Expected role</TableHead>
                  <TableHead>Expected helper behavior</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-xs">
                    super-admin@test.local
                  </TableCell>
                  <TableCell>super-admin</TableCell>
                  <TableCell>All sampled permissions should be true.</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-xs">
                    admin@test.local
                  </TableCell>
                  <TableCell>admin-administrativo</TableCell>
                  <TableCell>
                    Operational permissions should match the seed data;
                    settings.manage_settings should be false by default.
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-xs">
                    internal@test.local
                  </TableCell>
                  <TableCell>consulta-interna</TableCell>
                  <TableCell>
                    View permissions should be true; write and settings
                    management permissions should be false.
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-xs">
                    guide@test.local
                  </TableCell>
                  <TableCell>guide</TableCell>
                  <TableCell>
                    Guide Portal permissions should be present in the full
                    permission array. current_user_guide_id should return a
                    guide id if the local profile mapping linked one.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
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
