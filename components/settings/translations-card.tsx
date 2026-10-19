"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import { Download, LoaderCircle, RefreshCcw, Upload } from "lucide-react"

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
import {
  createTranslationCsvRows,
  editableTranslationLanguageCodes,
  parseTranslationCsv,
  translationLanguageNames,
  type TranslationCatalogEntry,
  type TranslationImportRow,
  type TranslationLanguage,
} from "@/lib/i18n/catalog"
import { importTranslationRows } from "@/lib/supabase/mutations/translations"
import { getTranslationCatalog } from "@/lib/supabase/queries/translations"
import { downloadCsv } from "@/lib/utils/csv"

type TranslationsCardProps = {
  canView: boolean
  canManage: boolean
  permissionMessage: string
}

function completionFor(catalog: TranslationCatalogEntry[], language: TranslationLanguage) {
  const configured = catalog.filter((entry) => entry[language].trim()).length
  return {
    configured,
    missing: catalog.length - configured,
    percentage: catalog.length ? Math.round((configured / catalog.length) * 100) : 0,
  }
}

export function TranslationsCard({
  canView,
  canManage,
  permissionMessage,
}: TranslationsCardProps) {
  const { t } = useI18n()
  const [catalog, setCatalog] = useState<TranslationCatalogEntry[]>([])
  const [rows, setRows] = useState<TranslationImportRow[]>([])
  const [fileErrors, setFileErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState("")
  const [status, setStatus] = useState("")
  const [isLoading, setIsLoading] = useState(canView)
  const [isImporting, setIsImporting] = useState(false)
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [previewVersion, setPreviewVersion] = useState(0)
  const [confirmationVersion, setConfirmationVersion] = useState<number | null>(null)
  const importingRef = useRef(false)

  async function loadCatalog(successMessage = "") {
    if (!canView) return
    setIsLoading(true)
    const result = await getTranslationCatalog()
    setIsLoading(false)
    if (result.error) {
      setStatus(result.error)
      return
    }
    setCatalog(result.data)
    setStatus(successMessage)
  }

  useEffect(() => {
    if (!canView) return
    let isMounted = true
    void getTranslationCatalog().then((result) => {
      if (!isMounted) return
      setIsLoading(false)
      if (result.error) {
        setStatus(result.error)
        return
      }
      setCatalog(result.data)
      setStatus("")
    })
    return () => {
      isMounted = false
    }
  }, [canView])

  const importableRows = useMemo(
    () => rows.filter((row) => row.state !== "invalid" && row.changedLanguages.length),
    [rows]
  )
  const previewSummary = useMemo(
    () => ({
      es: rows.reduce((count, row) => count + Number(row.changedLanguages.includes("es")), 0),
      fr: rows.reduce((count, row) => count + Number(row.changedLanguages.includes("fr")), 0),
      tr: rows.reduce((count, row) => count + Number(row.changedLanguages.includes("tr")), 0),
      missing: rows.reduce((count, row) => count + row.missingLanguages.length, 0),
      invalidPlaceholders: rows.filter((row) =>
        row.issues.some((issue) => issue.code === "placeholder_mismatch")
      ).length,
      unknown: rows.filter((row) =>
        row.issues.some((issue) => issue.code === "unknown_key")
      ).length,
      unchanged: rows.filter((row) => row.state === "unchanged").length,
    }),
    [rows]
  )
  const totalChanges =
    previewSummary.es + previewSummary.fr + previewSummary.tr

  function exportCatalog(missingOnly: boolean) {
    const date = new Date().toISOString().slice(0, 10)
    const exported = downloadCsv(
      `translations${missingOnly ? "-missing" : ""}-${date}.csv`,
      createTranslationCsvRows(catalog, missingOnly),
      { includeBom: true }
    )
    if (!exported) setStatus(t("settings.translations_card.message_no_translation_entries_are_available_to_export"))
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setConfirmationOpen(false)
    setConfirmationVersion(null)
    setPreviewVersion((version) => version + 1)
    setStatus("")

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setRows([])
      setFileName("")
      setFileErrors([t("validation.upload_csv")])
      return
    }

    const result = parseTranslationCsv(await file.text(), catalog, t)
    setRows(result.rows)
    setFileErrors(result.fileErrors)
    setFileName(file.name)
  }

  function openConfirmation() {
    if (!canManage || importingRef.current || !importableRows.length) return
    setConfirmationVersion(previewVersion)
    setConfirmationOpen(true)
  }

  async function confirmImport() {
    if (
      !canManage ||
      importingRef.current ||
      confirmationVersion !== previewVersion ||
      !importableRows.length
    ) {
      setConfirmationOpen(false)
      return
    }

    importingRef.current = true
    setIsImporting(true)
    const currentRows = [...importableRows]
    try {
      const result = await importTranslationRows(currentRows)
      if (!result.success) {
        setStatus(result.message)
        return
      }
      setRows([])
      setFileErrors([])
      setFileName("")
      setConfirmationOpen(false)
      await loadCatalog(t("settings.translations.imported_count", { count: result.updatedCount }))
    } finally {
      importingRef.current = false
      setIsImporting(false)
    }
  }

  const completion = Object.fromEntries(
    (["en", ...editableTranslationLanguageCodes] as TranslationLanguage[]).map((language) => [
      language,
      completionFor(catalog, language),
    ])
  ) as Record<TranslationLanguage, ReturnType<typeof completionFor>>

  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle><T i18nKey="settings.translations_card.translations" /></CardTitle>
          <CardDescription>{permissionMessage}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle><T i18nKey="settings.translations_card.translation_catalog" /></CardTitle>
              <CardDescription>
                <T i18nKey="settings.translations_card.english_is_the_source_and_fallback_spanish_french" />
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" disabled={isLoading} onClick={() => void loadCatalog()}>
              {isLoading ? <LoaderCircle className="animate-spin" /> : <RefreshCcw />}
              <T i18nKey="common.refresh" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {(["en", "es", "fr", "tr"] as TranslationLanguage[]).map((language) => (
              <div key={language} className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="text-xs text-muted-foreground">
                  {translationLanguageNames[language]}
                </div>
                <div className="font-semibold">
                  {completion[language].percentage}%
                  {language === "en"
                    ? completion[language].missing
                      ? ` · ${t("settings.translations.source_missing", { count: completion[language].missing })}`
                      : ` · ${t("settings.translations.source")}`
                    : ` · ${t("settings.translations.missing_count", { count: completion[language].missing })}`}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!catalog.length} onClick={() => exportCatalog(false)}>
              <Download />
              <T i18nKey="settings.translations_card.export_all_translations" />
            </Button>
            <Button variant="outline" disabled={!catalog.length} onClick={() => exportCatalog(true)}>
              <Download />
              <T i18nKey="settings.translations_card.export_missing_translations" />
            </Button>
            <Button asChild disabled={!canManage || !catalog.length || isImporting}>
              <label
                htmlFor="translations-import-file"
                className={!canManage || !catalog.length || isImporting ? "pointer-events-none" : undefined}
              >
                <Upload />
                <T i18nKey="settings.translations_card.import_translations" />
                <Input
                  id="translations-import-file"
                  className="sr-only !size-px"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={!canManage || !catalog.length || isImporting}
                  onChange={upload}
                />
              </label>
            </Button>
          </div>

          {!canManage ? <p className="text-sm text-amber-700">{permissionMessage}</p> : null}
          {fileName ? <p className="text-sm text-muted-foreground">{fileName}</p> : null}
          {fileErrors.map((error) => (
            <p key={error} className="text-sm text-red-700">{error}</p>
          ))}
          {status ? <p role="status" className="text-sm">{status}</p> : null}
        </CardContent>
      </Card>

      {rows.length ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle><T i18nKey="settings.translations_card.import_preview" /></CardTitle>
            <CardDescription><T i18nKey="settings.translations_card.no_database_changes_occur_until_import_is_confirmed" /></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-0">
            <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 xl:grid-cols-7">
              {[
                [t("settings.translations.spanish_changes"), previewSummary.es],
                [t("settings.translations.french_changes"), previewSummary.fr],
                [t("settings.translations.turkish_changes"), previewSummary.tr],
                [t("settings.translations.missing_translations"), previewSummary.missing],
                [t("settings.translations.invalid_placeholders"), previewSummary.invalidPlaceholders],
                [t("settings.translations.unknown_keys"), previewSummary.unknown],
                [t("settings.translations.unchanged_rows"), previewSummary.unchanged],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border bg-muted/20 px-3 py-2">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="font-semibold">{value}</div>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto border-y">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4"><T i18nKey="settings.translations_card.row" /></TableHead>
                    <TableHead><T i18nKey="settings.translations_card.key" /></TableHead>
                    <TableHead><T i18nKey="settings.translations_card.context" /></TableHead>
                    <TableHead><T i18nKey="settings.translations_card.changes" /></TableHead>
                    <TableHead><T i18nKey="common.result" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={`${row.rowNumber}-${row.key}`}>
                      <TableCell className="pl-4">{row.rowNumber}</TableCell>
                      <TableCell className="font-mono text-xs">{row.key || "—"}</TableCell>
                      <TableCell>{row.context || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.changedLanguages.length
                            ? row.changedLanguages.map((language) => (
                                <Badge key={language} variant="secondary">
                                  {language.toUpperCase()}
                                </Badge>
                              ))
                            : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-72">
                        <Badge
                          variant="outline"
                          className={
                            row.state === "invalid"
                              ? "border-red-200 text-red-700"
                              : row.state === "warning"
                                ? "border-amber-200 text-amber-800"
                                : row.state === "ready"
                                  ? "border-emerald-200 text-emerald-800"
                                  : "text-muted-foreground"
                          }
                        >
                          {row.state === "invalid"
                            ? t("status.invalid")
                            : row.state === "warning"
                              ? t("status.warning")
                              : row.state === "ready"
                                ? t("status.ready")
                                : t("status.unchanged")}
                        </Badge>
                        {row.issues.map((issue) => (
                          <div
                            key={issue.message}
                            className={`mt-1 text-xs ${issue.severity === "error" ? "text-red-700" : "text-amber-800"}`}
                          >
                            {issue.message}
                          </div>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end p-4 pt-0">
              <Button disabled={!canManage || !importableRows.length || isImporting} onClick={openConfirmation}>
                {t("settings.translations.confirm_preview", { count: totalChanges })}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        open={confirmationOpen}
        onOpenChange={(open) => {
          if (!importingRef.current) setConfirmationOpen(open)
        }}
      >
        <DialogContent showCloseButton={!isImporting}>
          <DialogHeader>
            <DialogTitle>{t("settings.translations.confirm_title", { count: totalChanges })}</DialogTitle>
            <DialogDescription>
              <T i18nKey="settings.translations_card.only_spanish_french_and_turkish_values_will_be" />
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/25 p-3 text-sm">
            {t("settings.translations.catalog_rows", { count: importableRows.length })}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isImporting} onClick={() => setConfirmationOpen(false)}>
              <T i18nKey="common.cancel" />
            </Button>
            <Button
              disabled={isImporting || confirmationVersion !== previewVersion || !importableRows.length}
              onClick={confirmImport}
            >
              {isImporting ? t("settings.translations.importing") : t("settings.translations.confirm_import")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
