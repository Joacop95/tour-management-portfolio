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
import type { Circuit } from "@/lib/types/domain"
import { getActiveSupabaseCircuits } from "@/lib/supabase/queries/circuits"

export default function SupabaseCircuitsPreviewPage() {
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

  useEffect(() => {
    let isMounted = true

    async function loadCircuits() {
      const result = await getActiveSupabaseCircuits()

      if (!isMounted) {
        return
      }

      setCircuits(result.data)
      setError(result.error)
      setIsLoading(false)
    }

    loadCircuits()

    return () => {
      isMounted = false
    }
  }, [])

  const hasEnv = envStatus.hasUrl && envStatus.hasAnonKey

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div>
          <Badge variant="outline">Development only</Badge>
          <h1 className="mt-3 text-2xl font-semibold">
            Supabase Circuits Preview
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Temporary read-only preview for seeded Supabase circuits and
            aliases. Development diagnostic page only. Remove or protect before
            production.
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
                Circuit query
              </div>
              <Badge variant={!error && hasEnv ? "default" : "outline"}>
                {isLoading
                  ? "Loading"
                  : error
                    ? "Error"
                    : `${circuits.length} circuits`}
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
            <CardTitle className="text-base">Active Circuits</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-32">Region</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead>Aliases</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-slate-500">
                      Loading circuits from Supabase...
                    </TableCell>
                  </TableRow>
                ) : circuits.length > 0 ? (
                  circuits.map((circuit) => (
                    <TableRow key={circuit.id}>
                      <TableCell className="font-mono text-xs">
                        {circuit.code || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{circuit.name}</div>
                        {circuit.notes ? (
                          <div className="mt-1 text-xs text-slate-500">
                            {circuit.notes}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>{circuit.region || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={circuit.isActive === false ? "outline" : "default"}
                        >
                          {circuit.isActive === false ? "Inactive" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {circuit.aliases && circuit.aliases.length > 0 ? (
                            circuit.aliases.map((alias) => (
                              <Badge key={alias} variant="outline">
                                {alias}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-slate-500">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-slate-500">
                      {error
                        ? "Unable to load Supabase circuits."
                        : "No active circuits found."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="text-xs text-slate-500">
          This page only reports whether public environment variables are
          present. It does not display secrets, anon keys, database URLs, or
          passwords.
        </p>
      </div>
    </main>
  )
}
