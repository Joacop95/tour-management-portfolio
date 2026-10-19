import { T, useI18n } from "@/components/i18n/i18n-provider"
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"

const legendItems = [
  {
    labelKey: "planning.legend.assigned_active" as UiTranslationKey,
    tone: "success" as StatusTone,
  },
  {
    labelKey: "status.without_guide" as UiTranslationKey,
    tone: "destructive" as StatusTone,
  },
  {
    labelKey: "status.pending_confirmation" as UiTranslationKey,
    tone: "warning" as StatusTone,
  },
  {
    labelKey: "status.finalized" as UiTranslationKey,
    tone: "info" as StatusTone,
  },
  {
    labelKey: "status.cxl" as UiTranslationKey,
    tone: "neutral" as StatusTone,
    className: "line-through",
  },
  {
    labelKey: "status.fusionado" as UiTranslationKey,
    tone: "warning" as StatusTone,
  },
  {
    labelKey: "planning.legend.overlap" as UiTranslationKey,
    tone: "destructive" as StatusTone,
    className: "bg-background",
  },
]

export function PlanningLegend() {
  const { t } = useI18n()
  return (
    <div
      aria-label={t("planning.legend.aria_label")}
      className="flex flex-wrap items-center gap-1.5"
    >
      <span className="mr-0.5 text-xs font-semibold text-muted-foreground">
        <T i18nKey="planning.planning_legend.legend" />
      </span>
      {legendItems.map((item) => (
        <StatusBadge
          key={item.labelKey}
          tone={item.tone}
          className={item.className}
        >
          {t(item.labelKey)}
        </StatusBadge>
      ))}
    </div>
  )
}
