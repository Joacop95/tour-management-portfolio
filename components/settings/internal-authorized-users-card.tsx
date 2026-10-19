"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { Ban, Pencil, Plus, RefreshCw, UserCog } from "lucide-react"

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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { permissionsUpdatedEvent } from "@/lib/auth/permission-source"
import {
  changeInternalAuthorizedUserRole,
  createInternalAuthorizedUser,
  revokeInternalAuthorizedUser,
  updateInternalAuthorizedUser,
} from "@/lib/supabase/mutations/internal-authorized-users"
import {
  getSupabaseInternalAuthorizationRoles,
  getSupabaseInternalAuthorizedUsers,
} from "@/lib/supabase/queries/internal-authorized-users"
import type {
  InternalAuthorizedUser,
  InternalAuthorizedUserRole,
  InternalAuthorizedUserStatus,
} from "@/lib/types/domain"
import { formatDateTimeDisplay } from "@/lib/utils/date-format"

type FormValues = {
  email: string
  roleId: string
  status: Exclude<InternalAuthorizedUserStatus, "registered">
  notes: string
}

type FormErrors = Partial<Record<"email" | "roleId", string>>

const statusLabels: Record<InternalAuthorizedUserStatus, UiTranslationKey> = {
  allowed: "status.allowed",
  invited: "status.invited",
  registered: "status.registered",
  revoked: "status.revoked",
}

function getStatusVariant(status: InternalAuthorizedUserStatus) {
  switch (status) {
    case "registered":
      return "default" as const
    case "revoked":
      return "destructive" as const
    case "invited":
      return "secondary" as const
    default:
      return "outline" as const
  }
}

function getInitialValues(record: InternalAuthorizedUser | null): FormValues {
  return {
    email: record?.email ?? "",
    roleId: record?.roleId ?? "",
    status: record?.status === "registered" ? "allowed" : record?.status ?? "allowed",
    notes: record?.notes ?? "",
  }
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function InternalAuthorizedUsersCard({
  canManage,
  canAssignSuperAdmin,
  permissionMessage,
}: {
  canManage: boolean
  canAssignSuperAdmin: boolean
  permissionMessage: string
}) {
  const { t } = useI18n()
  const [records, setRecords] = useState<InternalAuthorizedUser[]>([])
  const [roles, setRoles] = useState<InternalAuthorizedUserRole[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRecord, setEditingRecord] =
    useState<InternalAuthorizedUser | null>(null)
  const [roleRecord, setRoleRecord] =
    useState<InternalAuthorizedUser | null>(null)

  const permittedRoles = useMemo(
    () =>
      roles.filter(
        (role) => role.key !== "super-admin" || canAssignSuperAdmin
      ),
    [canAssignSuperAdmin, roles]
  )

  const loadRecords = useCallback(async () => {
    if (!canManage) {
      setRecords([])
      setRoles([])
      setLoadError(null)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    const [recordsResult, rolesResult] = await Promise.all([
      getSupabaseInternalAuthorizedUsers(),
      getSupabaseInternalAuthorizationRoles(),
    ])

    setIsLoading(false)

    if (recordsResult.error || rolesResult.error) {
      setRecords([])
      setRoles([])
      setLoadError(
        recordsResult.error ??
          rolesResult.error ??
          "Unable to load internal authorized users."
      )
      return
    }

    setRecords(recordsResult.data)
    setRoles(rolesResult.data)
  }, [canManage])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadRecords()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadRecords])

  function openCreateDialog() {
    setEditingRecord(null)
    setActionError(null)
    setSuccessMessage(null)
    setDialogOpen(true)
  }

  function openEditDialog(record: InternalAuthorizedUser) {
    setEditingRecord(record)
    setActionError(null)
    setSuccessMessage(null)
    setDialogOpen(true)
  }

  function openRoleDialog(record: InternalAuthorizedUser) {
    setRoleRecord(record)
    setActionError(null)
    setSuccessMessage(null)
  }

  async function handleRevoke(record: InternalAuthorizedUser) {
    if (!canManage || isSaving) {
      return
    }

    if (
      !window.confirm(
        t("settings.internal.revoke.confirm", { email: record.email })
      )
    ) {
      return
    }

    setActionError(null)
    setSuccessMessage(null)
    setIsSaving(true)
    const result = await revokeInternalAuthorizedUser(record.id)
    setIsSaving(false)

    if (result.error) {
      setActionError(result.error)
      return
    }

    setSuccessMessage(t("settings.internal.revoke.success"))
    window.dispatchEvent(new Event(permissionsUpdatedEvent))
    await loadRecords()
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle><T i18nKey="settings.internal_authorized_users_card.internal_authorized_users" /></CardTitle>
            <CardDescription>
              <T i18nKey="settings.internal_authorized_users_card.authorize_an_internal_email_to_create_or_activate" />
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadRecords()}
              disabled={!canManage || isLoading || isSaving}
              title={!canManage ? permissionMessage : undefined}
            >
              <RefreshCw className="size-3.5" />
              <T i18nKey="common.refresh" />
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={openCreateDialog}
              disabled={!canManage || isLoading || isSaving}
              title={!canManage ? permissionMessage : undefined}
            >
              <Plus className="size-3.5" />
              <T i18nKey="settings.internal_authorized_users_card.authorize_user" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            <T i18nKey="settings.internal_authorized_users_card.after_authorizing_an_email_ask_the_user_to" />{" "}
            <code><T i18nKey="settings.internal_authorized_users_card.activate" /></code><T i18nKey="settings.internal_authorized_users_card.they_can_then_sign_in_through" />{" "}
            <code><T i18nKey="settings.internal_authorized_users_card.login" /></code>.
          </p>
          <p><T i18nKey="settings.internal_authorized_users_card.invitation_email_delivery_is_a_future_step" /></p>
        </div>

        {!canManage ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {permissionMessage} <T i18nKey="settings.internal_authorized_users_card.supabase_authorization_management_requires_an_authenticated_user_with" /> <code><T i18nKey="settings.internal_authorized_users_card.settings_manage_roles_permissions" /></code>.
          </p>
        ) : null}

        {loadError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {loadError}
          </p>
        ) : null}
        {actionError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {actionError}
          </p>
        ) : null}
        {successMessage ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {successMessage}
          </p>
        ) : null}

        {canManage && !loadError ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><T i18nKey="common.email" /></TableHead>
                  <TableHead><T i18nKey="settings.internal_authorized_users_card.role" /></TableHead>
                  <TableHead><T i18nKey="common.status" /></TableHead>
                  <TableHead><T i18nKey="guide_portal.navigation.profile" /></TableHead>
                  <TableHead><T i18nKey="settings.internal_authorized_users_card.invited" /></TableHead>
                  <TableHead><T i18nKey="settings.internal_authorized_users_card.registered" /></TableHead>
                  <TableHead><T i18nKey="settings.internal_authorized_users_card.revoked" /></TableHead>
                  <TableHead><T i18nKey="common.notes" /></TableHead>
                  <TableHead className="w-24 text-right"><T i18nKey="common.actions" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      <T i18nKey="settings.internal_authorized_users_card.loading_internal_authorized_users" />
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      <T i18nKey="settings.internal_authorized_users_card.no_internal_authorized_users_have_been_added" />
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.email}</TableCell>
                      <TableCell>{record.roleName}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(record.status)}>
                          {t(statusLabels[record.status])}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={record.profileId ? "default" : "outline"}>
                          {record.profileId ? t("status.linked") : t("status.not_linked")}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTimeDisplay(record.invitedAt)}</TableCell>
                      <TableCell>{formatDateTimeDisplay(record.registeredAt)}</TableCell>
                      <TableCell>{formatDateTimeDisplay(record.revokedAt)}</TableCell>
                      <TableCell className="max-w-56 whitespace-normal text-muted-foreground">
                        {record.notes || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openRoleDialog(record)}
                            disabled={isSaving}
                            title={t("settings.internal.role_change.action")}
                          >
                            <UserCog className="size-3.5" />
                            <span className="sr-only">
                              <T i18nKey="settings.internal.role_change.action" />
                            </span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEditDialog(record)}
                            disabled={isSaving}
                            title={t("settings.internal_authorized_users_card.edit_authorization")}
                          >
                            <Pencil className="size-3.5" />
                            <span className="sr-only"><T i18nKey="settings.internal_authorized_users_card.edit_authorization" /></span>
                          </Button>
                          {record.status !== "revoked" ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => void handleRevoke(record)}
                              disabled={isSaving}
                              title={t("settings.internal_authorized_users_card.revoke_authorization")}
                            >
                              <Ban className="size-3.5" />
                              <span className="sr-only"><T i18nKey="settings.internal_authorized_users_card.revoke_authorization" /></span>
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setEditingRecord(null)
          }
        }}
      >
        {dialogOpen ? (
          <InternalAuthorizedUserForm
            key={editingRecord?.id ?? "new-internal-authorized-user"}
            record={editingRecord}
            roles={permittedRoles}
            canAssignSuperAdmin={canAssignSuperAdmin}
            onCancel={() => setDialogOpen(false)}
            onSave={async (values) => {
              setIsSaving(true)
              const result = editingRecord
                ? await updateInternalAuthorizedUser(editingRecord.id, {
                    status:
                      editingRecord.status === "registered"
                        ? undefined
                        : values.status,
                    notes: values.notes,
                  })
                : await createInternalAuthorizedUser({
                    email: values.email,
                    roleId: values.roleId,
                    status:
                      values.status === "revoked" ? "allowed" : values.status,
                    notes: values.notes,
                  })
              setIsSaving(false)

              if (result.error) {
                return result.error
              }

              setDialogOpen(false)
              setEditingRecord(null)
              setSuccessMessage(
                editingRecord
                  ? t("settings.internal.authorization_updated")
                  : t("settings.internal.email_authorized")
              )
              await loadRecords()
              return null
            }}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(roleRecord)}
        onOpenChange={(open) => {
          if (!open) setRoleRecord(null)
        }}
      >
        {roleRecord ? (
          <InternalRoleChangeForm
            key={roleRecord.id}
            record={roleRecord}
            roles={permittedRoles}
            onCancel={() => setRoleRecord(null)}
            onSave={async (roleId) => {
              setIsSaving(true)
              const result = await changeInternalAuthorizedUserRole(
                roleRecord.id,
                roleId
              )
              setIsSaving(false)

              if (result.error) return result.error

              setRoleRecord(null)
              setSuccessMessage(t("settings.internal.role_change.success"))
              window.dispatchEvent(new Event(permissionsUpdatedEvent))
              await loadRecords()
              return null
            }}
          />
        ) : null}
      </Dialog>
    </Card>
  )
}

function InternalAuthorizedUserForm({
  record,
  roles,
  canAssignSuperAdmin,
  onCancel,
  onSave,
}: {
  record: InternalAuthorizedUser | null
  roles: InternalAuthorizedUserRole[]
  canAssignSuperAdmin: boolean
  onCancel: () => void
  onSave: (values: FormValues) => Promise<string | null>
}) {
  const { t } = useI18n()
  const [values, setValues] = useState<FormValues>(() => getInitialValues(record))
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isRegistered = record?.status === "registered"

  function updateValue<Key extends keyof FormValues>(
    key: Key,
    value: FormValues[Key]
  ) {
    setValues((currentValues) => ({ ...currentValues, [key]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [key]: undefined }))
    setSubmitError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: FormErrors = {}

    if (!record && !isValidEmail(values.email)) {
      nextErrors.email = "Enter a valid email address."
    }

    if (!values.roleId) {
      nextErrors.roleId = "Choose an internal role."
    }

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSubmitting(true)
    const error = await onSave({
      ...values,
      email: values.email.trim().toLowerCase(),
      notes: values.notes.trim(),
    })
    setIsSubmitting(false)

    if (error) {
      setSubmitError(error)
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>
            {record ? t("settings.internal.edit_authorization") : t("settings.internal.authorize_user_title")}
          </DialogTitle>
          <DialogDescription>
            <T i18nKey="settings.internal_authorized_users_card.this_authorizes_an_internal_email_to_create_or" />
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="internal-authorization-email"><T i18nKey="common.email" /></Label>
            <Input
              id="internal-authorization-email"
              type="email"
              value={values.email}
              disabled={Boolean(record) || isSubmitting}
              onChange={(event) => updateValue("email", event.target.value)}
              aria-invalid={Boolean(errors.email)}
            />
            <p className="text-xs text-muted-foreground">
              <T i18nKey="settings.internal_authorized_users_card.email_cannot_be_changed_revoke_this_authorization_and" />
            </p>
            {errors.email ? (
              <p className="text-xs text-destructive">{errors.email}</p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label><T i18nKey="settings.internal_authorized_users_card.role" /></Label>
            {record ? (
              <div className="rounded-md border px-3 py-2 text-sm">
                {record.roleName}
              </div>
            ) : (
              <Select
                value={values.roleId}
                disabled={isSubmitting}
                onValueChange={(roleId) => updateValue("roleId", roleId)}
              >
                <SelectTrigger aria-invalid={Boolean(errors.roleId)}>
                  <SelectValue placeholder={t("settings.internal_authorized_users_card.placeholder_select_an_internal_role")} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {record ? (
              <p className="text-xs text-muted-foreground">
                <T i18nKey="settings.internal.role_change.use_action" />
              </p>
            ) : null}
            {!canAssignSuperAdmin ? (
              <p className="text-xs text-muted-foreground">
                <T i18nKey="settings.internal_authorized_users_card.only_super_admin_can_authorize_another_super_admin" />
              </p>
            ) : null}
            {errors.roleId ? (
              <p className="text-xs text-destructive">{errors.roleId}</p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label><T i18nKey="common.status" /></Label>
            {isRegistered ? (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Badge variant={getStatusVariant(record.status)}>
                  {t(statusLabels[record.status])}
                </Badge>
                <span className="text-muted-foreground">
                  <T i18nKey="settings.internal_authorized_users_card.use_revoke_to_stop_new_authorization_claims_it" />
                </span>
              </div>
            ) : (
              <Select
                value={values.status}
                disabled={isSubmitting}
                onValueChange={(status) =>
                  updateValue(
                    "status",
                    status as Exclude<InternalAuthorizedUserStatus, "registered">
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allowed"><T i18nKey="settings.internal_authorized_users_card.allowed" /></SelectItem>
                  <SelectItem value="invited"><T i18nKey="settings.internal_authorized_users_card.invited" /></SelectItem>
                  {record?.status === "revoked" ? (
                    <SelectItem value="revoked"><T i18nKey="settings.internal_authorized_users_card.revoked" /></SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="internal-authorization-notes"><T i18nKey="common.notes" /></Label>
            <Textarea
              id="internal-authorization-notes"
              value={values.notes}
              rows={3}
              disabled={isSubmitting}
              onChange={(event) => updateValue("notes", event.target.value)}
            />
          </div>
        </div>

        {submitError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">
            {submitError}
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
          <Button type="submit" disabled={isSubmitting || roles.length === 0}>
            {isSubmitting ? t("groups.form.saving") : record ? t("settings.internal.save_authorization") : t("settings.internal.authorize_user")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function InternalRoleChangeForm({
  record,
  roles,
  onCancel,
  onSave,
}: {
  record: InternalAuthorizedUser
  roles: InternalAuthorizedUserRole[]
  onCancel: () => void
  onSave: (roleId: string) => Promise<string | null>
}) {
  const { t } = useI18n()
  const [roleId, setRoleId] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!roleId || isSubmitting) return

    setSubmitError(null)
    setIsSubmitting(true)
    const error = await onSave(roleId)
    setIsSubmitting(false)

    if (error) setSubmitError(error)
  }

  return (
    <DialogContent className="sm:max-w-md">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>
            <T i18nKey="settings.internal.role_change.title" />
          </DialogTitle>
          <DialogDescription>
            {t("settings.internal.role_change.description", {
              email: record.email,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label><T i18nKey="settings.internal.role_change.current" /></Label>
          <div className="rounded-md border px-3 py-2 text-sm">
            {record.roleName}
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label><T i18nKey="settings.internal.role_change.new" /></Label>
          <Select
            value={roleId}
            disabled={isSubmitting}
            onValueChange={setRoleId}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("settings.internal_authorized_users_card.placeholder_select_an_internal_role")} />
            </SelectTrigger>
            <SelectContent>
              {roles.filter((role) => role.id !== record.roleId).map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {record.status === "revoked" ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <T i18nKey="settings.internal.role_change.revoked_notice" />
          </p>
        ) : null}

        {submitError ? (
          <p className="text-sm text-destructive">{submitError}</p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            <T i18nKey="common.cancel" />
          </Button>
          <Button type="submit" disabled={isSubmitting || !roleId}>
            <T i18nKey="settings.internal.role_change.save" />
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
