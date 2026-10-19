"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { CalendarDays, ChevronLeft, ChevronRight, Rows3 } from "lucide-react"

import { DatePickerInput } from "@/components/common/date-picker-input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Circuit } from "@/lib/types/domain"

type PlanningZoom = "compact" | "comfortable" | "detailed"
const planningRangeOptions = [30, 45, 60, 90, 120, 150] as const

export type PlanningRangeDays = (typeof planningRangeOptions)[number]

type PlanningControlsProps = {
  circuits: Circuit[]
  circuitId: string
  monthOptions: Array<{ value: string; label: string }>
  onlyWithoutGuide: boolean
  rangeDays: PlanningRangeDays
  showCancelledMerged: boolean
  startDateIso: string
  zoom: PlanningZoom
  onCircuitChange: (circuitId: string) => void
  onMonthChange: (month: string) => void
  onOnlyWithoutGuideChange: (checked: boolean) => void
  onRangeDaysChange: (rangeDays: PlanningRangeDays) => void
  onShowCancelledMergedChange: (checked: boolean) => void
  onShiftRange: (direction: "previous" | "next") => void
  onStartDateChange: (dateIso: string) => void
  onTodayClick: () => void
  onZoomChange: (zoom: PlanningZoom) => void
}

function isPlanningZoom(value: string): value is PlanningZoom {
  return value === "compact" || value === "comfortable" || value === "detailed"
}

function isPlanningRangeDays(value: string): value is `${PlanningRangeDays}` {
  return planningRangeOptions.some((rangeDays) => String(rangeDays) === value)
}

export function PlanningControls({
  circuits,
  circuitId,
  monthOptions,
  onlyWithoutGuide,
  rangeDays,
  showCancelledMerged,
  startDateIso,
  zoom,
  onCircuitChange,
  onMonthChange,
  onOnlyWithoutGuideChange,
  onRangeDaysChange,
  onShowCancelledMergedChange,
  onShiftRange,
  onStartDateChange,
  onTodayClick,
  onZoomChange,
}: PlanningControlsProps) {
  const { t } = useI18n()
  const monthValue = startDateIso.slice(0, 7)

  return (
    <div
      aria-label={t("planning.planning_controls.aria_label_planning_controls")}
      className="flex min-w-0 flex-1 flex-wrap items-end gap-2"
    >
      <div className="grid w-40 gap-1">
        <Label htmlFor="planning-start-date" className="text-xs">
          <T i18nKey="common.start_date" />
        </Label>
        <DatePickerInput
          id="planning-start-date"
          value={startDateIso}
          onChange={(dateIso) => {
            if (dateIso) {
              onStartDateChange(dateIso)
            }
          }}
          minDateIso="2026-01-01"
          maxDateIso="2040-12-31"
        />
      </div>

      <div className="flex items-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("planning.planning_controls.aria_label_previous_planning_period")}
          onClick={() => onShiftRange("previous")}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button type="button" variant="outline" onClick={onTodayClick}>
          <T i18nKey="common.today" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("planning.planning_controls.aria_label_next_planning_period")}
          onClick={() => onShiftRange("next")}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <Select value={monthValue} onValueChange={onMonthChange}>
        <SelectTrigger aria-label={t("planning.planning_controls.aria_label_jump_to_month")} className="w-40">
          <CalendarDays className="size-4 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {monthOptions.map((month) => (
            <SelectItem key={month.value} value={month.value}>
              {month.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(rangeDays)}
        onValueChange={(value) => {
          if (isPlanningRangeDays(value)) {
            onRangeDaysChange(Number(value) as PlanningRangeDays)
          }
        }}
      >
        <SelectTrigger aria-label={t("planning.planning_controls.aria_label_visible_range")} className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {planningRangeOptions.map((rangeDaysOption) => (
            <SelectItem
              key={rangeDaysOption}
              value={String(rangeDaysOption)}
            >
              {rangeDaysOption} <T i18nKey="planning.planning_controls.days" />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={circuitId} onValueChange={onCircuitChange}>
        <SelectTrigger aria-label={t("planning.planning_controls.aria_label_circuit_filter")} className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all-circuits"><T i18nKey="planning.planning_controls.all_circuits" /></SelectItem>
          {circuits.map((circuit) => (
            <SelectItem key={circuit.id} value={circuit.id}>
              {circuit.code} · {circuit.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={zoom}
        onValueChange={(value) => {
          if (isPlanningZoom(value)) {
            onZoomChange(value)
          }
        }}
      >
        <SelectTrigger aria-label={t("planning.planning_controls.aria_label_timeline_density")} className="w-40">
          <Rows3 className="size-4 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="compact"><T i18nKey="planning.planning_controls.compact_zoom" /></SelectItem>
          <SelectItem value="comfortable"><T i18nKey="planning.planning_controls.comfortable_zoom" /></SelectItem>
          <SelectItem value="detailed"><T i18nKey="planning.planning_controls.detailed_zoom" /></SelectItem>
        </SelectContent>
      </Select>

      <div className="flex h-9 items-center gap-2 rounded-md border border-border/70 bg-background px-2.5">
        <Checkbox
          id="planning-without-guide"
          checked={onlyWithoutGuide}
          onCheckedChange={(checked) =>
            onOnlyWithoutGuideChange(checked === true)
          }
        />
        <Label htmlFor="planning-without-guide" className="text-sm">
          <T i18nKey="status.without_guide" />
        </Label>
      </div>

      <div className="flex h-9 items-center gap-2 rounded-md border border-border/70 bg-background px-2.5">
        <Checkbox
          id="planning-show-cancelled"
          checked={showCancelledMerged}
          onCheckedChange={(checked) =>
            onShowCancelledMergedChange(checked === true)
          }
        />
        <Label htmlFor="planning-show-cancelled" className="text-sm">
          <T i18nKey="planning.planning_controls.show_cxl_fusionado" />
        </Label>
      </div>
    </div>
  )
}
