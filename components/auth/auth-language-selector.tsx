"use client"

import { Languages } from "lucide-react"

import { useI18n } from "@/components/i18n/i18n-provider"
import { saveUiLanguage, useUiLanguage } from "@/components/settings/settings-client-store"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AppLanguage } from "@/lib/types/settings"

export function AuthLanguageSelector() {
  const { t } = useI18n()
  const language = useUiLanguage()

  return (
    <Select value={language} onValueChange={(value) => saveUiLanguage(value as AppLanguage)}>
      <SelectTrigger aria-label={t("settings.language.label")} className="h-8 w-24">
        <Languages className="size-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">EN</SelectItem>
        <SelectItem value="es">ES</SelectItem>
        <SelectItem value="fr">FR</SelectItem>
        <SelectItem value="tr">TR</SelectItem>
      </SelectContent>
    </Select>
  )
}
