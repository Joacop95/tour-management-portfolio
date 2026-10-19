"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import { useEffect, useMemo, useState } from "react"
import { LoaderCircle, RefreshCcw, Save } from "lucide-react"

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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { replaceRealRolePermissions } from "@/lib/supabase/mutations/role-permissions"
import { permissionsUpdatedEvent } from "@/lib/auth/permission-source"
import {
  getRealRolePermissionMatrix,
  type RealPermission,
  type RealRolePermissionMatrix,
} from "@/lib/supabase/queries/role-permissions"

const moduleOrder = [
  "dashboard",
  "groups",
  "planning",
  "guides",
  "availability",
  "assignments",
  "change_requests",
  "import_export",
  "settings",
]

const moduleLabels: Record<string, UiTranslationKey> = {
  dashboard: "navigation.dashboard",
  groups: "navigation.groups",
  planning: "navigation.planning",
  guides: "navigation.guides",
  availability: "navigation.availability",
  assignments: "navigation.assignments",
  change_requests: "navigation.change_requests",
  import_export: "navigation.import_export",
  settings: "navigation.settings",
}

const primaryPermissions: Record<string, string> = {
  dashboard: "dashboard.view",
  groups: "groups.view",
  planning: "planning.view",
  guides: "guides.view",
  availability: "availability.view",
  assignments: "assignments.view",
  change_requests: "change_requests.view",
  import_export: "import_export.view",
  settings: "settings.view",
}

const columns = [
  { key: "create", labelKey: "settings.permissions.create", matches: (key: string) => key.endsWith(".create") || key.endsWith(".create_internal") || key.endsWith(".import_excel") },
  { key: "edit", labelKey: "settings.permissions.edit", matches: (key: string) => key.endsWith(".edit") || key.endsWith(".change_guide") || key.endsWith(".delete") },
  { key: "assign", labelKey: "settings.permissions.assign", matches: (key: string) => key.endsWith(".assign_guide") },
  { key: "confirm", labelKey: "settings.permissions.confirm", matches: (key: string) => key.endsWith(".confirm_guide") },
  { key: "export", labelKey: "settings.permissions.export", matches: (key: string) => key.endsWith(".export") || key.endsWith(".export_excel") },
  { key: "manage", labelKey: "settings.permissions.manage", matches: (key: string) => key.includes(".manage_") },
] as const

function normalizeChecked(value: boolean | "indeterminate") {
  return value === true
}

function byCatalogOrder(left: RealPermission, right: RealPermission) {
  return left.key.localeCompare(right.key)
}

export function RealRolePermissionsCard({ canManage }: { canManage: boolean }) {
  const { t } = useI18n()
  const [matrix, setMatrix] = useState<RealRolePermissionMatrix | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState("")
  const [draftKeys, setDraftKeys] = useState<string[]>([])
  const [savedKeys, setSavedKeys] = useState<string[]>([])
  const [status, setStatus] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  async function loadMatrix(preferredRoleId?: string) {
    setIsLoading(true)
    setStatus("")
    const result = await getRealRolePermissionMatrix()
    setIsLoading(false)
    if (!result.data) {
      setMatrix(null)
      setStatus(result.error ?? "Unable to load real role permissions.")
      return
    }

    setMatrix(result.data)
    const roleId =
      result.data.roles.find((role) => role.id === preferredRoleId)?.id ??
      result.data.roles.find((role) => role.key === "super-admin")?.id ??
      result.data.roles[0]?.id ??
      ""
    const keys = result.data.permissionKeysByRoleId[roleId] ?? []
    setSelectedRoleId(roleId)
    setDraftKeys(keys)
    setSavedKeys(keys)
  }

  useEffect(() => {
    if (!canManage) return

    let isMounted = true
    void getRealRolePermissionMatrix().then((result) => {
      if (!isMounted) return
      setIsLoading(false)
      if (!result.data) {
        setStatus(result.error ?? "Unable to load real role permissions.")
        return
      }
      setMatrix(result.data)
      const roleId =
        result.data.roles.find((role) => role.key === "super-admin")?.id ??
        result.data.roles[0]?.id ??
        ""
      const keys = result.data.permissionKeysByRoleId[roleId] ?? []
      setSelectedRoleId(roleId)
      setDraftKeys(keys)
      setSavedKeys(keys)
    })

    return () => {
      isMounted = false
    }
  }, [canManage])

  const selectedRole = matrix?.roles.find((role) => role.id === selectedRoleId)
  const modules = useMemo(() => {
    if (!matrix) return []
    return moduleOrder.flatMap((moduleKey) => {
      const permissions = matrix.permissions
        .filter((permission) => permission.moduleKey === moduleKey)
        .sort(byCatalogOrder)
      return permissions.length > 0 ? [{ moduleKey, permissions }] : []
    })
  }, [matrix])
  const modulesWithAccess = modules.filter(({ moduleKey }) =>
    draftKeys.includes(primaryPermissions[moduleKey])
  ).length
  const visiblePermissionKeys = new Set(
    modules.flatMap((module) =>
      module.permissions.map((permission) => permission.key)
    )
  )
  const enabledPermissionCount = draftKeys.filter((key) =>
    visiblePermissionKeys.has(key)
  ).length
  const hasChanges =
    [...draftKeys].sort().join("|") !== [...savedKeys].sort().join("|")

  function selectRole(roleId: string) {
    setSelectedRoleId(roleId)
    const keys = matrix?.permissionKeysByRoleId[roleId] ?? []
    setDraftKeys(keys)
    setSavedKeys(keys)
    setStatus("")
  }

  function setPermission(permissionKey: string, enabled: boolean) {
    setDraftKeys((current) =>
      enabled
        ? Array.from(new Set([...current, permissionKey]))
        : current.filter((key) => key !== permissionKey)
    )
    setStatus("")
  }

  function setModuleAccess(moduleKey: string, enabled: boolean) {
    const modulePermissionKeys =
      modules.find((module) => module.moduleKey === moduleKey)?.permissions.map((permission) => permission.key) ?? []
    const primaryKey = primaryPermissions[moduleKey]
    setDraftKeys((current) => {
      const withoutModule = current.filter((key) => !modulePermissionKeys.includes(key))
      return enabled ? [...withoutModule, primaryKey] : withoutModule
    })
    setStatus("")
  }

  async function save() {
    if (!selectedRoleId || !canManage || !hasChanges) return
    setIsSaving(true)
    const result = await replaceRealRolePermissions(selectedRoleId, draftKeys)
    setIsSaving(false)
    setStatus(result.message)
    if (!result.success) return

    await loadMatrix(selectedRoleId)
    window.dispatchEvent(new Event(permissionsUpdatedEvent))
    setStatus(t("settings.real_role_permissions_card.message_role_permissions_saved_and_verified"))
  }

  function isProtected(permissionKey?: string) {
    return selectedRole?.key === "super-admin" &&
      (permissionKey === "settings.view" ||
        permissionKey === "settings.manage_roles_permissions")
  }

  function renderPermission(permission: RealPermission, showLabel = false) {
    const moduleHasAccess = draftKeys.includes(primaryPermissions[permission.moduleKey])
    const disabled = !canManage || !moduleHasAccess || isProtected(permission.key)
    const id = `real-${selectedRoleId}-${permission.key}`
    return (
      <div key={permission.key} className="flex min-h-6 items-center gap-1.5">
        <Checkbox
          id={id}
          checked={draftKeys.includes(permission.key)}
          disabled={disabled}
          onCheckedChange={(value) => setPermission(permission.key, normalizeChecked(value))}
        />
        <Label htmlFor={id} className={showLabel ? "text-xs font-normal" : "sr-only"}>
          {permission.name}
        </Label>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle><T i18nKey="settings.real_role_permissions_card.roles_permissions" /></CardTitle>
            <CardDescription>
              <T i18nKey="settings.real_role_permissions_card.editing_real_role_permissions_changes_affect_authenticated_internal" />
            </CardDescription>
          </div>
          <Badge variant="outline"><T i18nKey="settings.real_role_permissions_card.supabase_authority" /></Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canManage ? (
          <p className="text-sm text-amber-700">
            <T i18nKey="settings.real_role_permissions_card.real_settings_manage_roles_permissions_permission_is_required" />
          </p>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> <T i18nKey="settings.real_role_permissions_card.loading_real_permissions" />
          </div>
        ) : matrix && selectedRole ? (
          <>
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,320px)_1fr]">
              <div className="grid gap-2">
                <Label htmlFor="real-permission-role"><T i18nKey="settings.internal_authorized_users_card.role" /></Label>
                <Select value={selectedRoleId} onValueChange={selectRole}>
                  <SelectTrigger id="real-permission-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {matrix.roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground"><T i18nKey="settings.real_role_permissions_card.selected_role" /></p><p className="font-semibold">{selectedRole.name}</p></div>
                <div><p className="text-xs text-muted-foreground"><T i18nKey="settings.real_role_permissions_card.modules_with_access" /></p><p className="font-semibold">{modulesWithAccess} <T i18nKey="settings.circuits_card.of" /> {modules.length}</p></div>
                <div><p className="text-xs text-muted-foreground"><T i18nKey="settings.real_role_permissions_card.enabled_permissions" /></p><p className="font-semibold">{enabledPermissionCount}</p></div>
              </div>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <T i18nKey="settings.real_role_permissions_card.permission_changes_take_effect_for_users_of_this" />
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[980px] border-collapse text-xs">
                <thead className="bg-muted/50 text-muted-foreground"><tr className="border-b">
                  <th className="w-44 px-3 py-2 text-left font-medium"><T i18nKey="settings.real_role_permissions_card.module" /></th>
                  <th className="w-28 px-3 py-2 text-left font-medium"><T i18nKey="settings.real_role_permissions_card.access" /></th>
                  {columns.map((column) => <th key={column.key} className="px-3 py-2 text-left font-medium">{t(column.labelKey)}</th>)}
                  <th className="min-w-56 px-3 py-2 text-left font-medium"><T i18nKey="settings.real_role_permissions_card.other_permissions" /></th>
                </tr></thead>
                <tbody>{modules.map(({ moduleKey, permissions }) => {
                  const primaryKey = primaryPermissions[moduleKey]
                  const hasAccess = draftKeys.includes(primaryKey)
                  const accessProtected = isProtected(primaryKey)
                  const categorized = new Set(columns.flatMap((column) => permissions.filter((permission) => column.matches(permission.key)).map((permission) => permission.key)))
                  const other = permissions.filter((permission) => permission.key !== primaryKey && !categorized.has(permission.key))
                  return <tr key={moduleKey} className="border-b last:border-0">
                    <td className="px-3 py-2 align-top font-medium">{moduleLabels[moduleKey] ? t(moduleLabels[moduleKey]) : moduleKey}</td>
                    <td className="px-3 py-2 align-top"><div className="flex items-center gap-1.5">
                      <Checkbox id={`real-access-${selectedRoleId}-${moduleKey}`} checked={hasAccess} disabled={!canManage || accessProtected} onCheckedChange={(value) => setModuleAccess(moduleKey, normalizeChecked(value))} />
                      <Label htmlFor={`real-access-${selectedRoleId}-${moduleKey}`} className="text-xs font-normal">{hasAccess ? t("common.on") : t("common.off")}</Label>
                      {accessProtected ? <Badge variant="outline"><T i18nKey="settings.real_role_permissions_card.protected" /></Badge> : null}
                    </div></td>
                    {columns.map((column) => {
                      const matches = permissions.filter((permission) => column.matches(permission.key))
                      return <td key={column.key} className="px-3 py-2 align-top">{matches.length ? matches.map((permission) => renderPermission(permission, matches.length > 1)) : <span className="text-muted-foreground/60">—</span>}</td>
                    })}
                    <td className="px-3 py-2 align-top">{other.length ? <div className="space-y-1">{other.map((permission) => renderPermission(permission, true))}</div> : <span className="text-muted-foreground/60">—</span>}</td>
                  </tr>
                })}</tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                {hasChanges ? <span className="font-medium text-amber-700"><T i18nKey="settings.real_role_permissions_card.unsaved_changes" /></span> : <span className="text-muted-foreground"><T i18nKey="settings.real_role_permissions_card.saved_state_is_loaded_from_supabase" /></span>}
                {status ? <p className="mt-1 text-muted-foreground">{status}</p> : null}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={!hasChanges || isSaving} onClick={() => { setDraftKeys(savedKeys); setStatus(t("settings.real_role_permissions_card.message_draft_reset_to_the_last_loaded_state")) }}><RefreshCcw className="size-4" /><T i18nKey="settings.real_role_permissions_card.reset_draft" /></Button>
                <Button type="button" disabled={!canManage || !hasChanges || isSaving} onClick={() => void save()}>{isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}<T i18nKey="settings.real_role_permissions_card.save_real_permissions" /></Button>
              </div>
            </div>
            {!canManage ? <p className="text-sm text-amber-700"><T i18nKey="settings.real_role_permissions_card.real_settings_manage_roles_permissions_permission_is_required_2" /></p> : null}
          </>
        ) : (
          <p className="text-sm text-destructive">{status || "Real permissions are unavailable."}</p>
        )}
      </CardContent>
    </Card>
  )
}
