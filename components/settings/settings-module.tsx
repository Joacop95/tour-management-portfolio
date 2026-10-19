"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { RotateCcw, Save } from "lucide-react"

import { CircuitsCard } from "@/components/settings/circuits-card"
import { EmailTemplatesCard } from "@/components/settings/email-templates-card"
import { InternalAuthorizedUsersCard } from "@/components/settings/internal-authorized-users-card"
import { NotificationRulesCard } from "@/components/settings/notification-rules-card"
import { RealRolePermissionsCard } from "@/components/settings/real-role-permissions-card"
import { TranslationsCard } from "@/components/settings/translations-card"
import { useCurrentUserAccess } from "@/components/layout/current-user-access-provider"
import { isDevToolsEnabled } from "@/lib/auth/runtime-mode"
import {
  useAppSettings,
  usePermissionSource,
  usePreviewRole,
} from "@/components/settings/settings-client-store"
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
  appLanguageOptions,
  defaultAppSettings,
  primaryModuleViewPermissions,
  settingsModules,
  settingsRoleOptions,
} from "@/lib/mock-data/settings"
import { previewModuleKeys, previewPermissionKeys } from "@/lib/i18n/settings-labels"
import {
  hasActivePermission,
  resolveActivePermissionKeys,
} from "@/lib/auth/permission-source"
import type {
  AppLanguage,
  AppModuleKey,
  AppSettings,
  ModulePermissionKey,
  RoleKey,
} from "@/lib/types/settings"
import {
  localStorageKeys,
  writeLocalStorageValue,
} from "@/lib/utils/local-storage"
import {
  cloneAppSettings,
} from "@/lib/utils/settings-access"

const manageSettingsPermissionMessage =
  "You do not have permission to edit settings."
const manageRolesPermissionMessage =
  "You do not have permission to manage roles and permissions."
const manageNotificationsPermissionMessage =
  "You do not have permission to edit notification settings."

type SettingsSectionKey =
  | "notifications"
  | "translations"
  | "access"
  | "circuits"
  | "general"
type AccessSectionPanel = "roles" | "internal-users"
type NotificationsSectionPanel = "rules" | "templates"

const settingsSections: {
  key: SettingsSectionKey
  labelKey: UiTranslationKey
  descriptionKey: UiTranslationKey
}[] = [
  {
    key: "notifications",
    labelKey: "settings.sections.notifications",
    descriptionKey: "settings.sections.notifications_description",
  },
  {
    key: "translations",
    labelKey: "settings.sections.translations",
    descriptionKey: "settings.sections.translations_description",
  },
  {
    key: "access",
    labelKey: "settings.sections.access",
    descriptionKey: "settings.sections.access_description",
  },
  {
    key: "circuits",
    labelKey: "settings.sections.circuits",
    descriptionKey: "settings.sections.circuits_description",
  },
  {
    key: "general",
    labelKey: "settings.sections.general",
    descriptionKey: "settings.sections.general_description",
  },
]

const permissionMatrixColumns: {
  key: string
  labelKey: UiTranslationKey
  matches: (permission: ModulePermissionKey) => boolean
}[] = [
  {
    key: "create",
    labelKey: "settings.permissions.create",
    matches: (permission) =>
      permission.startsWith("create-") || permission === "import-excel",
  },
  {
    key: "edit",
    labelKey: "settings.permissions.edit",
    matches: (permission) =>
      permission.startsWith("edit-") || permission === "change-guide",
  },
  {
    key: "assign",
    labelKey: "settings.permissions.assign",
    matches: (permission) =>
      permission === "assign-guides" || permission === "assign-guide",
  },
  {
    key: "confirm",
    labelKey: "settings.permissions.confirm",
    matches: (permission) =>
      permission === "confirm-guides" || permission === "confirm-guide",
  },
  {
    key: "export",
    labelKey: "settings.permissions.export",
    matches: (permission) =>
      permission === "export-groups" || permission === "export-excel",
  },
  {
    key: "manage",
    labelKey: "settings.permissions.manage",
    matches: (permission) => permission.startsWith("manage-"),
  },
]

function normalizeCheckboxValue(value: boolean | "indeterminate") {
  return value === true
}

type SettingsDraftUpdater = (draft: AppSettings) => void

function buildYearOptions(minYear = 2026, maxYear = 2040) {
  return Array.from({ length: maxYear - minYear + 1 }, (_, index) =>
    String(minYear + index)
  )
}

function getAvailabilityValidationError(settings: AppSettings, t: ReturnType<typeof useI18n>["t"]) {
  const { minYear, maxYear, defaultSelectedYear } = settings.availability

  if (![minYear, maxYear, defaultSelectedYear].every(Number.isFinite)) {
    return t("validation.availability_years_numeric")
  }

  if (minYear > maxYear) {
    return t("validation.availability_min_year")
  }

  if (defaultSelectedYear < minYear || defaultSelectedYear > maxYear) {
    return t("validation.availability_default_year")
  }

  return null
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function SettingsSectionShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="rounded-xl border bg-card px-4 py-3 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function ToggleSetting({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) =>
          onCheckedChange(normalizeCheckboxValue(value))
        }
      />
      <span className="grid gap-1">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{description}</span>
      </span>
    </label>
  )
}

function LanguageSelect({
  label,
  value,
  disabled,
  onValueChange,
}: {
  label: string
  value: AppLanguage
  disabled?: boolean
  onValueChange: (value: AppLanguage) => void
}) {
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(nextValue) => onValueChange(nextValue as AppLanguage)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {appLanguageOptions.map((language) => (
            <SelectItem key={language.value} value={language.value}>
              {language.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function GeneralSettingsCard({
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
  function updateSettings(nextSettings: AppSettings) {
    if (canEdit) {
      onChange(nextSettings)
    }
  }

  return (
    <SettingsCard
      title={t("settings.settings_module.title_general_settings")}
      description={t("settings.settings_module.description_default_app_language_and_group_language_preferences")}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <LanguageSelect
          label={t("settings.settings_module.label_default_language")}
          value={settings.general.defaultLanguage}
          disabled={!canEdit}
          onValueChange={(defaultLanguage) =>
            updateSettings({
              ...settings,
              general: { ...settings.general, defaultLanguage },
            })
          }
        />
        <LanguageSelect
          label={t("settings.settings_module.label_default_group_language")}
          value={settings.general.defaultGroupLanguage}
          disabled={!canEdit}
          onValueChange={(defaultGroupLanguage) =>
            updateSettings({
              ...settings,
              general: { ...settings.general, defaultGroupLanguage },
            })
          }
        />
      </div>
      <p className="text-sm text-muted-foreground">
        <T i18nKey="settings.settings_module.these_values_are_defaults_for_new_local_behavior" />
      </p>
      {!canEdit ? (
        <p className="text-sm text-amber-700">{permissionMessage}</p>
      ) : null}
    </SettingsCard>
  )
}

function DisplaySettingsCard({
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
  function setDisplayValue(
    key: keyof AppSettings["display"],
    value: boolean
  ) {
    if (!canEdit) {
      return
    }

    onChange({
      ...settings,
      display: { ...settings.display, [key]: value },
    })
  }

  return (
    <SettingsCard
      title={t("settings.settings_module.title_display_settings")}
      description={t("settings.settings_module.description_mock_visibility_controls_for_sensitive_operational_columns")}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <ToggleSetting
          label={t("settings.settings_module.label_show_guide_change_request_metrics")}
          description={t("settings.settings_module.description_controls_the_change_requests_column_in_the_guides")}
          checked={settings.display.showGuideChangeRequestMetrics}
          disabled={!canEdit}
          onCheckedChange={(checked) =>
            setDisplayValue("showGuideChangeRequestMetrics", checked)
          }
        />
        <ToggleSetting
          label={t("settings.settings_module.label_show_internal_notes")}
          description={t("settings.settings_module.description_saved_for_future_profile_and_table_visibility_rules")}
          checked={settings.display.showInternalNotes}
          disabled={!canEdit}
          onCheckedChange={(checked) =>
            setDisplayValue("showInternalNotes", checked)
          }
        />
      </div>
      {!canEdit ? (
        <p className="text-sm text-amber-700">{permissionMessage}</p>
      ) : null}
    </SettingsCard>
  )
}

function AvailabilitySettingsCard({
  settings,
  validationError,
  canEdit,
  permissionMessage,
  onChange,
}: {
  settings: AppSettings
  validationError: string | null
  canEdit: boolean
  permissionMessage: string
  onChange: (settings: AppSettings) => void
}) {
  const { t } = useI18n()
  const yearOptions = buildYearOptions()

  function setAvailabilityNumber(
    key: keyof AppSettings["availability"],
    value: number
  ) {
    if (!canEdit) {
      return
    }

    onChange({
      ...settings,
      availability: { ...settings.availability, [key]: value },
    })
  }

  return (
    <SettingsCard
      title={t("settings.settings_module.title_availability_settings")}
      description={t("settings.settings_module.description_mock_defaults_for_date_ranges_and_availability_year")}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid gap-1">
          <Label htmlFor="availability-min-year"><T i18nKey="settings.settings_module.minimum_year" /></Label>
          <Input
            id="availability-min-year"
            type="number"
            min={2026}
            max={2040}
            value={settings.availability.minYear}
            disabled={!canEdit}
            onChange={(event) =>
              setAvailabilityNumber("minYear", Number(event.target.value))
            }
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="availability-max-year"><T i18nKey="settings.settings_module.maximum_year" /></Label>
          <Input
            id="availability-max-year"
            type="number"
            min={2026}
            max={2040}
            value={settings.availability.maxYear}
            disabled={!canEdit}
            onChange={(event) =>
              setAvailabilityNumber("maxYear", Number(event.target.value))
            }
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="availability-default-year">
            <T i18nKey="settings.settings_module.default_selected_availability_year" />
          </Label>
          <Select
            value={String(settings.availability.defaultSelectedYear)}
            disabled={!canEdit}
            onValueChange={(value) =>
              setAvailabilityNumber("defaultSelectedYear", Number(value))
            }
          >
            <SelectTrigger id="availability-default-year" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        <T i18nKey="settings.settings_module.date_picker_range_and_availability_year_defaults_can" />
      </p>
      {validationError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {validationError}
        </p>
      ) : null}
      {!canEdit ? (
        <p className="text-sm text-amber-700">{permissionMessage}</p>
      ) : null}
    </SettingsCard>
  )
}

function GuideMetricsSettingsCard({
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
  function setGuideMetricValue(
    key: keyof AppSettings["guideMetrics"],
    value: boolean
  ) {
    if (!canEdit) {
      return
    }

    onChange({
      ...settings,
      guideMetrics: { ...settings.guideMetrics, [key]: value },
    })
  }

  function setGuideMetricsEnabled(showInternalGuideMetrics: boolean) {
    if (!canEdit) {
      return
    }

    onChange({
      ...settings,
      display: {
        ...settings.display,
        showInternalGuideMetrics,
        showSalesRanking: showInternalGuideMetrics
          ? settings.guideMetrics.enableSalesRanking ||
            settings.guideMetrics.enableSalesScore
          : settings.display.showSalesRanking,
      },
    })
  }

  function setSalesRankingEnabled(enableSalesRanking: boolean) {
    if (!canEdit) {
      return
    }

    onChange({
      ...settings,
      display: {
        ...settings.display,
        showSalesRanking:
          enableSalesRanking || settings.guideMetrics.enableSalesScore,
      },
      guideMetrics: {
        ...settings.guideMetrics,
        enableSalesRanking,
      },
    })
  }

  function setSalesScoreEnabled(enableSalesScore: boolean) {
    if (!canEdit) {
      return
    }

    onChange({
      ...settings,
      display: {
        ...settings.display,
        showSalesRanking:
          settings.guideMetrics.enableSalesRanking || enableSalesScore,
      },
      guideMetrics: {
        ...settings.guideMetrics,
        enableSalesScore,
      },
    })
  }

  const guideMetricsEnabled = settings.display.showInternalGuideMetrics
  const childSettingsDisabled = !canEdit || !guideMetricsEnabled

  return (
    <SettingsCard
      title={t("settings.settings_module.title_guide_metrics_settings")}
      description={t("settings.settings_module.description_reference_only_guide_metrics_for_future_survey_and")}
    >
      <ToggleSetting
        label={t("settings.settings_module.label_enable_guide_metrics")}
        description={t("settings.settings_module.description_shows_the_guide_metrics_surface_in_preview_local")}
        checked={guideMetricsEnabled}
        disabled={!canEdit}
        onCheckedChange={setGuideMetricsEnabled}
      />
      <div className="grid gap-3 border-l-2 border-border pl-3 md:grid-cols-3">
        <ToggleSetting
          label={t("settings.settings_module.label_internal_rating")}
          description={t("settings.settings_module.description_show_internal_guide_rating_values")}
          checked={settings.guideMetrics.enableInternalRating}
          disabled={childSettingsDisabled}
          onCheckedChange={(checked) =>
            setGuideMetricValue("enableInternalRating", checked)
          }
        />
        <ToggleSetting
          label={t("settings.settings_module.label_sales_ranking")}
          description={t("settings.settings_module.description_show_guide_sales_ranking_values")}
          checked={settings.guideMetrics.enableSalesRanking}
          disabled={childSettingsDisabled}
          onCheckedChange={setSalesRankingEnabled}
        />
        <ToggleSetting
          label={t("settings.settings_module.label_sales_score")}
          description={t("settings.settings_module.description_show_guide_sales_score_values")}
          checked={settings.guideMetrics.enableSalesScore}
          disabled={childSettingsDisabled}
          onCheckedChange={setSalesScoreEnabled}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        <T i18nKey="settings.settings_module.guide_metrics_are_mock_only_until_survey_and" />
      </p>
      {!canEdit ? (
        <p className="text-sm text-amber-700">{permissionMessage}</p>
      ) : null}
    </SettingsCard>
  )
}

function RolesPermissionsCard({
  settings,
  canEdit,
  permissionMessage,
  permissionSourceLabel,
  usesAuthPermissionSource,
  onDraftUpdate,
}: {
  settings: AppSettings
  canEdit: boolean
  permissionMessage: string
  permissionSourceLabel: string
  usesAuthPermissionSource: boolean
  onDraftUpdate: (updater: SettingsDraftUpdater) => void
}) {
  const { t } = useI18n()
  const [selectedRole, setSelectedRole] = useState<RoleKey>("super-admin")
  const rolePermissions = settings.permissions[selectedRole]
  const modulesWithAccess = settingsModules.filter((module) =>
    Boolean(rolePermissions[module.key].access)
  ).length
  const enabledPermissionCount = settingsModules.reduce((count, module) => {
    const moduleSettings = rolePermissions[module.key]

    return (
      count +
      module.permissions.filter((permission) =>
        Boolean(moduleSettings.permissions[permission])
      ).length
    )
  }, 0)

  function isProtectedSuperAdminSetting(
    moduleKey: string,
    permission?: ModulePermissionKey
  ) {
    return (
      selectedRole === "super-admin" &&
      moduleKey === "settings" &&
      (!permission ||
        permission === "view-settings" ||
        permission === "manage-roles-permissions")
    )
  }

  function updateModuleAccess(moduleKey: AppModuleKey, access: boolean) {
    if (!canEdit) {
      return
    }

    if (isProtectedSuperAdminSetting(moduleKey)) {
      return
    }

    onDraftUpdate((draft) => {
      const moduleSettings = draft.permissions[selectedRole][moduleKey]
      const primaryViewPermission = primaryModuleViewPermissions[moduleKey]

      moduleSettings.access = access
      if (access) {
        moduleSettings.permissions[primaryViewPermission] = true
      } else {
        for (const permission of
          settingsModules.find((module) => module.key === moduleKey)
            ?.permissions ?? []) {
          moduleSettings.permissions[permission] = false
        }
      }
    })
  }

  function updatePermission(
    role: RoleKey,
    moduleKey: AppModuleKey,
    permission: ModulePermissionKey,
    checked: boolean
  ) {
    if (!canEdit) {
      return
    }

    if (isProtectedSuperAdminSetting(moduleKey, permission)) {
      return
    }

    onDraftUpdate((draft) => {
      draft.permissions[role][moduleKey].permissions[permission] = checked
    })
  }

  function getColumnPermissions(
    modulePermissions: ModulePermissionKey[],
    column: (typeof permissionMatrixColumns)[number]
  ) {
    return modulePermissions.filter((permission) => column.matches(permission))
  }

  function getOtherPermissions(
    moduleKey: AppModuleKey,
    modulePermissions: ModulePermissionKey[]
  ) {
    const primaryViewPermission = primaryModuleViewPermissions[moduleKey]

    return modulePermissions.filter(
      (permission) =>
        permission !== primaryViewPermission &&
        !permissionMatrixColumns.some((column) => column.matches(permission))
    )
  }

  function renderPermissionCheckbox(
    moduleKey: AppModuleKey,
    permission: ModulePermissionKey,
    options: {
      hasAccess: boolean
      showLabel?: boolean
    }
  ) {
    const moduleSettings = rolePermissions[moduleKey]
    const permissionDisabled =
      isProtectedSuperAdminSetting(moduleKey, permission) ||
      !canEdit ||
      !options.hasAccess
    const label = t(previewPermissionKeys[permission])
    const checkboxId = `permission-${selectedRole}-${moduleKey}-${permission}`

    return (
      <div
        key={permission}
        className="inline-flex min-h-6 items-center gap-1.5 text-xs text-muted-foreground"
        title={!options.hasAccess ? t("settings.preview.enable_access_first") : label}
      >
        <Checkbox
          id={checkboxId}
          aria-label={label}
          checked={Boolean(moduleSettings.permissions[permission])}
          disabled={permissionDisabled}
          onCheckedChange={(checked) =>
            updatePermission(
              selectedRole,
              moduleKey,
              permission,
              normalizeCheckboxValue(checked)
            )
          }
        />
        {options.showLabel ? (
          <label htmlFor={checkboxId} className="cursor-pointer whitespace-nowrap">
            {label}
          </label>
        ) : (
          <label htmlFor={checkboxId} className="sr-only">
            {label}
          </label>
        )}
      </div>
    )
  }

  function renderPermissionCell(
    moduleKey: AppModuleKey,
    permissions: ModulePermissionKey[],
    hasAccess: boolean,
    options?: {
      alwaysShowLabels?: boolean
    }
  ) {
    if (permissions.length === 0) {
      return <span className="text-muted-foreground/60">—</span>
    }

    return (
      <div className="flex flex-col gap-1">
        {permissions.map((permission) =>
          renderPermissionCheckbox(moduleKey, permission, {
            hasAccess,
            showLabel: options?.alwaysShowLabels || permissions.length > 1,
          })
        )}
      </div>
    )
  }

  return (
    <SettingsCard
      title={t("settings.settings_module.title_preview_role_permissions")}
      description={t("settings.settings_module.description_development_only_local_simulation_this_does_not_change")}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,320px)_1fr]">
        <div className="grid gap-2">
          <Label htmlFor="permission-matrix-role"><T i18nKey="settings.internal_authorized_users_card.role" /></Label>
          <Select
            value={selectedRole}
            onValueChange={(value) => setSelectedRole(value as RoleKey)}
          >
            <SelectTrigger id="permission-matrix-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {settingsRoleOptions.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground"><T i18nKey="settings.real_role_permissions_card.selected_role" /></p>
            <p className="font-semibold">
              {
                settingsRoleOptions.find((role) => role.value === selectedRole)
                  ?.label
              }
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground"><T i18nKey="settings.real_role_permissions_card.modules_with_access" /></p>
            <p className="font-semibold">
              {modulesWithAccess} <T i18nKey="settings.circuits_card.of" /> {settingsModules.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground"><T i18nKey="settings.real_role_permissions_card.enabled_permissions" /></p>
            <p className="font-semibold">{enabledPermissionCount}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-1 text-sm text-muted-foreground">
        <p>
          <T i18nKey="settings.settings_module.these_settings_edit_local_preview_role_permissions_they" />
        </p>
        {usesAuthPermissionSource ? (
          <p className="text-xs">
            <T i18nKey="settings.settings_module.switch_to_preview_role_permissions_and_save_changes" />
          </p>
        ) : (
          <p className="text-xs">
            <T i18nKey="settings.settings_module.current_active_permissions_are_using" /> {permissionSourceLabel}<T i18nKey="settings.settings_module.save_changes_to_test_this_role_in_the" />
          </p>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[980px] border-collapse text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr className="border-b">
              <th className="w-44 px-3 py-2 text-left font-medium"><T i18nKey="settings.real_role_permissions_card.module" /></th>
              <th className="w-28 px-3 py-2 text-left font-medium"><T i18nKey="settings.real_role_permissions_card.access" /></th>
              {permissionMatrixColumns.map((column) => (
                <th
                  key={column.key}
                  className="px-3 py-2 text-left font-medium"
                >
                  {t(column.labelKey)}
                </th>
              ))}
              <th className="min-w-48 px-3 py-2 text-left font-medium">
                <T i18nKey="settings.real_role_permissions_card.other_permissions" />
              </th>
            </tr>
          </thead>
          <tbody>
            {settingsModules.map((module) => {
              const moduleSettings = rolePermissions[module.key]
              const hasAccess = Boolean(moduleSettings.access)
              const accessDisabled = isProtectedSuperAdminSetting(module.key)
              const otherPermissions = getOtherPermissions(
                module.key,
                module.permissions
              )
              const accessCheckboxId = `module-access-${selectedRole}-${module.key}`

              return (
                <tr key={module.key} className="border-b last:border-b-0">
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium">{t(previewModuleKeys[module.key])}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {module.href}
                    </div>
                    {accessDisabled ? (
                      <Badge variant="outline" className="mt-1">
                        <T i18nKey="settings.real_role_permissions_card.protected" />
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div
                      className="inline-flex min-h-6 items-center gap-1.5 font-medium"
                      title={
                        accessDisabled
                          ? t("settings.preview.protected_super_admin")
                          : undefined
                      }
                    >
                      <Checkbox
                        id={accessCheckboxId}
                        aria-label={t("settings.preview.module_access_aria", { module: t(previewModuleKeys[module.key]) })}
                        checked={hasAccess}
                        disabled={accessDisabled || !canEdit}
                        onCheckedChange={(checked) =>
                          updateModuleAccess(
                            module.key,
                            normalizeCheckboxValue(checked)
                          )
                        }
                      />
                      <label
                        htmlFor={accessCheckboxId}
                        className={accessDisabled ? undefined : "cursor-pointer"}
                      >
                        {hasAccess ? t("common.on") : t("common.off")}
                      </label>
                    </div>
                  </td>
                  {permissionMatrixColumns.map((column) => (
                    <td key={column.key} className="px-3 py-2 align-top">
                      {renderPermissionCell(
                        module.key,
                        getColumnPermissions(module.permissions, column),
                        hasAccess
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2 align-top">
                    {renderPermissionCell(
                      module.key,
                      otherPermissions,
                      hasAccess,
                      { alwaysShowLabels: true }
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        <T i18nKey="settings.settings_module.disable_module_access_to_hide_the_module_from" />
      </p>
      <p className="text-sm text-muted-foreground">
        <T i18nKey="settings.settings_module.guide_portal_navigation_is_controlled_separately_from_the" />
      </p>
      <p className="text-sm text-muted-foreground">
        <T i18nKey="settings.settings_module.preview_settings_never_grant_backend_authority_or_modify" />
      </p>
      {!canEdit ? (
        <p className="text-sm text-amber-700">{permissionMessage}</p>
      ) : null}
    </SettingsCard>
  )
}

export function SettingsModule() {
  const { t } = useI18n()
  const persistedSettings = useAppSettings()
  const [settingsDraft, setSettingsDraft] = useState<AppSettings | null>(null)
  const [activeSection, setActiveSection] =
    useState<SettingsSectionKey>("notifications")
  const [activeNotificationsPanel, setActiveNotificationsPanel] =
    useState<NotificationsSectionPanel>("rules")
  const [activeAccessPanel, setActiveAccessPanel] =
    useState<AccessSectionPanel>("roles")
  const [savedMessage, setSavedMessage] = useState("")
  const { access: authAccess, isInitialLoading: isAuthAccessLoading } =
    useCurrentUserAccess()
  const previewRole = usePreviewRole()
  const permissionSource = usePermissionSource()
  const settings = settingsDraft ?? persistedSettings
  const availabilityValidationError = getAvailabilityValidationError(settings, t)
  const activePermissionResolution = resolveActivePermissionKeys({
    permissionSource,
    appSettings: persistedSettings,
    previewRole,
    authAccess,
  })
  const activePermissionKeys = activePermissionResolution.activePermissionKeys
  const isCheckingAuthPermissions =
    permissionSource === "auth" && isAuthAccessLoading
  const canManageSettings =
    !isCheckingAuthPermissions &&
    hasActivePermission(activePermissionKeys, "settings.manage_settings")
  const canManageRolesPermissions =
    !isAuthAccessLoading &&
    authAccess.isAuthenticated &&
    authAccess.permissionKeys.includes("settings.manage_roles_permissions")
  const canManageNotificationSettings =
    !isCheckingAuthPermissions &&
    hasActivePermission(
      activePermissionKeys,
      "settings.manage_notification_settings"
    )
  const canViewTranslations =
    !isAuthAccessLoading &&
    authAccess.isAuthenticated &&
    authAccess.permissionKeys.includes("settings.view")
  const canManageTranslations =
    !isAuthAccessLoading &&
    authAccess.isAuthenticated &&
    authAccess.permissionKeys.includes("settings.manage_settings")
  const canSaveSettings =
    (canManageSettings ||
      canManageRolesPermissions ||
      canManageNotificationSettings) &&
    !availabilityValidationError
  const canManageInternalAuthorizedUsers =
    authAccess.isAuthenticated &&
    authAccess.permissionKeys.includes("settings.manage_roles_permissions")
  const canAssignSuperAdmin = authAccess.roleKeys.includes("super-admin")
  const manageSettingsMessage = isCheckingAuthPermissions
    ? "Loading Auth permissions."
    : manageSettingsPermissionMessage
  const manageRolesMessage = isCheckingAuthPermissions
    ? "Loading Auth permissions."
    : manageRolesPermissionMessage
  const manageNotificationsMessage = isCheckingAuthPermissions
    ? "Loading Auth permissions."
    : manageNotificationsPermissionMessage
  const activeSectionConfig =
    settingsSections.find((section) => section.key === activeSection) ??
    settingsSections[0]
  const permissionSourceLabel =
    activePermissionResolution.effectiveSource === "auth"
      ? t("common.auth_user_permissions")
      : activePermissionResolution.effectiveSource === "preview-fallback"
        ? t("settings.preview.auth_fallback")
        : t("settings.preview.role_permissions")

  useEffect(() => {
    async function selectLinkedSection() {
      await Promise.resolve()
      const section = new URLSearchParams(window.location.search).get("section")
      if (section && settingsSections.some((item) => item.key === section)) {
        setActiveSection(section as SettingsSectionKey)
      }
    }

    void selectLinkedSection()
  }, [])

  function handleSave() {
    if (availabilityValidationError) {
      setSavedMessage(availabilityValidationError)
      return
    }

    if (!canSaveSettings) {
      setSavedMessage(manageSettingsMessage)
      return
    }

    writeLocalStorageValue(localStorageKeys.appSettings, settings)
    setSavedMessage(t("settings.preview.saved"))
  }

  function handleSettingsDraftChange(nextSettings: AppSettings) {
    setSettingsDraft(cloneAppSettings(nextSettings))
    setSavedMessage("")
  }

  function handleSettingsDraftUpdate(updater: SettingsDraftUpdater) {
    setSettingsDraft((currentDraft) => {
      const nextDraft = cloneAppSettings(currentDraft ?? persistedSettings)

      updater(nextDraft)
      return nextDraft
    })
    setSavedMessage("")
  }

  function handleReset() {
    if (!canManageSettings) {
      setSavedMessage(manageSettingsMessage)
      return
    }

    const defaults = cloneAppSettings(defaultAppSettings)

    setSettingsDraft(defaults)
    writeLocalStorageValue(localStorageKeys.appSettings, defaults)
    setSavedMessage(t("settings.preview.reset"))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isDevToolsEnabled ? <div className="space-y-1 text-sm text-muted-foreground">
          <p><T i18nKey="settings.settings_module.settings_are_stored_locally_in_this_browser_for" /></p>
          <p>
            <T i18nKey="settings.settings_module.settings_actions_use" />{" "}
            {activePermissionResolution.effectiveSource === "auth"
              ? t("common.auth_user_permissions")
              : activePermissionResolution.effectiveSource ===
                  "preview-fallback"
                ? t("settings.preview.auth_safe_fallback")
                : t("settings.preview.role_permissions")}
            .
          </p>
          <p className="text-xs">
            <T i18nKey="settings.settings_module.circuit_management_currently_uses_the_general_settings_permission" />
          </p>
          {activePermissionResolution.warning ? (
            <p className="text-xs text-amber-700">
              {activePermissionResolution.warning}
            </p>
          ) : null}
          {isCheckingAuthPermissions ? (
            <p className="text-xs"><T i18nKey="settings.settings_module.loading_auth_permissions_before_enabling_settings_actions" /></p>
          ) : null}
        </div> : null}
        <div className="flex flex-wrap items-center gap-2">
          {savedMessage ? (
            <span className="text-sm font-medium text-emerald-700">
              {savedMessage}
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={!canManageSettings}
            title={!canManageSettings ? manageSettingsMessage : undefined}
            onClick={handleReset}
          >
            <RotateCcw className="size-4" />
            <T i18nKey="settings.settings_module.reset_to_defaults" />
          </Button>
          <Button
            type="button"
            disabled={!canSaveSettings}
            title={
              availabilityValidationError ??
              (!canSaveSettings ? manageSettingsMessage : undefined)
            }
            onClick={handleSave}
          >
            <Save className="size-4" />
            <T i18nKey="settings.settings_module.save_settings" />
          </Button>
        </div>
      </div>

      <Card size="sm" className="gap-2">
        <CardHeader className="border-b pb-2">
          <CardTitle><T i18nKey="settings.settings_module.settings_sections" /></CardTitle>
          <CardDescription className="text-xs">
            <T i18nKey="settings.settings_module.choose_a_focused_area_to_manage_existing_permission" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {settingsSections.map((section) => {
              const isActive = section.key === activeSection

              return (
                <button
                  key={section.key}
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                    isActive
                      ? "border-primary/45 bg-primary/8 text-foreground shadow-sm"
                      : "bg-background hover:border-primary/25 hover:bg-primary/5"
                  }`}
                  aria-pressed={isActive}
                  onClick={() => setActiveSection(section.key)}
                >
                  <span className="block font-semibold">{t(section.labelKey)}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t(section.descriptionKey)}
                  </span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <SettingsSectionShell
        title={t(activeSectionConfig.labelKey)}
        description={t(activeSectionConfig.descriptionKey)}
      >
        {activeSection === "notifications" ? (
          <>
            <Card size="sm" className="gap-2">
              <CardHeader className="border-b pb-2">
                <CardTitle><T i18nKey="settings.settings_module.notification_and_email_tools" /></CardTitle>
                <CardDescription className="text-xs">
                  <T i18nKey="settings.settings_module.review_workflow_rules_separately_from_catalog_backed_email" />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      key: "rules" as const,
                      label: t("settings.panels.notification_rules"),
                      description: t("settings.panels.notification_rules_description"),
                    },
                    {
                      key: "templates" as const,
                      label: t("settings.panels.email_templates"),
                      description: t("settings.panels.email_templates_description"),
                    },
                  ].map((panel) => {
                    const isActive = panel.key === activeNotificationsPanel

                    return (
                      <button
                        key={panel.key}
                        type="button"
                        className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? "border-primary/45 bg-primary/8 text-foreground shadow-sm"
                            : "bg-background hover:border-primary/25 hover:bg-primary/5"
                        }`}
                        aria-pressed={isActive}
                        onClick={() => setActiveNotificationsPanel(panel.key)}
                      >
                        <span className="block font-semibold">{panel.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {panel.description}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {activeNotificationsPanel === "rules" ? (
              <NotificationRulesCard
                settings={settings}
                canEdit={canManageNotificationSettings}
                permissionMessage={manageNotificationsMessage}
                onChange={handleSettingsDraftChange}
              />
            ) : null}
            {activeNotificationsPanel === "templates" ? (
              <EmailTemplatesCard
                canView={canViewTranslations}
                onManageTranslations={() => setActiveSection("translations")}
              />
            ) : null}
          </>
        ) : null}

        {activeSection === "translations" ? (
          <TranslationsCard
            canView={canViewTranslations}
            canManage={canManageTranslations}
            permissionMessage={
              isAuthAccessLoading
                ? "Loading Auth permissions."
                : "You do not have permission to manage translations."
            }
          />
        ) : null}

        {activeSection === "access" ? (
          <>
            <Card size="sm" className="gap-2">
              <CardHeader className="border-b pb-2">
                <CardTitle><T i18nKey="settings.settings_module.access_tools" /></CardTitle>
                <CardDescription className="text-xs">
                  <T i18nKey="settings.settings_module.manage_real_role_permissions_or_the_internal_user" />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      key: "roles" as const,
                      label: t("settings.panels.roles_permissions"),
                      description: t("settings.panels.roles_permissions_description"),
                    },
                    {
                      key: "internal-users" as const,
                      label: t("settings.panels.internal_authorized_users"),
                      description: t("settings.panels.internal_authorized_users_description"),
                    },
                  ].map((panel) => {
                    const isActive = panel.key === activeAccessPanel

                    return (
                      <button
                        key={panel.key}
                        type="button"
                        className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? "border-primary/45 bg-primary/8 text-foreground shadow-sm"
                            : "bg-background hover:border-primary/25 hover:bg-primary/5"
                        }`}
                        aria-pressed={isActive}
                        onClick={() => setActiveAccessPanel(panel.key)}
                      >
                        <span className="block font-semibold">
                          {panel.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {panel.description}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {activeAccessPanel === "roles" ? (
              <>
                <RealRolePermissionsCard
                  canManage={canManageRolesPermissions}
                />
                {isDevToolsEnabled ? (
                  <details className="rounded-lg border bg-muted/20 p-3">
                    <summary className="cursor-pointer text-sm font-semibold">
                      <T i18nKey="settings.settings_module.development_preview_role_simulator" />
                    </summary>
                    <div className="mt-3">
                      <RolesPermissionsCard
                        settings={settings}
                        canEdit={canManageRolesPermissions}
                        permissionMessage={manageRolesMessage}
                        permissionSourceLabel={permissionSourceLabel}
                        usesAuthPermissionSource={permissionSource === "auth"}
                        onDraftUpdate={handleSettingsDraftUpdate}
                      />
                    </div>
                  </details>
                ) : null}
              </>
            ) : null}
            {activeAccessPanel === "internal-users" ? (
              <InternalAuthorizedUsersCard
                canManage={canManageInternalAuthorizedUsers}
                canAssignSuperAdmin={canAssignSuperAdmin}
                permissionMessage={manageRolesMessage}
              />
            ) : null}
          </>
        ) : null}

        {activeSection === "circuits" ? (
          <CircuitsCard
            canManageCircuits={canManageSettings}
            managePermissionMessage={manageSettingsMessage}
          />
        ) : null}

        {activeSection === "general" ? (
          <div className="grid items-start gap-4 xl:grid-cols-2">
            <GeneralSettingsCard
              settings={settings}
              canEdit={canManageSettings}
              permissionMessage={manageSettingsMessage}
              onChange={handleSettingsDraftChange}
            />
            <DisplaySettingsCard
              settings={settings}
              canEdit={canManageSettings}
              permissionMessage={manageSettingsMessage}
              onChange={handleSettingsDraftChange}
            />
            <AvailabilitySettingsCard
              settings={settings}
              validationError={availabilityValidationError}
              canEdit={canManageSettings}
              permissionMessage={manageSettingsMessage}
              onChange={handleSettingsDraftChange}
            />
            <GuideMetricsSettingsCard
              settings={settings}
              canEdit={canManageSettings}
              permissionMessage={manageSettingsMessage}
              onChange={handleSettingsDraftChange}
            />
          </div>
        ) : null}
      </SettingsSectionShell>
    </div>
  )
}
