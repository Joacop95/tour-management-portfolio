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
  getSupabaseAvailability,
  type SupabaseGuideAvailability,
} from "@/lib/supabase/queries/availability"
import { formatDateDisplay } from "@/lib/utils/date-format"

function getStatusVariant(status: SupabaseGuideAvailability["status"]) {
  if (status === "available") {
    return "default"
  }

  if (status === "occupied-by-assignment") {
    return "secondary"
  }

  return "outline"
}

export default function SupabaseAvailabilityPreviewPage() {
  const [availability, setAvailability] = useState<
    SupabaseGuideAvailability[]
  >([])
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

    async function loadAvailability() {
      const result = await getSupabaseAvailability()

      if (!isMounted) {
        return
      }

      setAvailability(result.data)
      setError(result.error)
      setIsLoading(false)
    }

    loadAvailability()

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
            Supabase Availability Preview
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Temporary read-only preview for seeded Supabase guide availability.
            Remove or protect before production.
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
                Availability query
              </div>
              <Badge variant={!error && hasEnv ? "default" : "outline"}>
                {isLoading
                  ? "Loading"
                  : error
                    ? "Error"
                    : `${availability.length} records`}
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
              Seeded Availability Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guide</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Start date</TableHead>
                  <TableHead>End date</TableHead>
                  <TableHead>Assignment context</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-sm text-slate-500">
                      Loading availability from Supabase...
                    </TableCell>
                  </TableRow>
                ) : availability.length > 0 ? (
                  availability.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.guideName}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(record.status)}>
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{record.source}</TableCell>
                      <TableCell>
                        {formatDateDisplay(record.startDateIso)}
                      </TableCell>
                      <TableCell>
                        {formatDateDisplay(record.endDateIso)}
                      </TableCell>
                      <TableCell>
                        {record.assignmentGroupCode ? (
                          <div className="text-sm">
                            <div className="font-medium">
                              {record.assignmentGroupCode}
                            </div>
                            <div className="text-xs text-slate-500">
                              {record.assignmentCircuitName ?? "Unknown circuit"}
                              {" · "}
                              {formatDateDisplay(
                                record.assignmentGroupStartDateIso ?? ""
                              )}
                              {" - "}
                              {formatDateDisplay(
                                record.assignmentGroupEndDateIso ?? ""
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs text-sm">
                        <span title={record.notes}>
                          {record.notes || "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-sm text-slate-500">
                      {error
                        ? "Unable to load Supabase availability."
                        : "No Supabase availability records found."}
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
