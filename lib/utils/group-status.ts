import type { GroupStatus } from "@/lib/types/domain"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"

export const groupStatusOptions: { value: GroupStatus; labelKey: UiTranslationKey }[] = [
  { value: "active", labelKey: "status.active" },
  { value: "cxl", labelKey: "status.cxl" },
  { value: "fusionado", labelKey: "status.fusionado" },
  { value: "finalized", labelKey: "status.finalized" },
]
