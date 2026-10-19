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
import { getAllSupabaseCircuits } from "@/lib/supabase/queries/circuits"
import { getSupabaseGuides } from "@/lib/supabase/queries/guides"
import type { Circuit, Guide } from "@/lib/types/domain"

export default function SupabaseGuidesPreviewPage() {
  const [guides, setGuides] = useState<Guide[]>([])
  const [circuits, setCircuits] = useState<Circuit[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const envStatus = useMemo(
    () => ({
      hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    }),
    []
  )

  const circuitNameById = useMemo(() => {
    return new Map(circuits.map((circuit) => [circuit.id, circuit.name]))
  }, [circuits])

  useEffect(() => {
    let isMounted = true

    async function loadGuides() {
      const [guidesResult, circuitsResult] = await Promise.all([
        getSupabaseGuides(),
        getAllSupabaseCircuits(),
      ])

      if (!isMounted) {
        return
      }

      setGuides(guidesResult.data)
      setCircuits(circuitsResult.data)
      setError(guidesResult.error ?? circuitsResult.error)
      setIsLoading(false)
    }

    loadGuides()

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
            Supabase Guides Preview
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Temporary read-only preview for seeded Supabase guides and guide
            circuit capabilities. Remove or protect before production.
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
                Guide query
              </div>
              <Badge variant={!error && hasEnv ? "default" : "outline"}>
                {isLoading
                  ? "Loading"
                  : error
                    ? "Error"
                    : `${guides.length} guides`}
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
            <CardTitle className="text-base">Seeded Guides</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guide</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Preferred language</TableHead>
                  <TableHead>Circuit capabilities</TableHead>
                  <TableHead>Internal rating</TableHead>
                  <TableHead>Sales ranking</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-slate-500">
                      Loading guides from Supabase...
                    </TableCell>
                  </TableRow>
                ) : guides.length > 0 ? (
                  guides.map((guide) => (
                    <TableRow key={guide.id}>
                      <TableCell>
                        <div className="font-medium">{guide.name}</div>
                        <div className="text-xs text-slate-500">
                          {guide.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            guide.status === "active" ? "default" : "outline"
                          }
                        >
                          {guide.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{guide.preferredLanguage || "—"}</TableCell>
                      <TableCell>
                        <div className="flex max-w-lg flex-wrap gap-1">
                          {guide.circuitIds.length > 0 ? (
                            guide.circuitIds.map((circuitId) => (
                              <Badge key={circuitId} variant="secondary">
                                {circuitNameById.get(circuitId) ?? circuitId}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-slate-500">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {guide.internalRating
                          ? `${guide.internalRating.toFixed(1)}/5`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {guide.salesRanking ? `#${guide.salesRanking}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-slate-500">
                      {error
                        ? "Unable to load Supabase guides."
                        : "No Supabase guides found."}
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
          passwords, or real email credentials.
        </p>
      </div>
    </main>
  )
}
