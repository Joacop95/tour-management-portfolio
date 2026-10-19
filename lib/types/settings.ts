export type AppLanguage = "en" | "fr" | "es" | "tr"

export type DisplaySettings = {
  showInternalGuideMetrics: boolean
  showGuideChangeRequestMetrics: boolean
  showInternalNotes: boolean
  showSalesRanking: boolean
}

export type GuideMetricsSettings = {
  enableInternalRating: boolean
  enableSalesRanking: boolean
  enableSalesScore: boolean
}

export type GeneralSettings = {
  defaultLanguage: AppLanguage
  defaultGroupLanguage: AppLanguage
}

export type AvailabilitySettings = {
  minYear: number
  maxYear: number
  defaultSelectedYear: number
}

export type NotificationType =
  | "guide-invitation"
  | "assigned-groups-email"
  | "availability-conflict-alert"
  | "group-without-guide-alert"
  | "yearly-availability-request"
  | "assignment-changed"
  | "guide-confirmation-reminder"
  | "availability-request-reminder"
  | "change-request-update"

export type RoleKey =
  | "super-admin"
  | "admin-administrativo"
  | "consulta-interna"
  | "guide"

export type NotificationSettings = Record<
  NotificationType,
  {
    enabled: boolean
    primaryRecipientLabel: string
    primaryRecipientHelp: string
    internalCopyRoleIds: RoleKey[]
    manualCopyEmails: string
    senderRoleIds: RoleKey[]
    triggerType: string
  }
>

export type EmailTemplateType =
  | "group-cancelled-for-guide"
  | "group-merged-for-guide"
  | "guide-invitation"
  | "reset-password"
  | "assigned-groups-email"
  | "availability-conflict-alert"
  | "group-without-guide-alert"
  | "yearly-availability-request"
  | "assignment-changed"
  | "guide-confirmation-reminder"
  | "availability-request-reminder"
  | "change-request-update"

export type EmailTemplateSettings = Record<
  EmailTemplateType,
  {
    subject: Record<AppLanguage, string>
    body: Record<AppLanguage, string>
  }
>

export type AppModuleKey =
  | "dashboard"
  | "planning"
  | "groups"
  | "guides"
  | "availability"
  | "assignments"
  | "change-requests"
  | "import-export"
  | "settings"
  | "guide-portal"

export type ModulePermissionKey =
  | "view-dashboard"
  | "view-planning"
  | "view-groups"
  | "create-groups"
  | "edit-groups"
  | "assign-guides"
  | "confirm-guides"
  | "export-groups"
  | "view-guides"
  | "create-guides"
  | "edit-guides"
  | "view-internal-metrics"
  | "view-change-request-metrics"
  | "view-availability"
  | "create-availability"
  | "edit-availability"
  | "delete-availability"
  | "view-assignments"
  | "assign-guide"
  | "change-guide"
  | "confirm-guide"
  | "view-change-requests"
  | "view-import-export"
  | "import-excel"
  | "export-excel"
  | "view-settings"
  | "manage-settings"
  | "manage-roles-permissions"
  | "manage-email-templates"
  | "manage-notification-settings"
  | "view-own-profile"
  | "view-own-groups"
  | "edit-own-availability"
  | "request-group-change"

export type ModulePermissionSettings = {
  access: boolean
  permissions: Partial<Record<ModulePermissionKey, boolean>>
}

export type PermissionsSettings = Record<
  RoleKey,
  Record<AppModuleKey, ModulePermissionSettings>
>

export type AppSettings = {
  general: GeneralSettings
  display: DisplaySettings
  availability: AvailabilitySettings
  guideMetrics: GuideMetricsSettings
  notifications: NotificationSettings
  emailTemplates: EmailTemplateSettings
  permissions: PermissionsSettings
}
