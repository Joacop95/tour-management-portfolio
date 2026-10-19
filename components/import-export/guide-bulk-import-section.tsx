"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { ChangeEvent, useMemo, useState } from "react"
import { Clipboard, Download, FileUp, ShieldAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  guideBulkImportColumns,
  getGuideBulkImportTemplate,
  parseGuideBulkImportCsv,
  type GuideBulkImportPreviewRow,
} from "@/lib/utils/guide-bulk-import"
import {
  applySupabaseGuideBulkImportRow,
  type GuideBulkImportRowResult,
} from "@/lib/supabase/mutations/guide-bulk-import"
import type { Circuit, Guide } from "@/lib/types/domain"

type GuideBulkImportSectionProps = {
  guides: Guide[]
  circuits: Circuit[]
  canManageGuides: boolean
  canApplyImport: boolean
  permissionMessage: string
  applyUnavailableMessage: string
  onImportApplied: () => Promise<string | null>
}

const stateConfig = {
  ready: {
    labelKey: "status.ready",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  warning: {
    labelKey: "status.warning",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  error: {
    labelKey: "status.error",
    className: "border-red-200 bg-red-50 text-red-700",
  },
} as const

function downloadTemplate() {
  const blob = new Blob([getGuideBulkImportTemplate()], {
    type: "text/csv;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = "tour-guide-operations-guide-import-template.csv"
  link.click()
  URL.revokeObjectURL(url)
}

function formatGuideStatus(status: GuideBulkImportPreviewRow["status"]) {
  return status
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function GuideBulkImportSection({
  guides,
  circuits,
  canManageGuides,
  canApplyImport,
  permissionMessage,
  applyUnavailableMessage,
  onImportApplied,
}: GuideBulkImportSectionProps) {
  const { t } = useI18n()
  const [rows, setRows] = useState<GuideBulkImportPreviewRow[]>([])
  const [fileErrors, setFileErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [results, setResults] = useState<GuideBulkImportRowResult[]>([])
  const [appliedAt, setAppliedAt] = useState<string | null>(null)
  const summary = useMemo(
    () => ({
      ready: rows.filter((row) => row.state === "ready").length,
      warning: rows.filter((row) => row.state === "warning").length,
      error: rows.filter((row) => row.state === "error").length,
    }),
    [rows]
  )
  const importableRows = useMemo(
    () => rows.filter((row) => row.state !== "error" && row.action !== "blocked"),
    [rows]
  )
  const resultByRowNumber = useMemo(
    () => new Map(results.map((result) => [result.rowNumber, result])),
    [results]
  )
  const appliedSummary = useMemo(
    () => ({
      created: results.filter((result) => result.action === "created").length,
      updated: results.filter((result) => result.action === "updated").length,
      skipped: summary.error + results.filter((result) => result.action === "skipped").length,
      failed: results.filter((result) => result.action === "failed").length,
      emailsCreated: results.reduce(
        (count, result) => count + result.authorizedEmail.created,
        0
      ),
      emailsUpdated: results.reduce(
        (count, result) => count + result.authorizedEmail.updated,
        0
      ),
      emailsRevoked: results.reduce(
        (count, result) => count + result.authorizedEmail.revoked,
        0
      ),
      circuitCapabilitiesUpdated: results.reduce(
        (count, result) => count + result.circuitCapabilitiesUpdated,
        0
      ),
    }),
    [results, summary.error]
  )

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) {
      return
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setRows([])
      setFileName(file.name)
      setFileErrors(["Upload a CSV file for this preview."])
      setResults([])
      setAppliedAt(null)
      return
    }

    const result = parseGuideBulkImportCsv({
      csv: await file.text(),
      guides,
      circuits,
      t,
    })

    setRows(result.rows)
    setFileErrors(result.fileErrors)
    setFileName(file.name)
    setFeedback(null)
    setResults([])
    setAppliedAt(null)
  }

  async function handleCopyTemplate() {
    try {
      await navigator.clipboard.writeText(getGuideBulkImportTemplate())
      setFeedback(t("import_export.guides.template_copied"))
    } catch {
      setFeedback(t("import_export.guides.template_copy_failed"))
    }
  }

  async function handleApplyImport() {
    if (
      !canApplyImport ||
      isApplying ||
      appliedAt !== null ||
      importableRows.length === 0
    ) {
      return
    }

    setIsApplying(true)
    setFeedback(null)
    const nextResults: GuideBulkImportRowResult[] = []

    try {
      for (const row of importableRows) {
        try {
          nextResults.push(await applySupabaseGuideBulkImportRow(row))
        } catch (error) {
          nextResults.push({
            rowNumber: row.rowNumber,
            action: "failed",
            message:
              error instanceof Error
                ? error.message
                : "Unexpected import failure.",
            authorizedEmail: { created: 0, updated: 0, revoked: 0 },
            circuitCapabilitiesUpdated: 0,
          })
        }
      }

      setResults(nextResults)
      setAppliedAt(new Date().toLocaleString())

      try {
        const refreshError = await onImportApplied()
        setFeedback(
          refreshError
            ? t("import_export.guides.refresh_failed", { error: refreshError })
            : t("import_export.guides.import_finished")
        )
      } catch (error) {
        setFeedback(
          t("import_export.guides.refresh_failed", { error: error instanceof Error ? error.message : t("import_export.guides.unexpected_refresh_failure") })
        )
      }
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-heading text-lg font-semibold"><T i18nKey="import_export.guide_bulk_import_section.bulk_import_guides" /></h2>
        <p className="text-sm text-muted-foreground">
          <T i18nKey="import_export.guide_bulk_import_section.upload_a_csv_to_preview_guide_imports_before" />
        </p>
      </div>

      {!canManageGuides ? (
        <Card>
          <CardContent className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-800" />
            <div>
              <p className="font-medium"><T i18nKey="import_export.guide_bulk_import_section.bulk_guide_import_unavailable" /></p>
              <p className="text-sm text-muted-foreground">
                {permissionMessage}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)]">
            <Card>
              <CardHeader className="border-b">
                <div>
                  <CardTitle className="text-base"><T i18nKey="import_export.guide_bulk_import_section.csv_template" /></CardTitle>
                  <CardDescription>
                    <T i18nKey="import_export.guide_bulk_import_section.include_every_column_multi_value_languages_and_circuits" />
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  {guideBulkImportColumns.map((column) => (
                    <Badge key={column} variant="outline">
                      {column}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={downloadTemplate}>
                    <Download className="size-4" />
                    <T i18nKey="import_export.guide_bulk_import_section.download_template" />
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCopyTemplate}>
                    <Clipboard className="size-4" />
                    <T i18nKey="import_export.guide_bulk_import_section.copy_template" />
                  </Button>
                </div>
                {feedback ? (
                  <p className="text-xs text-muted-foreground">{feedback}</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base"><T i18nKey="import_export.guide_bulk_import_section.upload_csv" /></CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <label
                  htmlFor="guide-bulk-import-file"
                  className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 p-4 text-center"
                >
                  <FileUp className="size-5 text-muted-foreground" />
                  <span className="text-sm font-medium"><T i18nKey="import_export.guide_bulk_import_section.choose_a_csv_file" /></span>
                  <span className="text-xs text-muted-foreground">
                    <T i18nKey="import_export.guide_bulk_import_section.preview_first_apply_only_after_validation_is_complete" />
                  </span>
                </label>
                <Input
                  id="guide-bulk-import-file"
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={handleUpload}
                />
                {fileName ? (
                  <p className="text-xs text-muted-foreground">
                    <T i18nKey="import_export.guide_bulk_import_section.selected" /> {fileName}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {fileErrors.length > 0 ? (
            <Card className="border-red-200 bg-red-50/50">
              <CardContent>
                <p className="font-medium text-red-800"><T i18nKey="import_export.guide_bulk_import_section.csv_cannot_be_previewed" /></p>
                <ul className="mt-1 list-disc pl-5 text-sm text-red-800">
                  {fileErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {rows.length > 0 ? (
            <>
              <section className="grid gap-3 sm:grid-cols-3">
                {([
                  [t("status.ready"), summary.ready, "ready"],
                  [t("status.warnings"), summary.warning, "warning"],
                  [t("status.errors"), summary.error, "error"],
                ] as const).map(([label, count, state]) => (
                  <Card key={state} size="sm">
                    <CardContent className="flex items-center justify-between py-3">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <Badge variant="outline" className={stateConfig[state].className}>
                        {count}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </section>

              <Card>
                <CardHeader className="border-b">
                  <div>
                    <CardTitle className="text-base"><T i18nKey="import_export.guide_bulk_import_section.guide_import_preview" /></CardTitle>
                    <CardDescription>
                      <T i18nKey="import_export.guide_bulk_import_section.rows_are_classified_as_create_update_or_blocked" />
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto p-0">
                  <table className="w-full min-w-[960px] text-left text-xs">
                    <thead className="border-b bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium"><T i18nKey="import_export.guide_bulk_import_section.row" /></th>
                        <th className="px-2 py-2 font-medium"><T i18nKey="common.guide" /></th>
                        <th className="px-2 py-2 font-medium"><T i18nKey="import_export.guide_bulk_import_section.login_email" /></th>
                        <th className="px-2 py-2 font-medium"><T i18nKey="import_export.guide_bulk_import_section.languages" /></th>
                        <th className="px-2 py-2 font-medium"><T i18nKey="import_export.guide_bulk_import_section.circuits" /></th>
                        <th className="px-2 py-2 font-medium"><T i18nKey="common.status" /></th>
                        <th className="px-2 py-2 font-medium"><T i18nKey="import_export.guide_bulk_import_section.action" /></th>
                        <th className="px-2 py-2 font-medium"><T i18nKey="common.result" /></th>
                        <th className="px-2 py-2 pr-3 font-medium"><T i18nKey="common.notes" /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.rowNumber} className="border-b last:border-b-0">
                          <td className="px-3 py-2">{row.rowNumber}</td>
                          <td className="px-2 py-2 font-medium">
                            <div>{row.fullName || "-"}</div>
                            {row.phone ? (
                              <div className="text-muted-foreground">{row.phone}</div>
                            ) : null}
                          </td>
                          <td className="px-2 py-2">{row.authorizedLoginEmail || "-"}</td>
                          <td className="px-2 py-2">
                            <div>{row.preferredLanguage || "-"}</div>
                            <div className="text-muted-foreground">
                              {row.spokenLanguages.join(", ") || "Not configured"}
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            {row.circuitNames.join(", ") || "No matched circuits"}
                          </td>
                          <td className="px-2 py-2">{formatGuideStatus(row.status)}</td>
                          <td className="px-2 py-2 capitalize">
                            {row.action}
                          </td>
                          <td className="px-2 py-2">
                            <Badge variant="outline" className={stateConfig[row.state].className}>
                              {t(stateConfig[row.state].labelKey)}
                            </Badge>
                          </td>
                          <td className="max-w-80 px-2 py-2 pr-3 text-muted-foreground">
                            {resultByRowNumber.get(row.rowNumber)?.message ??
                              (row.issues.length > 0
                              ? row.issues.map((issue) => issue.message).join(" ")
                              : "Validated for import.")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-medium">
                  <T i18nKey="import_export.guide_bulk_import_section.this_will_create_or_update_guides_authorized_login" />
                </p>
                <p>
                  <T i18nKey="import_export.guide_bulk_import_section.rows_with_errors_are_skipped_warning_rows_can" />
                </p>
                <div className="flex justify-end">
                  <Button
                    disabled={
                      !canApplyImport ||
                      isApplying ||
                      appliedAt !== null ||
                      importableRows.length === 0
                    }
                    title={
                      appliedAt
                        ? "Upload the CSV again before retrying an import."
                        : canApplyImport
                        ? undefined
                        : applyUnavailableMessage
                    }
                    onClick={handleApplyImport}
                  >
                    {isApplying
                      ? "Applying import..."
                      : `Apply import (${importableRows.length})`}
                  </Button>
                </div>
                {!canApplyImport ? (
                  <p className="text-xs text-amber-900">{applyUnavailableMessage}</p>
                ) : null}
                {appliedAt ? (
                  <p className="text-xs text-amber-900">
                    <T i18nKey="import_export.guide_bulk_import_section.upload_the_csv_again_to_run_another_import" />
                  </p>
                ) : null}
              </div>

              {appliedAt ? (
                <Card>
                  <CardHeader className="border-b">
                    <div>
                      <CardTitle className="text-base"><T i18nKey="import_export.guide_bulk_import_section.import_result" /></CardTitle>
                      <CardDescription><T i18nKey="import_export.guide_bulk_import_section.completed" /> {appliedAt}</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-2 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <p><T i18nKey="import_export.guide_bulk_import_section.created_guides" /> {appliedSummary.created}</p>
                    <p><T i18nKey="import_export.guide_bulk_import_section.updated_guides" /> {appliedSummary.updated}</p>
                    <p><T i18nKey="import_export.guide_bulk_import_section.skipped_rows" /> {appliedSummary.skipped}</p>
                    <p><T i18nKey="import_export.guide_bulk_import_section.failed_rows" /> {appliedSummary.failed}</p>
                    <p><T i18nKey="import_export.guide_bulk_import_section.login_emails_created" /> {appliedSummary.emailsCreated}</p>
                    <p><T i18nKey="import_export.guide_bulk_import_section.login_emails_updated" /> {appliedSummary.emailsUpdated}</p>
                    <p><T i18nKey="import_export.guide_bulk_import_section.login_emails_revoked" /> {appliedSummary.emailsRevoked}</p>
                    <p>
                      <T i18nKey="import_export.guide_bulk_import_section.circuit_capabilities_updated" /> {appliedSummary.circuitCapabilitiesUpdated}
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </section>
  )
}
