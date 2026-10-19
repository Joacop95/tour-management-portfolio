"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { useEffect, useMemo, useState } from "react"
import { Download, FileDown, RotateCcw, Search } from "lucide-react"

import { DatePickerInput } from "@/components/common/date-picker-input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getSupabaseAvailabilitySubmissions, type SupabaseAvailabilitySubmission } from "@/lib/supabase/queries/availability"
import { getSupabaseChangeRequestInbox, type SupabaseChangeRequestInboxItem } from "@/lib/supabase/queries/change-requests"
import type { Circuit, Guide, GuideAvailability, TourGroup } from "@/lib/types/domain"
import { downloadCsv } from "@/lib/utils/csv"
import { formatDateDisplay } from "@/lib/utils/date-format"
import type { UiTranslator } from "@/lib/i18n/ui-catalog"

export type ExportDataset = "groups" | "guides" | "assignments" | "availability" | "change-requests"

type ExportSectionProps = {
  groups: TourGroup[]
  circuits: Circuit[]
  guides: Guide[]
  availability: GuideAvailability[]
  allowedDatasets: ExportDataset[]
  isAuthenticated: boolean
  isSupabase: boolean
  loadError: string | null
}

type ExportColumn = { id: string; label: string }
type ExportRow = {
  id: string
  values: Record<string, string | number>
  search: string
  guideId?: string | null
  circuitId?: string | null
  dateIso?: string
  status?: string
  confirmation?: string
  year?: number
  availabilityType?: string
  submissionStatus?: string
}
type Filters = {
  search: string
  guideId: string
  circuitId: string
  status: string
  confirmation: string
  dateFrom: string
  dateTo: string
  year: string
  availabilityType: string
  submissionStatus: string
}

const emptyFilters: Filters = {
  search: "", guideId: "all", circuitId: "all", status: "all",
  confirmation: "all", dateFrom: "", dateTo: "", year: "all",
  availabilityType: "all", submissionStatus: "all",
}

function getDatasetConfig(t: UiTranslator): Record<ExportDataset, { label: string; description: string; columns: ExportColumn[] }> {
  return {
  groups: {
    label: t("navigation.groups"),
    description: t("import_export.datasets.groups_description"),
    columns: [
      { id: "groupCode", label: t("import_export.columns.group_code") }, { id: "circuit", label: t("common.circuit") },
      { id: "guide", label: t("common.guide") }, { id: "startDate", label: t("common.start_date") },
      { id: "endDate", label: t("common.end_date") }, { id: "groupStatus", label: t("groups.table.group_status") },
      { id: "confirmationStatus", label: t("import_export.columns.confirmation_status") },
    ],
  },
  guides: {
    label: t("navigation.guides"),
    description: t("import_export.datasets.guides_description"),
    columns: [
      { id: "name", label: t("import_export.columns.guide_full_name") }, { id: "phone", label: t("common.phone") },
      { id: "birthDate", label: t("import_export.columns.birth_date") }, { id: "city", label: t("import_export.columns.city") },
      { id: "email", label: t("common.email") }, { id: "preferredLanguage", label: t("guides.table.preferred_language") },
      { id: "spokenLanguages", label: t("guides.table.spoken_languages") }, { id: "guideStatus", label: t("import_export.columns.guide_status") },
    ],
  },
  assignments: {
    label: t("navigation.assignments"),
    description: t("import_export.datasets.assignments_description"),
    columns: [
      { id: "groupCode", label: t("import_export.columns.group_code") }, { id: "circuit", label: t("common.circuit") },
      { id: "guide", label: t("common.guide") }, { id: "assignmentStatus", label: t("import_export.columns.assignment_status") },
      { id: "confirmationStatus", label: t("import_export.columns.confirmation_status") }, { id: "startDate", label: t("common.start_date") },
      { id: "endDate", label: t("common.end_date") },
    ],
  },
  availability: {
    label: t("navigation.availability"),
    description: t("import_export.datasets.availability_description"),
    columns: [
      { id: "guide", label: t("common.guide") }, { id: "year", label: t("common.year") },
      { id: "startDate", label: t("common.start_date") }, { id: "endDate", label: t("common.end_date") },
      { id: "availabilityType", label: t("import_export.columns.availability_type") }, { id: "source", label: t("common.source") },
      { id: "submissionStatus", label: t("import_export.columns.submission_status") },
    ],
  },
  "change-requests": {
    label: t("navigation.change_requests"),
    description: t("import_export.datasets.change_requests_description"),
    columns: [
      { id: "guide", label: t("common.guide") }, { id: "requestType", label: t("import_export.columns.request_type") },
      { id: "relatedGroup", label: t("import_export.columns.related_group") }, { id: "status", label: t("common.status") },
      { id: "submittedDate", label: t("import_export.columns.submitted_date") }, { id: "resolvedDate", label: t("import_export.columns.resolved_date") },
      { id: "guideVisibleResponse", label: t("import_export.columns.guide_visible_response") },
    ],
  },
  }
}

function title(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase())
}

function datePart(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ""
}

function optionalDate(value: string | null | undefined) {
  return value ? formatDateDisplay(value) : ""
}

function filenameDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function ExportSection({ groups, circuits, guides, availability, allowedDatasets, isAuthenticated, isSupabase, loadError }: ExportSectionProps) {
  const { t } = useI18n()
  const datasetConfig = useMemo(() => getDatasetConfig(t), [t])
  const [dataset, setDataset] = useState<ExportDataset>("groups")
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [selectedColumns, setSelectedColumns] = useState<Record<ExportDataset, string[]>>(
    () => Object.fromEntries(Object.entries(datasetConfig).map(([key, config]) => [key, config.columns.map((column) => column.id)])) as Record<ExportDataset, string[]>
  )
  const [submissions, setSubmissions] = useState<SupabaseAvailabilitySubmission[] | null>(null)
  const [changeRequests, setChangeRequests] = useState<SupabaseChangeRequestInboxItem[] | null>(null)
  const [optionalLoadError, setOptionalLoadError] = useState<string | null>(null)
  const canLoadAvailability = allowedDatasets.includes("availability")
  const canLoadChangeRequests = allowedDatasets.includes("change-requests")

  useEffect(() => {
    let active = true
    async function loadOptionalData() {
      const [submissionResult, requestResult] = await Promise.all([
        canLoadAvailability ? getSupabaseAvailabilitySubmissions() : Promise.resolve({ data: [] as SupabaseAvailabilitySubmission[], error: null }),
        canLoadChangeRequests ? getSupabaseChangeRequestInbox() : Promise.resolve({ data: [] as SupabaseChangeRequestInboxItem[], error: null, warning: null }),
      ])
      if (!active) return
      setSubmissions(submissionResult.data)
      setChangeRequests(requestResult.data)
      setOptionalLoadError(submissionResult.error || requestResult.error ? "Unable to load export data." : null)
    }
    void loadOptionalData()
    return () => { active = false }
  }, [canLoadAvailability, canLoadChangeRequests])

  const circuitById = useMemo(() => new Map(circuits.map((item) => [item.id, item.name])), [circuits])
  const guideById = useMemo(() => new Map(guides.map((item) => [item.id, item.name])), [guides])
  const submissionByGuideYear = useMemo(() => new Map((submissions ?? []).map((item) => [`${item.guideId}:${item.year}`, item.status])), [submissions])
  const rowsByDataset = useMemo<Record<ExportDataset, ExportRow[]>>(() => ({
    groups: groups.map((group) => ({
      id: group.id, guideId: group.guideId, circuitId: group.circuitId, dateIso: group.startDateIso,
      status: group.groupStatus, confirmation: group.guideId ? group.confirmationStatus : "without-guide",
      search: `${group.code} ${guideById.get(group.guideId ?? "") ?? ""} ${circuitById.get(group.circuitId) ?? ""}`.toLowerCase(),
      values: { groupCode: group.code, circuit: circuitById.get(group.circuitId) ?? "No circuit", guide: guideById.get(group.guideId ?? "") ?? "Without guide", startDate: optionalDate(group.startDateIso), endDate: optionalDate(group.endDateIso), groupStatus: title(group.groupStatus), confirmationStatus: group.guideId ? title(group.confirmationStatus) : "Without guide" },
    })),
    guides: guides.map((guide) => ({
      id: guide.id, guideId: guide.id, status: guide.status,
      search: `${guide.name} ${guide.email} ${guide.phone ?? ""} ${guide.city ?? ""} ${guide.preferredLanguage} ${guide.languages.join(" ")}`.toLowerCase(),
      values: { name: guide.name, phone: guide.phone ?? "", birthDate: optionalDate(guide.birthDateIso), city: guide.city ?? "", email: guide.email, preferredLanguage: guide.preferredLanguage, spokenLanguages: guide.languages.join("; "), guideStatus: title(guide.status) },
    })),
    assignments: groups.map((group) => ({
      id: group.currentAssignmentId ?? group.id, guideId: group.guideId, circuitId: group.circuitId, dateIso: group.startDateIso,
      status: group.assignmentStatus, confirmation: group.guideId ? group.confirmationStatus : "without-guide",
      search: `${group.code} ${guideById.get(group.guideId ?? "") ?? ""} ${circuitById.get(group.circuitId) ?? ""}`.toLowerCase(),
      values: { groupCode: group.code, circuit: circuitById.get(group.circuitId) ?? "No circuit", guide: guideById.get(group.guideId ?? "") ?? "Without guide", assignmentStatus: title(group.assignmentStatus), confirmationStatus: group.guideId ? title(group.confirmationStatus) : "Without guide", startDate: optionalDate(group.startDateIso), endDate: optionalDate(group.endDateIso) },
    })),
    availability: availability.map((record) => {
      const year = Number(record.startDateIso.slice(0, 4))
      const submissionStatus = submissionByGuideYear.get(`${record.guideId}:${year}`) ?? "not-submitted"
      return { id: record.id, guideId: record.guideId, dateIso: record.startDateIso, year, status: record.status, availabilityType: record.status, submissionStatus, search: `${guideById.get(record.guideId) ?? ""} ${record.status} ${record.source}`.toLowerCase(), values: { guide: guideById.get(record.guideId) ?? "Unknown guide", year, startDate: optionalDate(record.startDateIso), endDate: optionalDate(record.endDateIso), availabilityType: title(record.status), source: record.source === "guide-submitted" ? "Guide submitted" : record.source === "assignment-generated" ? "Assignment generated" : "Internal", submissionStatus: title(submissionStatus) } }
    }),
    "change-requests": (changeRequests ?? []).map((request) => {
      const resolved = request.completedAt ?? request.reviewedAt ?? request.cancelledAt
      return { id: request.id, guideId: request.guideId, circuitId: request.circuitId, dateIso: datePart(request.requestedAt), status: request.requestStatus, search: `${request.guideName ?? ""} ${request.groupCode ?? ""} ${request.requestType} ${request.requestStatus}`.toLowerCase(), values: { guide: request.guideName ?? "Unknown guide", requestType: title(request.requestType), relatedGroup: request.groupCode ?? "", status: title(request.requestStatus), submittedDate: optionalDate(datePart(request.requestedAt)), resolvedDate: optionalDate(datePart(resolved)), guideVisibleResponse: request.decisionReason ?? "" } }
    }),
  }), [availability, changeRequests, circuitById, groups, guideById, guides, submissionByGuideYear])

  const availableDatasets = (Object.keys(datasetConfig) as ExportDataset[]).filter((key) => allowedDatasets.includes(key))
  const activeDataset = allowedDatasets.includes(dataset) ? dataset : availableDatasets[0] ?? dataset
  const activeConfig = datasetConfig[activeDataset]
  const activeRows = rowsByDataset[activeDataset]
  const filteredRows = activeRows.filter((row) => {
    const search = filters.search.trim().toLowerCase()
    return (!search || row.search.includes(search)) &&
      (filters.guideId === "all" || row.guideId === filters.guideId) &&
      (filters.circuitId === "all" || row.circuitId === filters.circuitId) &&
      (filters.status === "all" || row.status === filters.status) &&
      (filters.confirmation === "all" || row.confirmation === filters.confirmation) &&
      (!filters.dateFrom || (row.dateIso ?? "") >= filters.dateFrom) &&
      (!filters.dateTo || (row.dateIso ?? "") <= filters.dateTo) &&
      (filters.year === "all" || row.year === Number(filters.year)) &&
      (filters.availabilityType === "all" || row.availabilityType === filters.availabilityType) &&
      (filters.submissionStatus === "all" || row.submissionStatus === filters.submissionStatus)
  })
  const selected = selectedColumns[activeDataset]
  const visibleColumns = activeConfig.columns.filter((column) => selected.includes(column.id))
  const years = Array.from(new Set(availability.map((record) => record.startDateIso.slice(0, 4)).filter(Boolean))).sort()
  const error = loadError || optionalLoadError

  function selectDataset(next: ExportDataset) { setDataset(next); setFilters(emptyFilters) }
  function updateFilter<Key extends keyof Filters>(key: Key, value: Filters[Key]) { setFilters((current) => ({ ...current, [key]: value })) }
  function handleExport() {
    if (!filteredRows.length || !visibleColumns.length) return
    const csvRows = filteredRows.map((row) => Object.fromEntries(visibleColumns.map((column) => [column.label, row.values[column.id] ?? ""])))
    downloadCsv(`${activeDataset}-${filenameDate()}.csv`, csvRows)
  }

  if (!isAuthenticated || !isSupabase) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground"><T i18nKey="import_export.export_section.sign_in_with_an_authorized_internal_account_to" /></CardContent></Card>
  }

  return <section className="space-y-4">
    <div><h2 className="text-lg font-semibold"><T i18nKey="import_export.export_section.operational_export" /></h2><p className="text-sm text-muted-foreground"><T i18nKey="import_export.export_section.exports_use_the_current_rls_scoped_supabase_snapshot" /></p></div>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{(Object.keys(datasetConfig) as ExportDataset[]).map((key) => { const allowed=allowedDatasets.includes(key); return <button key={key} type="button" disabled={!allowed} className={`rounded-md border p-3 text-left text-sm transition ${activeDataset===key?"border-primary/40 bg-primary/8":"hover:bg-muted"} disabled:cursor-not-allowed disabled:opacity-45`} onClick={()=>selectDataset(key)}><span className="font-medium">{datasetConfig[key].label}</span><span className="mt-1 block text-xs text-muted-foreground">{allowed?t("status.available"):t("import_export.no_export_permission")}</span></button> })}</div>
    {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"><T i18nKey="import_export.export_section.unable_to_load_export_data" /></p> : null}
    {availableDatasets.length===0 ? <Card><CardContent className="py-6 text-sm text-muted-foreground"><T i18nKey="import_export.export_section.you_do_not_have_permission_to_export_these" /></CardContent></Card> : <>
      <Card size="sm"><CardHeader className="border-b"><CardTitle>{activeConfig.label}</CardTitle><CardDescription>{activeConfig.description}</CardDescription></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="grid gap-1"><Label htmlFor="export-search"><T i18nKey="common.search" /></Label><div className="relative"><Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground"/><Input id="export-search" className="pl-8" value={filters.search} onChange={(event)=>updateFilter("search",event.target.value)} placeholder={t("import_export.export_section.placeholder_search_current_dataset")}/></div></div>
          {activeDataset!=="guides" ? <div className="grid gap-1"><Label><T i18nKey="common.guide" /></Label><Select value={filters.guideId} onValueChange={(value)=>updateFilter("guideId",value)}><SelectTrigger className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all"><T i18nKey="import_export.export_section.all_guides" /></SelectItem>{guides.map((guide)=><SelectItem key={guide.id} value={guide.id}>{guide.name}</SelectItem>)}</SelectContent></Select></div> : null}
          {["groups","assignments"].includes(activeDataset) ? <div className="grid gap-1"><Label><T i18nKey="common.circuit" /></Label><Select value={filters.circuitId} onValueChange={(value)=>updateFilter("circuitId",value)}><SelectTrigger className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all"><T i18nKey="import_export.export_section.all_circuits" /></SelectItem>{circuits.map((circuit)=><SelectItem key={circuit.id} value={circuit.id}>{circuit.name}</SelectItem>)}</SelectContent></Select></div> : null}
          {activeDataset==="guides" ? <StatusFilter label={t("import_export.export_section.label_guide_status")} value={filters.status} values={["active","inactive","invited","blocked"]} onChange={(value)=>updateFilter("status",value)}/> : null}
          {activeDataset==="groups" ? <StatusFilter label={t("import_export.export_filters.group_status")} value={filters.status} values={["active","cxl","fusionado","finalized"]} onChange={(value)=>updateFilter("status",value)}/> : null}
          {activeDataset==="assignments" ? <StatusFilter label={t("import_export.export_section.label_assignment_status")} value={filters.status} values={["without-guide","assigned"]} onChange={(value)=>updateFilter("status",value)}/> : null}
          {["groups","assignments"].includes(activeDataset) ? <StatusFilter label={t("import_export.export_filters.confirmation")} value={filters.confirmation} values={["without-guide","not-required","pending-confirmation","confirmed"]} onChange={(value)=>updateFilter("confirmation",value)}/> : null}
          {activeDataset==="availability" ? <><StatusFilter label={t("common.year")} value={filters.year} values={years} onChange={(value)=>updateFilter("year",value)}/><StatusFilter label={t("import_export.export_section.label_availability_type")} value={filters.availabilityType} values={["available","not-available","occupied-by-assignment","pending-review"]} onChange={(value)=>updateFilter("availabilityType",value)}/><StatusFilter label={t("import_export.export_section.label_submission_status")} value={filters.submissionStatus} values={["not-submitted","draft","pending-review","changes-requested","approved"]} onChange={(value)=>updateFilter("submissionStatus",value)}/></> : null}
          {activeDataset==="change-requests" ? <StatusFilter label={t("import_export.export_section.label_request_status")} value={filters.status} values={["pending","in_progress","approved","rejected","completed","cancelled"]} onChange={(value)=>updateFilter("status",value)}/> : null}
          {["groups","assignments","change-requests"].includes(activeDataset) ? <><div className="grid gap-1"><Label><T i18nKey="import_export.export_section.from" /></Label><DatePickerInput value={filters.dateFrom} onChange={(value)=>updateFilter("dateFrom",value)}/></div><div className="grid gap-1"><Label><T i18nKey="import_export.export_section.to" /></Label><DatePickerInput value={filters.dateTo} onChange={(value)=>updateFilter("dateTo",value)}/></div></> : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-medium">{filteredRows.length} <T i18nKey="import_export.export_section.rows_will_be_exported" /></p><Button type="button" variant="outline" size="sm" onClick={()=>setFilters(emptyFilters)}><RotateCcw/><T i18nKey="import_export.export_section.reset_filters" /></Button></div>
      </CardContent></Card>
      <Card size="sm"><CardHeader className="border-b"><CardTitle><T i18nKey="import_export.export_section.columns" /></CardTitle><CardDescription><T i18nKey="import_export.export_section.select_at_least_one_column_defaults_are_restored" /></CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3">{activeConfig.columns.map((column)=>{const id=`export-column-${activeDataset}-${column.id}`;return <div key={column.id} className="flex items-center gap-2"><Checkbox id={id} checked={selected.includes(column.id)} onCheckedChange={(checked)=>setSelectedColumns((current)=>({...current,[activeDataset]:checked===true?[...current[activeDataset],column.id].filter((value,index,array)=>array.indexOf(value)===index):current[activeDataset].filter((value)=>value!==column.id)}))}/><Label htmlFor={id} className="font-normal">{column.label}</Label></div>})}</CardContent></Card>
      <Card size="sm"><CardHeader className="border-b"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle><T i18nKey="import_export.export_section.preview" /></CardTitle><CardDescription><T i18nKey="import_export.export_section.showing_up_to_20_of" /> {filteredRows.length} <T i18nKey="import_export.export_section.matching_rows" /></CardDescription></div><Button type="button" disabled={!filteredRows.length||!visibleColumns.length||Boolean(error)} onClick={handleExport}><Download/><T i18nKey="import_export.export_section.export_csv" /></Button></div></CardHeader><CardContent className="overflow-x-auto p-0">{!filteredRows.length?<div className="p-6 text-center text-sm text-muted-foreground"><FileDown className="mx-auto mb-2 size-5"/><T i18nKey="import_export.export_section.no_records_match_the_selected_filters" /></div>:<Table className="text-xs"><TableHeader><TableRow>{visibleColumns.map((column)=><TableHead key={column.id}>{column.label}</TableHead>)}</TableRow></TableHeader><TableBody>{filteredRows.slice(0,20).map((row)=><TableRow key={row.id}>{visibleColumns.map((column)=><TableCell key={column.id} className="max-w-64 whitespace-normal">{row.values[column.id] || "—"}</TableCell>)}</TableRow>)}</TableBody></Table>}</CardContent></Card>
    </>}
  </section>
}

function StatusFilter({ label, value, values, onChange }: { label:string; value:string; values:string[]; onChange:(value:string)=>void }) {
  return <div className="grid gap-1"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all"><T i18nKey="common.all" /></SelectItem>{values.map((item)=><SelectItem key={item} value={item}>{title(item)}</SelectItem>)}</SelectContent></Select></div>
}
