import type {
  AppLanguage,
  AppModuleKey,
  AppSettings,
  EmailTemplateType,
  ModulePermissionKey,
  NotificationType,
  RoleKey,
} from "@/lib/types/settings"

export const appLanguageOptions: { value: AppLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "tr", label: "Turkish" },
]

export const settingsRoleOptions: { value: RoleKey; label: string }[] = [
  { value: "super-admin", label: "Super Admin" },
  { value: "admin-administrativo", label: "Admin Administrativo" },
  { value: "consulta-interna", label: "Consulta Interna" },
  { value: "guide", label: "Guide" },
]

export const notificationTypeLabels: Record<NotificationType, string> = {
  "guide-invitation": "Guide invitation",
  "assigned-groups-email": "Assigned groups email",
  "availability-conflict-alert": "Internal availability conflict alert",
  "group-without-guide-alert": "Group without guide alert",
  "yearly-availability-request": "Yearly availability request",
  "assignment-changed": "Assignment changed",
  "guide-confirmation-reminder": "Guide confirmation reminder",
  "availability-request-reminder": "Availability request reminder",
  "change-request-update": "Change request update",
}

export const emailTemplateTypeLabels: Record<EmailTemplateType, string> = {
  "group-cancelled-for-guide": "Group cancelled for guide",
  "group-merged-for-guide": "Group merged for guide",
  "guide-invitation": "Guide invitation",
  "reset-password": "Reset password",
  "assigned-groups-email": "Assigned groups email",
  "availability-conflict-alert": "Internal availability conflict alert",
  "group-without-guide-alert": "Group without guide alert",
  "yearly-availability-request": "Yearly availability request",
  "assignment-changed": "Assignment changed",
  "guide-confirmation-reminder": "Guide confirmation reminder",
  "availability-request-reminder": "Availability request reminder",
  "change-request-update": "Change request update",
}

export const modulePermissionLabels: Record<ModulePermissionKey, string> = {
  "view-dashboard": "View dashboard",
  "view-planning": "View planning",
  "view-groups": "View groups",
  "create-groups": "Create groups",
  "edit-groups": "Edit groups",
  "assign-guides": "Assign guides",
  "confirm-guides": "Confirm guides",
  "export-groups": "Export groups",
  "view-guides": "View guides",
  "create-guides": "Create guides",
  "edit-guides": "Edit guides",
  "view-internal-metrics": "View internal metrics",
  "view-change-request-metrics": "View change request metrics",
  "view-availability": "View availability",
  "create-availability": "Create availability",
  "edit-availability": "Edit availability",
  "delete-availability": "Delete availability",
  "view-assignments": "View assignments",
  "assign-guide": "Assign guide",
  "change-guide": "Change guide",
  "confirm-guide": "Confirm guide",
  "view-change-requests": "View change requests",
  "view-import-export": "View import export",
  "import-excel": "Import Excel",
  "export-excel": "Export Excel",
  "view-settings": "View settings",
  "manage-settings": "Manage settings",
  "manage-roles-permissions": "Manage roles permissions",
  "manage-email-templates": "Manage email templates",
  "manage-notification-settings": "Manage notification settings",
  "view-own-profile": "View own profile",
  "view-own-groups": "View own groups",
  "edit-own-availability": "Edit own availability",
  "request-group-change": "Request group change",
}

export const settingsModules: {
  key: AppModuleKey
  label: string
  href: string
  permissions: ModulePermissionKey[]
}[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/",
    permissions: ["view-dashboard"],
  },
  {
    key: "planning",
    label: "Planning",
    href: "/planning",
    permissions: ["view-planning"],
  },
  {
    key: "groups",
    label: "Groups",
    href: "/groups",
    permissions: [
      "view-groups",
      "create-groups",
      "edit-groups",
      "assign-guides",
      "confirm-guides",
      "export-groups",
    ],
  },
  {
    key: "guides",
    label: "Guides",
    href: "/guides",
    permissions: [
      "view-guides",
      "create-guides",
      "edit-guides",
      "view-internal-metrics",
      "view-change-request-metrics",
    ],
  },
  {
    key: "availability",
    label: "Availability",
    href: "/availability",
    permissions: [
      "view-availability",
      "create-availability",
      "edit-availability",
      "delete-availability",
    ],
  },
  {
    key: "assignments",
    label: "Assignments",
    href: "/assignments",
    permissions: [
      "view-assignments",
      "assign-guide",
      "change-guide",
      "confirm-guide",
    ],
  },
  {
    key: "change-requests",
    label: "Change Requests",
    href: "/change-requests",
    permissions: ["view-change-requests"],
  },
  {
    key: "import-export",
    label: "Import / Export",
    href: "/import-export",
    permissions: ["view-import-export", "import-excel", "export-excel"],
  },
  {
    key: "settings",
    label: "Settings",
    href: "/settings",
    permissions: [
      "view-settings",
      "manage-settings",
      "manage-roles-permissions",
      "manage-email-templates",
      "manage-notification-settings",
    ],
  },
  {
    key: "guide-portal",
    label: "Guide Portal",
    href: "/guide",
    permissions: [
      "view-own-profile",
      "view-own-groups",
      "edit-own-availability",
      "request-group-change",
    ],
  },
]

export const primaryModuleViewPermissions: Record<
  AppModuleKey,
  ModulePermissionKey
> = {
  dashboard: "view-dashboard",
  planning: "view-planning",
  groups: "view-groups",
  guides: "view-guides",
  availability: "view-availability",
  assignments: "view-assignments",
  "change-requests": "view-change-requests",
  "import-export": "view-import-export",
  settings: "view-settings",
  "guide-portal": "view-own-profile",
}

export const notificationTypes = Object.keys(
  notificationTypeLabels
) as NotificationType[]

export const emailProducingNotificationTypes: NotificationType[] = [
  "guide-invitation",
  "assigned-groups-email",
  "availability-conflict-alert",
  "group-without-guide-alert",
  "yearly-availability-request",
  "assignment-changed",
  "guide-confirmation-reminder",
  "availability-request-reminder",
  "change-request-update",
]

export const emailTemplateTypes = Object.keys(
  emailTemplateTypeLabels
) as EmailTemplateType[]

export const settingsModuleKeys = settingsModules.map((module) => module.key)

export const defaultAppSettings: AppSettings = {
  general: {
    defaultLanguage: "en",
    defaultGroupLanguage: "es",
  },
  display: {
    showInternalGuideMetrics: true,
    showGuideChangeRequestMetrics: true,
    showInternalNotes: true,
    showSalesRanking: true,
  },
  availability: {
    minYear: 2026,
    maxYear: 2040,
    defaultSelectedYear: 2026,
  },
  guideMetrics: {
    enableInternalRating: true,
    enableSalesRanking: true,
    enableSalesScore: true,
  },
  notifications: {
    "guide-invitation": {
      enabled: true,
      primaryRecipientLabel: "Invited guide",
      primaryRecipientHelp: "This recipient is determined by the action.",
      internalCopyRoleIds: ["super-admin", "admin-administrativo"],
      manualCopyEmails: "",
      senderRoleIds: ["super-admin", "admin-administrativo"],
      triggerType: "Admin action mock",
    },
    "assigned-groups-email": {
      enabled: true,
      primaryRecipientLabel: "Assigned guide",
      primaryRecipientHelp: "This recipient is determined by the action.",
      internalCopyRoleIds: [],
      manualCopyEmails: "",
      senderRoleIds: ["super-admin", "admin-administrativo"],
      triggerType: "Admin action mock",
    },
    "availability-conflict-alert": {
      enabled: true,
      primaryRecipientLabel: "Configured internal roles",
      primaryRecipientHelp: "Internal recipient roles receive this alert.",
      internalCopyRoleIds: ["super-admin"],
      manualCopyEmails: "operations@example.com",
      senderRoleIds: [],
      triggerType: "System / Admin action mock",
    },
    "group-without-guide-alert": {
      enabled: true,
      primaryRecipientLabel: "Configured internal roles",
      primaryRecipientHelp: "Internal recipient roles receive this alert.",
      internalCopyRoleIds: ["super-admin", "admin-administrativo"],
      manualCopyEmails: "",
      senderRoleIds: [],
      triggerType: "System alert mock",
    },
    "yearly-availability-request": {
      enabled: false,
      primaryRecipientLabel: "Active guides",
      primaryRecipientHelp: "This recipient is determined by the action.",
      internalCopyRoleIds: [],
      manualCopyEmails: "",
      senderRoleIds: ["super-admin", "admin-administrativo"],
      triggerType: "Admin action mock",
    },
    "assignment-changed": {
      enabled: false,
      primaryRecipientLabel: "Assigned or affected guide",
      primaryRecipientHelp:
        "The affected guide is determined by the assignment workflow.",
      internalCopyRoleIds: ["super-admin", "admin-administrativo"],
      manualCopyEmails: "",
      senderRoleIds: ["super-admin", "admin-administrativo"],
      triggerType: "Future assignment workflow",
    },
    "guide-confirmation-reminder": {
      enabled: false,
      primaryRecipientLabel: "Assigned guide",
      primaryRecipientHelp:
        "The guide with a pending confirmation is determined by the workflow.",
      internalCopyRoleIds: ["admin-administrativo"],
      manualCopyEmails: "",
      senderRoleIds: [],
      triggerType: "Future reminder workflow",
    },
    "availability-request-reminder": {
      enabled: false,
      primaryRecipientLabel: "Guides missing requested availability",
      primaryRecipientHelp:
        "Recipients are determined from the outstanding availability request.",
      internalCopyRoleIds: ["admin-administrativo"],
      manualCopyEmails: "",
      senderRoleIds: [],
      triggerType: "Future reminder workflow",
    },
    "change-request-update": {
      enabled: false,
      primaryRecipientLabel: "Requesting guide or internal review team",
      primaryRecipientHelp:
        "The recipient is determined by the change request event.",
      internalCopyRoleIds: ["super-admin", "admin-administrativo"],
      manualCopyEmails: "",
      senderRoleIds: [],
      triggerType: "Future change request workflow",
    },
  },
  emailTemplates: {
    "group-cancelled-for-guide": {
      subject: { en: "Your assigned group has been cancelled", fr: "", es: "", tr: "" },
      body: { en: "Your assigned group has been cancelled and is no longer assigned to you. Contact Operations if you have any questions.", fr: "", es: "", tr: "" },
    },
    "group-merged-for-guide": {
      subject: { en: "Your assigned group has been marked as merged", fr: "", es: "", tr: "" },
      body: { en: "Your assigned group has been marked as merged and is no longer assigned to you. Contact Operations if you have any questions.", fr: "", es: "", tr: "" },
    },
    "guide-invitation": {
      subject: {
        en: "Invitation to Tour Guide Operations",
        fr: "Invitation a Tour Guide Operations",
        es: "Invitacion a Tour Guide Operations",
        tr: "Tour Guide Operations daveti",
      },
      body: {
        en: "You have been invited to access Tour Guide Operations.",
        fr: "Vous etes invite a acceder a Tour Guide Operations.",
        es: "Has sido invitado a acceder a Tour Guide Operations.",
        tr: "Tour Guide Operations sistemine davet edildiniz.",
      },
    },
    "reset-password": {
      subject: {
        en: "Reset your password",
        fr: "Reinitialiser votre mot de passe",
        es: "Restablece tu contrasena",
        tr: "Sifrenizi sifirlayin",
      },
      body: {
        en: "Use the secure link to reset your password.",
        fr: "Utilisez le lien securise pour reinitialiser votre mot de passe.",
        es: "Usa el enlace seguro para restablecer tu contrasena.",
        tr: "Sifrenizi sifirlamak icin guvenli baglantiyi kullanin.",
      },
    },
    "assigned-groups-email": {
      subject: {
        en: "Assigned groups update",
        fr: "Mise a jour des groupes assignes",
        es: "Actualizacion de grupos asignados",
        tr: "Atanan gruplar guncellemesi",
      },
      body: {
        en: "Your assigned groups have been updated.",
        fr: "Vos groupes assignes ont ete mis a jour.",
        es: "Tus grupos asignados han sido actualizados.",
        tr: "Atanan gruplariniz guncellendi.",
      },
    },
    "availability-conflict-alert": {
      subject: { en: "", fr: "", es: "", tr: "" },
      body: { en: "", fr: "", es: "", tr: "" },
    },
    "group-without-guide-alert": {
      subject: { en: "", fr: "", es: "", tr: "" },
      body: { en: "", fr: "", es: "", tr: "" },
    },
    "yearly-availability-request": {
      subject: {
        en: "Please submit your yearly availability",
        fr: "Veuillez envoyer vos disponibilites annuelles",
        es: "Envia tu disponibilidad anual",
        tr: "Yillik uygunlugunuzu gonderin",
      },
      body: {
        en: "Please complete your availability for the selected year.",
        fr: "Veuillez completer vos disponibilites pour l'annee selectionnee.",
        es: "Completa tu disponibilidad para el ano seleccionado.",
        tr: "Secilen yil icin uygunlugunuzu tamamlayin.",
      },
    },
    "assignment-changed": {
      subject: { en: "", fr: "", es: "", tr: "" },
      body: { en: "", fr: "", es: "", tr: "" },
    },
    "guide-confirmation-reminder": {
      subject: { en: "", fr: "", es: "", tr: "" },
      body: { en: "", fr: "", es: "", tr: "" },
    },
    "availability-request-reminder": {
      subject: { en: "", fr: "", es: "", tr: "" },
      body: { en: "", fr: "", es: "", tr: "" },
    },
    "change-request-update": {
      subject: { en: "", fr: "", es: "", tr: "" },
      body: { en: "", fr: "", es: "", tr: "" },
    },
  },
  permissions: {
    "super-admin": Object.fromEntries(
      settingsModules.map((module) => [
        module.key,
        {
          access: true,
          permissions: Object.fromEntries(
            module.permissions.map((permission) => [permission, true])
          ),
        },
      ])
    ) as AppSettings["permissions"]["super-admin"],
    "admin-administrativo": Object.fromEntries(
      settingsModules.map((module) => {
        const hasAccess = module.key !== "settings"
        return [
          module.key,
          {
            access: hasAccess,
            permissions: Object.fromEntries(
              module.permissions.map((permission) => [permission, hasAccess])
            ),
          },
        ]
      })
    ) as AppSettings["permissions"]["admin-administrativo"],
    "consulta-interna": Object.fromEntries(
      settingsModules.map((module) => {
        const hasAccess = module.key !== "settings"
        return [
          module.key,
          {
            access: hasAccess,
            permissions: Object.fromEntries(
              module.permissions.map((permission, index) => [
                permission,
                hasAccess && index === 0,
              ])
            ),
          },
        ]
      })
    ) as AppSettings["permissions"]["consulta-interna"],
    guide: Object.fromEntries(
      settingsModules.map((module) => {
        const hasAccess = module.key === "guide-portal"
        return [
          module.key,
          {
            access: hasAccess,
            permissions: Object.fromEntries(
              module.permissions.map((permission, index) => [
                permission,
                hasAccess && index === 0,
              ])
            ),
          },
        ]
      })
    ) as AppSettings["permissions"]["guide"],
  },
}
