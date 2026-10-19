"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { FormEvent, useEffect, useState } from "react"
import { CircleOff, Pencil, Plus, RotateCcw, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { usePersistedCircuits } from "@/lib/hooks/use-persisted-mock-data"
import { isDevToolsEnabled } from "@/lib/auth/runtime-mode"
import {
  createSupabaseCircuit,
  deactivateSupabaseCircuit,
  reactivateSupabaseCircuit,
  updateSupabaseCircuit,
} from "@/lib/supabase/mutations/circuits"
import { getAllSupabaseCircuits } from "@/lib/supabase/queries/circuits"
import type { Circuit } from "@/lib/types/domain"
import {
  dedupeCircuitAliases,
  findDuplicateAlias,
  normalizeCircuitValue,
  parseCircuitAliases,
} from "@/lib/utils/circuit-equivalences"
import { formatDateTimeDisplay } from "@/lib/utils/date-format"
import { GroupImportRulesCard } from "@/components/settings/group-import-rules-card"
import {
  localStorageKeys,
  writeLocalStorageValue,
} from "@/lib/utils/local-storage"

type FormValues = {
  name: string
  code: string
  region: string
  aliasesText: string
  notes: string
  isActive: boolean
  planningSortOrder: string
}

type FormErrors = Partial<Record<keyof FormValues, string>>

type CircuitDataSource = "local-fallback" | "supabase"
type CircuitStatusFilter = "all" | "active" | "inactive"

function getInitialValues(circuit: Circuit | null): FormValues {
  return {
    name: circuit?.name ?? "",
    code: circuit?.code ?? "",
    region: circuit?.region ?? "",
    aliasesText: circuit?.aliases?.join("\n") ?? "",
    notes: circuit?.notes ?? "",
    isActive: circuit?.isActive ?? true,
    planningSortOrder:
      circuit?.planningSortOrder === null ||
      circuit?.planningSortOrder === undefined
        ? ""
        : String(circuit.planningSortOrder),
  }
}

function buildCircuitId(name: string, code: string) {
  const source = code.trim() || name.trim()
  const normalized = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  return `manual-circuit-${normalized}-${Date.now()}`
}

export function CircuitsCard({
  canManageCircuits = true,
  managePermissionMessage = "You do not have permission to edit settings.",
}: {
  canManageCircuits?: boolean
  managePermissionMessage?: string
}) {
  const { t } = useI18n()
  const localCircuits = usePersistedCircuits()
  const [supabaseCircuits, setSupabaseCircuits] = useState<Circuit[] | null>(
    null
  )
  const [supabaseError, setSupabaseError] = useState<string | null>(null)
  const [writeError, setWriteError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCircuit, setEditingCircuit] = useState<Circuit | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<CircuitStatusFilter>("all")
  const dataSource: CircuitDataSource = process.env.NODE_ENV === "production" || supabaseCircuits
    ? "supabase"
    : "local-fallback"
  const circuits = supabaseCircuits ?? localCircuits
  const normalizedSearchQuery = normalizeCircuitValue(searchQuery)
  const visibleCircuits = circuits.filter((circuit) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && circuit.isActive !== false) ||
      (statusFilter === "inactive" && circuit.isActive === false)
    const searchableValues = [
      circuit.name,
      circuit.code,
      ...(circuit.aliases ?? []),
    ]
    const matchesSearch =
      !normalizedSearchQuery ||
      searchableValues.some((value) =>
        normalizeCircuitValue(value).includes(normalizedSearchQuery)
      )

    return matchesStatus && matchesSearch
  })

  async function refreshSupabaseCircuits() {
    const result = await getAllSupabaseCircuits()

    if (result.error) {
      setSupabaseCircuits(null)
      setSupabaseError(result.error)
      return result.error
    }

    setSupabaseCircuits(result.data)
    setSupabaseError(null)
    return null
  }

  useEffect(() => {
    let isMounted = true

    async function loadSupabaseCircuits() {
      const result = await getAllSupabaseCircuits()

      if (!isMounted) {
        return
      }

      if (result.error) {
        setSupabaseCircuits(null)
        setSupabaseError(result.error)
        return
      }

      setSupabaseCircuits(result.data)
      setSupabaseError(null)
    }

    loadSupabaseCircuits()

    return () => {
      isMounted = false
    }
  }, [])

  function openCreateDialog() {
    if (!canManageCircuits) {
      setWriteError(managePermissionMessage)
      return
    }

    setEditingCircuit(null)
    setWriteError(null)
    setDialogOpen(true)
  }

  function openEditDialog(circuit: Circuit) {
    if (!canManageCircuits) {
      setWriteError(managePermissionMessage)
      return
    }

    setEditingCircuit(circuit)
    setWriteError(null)
    setDialogOpen(true)
  }

  async function saveCircuit(circuit: Circuit) {
    setWriteError(null)

    if (!canManageCircuits) {
      setWriteError(managePermissionMessage)
      return managePermissionMessage
    }

    if (dataSource === "supabase") {
      const result = editingCircuit
        ? await updateSupabaseCircuit(editingCircuit.id, {
            name: circuit.name,
            code: circuit.code,
            region: circuit.region,
            notes: circuit.notes ?? "",
            isActive: circuit.isActive !== false,
            aliases: circuit.aliases ?? [],
            planningSortOrder: circuit.planningSortOrder ?? null,
          })
        : await createSupabaseCircuit({
            name: circuit.name,
            code: circuit.code,
            region: circuit.region,
            notes: circuit.notes ?? "",
            isActive: circuit.isActive !== false,
            aliases: circuit.aliases ?? [],
            planningSortOrder: circuit.planningSortOrder ?? null,
          })

      if (result.error) {
        setWriteError(result.error)
        return result.error
      }

      const refreshError = await refreshSupabaseCircuits()

      if (refreshError) {
        setWriteError(refreshError)
        return refreshError
      }

      setDialogOpen(false)
      setEditingCircuit(null)
      return null
    }

    const exists = localCircuits.some((item) => item.id === circuit.id)
    const nextCircuits = exists
      ? localCircuits.map((item) => (item.id === circuit.id ? circuit : item))
      : [circuit, ...localCircuits]

    writeLocalStorageValue(localStorageKeys.circuits, nextCircuits)
    setDialogOpen(false)
    setEditingCircuit(null)
    return null
  }

  async function deactivateCircuit(circuit: Circuit) {
    setWriteError(null)

    if (!canManageCircuits) {
      setWriteError(managePermissionMessage)
      return
    }

    if (dataSource === "supabase") {
      const result = await deactivateSupabaseCircuit(circuit.id)

      if (result.error) {
        setWriteError(result.error)
        return
      }

      const refreshError = await refreshSupabaseCircuits()

      if (refreshError) {
        setWriteError(refreshError)
      }

      return
    }

    const nowIso = new Date().toISOString()
    const exists = localCircuits.some((item) => item.id === circuit.id)
    const deactivatedCircuit = {
      ...circuit,
      isActive: false,
      updatedAtIso: nowIso,
      updatedBy: "Super Admin",
    }

    writeLocalStorageValue(
      localStorageKeys.circuits,
      exists
        ? localCircuits.map((item) =>
            item.id === circuit.id ? deactivatedCircuit : item
          )
        : [deactivatedCircuit, ...localCircuits]
    )
  }

  async function reactivateCircuit(circuit: Circuit) {
    setWriteError(null)

    if (!canManageCircuits) {
      setWriteError(managePermissionMessage)
      return
    }

    if (dataSource === "supabase") {
      const result = await reactivateSupabaseCircuit(circuit.id)

      if (result.error) {
        setWriteError(result.error)
        return
      }

      const refreshError = await refreshSupabaseCircuits()

      if (refreshError) {
        setWriteError(refreshError)
      }

      return
    }

    const nowIso = new Date().toISOString()
    const exists = localCircuits.some((item) => item.id === circuit.id)
    const reactivatedCircuit = {
      ...circuit,
      isActive: true,
      updatedAtIso: nowIso,
      updatedBy: "Super Admin",
    }

    writeLocalStorageValue(
      localStorageKeys.circuits,
      exists
        ? localCircuits.map((item) =>
            item.id === circuit.id ? reactivatedCircuit : item
          )
        : [reactivatedCircuit, ...localCircuits]
    )
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle><T i18nKey="settings.circuits_card.circuits" /></CardTitle>
            <CardDescription>
              <T i18nKey="settings.circuits_card.maintain_the_names_planning_abbreviations_and_aliases_used" />
            </CardDescription>
          </div>
          <div className="grid justify-items-end gap-1">
            <Button
              type="button"
              disabled={!canManageCircuits}
              title={!canManageCircuits ? managePermissionMessage : undefined}
              onClick={openCreateDialog}
            >
              <Plus className="size-4" />
              <T i18nKey="settings.circuits_card.add_circuit" />
            </Button>
            {!canManageCircuits ? (
              <p className="text-xs text-muted-foreground">
                {managePermissionMessage}
              </p>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          <T i18nKey="settings.circuits_card.the_official_name_is_used_throughout_the_app" />
        </p>
        {isDevToolsEnabled ? <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium"><T i18nKey="settings.circuits_card.data_source" /></span>
            <Badge
              variant={dataSource === "supabase" ? "default" : "outline"}
            >
              {dataSource === "supabase" ? "Supabase" : t("groups.data.local_fallback")}
            </Badge>
          </div>
          <p className="mt-2 text-muted-foreground">
            {dataSource === "supabase"
              ? "Changes are saved to Supabase."
              : "Supabase is unavailable. Changes are saved locally in this browser."}
          </p>
        </div> : null}
        {supabaseError ? (
          <p className="text-xs text-red-700">
            <T i18nKey="settings.circuits_card.supabase_read_failed" /> {supabaseError}
          </p>
        ) : null}
        {writeError ? (
          <p className="text-xs text-red-700">
            <T i18nKey="settings.circuits_card.circuit_save_failed" /> {writeError}
          </p>
        ) : null}
        {!canManageCircuits ? (
          <p className="text-xs text-amber-700">
            {managePermissionMessage}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("settings.circuits_card.placeholder_search_name_abbreviation_or_alias")}
              aria-label={t("settings.circuits_card.aria_label_search_circuits")}
              className="pl-8"
            />
          </div>
          <div
            className="flex w-fit items-center gap-1 rounded-lg border bg-muted/25 p-1"
            aria-label={t("settings.circuits_card.aria_label_circuit_status_filter")}
          >
            {(["all", "active", "inactive"] as const).map((filter) => (
              <Button
                key={filter}
                type="button"
                variant={statusFilter === filter ? "default" : "ghost"}
                size="xs"
                aria-pressed={statusFilter === filter}
                onClick={() => setStatusFilter(filter)}
              >
                {filter === "all"
                  ? t("common.all")
                  : filter === "active"
                    ? t("status.active")
                    : t("status.inactive")}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {visibleCircuits.length} <T i18nKey="settings.circuits_card.of" /> {circuits.length} <T i18nKey="settings.circuits_card.circuits_2" />
          </span>
          {searchQuery || statusFilter !== "all" ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                setSearchQuery("")
                setStatusFilter("all")
              }}
            >
              <T i18nKey="settings.circuits_card.clear_filters" />
            </Button>
          ) : null}
        </div>
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead><T i18nKey="settings.circuits_card.circuit_name" /></TableHead>
              <TableHead><T i18nKey="settings.circuits_card.planning_abbreviation" /></TableHead>
              <TableHead><T i18nKey="settings.circuits_card.aliases" /></TableHead>
              <TableHead><T i18nKey="common.status" /></TableHead>
              <TableHead><T i18nKey="settings.circuits_card.planning_order" /></TableHead>
              <TableHead><T i18nKey="settings.circuits_card.last_modified" /></TableHead>
              <TableHead className="text-right"><T i18nKey="common.actions" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleCircuits.map((circuit) => (
              <TableRow
                key={circuit.id}
                className={circuit.isActive === false ? "bg-muted/25" : undefined}
              >
                <TableCell className="font-medium">
                  {circuit.name}
                  {circuit.notes ? (
                    <div
                      className="mt-1 max-w-64 truncate text-xs font-normal text-muted-foreground"
                      title={circuit.notes}
                    >
                      {circuit.notes}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  {circuit.code ? (
                    <div className="grid gap-1">
                      <Badge variant="outline" className="font-semibold">
                        {circuit.code}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        <T i18nKey="settings.circuits_card.planning_label" />
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-amber-700">
                      <T i18nKey="settings.circuits_card.no_abbreviation_configured" />
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex max-w-xl flex-wrap gap-1">
                    {(circuit.aliases ?? []).length > 0 ? (
                      circuit.aliases?.map((alias) => (
                        <Badge key={alias} variant="secondary">
                          {alias}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        <T i18nKey="settings.circuits_card.no_aliases" />
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={circuit.isActive === false ? "outline" : "default"}>
                    {circuit.isActive === false ? t("status.inactive") : t("status.active")}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {circuit.planningSortOrder ?? t("settings.circuits.after_ordered")}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTimeDisplay(circuit.updatedAtIso)}
                  <div className="text-xs">{circuit.updatedBy ?? "—"}</div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={!canManageCircuits}
                      title={
                        !canManageCircuits ? managePermissionMessage : undefined
                      }
                      onClick={() => openEditDialog(circuit)}
                    >
                      <Pencil className="size-4" />
                      <span className="sr-only"><T i18nKey="settings.circuits_card.edit_circuit" /></span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={!canManageCircuits}
                      title={
                        !canManageCircuits ? managePermissionMessage : undefined
                      }
                      onClick={() => {
                        if (circuit.isActive === false) {
                          void reactivateCircuit(circuit)
                        } else {
                          void deactivateCircuit(circuit)
                        }
                      }}
                    >
                      {circuit.isActive === false ? (
                        <RotateCcw className="size-4" />
                      ) : (
                        <CircleOff className="size-4" />
                      )}
                      <span className="sr-only">
                        {circuit.isActive === false
                          ? t("settings.circuits.reactivate")
                          : t("settings.circuits.deactivate")}
                      </span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {visibleCircuits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  <T i18nKey="settings.circuits_card.no_circuits_match_the_current_search_and_status" />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <GroupImportRulesCard circuits={circuits} canManage={canManageCircuits} isSupabase={dataSource === "supabase"} onCircuitsChanged={refreshSupabaseCircuits} />
      </CardContent>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setEditingCircuit(null)
            setWriteError(null)
          }
        }}
      >
        {dialogOpen ? (
          <CircuitForm
            key={editingCircuit?.id ?? "new-circuit"}
            circuit={editingCircuit}
            existingCircuits={circuits}
            onCancel={() => {
              setDialogOpen(false)
              setEditingCircuit(null)
              setWriteError(null)
            }}
            onSave={saveCircuit}
            canSave={canManageCircuits}
            permissionMessage={managePermissionMessage}
          />
        ) : null}
      </Dialog>
    </Card>
  )
}

function CircuitForm({
  circuit,
  existingCircuits,
  onCancel,
  onSave,
  canSave,
  permissionMessage,
}: {
  circuit: Circuit | null
  existingCircuits: Circuit[]
  onCancel: () => void
  onSave: (circuit: Circuit) => Promise<string | null>
  canSave: boolean
  permissionMessage: string
}) {
  const { t } = useI18n()
  const [values, setValues] = useState<FormValues>(() =>
    getInitialValues(circuit)
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateValue<Key extends keyof FormValues>(
    key: Key,
    value: FormValues[Key]
  ) {
    setValues((currentValues) => ({ ...currentValues, [key]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [key]: undefined }))
    setSubmitError(null)
  }

  function validateAliases(aliases: string[], nextName: string) {
    const duplicateAlias = findDuplicateAlias(
      aliases,
      existingCircuits,
      circuit?.id
    )

    if (duplicateAlias) {
      return `"${duplicateAlias.alias}" already belongs to ${duplicateAlias.appCircuitName}.`
    }

    const duplicateNameValue = findDuplicateAlias(
      [nextName],
      existingCircuits,
      circuit?.id
    )

    if (duplicateNameValue) {
      return `Official name conflicts with "${duplicateNameValue.existingAlias}" from ${duplicateNameValue.appCircuitName}.`
    }

    return null
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)

    if (!canSave) {
      setSubmitError(permissionMessage)
      return
    }

    const aliases = dedupeCircuitAliases(parseCircuitAliases(values.aliasesText))
    const nextErrors: FormErrors = {}
    const normalizedName = normalizeCircuitValue(values.name)
    const normalizedCode = normalizeCircuitValue(values.code)

    if (!values.name.trim()) {
      nextErrors.name = "Official circuit name is required."
    }

    const duplicateName = existingCircuits.find(
      (item) =>
        item.id !== circuit?.id &&
        normalizeCircuitValue(item.name) === normalizedName
    )

    if (duplicateName) {
      nextErrors.name = "This official circuit name already exists."
    }

    if (normalizedCode) {
      const duplicateCode = existingCircuits.find(
        (item) =>
          item.id !== circuit?.id &&
          normalizeCircuitValue(item.code) === normalizedCode
      )

      if (duplicateCode) {
        nextErrors.code = "This circuit code already exists."
      }
    }

    const aliasError = validateAliases(aliases, values.name)

    if (aliasError) {
      nextErrors.aliasesText = aliasError
    }

    const planningSortOrder = values.planningSortOrder.trim()
      ? Number(values.planningSortOrder)
      : null

    if (
      planningSortOrder !== null &&
      (!Number.isInteger(planningSortOrder) || planningSortOrder < 0)
    ) {
      nextErrors.planningSortOrder =
        "Planning order must be a whole number of zero or greater."
    }

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    const nowIso = new Date().toISOString()

    setIsSubmitting(true)

    const saveError = await onSave({
      id: circuit?.id ?? buildCircuitId(values.name, values.code),
      name: values.name.trim(),
      code: values.code.trim(),
      region: values.region.trim() || "Custom",
      aliases,
      isActive: values.isActive,
      notes: values.notes.trim(),
      createdAtIso: circuit?.createdAtIso ?? nowIso,
      updatedAtIso: nowIso,
      updatedBy: "Super Admin",
      planningSortOrder,
    })

    setIsSubmitting(false)

    if (saveError) {
      setSubmitError(saveError)
    }
  }

  return (
    <DialogContent className="sm:max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <DialogHeader>
          <DialogTitle>{circuit ? t("settings.circuits.edit") : t("settings.circuits.add")}</DialogTitle>
          <DialogDescription>
            <T i18nKey="settings.circuits_card.configure_the_circuit_name_used_in_the_app" />
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="circuit-name"><T i18nKey="settings.circuits_card.circuit_name" /></Label>
            <Input
              id="circuit-name"
              value={values.name}
              disabled={!canSave}
              onChange={(event) => updateValue("name", event.target.value)}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name ? (
              <p className="text-xs text-red-700">{errors.name}</p>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="circuit-code">
                <T i18nKey="settings.circuits_card.planning_abbreviation_code" />
              </Label>
              <Input
                id="circuit-code"
                value={values.code}
                disabled={!canSave}
                onChange={(event) => updateValue("code", event.target.value)}
                aria-invalid={Boolean(errors.code)}
              />
              {errors.code ? (
                <p className="text-xs text-red-700">{errors.code}</p>
              ) : null}
              <div className="rounded-md border bg-muted/30 px-2.5 py-2 text-xs">
                <span className="text-muted-foreground"><T i18nKey="settings.circuits_card.planning_label_2" /> </span>
                {values.code.trim() ? (
                  <span className="font-semibold">{values.code.trim()}</span>
                ) : (
                  <span className="text-amber-700">
                    <T i18nKey="settings.circuits_card.no_abbreviation_configured" />
                  </span>
                )}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="circuit-region"><T i18nKey="settings.circuits_card.region" /></Label>
              <Input
                id="circuit-region"
                value={values.region}
                disabled={!canSave}
                onChange={(event) => updateValue("region", event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="circuit-aliases"><T i18nKey="settings.circuits_card.aliases" /></Label>
            <Textarea
              id="circuit-aliases"
              value={values.aliasesText}
              disabled={!canSave}
              onChange={(event) =>
                updateValue("aliasesText", event.target.value)
              }
              rows={5}
              placeholder={"CORAZON\nCORAZON ITALIA\nCorazon de Italia"}
              aria-invalid={Boolean(errors.aliasesText)}
            />
            <p className="text-xs text-muted-foreground">
              <T i18nKey="settings.circuits_card.aliases_help_match_imported_or_alternative_circuit_names" />
            </p>
            {errors.aliasesText ? (
              <p className="text-xs text-red-700">{errors.aliasesText}</p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="circuit-planning-order"><T i18nKey="settings.circuits_card.planning_order" /></Label>
            <Input
              id="circuit-planning-order"
              type="number"
              min="0"
              step="1"
              value={values.planningSortOrder}
              disabled={!canSave}
              onChange={(event) =>
                updateValue("planningSortOrder", event.target.value)
              }
              aria-invalid={Boolean(errors.planningSortOrder)}
              placeholder={t("settings.circuits_card.placeholder_not_configured")}
            />
            <p className="text-xs text-muted-foreground">
              <T i18nKey="settings.circuits_card.lower_numbers_appear_first_in_planning_custom_order" />
            </p>
            {errors.planningSortOrder ? (
              <p className="text-xs text-red-700">
                {errors.planningSortOrder}
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="circuit-notes"><T i18nKey="common.notes" /></Label>
            <Textarea
              id="circuit-notes"
              value={values.notes}
              disabled={!canSave}
              onChange={(event) => updateValue("notes", event.target.value)}
              rows={3}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="circuit-active"><T i18nKey="common.status" /></Label>
            <label
              htmlFor="circuit-active"
              className="flex items-center gap-2 text-sm font-medium"
            >
              <Checkbox
                id="circuit-active"
                checked={values.isActive}
                disabled={!canSave}
                onCheckedChange={(checked) =>
                  updateValue("isActive", checked === true)
                }
              />
              <T i18nKey="settings.circuits_card.active_circuit" />
            </label>
          </div>
        </div>

        {submitError ? (
          <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {submitError}
          </p>
        ) : null}
        {!canSave ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
            {permissionMessage}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            <T i18nKey="common.cancel" />
          </Button>
          <Button type="submit" disabled={isSubmitting || !canSave}>
            {isSubmitting ? t("groups.form.saving") : t("settings.circuits.save")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
