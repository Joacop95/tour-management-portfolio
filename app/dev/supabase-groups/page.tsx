"use client"

import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
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
  getSupabaseGroups,
  type SupabaseTourGroup,
} from "@/lib/supabase/queries/groups"
import { formatDateDisplay } from "@/lib/utils/date-format"

export default function SupabaseGroupsPreviewPage() {
  const [groups, setGroups] = useState<SupabaseTourGroup[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const envStatus = useMemo(
    () => ({
      hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    }),
    []
  )

  useEffect(() => {
    let isMounted = true

    async function loadGroups() {
      const result = await getSupabaseGroups()

      if (!isMounted) {
        return
      }

      setGroups(result.data)
      setError(result.error)
      setIsLoading(false)
    }

    loadGroups()

    return () => {
      isMounted = false
    }
  }, [])

  const hasEnv = envStatus.hasUrl && envStatus.hasAnonKey

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div>
          <Badge variant="outline">Development only</Badge>
          <h1 className="mt-3 text-2xl font-semibold">
            Supabase Groups Preview
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Temporary read-only preview for seeded Supabase groups and current
            assignment data. Remove or protect before production.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Connection Status</CardTitle>
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
                Groups query
              </div>
              <Badge variant={!error && hasEnv ? "default" : "outline"}>
                {isLoading
                  ? "Loading"
                  : error
                    ? "Error"
                    : `${groups.length} groups`}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {error ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4 text-sm text-red-800">
              {error}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Seeded Groups With Current Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group code</TableHead>
                  <TableHead>Circuit</TableHead>
                  <TableHead>Start date</TableHead>
                  <TableHead>End date</TableHead>
                  <TableHead>Group status</TableHead>
                  <TableHead>Current guide</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Confirmation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-sm text-slate-500">
                      Loading groups from Supabase...
                    </TableCell>
                  </TableRow>
                ) : groups.length > 0 ? (
                  groups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell className="font-mono text-xs">
                        {group.code}
                      </TableCell>
                      <TableCell>{group.circuitName}</TableCell>
                      <TableCell>
                        {formatDateDisplay(group.startDateIso)}
                      </TableCell>
                      <TableCell>{formatDateDisplay(group.endDateIso)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            group.groupStatus === "active"
                              ? "default"
                              : "outline"
                          }
                        >
                          {group.groupStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {group.currentGuideName ?? (
                          <span className="font-medium text-amber-700">
                            No guide
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            group.assignmentStatus === "assigned"
                              ? "default"
                              : "outline"
                          }
                        >
                          {group.assignmentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>{group.confirmationStatus}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-sm text-slate-500">
                      {error
                        ? "Unable to load Supabase groups."
                        : "No Supabase groups found."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="text-xs text-slate-500">
          This page only reports whether public environment variables are
          present. It does not display secrets, anon keys, database URLs,
          passwords, passenger names, or client data.
        </p>
      </div>
    </main>
  )
}
