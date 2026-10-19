"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { useState } from "react"
import { Eye, Pencil } from "lucide-react"

import { MultiSelect } from "@/components/common/multi-select"
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
import {
  notificationTypes,
  settingsRoleOptions,
} from "@/lib/mock-data/settings"
import { configuredNotificationCopyKeys, notificationTypeKeys } from "@/lib/i18n/settings-labels"
import type {
  AppSettings,
  NotificationType,
  RoleKey,
} from "@/lib/types/settings"

type NotificationRule = AppSettings["notifications"][NotificationType]

function notificationCopyLabel(value: string, t: ReturnType<typeof useI18n>["t"]) {
  const key = configuredNotificationCopyKeys[value]
  return key ? t(key) : value
}

const assignmentOutboxNotificationTypes = new Set<NotificationType>([
  "assigned-groups-email",
  "assignment-changed",
  "guide-confirmation-reminder",
])

function roleSummary(roleIds: RoleKey[], t: ReturnType<typeof useI18n>["t"]) {
  if (roleIds.length === 0) {
    return t("common.none")
  }

  return roleIds
    .map(
      (roleId) =>
        settingsRoleOptions.find((option) => option.value === roleId)?.label ??
        roleId
    )
    .join(", ")
}

function copySummary(rule: NotificationRule, t: ReturnType<typeof useI18n>["t"]) {
  const parts = []

  if (rule.internalCopyRoleIds.length > 0) {
    parts.push(roleSummary(rule.internalCopyRoleIds, t))
  }

  const manualEmailCount = rule.manualCopyEmails
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean).length

  if (manualEmailCount > 0) {
    parts.push(t(manualEmailCount === 1 ? "settings.notifications.manual_email_one" : "settings.notifications.manual_email_many", { count: manualEmailCount }))
  }

  return parts.length > 0 ? parts.join(" + ") : t("common.none")
}

export function NotificationRulesCard({
  settings,
  canEdit,
  permissionMessage,
  onChange,
}: {
  settings: AppSettings
  canEdit: boolean
  permissionMessage: string
  onChange: (settings: AppSettings) => void
}) {
  const { t } = useI18n()
  const [editingType, setEditingType] = useState<NotificationType | null>(null)
  const [ruleDraft, setRuleDraft] = useState<NotificationRule | null>(null)

  function openRule(type: NotificationType) {
    setEditingType(type)
    setRuleDraft({
      ...settings.notifications[type],
      internalCopyRoleIds: [...settings.notifications[type].internalCopyRoleIds],
      senderRoleIds: [...settings.notifications[type].senderRoleIds],
    })
  }

  function closeRule() {
    setEditingType(null)
    setRuleDraft(null)
  }

  function applyRule() {
    if (!canEdit || !editingType || !ruleDraft) {
      return
    }

    onChange({
      ...settings,
      notifications: {
        ...settings.notifications,
        [editingType]: ruleDraft,
      },
    })
    closeRule()
  }

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <CardTitle><T i18nKey="settings.notification_rules_card.notification_rules" /></CardTitle>
          <CardDescription>
            <T i18nKey="settings.notification_rules_card.configuration_for_recipients_and_workflow_triggers_assignment_workflows" />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><T i18nKey="settings.notification_rules_card.event" /></TableHead>
                <TableHead><T i18nKey="settings.notification_rules_card.state" /></TableHead>
                <TableHead><T i18nKey="settings.notification_rules_card.primary_recipient" /></TableHead>
                <TableHead><T i18nKey="settings.notification_rules_card.internal_copies" /></TableHead>
                <TableHead><T i18nKey="settings.notification_rules_card.sender_trigger" /></TableHead>
                <TableHead><T i18nKey="settings.email_templates_card.connection" /></TableHead>
                <TableHead className="text-right"><T i18nKey="settings.group_import_rules_card.action" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notificationTypes.map((type) => {
                const rule = settings.notifications[type]

                return (
                  <TableRow key={type}>
                    <TableCell className="font-medium">
                      {t(notificationTypeKeys[type])}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.enabled ? "default" : "secondary"}>
                        {rule.enabled ? t("status.enabled") : t("status.disabled")}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-52 whitespace-normal">
                      {notificationCopyLabel(rule.primaryRecipientLabel, t)}
                    </TableCell>
                    <TableCell className="max-w-56 whitespace-normal text-muted-foreground">
                      {copySummary(rule, t)}
                    </TableCell>
                    <TableCell className="max-w-56 whitespace-normal text-muted-foreground">
                      {rule.senderRoleIds.length > 0
                        ? roleSummary(rule.senderRoleIds, t)
                        : notificationCopyLabel(rule.triggerType, t)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {assignmentOutboxNotificationTypes.has(type)
                          ? t("settings.notifications.workflow_provider_missing")
                          : t("settings.notifications.not_connected")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openRule(type)}
                      >
                        {canEdit ? <Pencil /> : <Eye />}
                        {canEdit ? t("common.edit") : t("settings.notifications.view")}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {!canEdit ? (
            <p className="text-sm text-amber-700">{permissionMessage}</p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingType)} onOpenChange={(open) => !open && closeRule()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {editingType && ruleDraft ? (
            <>
              <DialogHeader>
                <DialogTitle>{t(notificationTypeKeys[editingType])}</DialogTitle>
                <DialogDescription>
                  {assignmentOutboxNotificationTypes.has(editingType)
                    ? t("settings.notifications.outbox_connected_delivery_missing")
                    : t("settings.notifications.local_configuration_only")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <section className="space-y-3 rounded-lg border p-3">
                  <h3 className="text-sm font-semibold"><T i18nKey="settings.notification_rules_card.recipients" /></h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label><T i18nKey="settings.notification_rules_card.primary_recipient" /></Label>
                      <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                        {notificationCopyLabel(ruleDraft.primaryRecipientLabel, t)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <T i18nKey="settings.notification_rules_card.this_recipient_is_determined_by_the_workflow" />
                      </p>
                    </div>
                    <div className="grid gap-1.5">
                      <Label><T i18nKey="settings.notification_rules_card.internal_copy_roles" /></Label>
                      <MultiSelect
                        label={t("settings.internal_authorized_users_card.role")}
                        values={ruleDraft.internalCopyRoleIds}
                        options={settingsRoleOptions}
                        allText={t("settings.notifications.no_roles_selected")}
                        emptyText={t("settings.notification_rules_card.empty_text_no_role_found")}
                        searchPlaceholder={t("settings.notifications.search_roles")}
                        disabled={!canEdit}
                        onValuesChange={(values) =>
                          setRuleDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  internalCopyRoleIds: values as RoleKey[],
                                }
                              : current
                          )
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        <T i18nKey="settings.notification_rules_card.optional_internal_roles_copied_on_this_notification" />
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="notification-manual-copy-emails">
                      <T i18nKey="settings.notification_rules_card.manual_copy_emails" />
                    </Label>
                    <Input
                      id="notification-manual-copy-emails"
                      value={ruleDraft.manualCopyEmails}
                      placeholder={t("settings.notification_rules_card.placeholder_ops_example_com_admin_example_com")}
                      disabled={!canEdit}
                      onChange={(event) =>
                        setRuleDraft((current) =>
                          current
                            ? { ...current, manualCopyEmails: event.target.value }
                            : current
                        )
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      <T i18nKey="settings.notification_rules_card.optional_extra_copy_emails_separated_by_commas" />
                    </p>
                  </div>
                </section>

                <section className="space-y-3 rounded-lg border p-3">
                  <h3 className="text-sm font-semibold"><T i18nKey="settings.notification_rules_card.trigger" /></h3>
                  {ruleDraft.senderRoleIds.length > 0 ? (
                    <div className="grid gap-1.5">
                      <Label><T i18nKey="settings.notification_rules_card.sender_roles" /></Label>
                      <MultiSelect
                        label={t("settings.notification_rules_card.label_sender")}
                        values={ruleDraft.senderRoleIds}
                        options={settingsRoleOptions}
                        allText={t("settings.notifications.no_sender_roles_selected")}
                        emptyText={t("settings.notification_rules_card.empty_text_no_role_found")}
                        searchPlaceholder={t("settings.notifications.search_roles")}
                        disabled={!canEdit}
                        onValuesChange={(values) =>
                          setRuleDraft((current) =>
                            current
                              ? { ...current, senderRoleIds: values as RoleKey[] }
                              : current
                          )
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        <T i18nKey="settings.notification_rules_card.preview_roles_allowed_to_trigger_this_future_email" />
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-1.5">
                      <Label><T i18nKey="settings.notification_rules_card.system_trigger" /></Label>
                      <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                        {notificationCopyLabel(ruleDraft.triggerType, t)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <T i18nKey="settings.notification_rules_card.trigger_wiring_is_not_implemented_yet" />
                      </p>
                    </div>
                  )}
                </section>

                <section className="flex items-start gap-3 rounded-lg border p-3">
                  <Checkbox
                    id="notification-rule-enabled"
                    checked={ruleDraft.enabled}
                    disabled={!canEdit}
                    onCheckedChange={(checked) =>
                      setRuleDraft((current) =>
                        current
                          ? { ...current, enabled: checked === true }
                          : current
                      )
                    }
                  />
                  <div className="grid gap-1">
                    <Label htmlFor="notification-rule-enabled"><T i18nKey="settings.notification_rules_card.enabled" /></Label>
                    <p className="text-xs text-muted-foreground">
                      <T i18nKey="settings.notification_rules_card.mock_local_configuration_only_the_workflow_is_not" />
                    </p>
                  </div>
                </section>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeRule}>
                  {canEdit ? t("common.cancel") : t("common.close")}
                </Button>
                {canEdit ? (
                  <Button type="button" onClick={applyRule}>
                    <T i18nKey="settings.notification_rules_card.apply_rule_changes" />
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
