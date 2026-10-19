"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { useEffect, useState } from "react"
import { CircleOff, Plus, Save } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { deactivateGroupCodeCircuitMapping, saveGroupCodeCircuitMapping, updateCircuitDefaultDuration } from "@/lib/supabase/mutations/import-configuration"
import { getGroupCodeCircuitMappings, type GroupCodeCircuitMapping } from "@/lib/supabase/queries/import-configuration"
import type { Circuit } from "@/lib/types/domain"

export function GroupImportRulesCard({ circuits, canManage, isSupabase, onCircuitsChanged }: { circuits: Circuit[]; canManage: boolean; isSupabase: boolean; onCircuitsChanged: () => Promise<string | null> }) {
  const { t } = useI18n()
  const [mappings, setMappings] = useState<GroupCodeCircuitMapping[]>([])
  const [prefix, setPrefix] = useState("")
  const [circuitId, setCircuitId] = useState("")
  const [feedback, setFeedback] = useState("")

  async function refresh() {
    const result = await getGroupCodeCircuitMappings()
    setMappings(result.data)
    if (result.error) setFeedback(result.error)
  }
  useEffect(() => {
    let active = true
    async function loadMappings() {
      if (!isSupabase) return
      const result = await getGroupCodeCircuitMappings()
      if (!active) return
      setMappings(result.data)
      if (result.error) setFeedback(result.error)
    }
    void loadMappings()
    return () => { active = false }
  }, [isSupabase])

  async function saveMapping(nextPrefix = prefix, nextCircuitId = circuitId) {
    if (!/^\d+$/.test(nextPrefix) || !nextCircuitId) { setFeedback(t("settings.import_rules.numeric_prefix_required")); return }
    const circuit = circuits.find((item) => item.id === nextCircuitId)
    if (!circuit) return
    const result = await saveGroupCodeCircuitMapping({ prefix: nextPrefix, circuitId: nextCircuitId, circuitName: circuit.name, isActive: true })
    setFeedback(result.error ?? t("settings.import_rules.mapping_saved"))
    if (!result.error) { setPrefix(""); setCircuitId(""); await refresh() }
  }

  return <div id="group-import-rules" className="space-y-4 border-t pt-5">
    <div><h3 className="font-semibold"><T i18nKey="settings.group_import_rules_card.group_import_rules" /></h3><p className="text-sm text-muted-foreground"><T i18nKey="settings.group_import_rules_card.exact_numeric_prefixes_infer_circuits_circuit_offsets_calculate" /></p></div>
    {!isSupabase ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><T i18nKey="settings.group_import_rules_card.supabase_is_required_to_manage_operational_import_rules" /></p> : <>
      {feedback ? <p role="status" className="text-sm text-muted-foreground">{feedback}</p> : null}
      <Card size="sm"><CardHeader><CardTitle className="text-base"><T i18nKey="settings.group_import_rules_card.group_code_mapping" /></CardTitle><CardDescription><T i18nKey="settings.group_import_rules_card.unresolved_seeded_names_stay_inactive_until_linked_to" /></CardDescription></CardHeader><CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]"><Input value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder={t("settings.group_import_rules_card.placeholder_numeric_prefix")} disabled={!canManage} /><Select value={circuitId} onValueChange={setCircuitId} disabled={!canManage}><SelectTrigger className="w-full"><SelectValue placeholder={t("settings.group_import_rules_card.placeholder_select_circuit")} /></SelectTrigger><SelectContent>{circuits.filter((c) => c.isActive !== false).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><Button disabled={!canManage} onClick={() => saveMapping()}><Plus /><T i18nKey="settings.group_import_rules_card.add_mapping" /></Button></div>
        <Table><TableHeader><TableRow><TableHead><T i18nKey="settings.group_import_rules_card.prefix" /></TableHead><TableHead><T i18nKey="common.circuit" /></TableHead><TableHead><T i18nKey="common.status" /></TableHead><TableHead className="text-right"><T i18nKey="common.actions" /></TableHead></TableRow></TableHeader><TableBody>{mappings.map((mapping) => { const status = !mapping.circuitId ? "unresolved" : mapping.isActive ? "active" : "inactive"; return <TableRow key={mapping.prefix}><TableCell className="font-mono font-medium">{mapping.prefix}</TableCell><TableCell><Select value={mapping.circuitId ?? "unresolved"} onValueChange={(value) => { if (value !== "unresolved") void saveMapping(mapping.prefix, value) }} disabled={!canManage}><SelectTrigger className="w-full min-w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unresolved" disabled>{mapping.configuredCircuitName} <T i18nKey="settings.group_import_rules_card.unresolved" /></SelectItem>{circuits.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></TableCell><TableCell><Badge variant="outline" className={status === "active" ? "border-emerald-200 text-emerald-800" : status === "inactive" ? "border-slate-200 text-slate-700" : "border-amber-200 text-amber-800"}>{t(status === "active" ? "status.active" : status === "inactive" ? "status.inactive" : "status.unresolved")}</Badge></TableCell><TableCell className="text-right"><Button size="icon-sm" variant="ghost" disabled={!canManage || !mapping.isActive} onClick={async () => { const result = await deactivateGroupCodeCircuitMapping(mapping.prefix); setFeedback(result.error ?? t("settings.import_rules.mapping_deactivated")); if (!result.error) await refresh() }}><CircleOff /><span className="sr-only"><T i18nKey="settings.group_import_rules_card.deactivate" /> {mapping.prefix}</span></Button></TableCell></TableRow> })}</TableBody></Table>
      </CardContent></Card>
      <Card size="sm"><CardHeader><CardTitle className="text-base"><T i18nKey="settings.group_import_rules_card.circuit_duration_defaults" /></CardTitle><CardDescription><T i18nKey="settings.group_import_rules_card.end_date_offset_in_calendar_days_blank_means" /></CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead><T i18nKey="common.circuit" /></TableHead><TableHead><T i18nKey="settings.group_import_rules_card.default_end_date_offset" /></TableHead><TableHead className="text-right"><T i18nKey="settings.group_import_rules_card.action" /></TableHead></TableRow></TableHeader><TableBody>{circuits.map((circuit) => <DurationRow key={circuit.id} circuit={circuit} canManage={canManage} onSaved={async () => { await onCircuitsChanged(); setFeedback(t("settings.import_rules.duration_saved")) }} />)}</TableBody></Table></CardContent></Card>
    </>}
  </div>
}

function DurationRow({ circuit, canManage, onSaved }: { circuit: Circuit; canManage: boolean; onSaved: () => Promise<void> }) {
  const { t } = useI18n()
  const [value, setValue] = useState(circuit.defaultEndDateOffsetDays?.toString() ?? "")
  return <TableRow><TableCell className="font-medium">{circuit.name}</TableCell><TableCell><div className="flex items-center gap-2"><Input aria-label={t("settings.import_rules.duration_offset_label", { circuit: circuit.name })} className="w-28" inputMode="numeric" value={value} onChange={(event) => setValue(event.target.value)} disabled={!canManage} /><span className="text-sm text-muted-foreground"><T i18nKey="settings.group_import_rules_card.days" /></span></div></TableCell><TableCell className="text-right"><Button size="sm" variant="outline" disabled={!canManage || (value !== "" && (!Number.isInteger(Number(value)) || Number(value) < 0))} onClick={async () => { const result = await updateCircuitDefaultDuration(circuit.id, value === "" ? null : Number(value)); if (!result.error) await onSaved() }}><Save /><T i18nKey="common.save" /></Button></TableCell></TableRow>
}
