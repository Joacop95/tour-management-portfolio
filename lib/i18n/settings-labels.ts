import type { AppModuleKey, EmailTemplateType, ModulePermissionKey, NotificationType } from "@/lib/types/settings"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"

export const notificationTypeKeys: Record<NotificationType, UiTranslationKey> = {
  "guide-invitation": "settings.notification_type.guide_invitation",
  "assigned-groups-email": "settings.notification_type.assigned_groups_email",
  "availability-conflict-alert": "settings.notification_type.availability_conflict_alert",
  "group-without-guide-alert": "settings.notification_type.group_without_guide_alert",
  "yearly-availability-request": "settings.notification_type.yearly_availability_request",
  "assignment-changed": "settings.notification_type.assignment_changed",
  "guide-confirmation-reminder": "settings.notification_type.guide_confirmation_reminder",
  "availability-request-reminder": "settings.notification_type.availability_request_reminder",
  "change-request-update": "settings.notification_type.change_request_update",
}

export const emailTemplateTypeKeys: Record<EmailTemplateType, UiTranslationKey> = {
  "group-cancelled-for-guide": "settings.notification_type.group_cancelled_for_guide",
  "group-merged-for-guide": "settings.notification_type.group_merged_for_guide",
  "reset-password": "settings.notification_type.reset_password",
  ...notificationTypeKeys,
}

export const configuredNotificationCopyKeys: Record<string, UiTranslationKey> = {
  "Invited guide": "settings.notifications.recipient_invited_guide",
  "Assigned guide": "settings.notifications.recipient_assigned_guide",
  "Configured internal roles": "settings.notifications.recipient_internal_roles",
  "Active guides": "settings.notifications.recipient_active_guides",
  "Assigned or affected guide": "settings.notifications.recipient_affected_guide",
  "Guides missing requested availability": "settings.notifications.recipient_missing_availability",
  "Requesting guide or internal review team": "settings.notifications.recipient_requesting_guide_or_team",
  "Admin action mock": "settings.notifications.trigger_admin_action_mock",
  "System / Admin action mock": "settings.notifications.trigger_system_admin_mock",
  "System alert mock": "settings.notifications.trigger_system_alert_mock",
  "Future assignment workflow": "settings.notifications.trigger_future_assignment",
  "Future reminder workflow": "settings.notifications.trigger_future_reminder",
  "Future change request workflow": "settings.notifications.trigger_future_change_request",
}

export const previewModuleKeys: Record<AppModuleKey, UiTranslationKey> = {
  dashboard: "navigation.dashboard",
  planning: "navigation.planning",
  groups: "navigation.groups",
  guides: "navigation.guides",
  availability: "navigation.availability",
  assignments: "navigation.assignments",
  "change-requests": "navigation.change_requests",
  "import-export": "navigation.import_export",
  settings: "navigation.settings",
  "guide-portal": "settings.preview.guide_portal_module",
}

export const previewPermissionKeys: Record<ModulePermissionKey, UiTranslationKey> = {
  "view-dashboard": "settings.preview.permission.view_dashboard",
  "view-planning": "settings.preview.permission.view_planning",
  "view-groups": "settings.preview.permission.view_groups",
  "create-groups": "settings.preview.permission.create_groups",
  "edit-groups": "settings.preview.permission.edit_groups",
  "assign-guides": "settings.preview.permission.assign_guides",
  "confirm-guides": "settings.preview.permission.confirm_guides",
  "export-groups": "settings.preview.permission.export_groups",
  "view-guides": "settings.preview.permission.view_guides",
  "create-guides": "settings.preview.permission.create_guides",
  "edit-guides": "settings.preview.permission.edit_guides",
  "view-internal-metrics": "settings.preview.permission.view_internal_metrics",
  "view-change-request-metrics": "settings.preview.permission.view_change_request_metrics",
  "view-availability": "settings.preview.permission.view_availability",
  "create-availability": "settings.preview.permission.create_availability",
  "edit-availability": "settings.preview.permission.edit_availability",
  "delete-availability": "settings.preview.permission.delete_availability",
  "view-assignments": "settings.preview.permission.view_assignments",
  "assign-guide": "settings.preview.permission.assign_guide",
  "change-guide": "settings.preview.permission.change_guide",
  "confirm-guide": "settings.preview.permission.confirm_guide",
  "view-change-requests": "settings.preview.permission.view_change_requests",
  "view-import-export": "settings.preview.permission.view_import_export",
  "import-excel": "settings.preview.permission.import_excel",
  "export-excel": "settings.preview.permission.export_excel",
  "view-settings": "settings.preview.permission.view_settings",
  "manage-settings": "settings.preview.permission.manage_settings",
  "manage-roles-permissions": "settings.preview.permission.manage_roles_permissions",
  "manage-email-templates": "settings.preview.permission.manage_email_templates",
  "manage-notification-settings": "settings.preview.permission.manage_notification_settings",
  "view-own-profile": "settings.preview.permission.view_own_profile",
  "view-own-groups": "settings.preview.permission.view_own_groups",
  "edit-own-availability": "settings.preview.permission.edit_own_availability",
  "request-group-change": "settings.preview.permission.request_group_change",
}
