"use client"

import { type ChangeEvent, useState } from "react"
import { Download, Upload } from "lucide-react"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { importGuideRow } from "@/lib/supabase/mutations/guide-import"
import type { Guide } from "@/lib/types/domain"
import { formatDateDisplay } from "@/lib/utils/date-format"
import { getGuideImportTemplate, guideImportColumns, parseGuideImportCsv, type GuideImportRow } from "@/lib/utils/guide-import"

export function GuideImportSection({ guides, canPreview, canApply, onApplied }: {
  guides: Guide[]
  canPreview: boolean
  canApply: boolean
  onApplied: () => Promise<string | null>
}) {
  const { t } = useI18n()
  const [rows, setRows] = useState<GuideImportRow[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [feedback, setFeedback] = useState("")

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrors([t("validation.upload_csv")])
      return
    }
    const result = parseGuideImportCsv(await file.text(), guides, t)
    setRows(result.rows)
    setErrors(result.fileErrors)
  }

  function download() {
    const url = URL.createObjectURL(new Blob([getGuideImportTemplate()], { type: "text/csv" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "guides-import-template.csv"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function apply() {
    let imported = 0
    let failed = 0
    for (const row of rows.filter((item) => item.state !== "error")) {
      const result = await importGuideRow(row)
      if (result.success) imported += 1
      else failed += 1
    }
    await onApplied()
    setFeedback(failed
      ? t("import_export.guide_import.result_with_failures", { imported, failed })
      : t("import_export.guide_import.result", { imported }))
  }

  return <section className="space-y-4">
    <div>
      <h2 className="text-lg font-semibold"><T i18nKey="navigation.guides" /></h2>
      <p className="text-sm text-muted-foreground"><T i18nKey="import_export.guide_import_section.only_full_guide_name_is_required_import_does" /></p>
    </div>
    <Card>
      <CardHeader>
        <CardTitle className="text-base"><T i18nKey="import_export.guide_import_section.1_download_template_2_upload_3_validate" /></CardTitle>
        <CardDescription>{guideImportColumns.join(" · ")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={download}><Download /><T i18nKey="import_export.guide_bulk_import_section.download_template" /></Button>
          <Button asChild disabled={!canPreview}>
            <label htmlFor="guide-import-file"><Upload /><T i18nKey="import_export.guide_bulk_import_section.upload_csv" /><Input id="guide-import-file" className="sr-only !size-px" type="file" accept=".csv" onChange={upload} /></label>
          </Button>
        </div>
        {errors.map((error) => <p className="text-sm text-red-700" key={error}>{error}</p>)}
      </CardContent>
    </Card>
    {rows.length ? <>
      <Card><CardContent className="overflow-x-auto px-0"><Table>
        <TableHeader><TableRow>
          <TableHead className="pl-4"><T i18nKey="import_export.guide_bulk_import_section.row" /></TableHead>
          <TableHead><T i18nKey="common.name" /></TableHead>
          <TableHead><T i18nKey="common.phone" /></TableHead>
          <TableHead><T i18nKey="import_export.guide_import_section.birth_date" /></TableHead>
          <TableHead><T i18nKey="import_export.guide_import_section.city" /></TableHead>
          <TableHead><T i18nKey="common.email" /></TableHead>
          <TableHead><T i18nKey="common.result" /></TableHead>
        </TableRow></TableHeader>
        <TableBody>{rows.map((row) => <TableRow key={row.rowNumber}>
          <TableCell className="pl-4">{row.rowNumber}</TableCell>
          <TableCell className="font-medium">{row.name || "—"}</TableCell>
          <TableCell>{row.phone || "—"}</TableCell>
          <TableCell>{formatDateDisplay(row.birthDateIso)}</TableCell>
          <TableCell>{row.city || "—"}</TableCell>
          <TableCell>{row.email || "—"}</TableCell>
          <TableCell>
            <Badge variant="outline">{row.state === "error" ? t("status.invalid") : row.action === "update" ? t("import_export.guide_import.existing_update") : t("import_export.guide_import.new_guide")}</Badge>
            {row.issues.map((issue) => <div key={issue} className="mt-1 text-xs text-red-700">{issue}</div>)}
          </TableCell>
        </TableRow>)}</TableBody>
      </Table></CardContent></Card>
      <div className="flex justify-end"><Button disabled={!canApply || !rows.some((row) => row.state !== "error")} onClick={apply}><T i18nKey="import_export.guide_import_section.import_valid_rows" /></Button></div>
      {feedback ? <p>{feedback}</p> : null}
    </> : null}
  </section>
}
