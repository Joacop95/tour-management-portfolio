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
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

const diagnosticTables = [
  "roles",
  "permissions",
  "circuits",
  "circuit_aliases",
  "notification_settings",
  "email_templates",
] as const

type DiagnosticTable = (typeof diagnosticTables)[number]

type TableCheck = {
  table: DiagnosticTable
  count: number | null
  error: string | null
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "string") {
    return error
  }

  return "Unknown connection error."
}

export default function SupabaseDiagnosticsPage() {
  const [checks, setChecks] = useState<TableCheck[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const envStatus = useMemo(
    () => ({
      hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    }),
    []
  )

  useEffect(() => {
    let isMounted = true

    async function runDiagnostics() {
      const supabase = getSupabaseBrowserClient()

      if (!supabase) {
        if (isMounted) {
          setChecks([])
          setConnectionError("Supabase environment variables are not configured.")
          setIsLoading(false)
        }
        return
      }

      try {
        const results = await Promise.all(
          diagnosticTables.map(async (table) => {
            const { count, error } = await supabase
              .from(table)
              .select("*", { count: "exact", head: true })

            return {
              table,
              count,
              error: error?.message ?? null,
            }
          })
        )

        if (isMounted) {
          setChecks(results)
          setConnectionError(null)
        }
      } catch (error) {
        if (isMounted) {
          setChecks(
            diagnosticTables.map((table) => ({
              table,
              count: null,
              error: getErrorMessage(error),
            }))
          )
          setConnectionError(getErrorMessage(error))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    runDiagnostics()

    return () => {
      isMounted = false
    }
  }, [])

  const successfulChecks = checks.filter((check) => !check.error).length
  const hasEnv = envStatus.hasUrl && envStatus.hasAnonKey
  const hasErrors = Boolean(connectionError) || checks.some((check) => check.error)

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div>
          <Badge variant="outline">Development only</Badge>
          <h1 className="mt-3 text-2xl font-semibold">
            Supabase Diagnostics
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Temporary read-only page for checking local Supabase connectivity
            and seeded table counts. Development diagnostic page only. Remove
            or protect before production.
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
                Read checks
              </div>
              <Badge variant={!hasErrors && hasEnv ? "default" : "outline"}>
                {isLoading
                  ? "Checking"
                  : hasErrors
                    ? "Errors found"
                    : `${successfulChecks}/${diagnosticTables.length} passed`}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {connectionError ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4 text-sm text-red-800">
              {connectionError}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Seeded Table Counts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table</TableHead>
                  <TableHead className="w-28 text-right">Count</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-slate-500">
                      Checking Supabase connection...
                    </TableCell>
                  </TableRow>
                ) : checks.length > 0 ? (
                  checks.map((check) => (
                    <TableRow key={check.table}>
                      <TableCell className="font-mono text-xs">
                        {check.table}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {check.count ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={check.error ? "outline" : "default"}>
                          {check.error ? "Failed" : "Read OK"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {check.error ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-slate-500">
                      Supabase environment variables are not configured.
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
