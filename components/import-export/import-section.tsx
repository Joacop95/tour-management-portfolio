"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import Link from "next/link"
import { ChangeEvent, useMemo, useRef, useState } from "react"
import { Download, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { importSupabaseGroupRow } from "@/lib/supabase/mutations/group-import"
import type { GroupCodeCircuitMapping } from "@/lib/supabase/queries/import-configuration"
import type { Circuit, Guide, TourGroup } from "@/lib/types/domain"
import { formatDateDisplay } from "@/lib/utils/date-format"
import {
  getGroupImportTemplate,
  groupImportColumns,
  parseGroupImportCsv,
  type GroupImportRow,
} from "@/lib/utils/group-import"

type ImportSectionProps = {
  circuits: Circuit[]
  guides: Guide[]
  groups: TourGroup[]
  mappings: GroupCodeCircuitMapping[]
  canPreview: boolean
  canApply: boolean
  onApplied: () => Promise<string | null>
}

export function ImportSection({
  circuits,
  guides,
  groups,
  mappings,
  canPreview,
  canApply,
  onApplied,
}: ImportSectionProps) {
  const { t } = useI18n()
  const [rows, setRows] = useState<GroupImportRow[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState("")
  const [feedback, setFeedback] = useState("")
  const [applying, setApplying] = useState(false)
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [previewVersion, setPreviewVersion] = useState(0)
  const [confirmationVersion, setConfirmationVersion] = useState<number | null>(null)
  const [completedVersion, setCompletedVersion] = useState<number | null>(null)
  const applyingRef = useRef(false)

  const summary = useMemo(
    () => ({
      total: rows.length,
      ready: rows.filter((row) => row.state !== "error" && row.groupStatus === "active").length,
      cancelled: rows.filter((row) => row.state !== "error" && row.groupStatus === "cxl").length,
      merged: rows.filter((row) => row.state !== "error" && row.groupStatus === "fusionado").length,
      warnings: rows.filter((row) => row.state === "warning").length,
      invalid: rows.filter((row) => row.state === "error").length,
    }),
    [rows]
  )
  const importable = useMemo(
    () => rows.filter((row) => row.state !== "error" && row.action === "create"),
    [rows]
  )
  const confirmationSummary = useMemo(
    () => ({
      valid: importable.length,
      active: importable.filter((row) => row.groupStatus === "active").length,
      cancelled: importable.filter((row) => row.groupStatus === "cxl").length,
      merged: importable.filter((row) => row.groupStatus === "fusionado").length,
      withGuide: importable.filter((row) => row.guideId).length,
      withoutGuide: importable.filter((row) => !row.guideId).length,
      warnings: importable.filter((row) => row.state === "warning").length,
    }),
    [importable]
  )

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setConfirmationOpen(false)
    setConfirmationVersion(null)
    setCompletedVersion(null)
    setPreviewVersion((version) => version + 1)
    setFeedback("")

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrors([t("validation.upload_csv")])
      setRows([])
      setFileName("")
      return
    }

    const result = parseGroupImportCsv({
      csv: await file.text(),
      circuits,
      guides,
      groups,
      mappings,
      translate: t,
    })
    setRows(result.rows)
    setErrors(result.fileErrors)
    setFileName(file.name)
  }

  function download() {
    const url = URL.createObjectURL(
      new Blob([getGroupImportTemplate()], { type: "text/csv;charset=utf-8" })
    )
    const link = document.createElement("a")
    link.href = url
    link.download = "groups-import-template.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  function openConfirmation() {
    if (
      !canApply ||
      applyingRef.current ||
      !importable.length ||
      completedVersion === previewVersion
    ) {
      return
    }
    setConfirmationVersion(previewVersion)
    setConfirmationOpen(true)
  }

  async function confirmImport() {
    if (
      !canApply ||
      applyingRef.current ||
      confirmationVersion !== previewVersion ||
      !importable.length
    ) {
      setConfirmationOpen(false)
      return
    }

    const rowsToImport = [...importable]
    applyingRef.current = true
    setApplying(true)
    let created = 0
    let failed = 0

    try {
      for (const row of rowsToImport) {
        const result = await importSupabaseGroupRow(row)
        if (result.success) created += 1
        else failed += 1
      }
      await onApplied()
      if (created > 0) setCompletedVersion(previewVersion)
      setFeedback(failed
        ? t("import_export.groups.imported_with_failures", { count: created, failed })
        : t("import_export.groups.imported", { count: created }))
      setConfirmationOpen(false)
    } catch {
      setFeedback(t("import_export.groups.import_failed"))
    } finally {
      applyingRef.current = false
      setApplying(false)
    }
  }

  const importCompleted = completedVersion === previewVersion

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold"><T i18nKey="navigation.groups" /></h2>
          <p className="text-sm text-muted-foreground">
            <T i18nKey="import_export.import_section.only_group_code_is_required_circuit_and_end" />
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/settings?section=circuits#group-import-rules">
            <T i18nKey="import_export.import_section.manage_group_import_rules" />
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base"><T i18nKey="import_export.guide_import_section.1_download_template_2_upload_3_validate" /></CardTitle>
          <CardDescription>{groupImportColumns.join(" · ")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={download}>
              <Download />
              <T i18nKey="import_export.guide_bulk_import_section.download_template" />
            </Button>
            <Button asChild disabled={!canPreview}>
              <label htmlFor="group-import-file">
                <Upload />
                <T i18nKey="import_export.guide_bulk_import_section.upload_csv" />
                <Input
                  id="group-import-file"
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only !size-px"
                  onChange={upload}
                />
              </label>
            </Button>
          </div>
          {fileName ? <p className="text-sm text-muted-foreground">{fileName}</p> : null}
          {errors.map((error) => (
            <p key={error} className="text-sm text-red-700">
              {error}
            </p>
          ))}
        </CardContent>
      </Card>

      {rows.length ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {Object.entries(summary).map(([key, value]) => (
              <div key={key} className="rounded-lg border p-3">
                <div className="text-xs capitalize text-muted-foreground">{key}</div>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base"><T i18nKey="import_export.import_preview_table.import_preview" /></CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4"><T i18nKey="import_export.guide_bulk_import_section.row" /></TableHead>
                    <TableHead><T i18nKey="import_export.import_section.grupo" /></TableHead>
                    <TableHead><T i18nKey="import_export.import_section.circuito" /></TableHead>
                    <TableHead><T i18nKey="import_export.import_section.guia" /></TableHead>
                    <TableHead><T i18nKey="common.status" /></TableHead>
                    <TableHead><T i18nKey="import_export.import_section.fecha_inicio" /></TableHead>
                    <TableHead><T i18nKey="import_export.import_section.fecha_fin" /></TableHead>
                    <TableHead><T i18nKey="common.result" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.rowNumber}>
                      <TableCell className="pl-4">{row.rowNumber}</TableCell>
                      <TableCell className="font-medium">{row.groupCode || "—"}</TableCell>
                      <TableCell>
                        {row.circuitName}
                        {row.circuitDerived ? (
                          <div className="text-xs text-blue-700"><T i18nKey="import_export.import_section.derived_from_prefix" /></div>
                        ) : null}
                      </TableCell>
                      <TableCell>{row.groupStatus === "active" ? row.guideName : "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {row.groupStatus === "cxl"
                            ? "CXL"
                            : row.groupStatus === "fusionado"
                              ? "FUSIONADO"
                              : t("status.active")}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateDisplay(row.startDateIso)}</TableCell>
                      <TableCell>
                        {formatDateDisplay(row.endDateIso)}
                        {row.endDateDerived ? (
                          <div className="text-xs text-blue-700"><T i18nKey="import_export.import_section.calculated" /></div>
                        ) : null}
                      </TableCell>
                      <TableCell className="min-w-64">
                        <Badge
                          variant="outline"
                          className={
                            row.state === "error"
                              ? "border-red-200 text-red-700"
                              : row.state === "warning"
                                ? "border-amber-200 text-amber-800"
                                : "border-emerald-200 text-emerald-800"
                          }
                        >
                          {row.state === "error"
                            ? t("status.invalid")
                            : row.state === "warning"
                              ? t("import_export.import.ready_with_warnings")
                              : t("status.ready")}
                        </Badge>
                        {row.issues.map((issue) => (
                          <div
                            key={issue.message}
                            className={`mt-1 text-xs ${
                              issue.severity === "error" ? "text-red-700" : "text-muted-foreground"
                            }`}
                          >
                            {issue.message}
                          </div>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button
              disabled={!canApply || applying || !importable.length || importCompleted}
              onClick={openConfirmation}
            >
              {applying
                ? "Importing..."
                : importCompleted
                  ? t("import_export.import.completed")
                  : `Import valid rows (${importable.length})`}
            </Button>
          </div>
          {feedback ? (
            <p role="status" className="text-sm">
              {feedback}
            </p>
          ) : null}
        </>
      ) : null}

      <Dialog
        open={confirmationOpen}
        onOpenChange={(open) => {
          if (!applyingRef.current) setConfirmationOpen(open)
        }}
      >
        <DialogContent showCloseButton={!applying}>
          <DialogHeader>
            <DialogTitle>
              <T i18nKey="import_export.import_section.import" /> {confirmationSummary.valid} {confirmationSummary.valid === 1 ? "group" : "groups"}?
            </DialogTitle>
            <DialogDescription>
              <T i18nKey="import_export.import_section.new_groups_will_be_created_existing_groups_will" />
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border bg-muted/30 p-3 text-sm">
            <div>
              <dt className="text-muted-foreground"><T i18nKey="import_export.import_section.total_valid_rows" /></dt>
              <dd className="font-semibold">{confirmationSummary.valid}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground"><T i18nKey="import_export.import_section.rows_with_warnings" /></dt>
              <dd className="font-semibold">{confirmationSummary.warnings}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground"><T i18nKey="status.active" /></dt>
              <dd className="font-semibold">{confirmationSummary.active}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">CXL</dt>
              <dd className="font-semibold">{confirmationSummary.cancelled}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">FUSIONADO</dt>
              <dd className="font-semibold">{confirmationSummary.merged}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground"><T i18nKey="import_export.import_section.with_guide" /></dt>
              <dd className="font-semibold">{confirmationSummary.withGuide}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground"><T i18nKey="status.without_guide" /></dt>
              <dd className="font-semibold">{confirmationSummary.withoutGuide}</dd>
            </div>
          </dl>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={applying}
              onClick={() => setConfirmationOpen(false)}
            >
              <T i18nKey="common.cancel" />
            </Button>
            <Button
              disabled={
                applying ||
                confirmationVersion !== previewVersion ||
                !confirmationSummary.valid
              }
              onClick={confirmImport}
            >
              {applying ? t("import_export.import.importing") : t("import_export.import.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
