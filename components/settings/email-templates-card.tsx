"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { useEffect, useMemo, useState } from "react"
import { Languages, LoaderCircle, RefreshCcw } from "lucide-react"

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  emailProducingNotificationTypes,
  emailTemplateTypes,
} from "@/lib/mock-data/settings"
import { emailTemplateTypeKeys } from "@/lib/i18n/settings-labels"
import type { TranslationCatalogEntry, TranslationLanguage } from "@/lib/i18n/catalog"
import { getTranslationCatalog } from "@/lib/supabase/queries/translations"
import type { EmailTemplateType } from "@/lib/types/settings"

const assignmentOutboxTemplateTypes = new Set<EmailTemplateType>([
  "group-cancelled-for-guide",
  "group-merged-for-guide",
  "assigned-groups-email",
  "assignment-changed",
  "guide-confirmation-reminder",
])

const catalogTemplateTypes: Partial<Record<EmailTemplateType, string>> = {
  "group-cancelled-for-guide": "group_cancelled_for_guide",
  "group-merged-for-guide": "group_merged_for_guide",
  "guide-invitation": "guide_invitation",
  "reset-password": "reset_password",
  "assigned-groups-email": "assigned_groups_email",
  "yearly-availability-request": "yearly_availability_request",
  "assignment-changed": "assignment_changed",
  "guide-confirmation-reminder": "guide_confirmation_reminder",
}

function configuredForLanguage(
  entries: TranslationCatalogEntry[],
  language: TranslationLanguage
) {
  const subject = entries.find((entry) => entry.emailTemplateField === "subject")
  const body = entries.find((entry) => entry.emailTemplateField === "body")
  return Boolean(subject?.[language].trim() && body?.[language].trim())
}

export function EmailTemplatesCard({
  canView,
  onManageTranslations,
}: {
  canView: boolean
  onManageTranslations: () => void
}) {
  const { t } = useI18n()
  const [catalog, setCatalog] = useState<TranslationCatalogEntry[]>([])
  const [status, setStatus] = useState("")
  const [isLoading, setIsLoading] = useState(canView)

  async function loadCatalog() {
    if (!canView) return
    setIsLoading(true)
    const result = await getTranslationCatalog()
    setIsLoading(false)
    setCatalog(result.data)
    setStatus(result.error ?? "")
  }

  useEffect(() => {
    if (!canView) return
    let isMounted = true
    void getTranslationCatalog().then((result) => {
      if (!isMounted) return
      setIsLoading(false)
      setCatalog(result.data)
      setStatus(result.error ?? "")
    })
    return () => {
      isMounted = false
    }
  }, [canView])

  const entriesByTemplate = useMemo(() => {
    const grouped = new Map<string, TranslationCatalogEntry[]>()
    for (const entry of catalog) {
      if (!entry.emailTemplateType) continue
      grouped.set(entry.emailTemplateType, [
        ...(grouped.get(entry.emailTemplateType) ?? []),
        entry,
      ])
    }
    return grouped
  }, [catalog])

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle><T i18nKey="settings.email_templates_card.email_templates" /></CardTitle>
            <CardDescription>
              <T i18nKey="settings.email_templates_card.english_source_and_translation_availability_from_the_supabase" />
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!canView || isLoading} onClick={loadCatalog}>
              {isLoading ? <LoaderCircle className="animate-spin" /> : <RefreshCcw />}
              <T i18nKey="common.refresh" />
            </Button>
            <Button size="sm" onClick={onManageTranslations}>
              <Languages />
              <T i18nKey="settings.email_templates_card.manage_translations" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {emailProducingNotificationTypes.length} <T i18nKey="settings.email_templates_card.notification_rules_produce_email_events_external_delivery_remains" />
        </p>
        {status ? <p role="status" className="text-sm text-red-700">{status}</p> : null}
        {!canView ? (
          <p className="text-sm text-amber-700"><T i18nKey="settings.email_templates_card.sign_in_with_settings_access_to_view_the" /></p>
        ) : null}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><T i18nKey="settings.email_templates_card.template" /></TableHead>
                <TableHead><T i18nKey="settings.email_templates_card.english_subject" /></TableHead>
                <TableHead><T i18nKey="settings.email_templates_card.translation_availability" /></TableHead>
                <TableHead><T i18nKey="settings.email_templates_card.connection" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emailTemplateTypes.map((type) => {
                const catalogType = catalogTemplateTypes[type]
                const entries = catalogType ? entriesByTemplate.get(catalogType) ?? [] : []
                const subject = entries.find((entry) => entry.emailTemplateField === "subject")

                return (
                  <TableRow key={type}>
                    <TableCell className="font-medium">
                      {t(emailTemplateTypeKeys[type])}
                    </TableCell>
                    <TableCell className="max-w-80 truncate" title={subject?.en ?? ""}>
                      {subject?.en || "Missing source"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(["en", "es", "fr", "tr"] as TranslationLanguage[]).map((language) => (
                          <Badge
                            key={language}
                            variant={configuredForLanguage(entries, language) ? "secondary" : "outline"}
                          >
                            {language.toUpperCase()} {configuredForLanguage(entries, language) ? "✓" : "—"}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {type === "reset-password"
                          ? t("settings.notifications.auth_managed_preview")
                          : assignmentOutboxTemplateTypes.has(type)
                            ? t("settings.notifications.workflow_provider_missing")
                            : t("settings.notifications.not_connected")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
