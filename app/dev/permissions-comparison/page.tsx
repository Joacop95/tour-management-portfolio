"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import {
  useAppSettings,
  usePermissionSource,
  usePreviewRole,
  savePermissionSource,
} from "@/components/settings/settings-client-store"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import {
  getPreviewPermissionKeys,
  resolveActivePermissionKeys,
  type PermissionSource,
} from "@/lib/auth/permission-source"
import { onSupabaseAuthStateChange } from "@/lib/auth/supabase-auth"
import { settingsRoleOptions } from "@/lib/mock-data/settings"

function sortedUnique(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right)
  )
}

function PermissionBadges({ values }: { values: string[] }) {
  if (values.length === 0) {
    return <span className="text-sm text-slate-600">—</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {values.map((value) => (
        <Badge key={value} variant="outline" className="font-mono text-[11px]">
          {value}
        </Badge>
      ))}
    </div>
  )
}

export default function PermissionsComparisonPage() {
  const appSettings = useAppSettings()
  const previewRole = usePreviewRole()
  const permissionSource = usePermissionSource()
  const [accessStatus, setAccessStatus] =
    useState<CurrentUserAccessResult>(emptyCurrentUserAccess)
  const [isLoadingAccess, setIsLoadingAccess] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadAccessStatus() {
      const nextAccessStatus = await getCurrentUserAccess()

      if (!isMounted) {
        return
      }

      setAccessStatus(nextAccessStatus)
      setIsLoadingAccess(false)
    }

    void loadAccessStatus()

    const unsubscribe = onSupabaseAuthStateChange(() => {
      setIsLoadingAccess(true)
      void loadAccessStatus()
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  const previewRoleLabel =
    settingsRoleOptions.find((role) => role.value === previewRole)?.label ??
    "Super Admin"
  const authRoleDisplay =
    accessStatus.roleNames.length > 0
      ? accessStatus.roleNames.join(", ")
      : accessStatus.isAuthenticated
        ? "No user type assigned"
        : "Not signed in"
  const previewPermissionKeys = useMemo(() => {
    return getPreviewPermissionKeys(appSettings, previewRole)
  }, [appSettings, previewRole])
  const authPermissionKeys = useMemo(
    () => sortedUnique(accessStatus.permissionKeys),
    [accessStatus.permissionKeys]
  )
  const activePermissionResolution = useMemo(
    () =>
      resolveActivePermissionKeys({
        permissionSource,
        appSettings,
        previewRole,
        authAccess: accessStatus,
      }),
    [accessStatus, appSettings, permissionSource, previewRole]
  )
  const comparison = useMemo(() => {
    const authSet = new Set(authPermissionKeys)
    const previewSet = new Set(previewPermissionKeys)

    return {
      matching: authPermissionKeys.filter((permission) =>
        previewSet.has(permission)
      ),
      authOnly: authPermissionKeys.filter(
        (permission) => !previewSet.has(permission)
      ),
      previewOnly: previewPermissionKeys.filter(
        (permission) => !authSet.has(permission)
      ),
    }
  }, [authPermissionKeys, previewPermissionKeys])

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div>
          <Badge variant="outline">Development only</Badge>
          <h1 className="mt-3 text-2xl font-semibold">
            Permissions Comparison
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Compares the current Supabase Auth permissions with the active
            preview role permissions. This page does not enforce permissions,
            change navigation, or enable RLS.
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <Link
              href="/dev/auth-status"
              className="text-primary underline-offset-4 hover:underline"
            >
              Back to auth status
            </Link>
            <Link
              href="/dev/rls-helper-check"
              className="text-primary underline-offset-4 hover:underline"
            >
              Check RLS helper functions
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Current Context</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-4">
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Auth user email
              </div>
              <div>{accessStatus.userEmail ?? "Not signed in"}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Auth user type
              </div>
              <div>{isLoadingAccess ? "Checking" : authRoleDisplay}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Current preview role
              </div>
              <div>{previewRoleLabel}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase text-slate-500">
                Status
              </div>
              <Badge variant={accessStatus.isAuthenticated ? "default" : "outline"}>
                {isLoadingAccess
                  ? "Checking"
                  : accessStatus.isAuthenticated
                    ? "Signed in"
                    : "Not signed in"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Permission Source Toggle
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-[minmax(220px,320px)_1fr] md:items-center">
            <div className="grid gap-1">
              <div className="text-xs font-medium uppercase text-slate-500">
                Permission source
              </div>
              <Select
                value={permissionSource}
                onValueChange={(value) =>
                  savePermissionSource(value as PermissionSource)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preview">Preview role</SelectItem>
                  <SelectItem value="auth">Auth user</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 text-sm text-slate-600">
              <div>
                Active evaluation:{" "}
                <span className="font-medium text-slate-950">
                  {activePermissionResolution.effectiveSource === "auth"
                    ? "Auth user permissions"
                    : activePermissionResolution.effectiveSource ===
                        "preview-fallback"
                      ? "Preview role permissions fallback"
                      : "Preview role permissions"}
                </span>
              </div>
              {activePermissionResolution.warning ? (
                <div className="text-amber-800">
                  {activePermissionResolution.warning}
                </div>
              ) : null}
              <div className="text-xs text-slate-500">
                This setting is local development only. It does not enable RLS
                or backend security.
              </div>
            </div>
          </CardContent>
        </Card>

        {!isLoadingAccess && !accessStatus.isAuthenticated ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-4 text-sm text-amber-900">
              Not signed in. Preview role permissions are still shown below.
            </CardContent>
          </Card>
        ) : null}

        {!isLoadingAccess &&
        accessStatus.isAuthenticated &&
        accessStatus.roleNames.length === 0 ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-4 text-sm text-amber-900">
              Signed in, but no profile role is mapped for this user.
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Permission Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Set</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Permission keys</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Active permission source</TableCell>
                  <TableCell>
                    {activePermissionResolution.activePermissionKeys.length}
                  </TableCell>
                  <TableCell>
                    <PermissionBadges
                      values={activePermissionResolution.activePermissionKeys}
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Auth permissions</TableCell>
                  <TableCell>{authPermissionKeys.length}</TableCell>
                  <TableCell>
                    <PermissionBadges values={authPermissionKeys} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Preview role permissions</TableCell>
                  <TableCell>{previewPermissionKeys.length}</TableCell>
                  <TableCell>
                    <PermissionBadges values={previewPermissionKeys} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Permissions that match</TableCell>
                  <TableCell>{comparison.matching.length}</TableCell>
                  <TableCell>
                    <PermissionBadges values={comparison.matching} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Only in Auth</TableCell>
                  <TableCell>{comparison.authOnly.length}</TableCell>
                  <TableCell>
                    <PermissionBadges values={comparison.authOnly} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Only in Preview</TableCell>
                  <TableCell>{comparison.previewOnly.length}</TableCell>
                  <TableCell>
                    <PermissionBadges values={comparison.previewOnly} />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="text-xs text-slate-500">
          This page uses the browser anon client and local preview settings for
          development comparison only. It does not show access tokens, refresh
          tokens, anon keys, service role keys, database URLs, passwords, or
          environment variable values.
        </p>
      </div>
    </main>
  )
}
