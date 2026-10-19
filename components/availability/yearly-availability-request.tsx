"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, MailCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Guide, GuideAvailability } from "@/lib/types/domain"
import {
  localStorageKeys,
  readLocalStorageValue,
  writeLocalStorageValue,
} from "@/lib/utils/local-storage"

type YearlyAvailabilityRequestProps = {
  guides: Guide[]
  availability: GuideAvailability[]
}

const yearOptions = Array.from({ length: 2040 - 2026 + 1 }, (_, index) =>
  String(2026 + index)
)

function recordOverlapsYear(record: GuideAvailability, year: string) {
  return record.startDateIso <= `${year}-12-31` && record.endDateIso >= `${year}-01-01`
}

export function YearlyAvailabilityRequest({
  guides,
  availability,
}: YearlyAvailabilityRequestProps) {
  const { t } = useI18n()
  const [year, setYear] = useState("2027")
  const [targetGuides, setTargetGuides] = useState<
    "active" | "missing-availability"
  >("active")
  const [requestSent, setRequestSent] = useState(false)
  const [isExpanded, setIsExpanded] = useState(() =>
    readLocalStorageValue<boolean>(
      localStorageKeys.availabilityRequestExpanded,
      false
    )
  )
  const activeGuides = useMemo(
    () => guides.filter((guide) => guide.status === "active"),
    [guides]
  )
  const guidesWithYearAvailability = useMemo(
    () =>
      new Set(
        availability
          .filter((record) => recordOverlapsYear(record, year))
          .map((record) => record.guideId)
      ),
    [availability, year]
  )
  const alreadySubmitted = activeGuides.filter((guide) =>
    guidesWithYearAvailability.has(guide.id)
  ).length
  const missingAvailability = activeGuides.length - alreadySubmitted
  const targetCount =
    targetGuides === "missing-availability"
      ? missingAvailability
      : activeGuides.length

  function handleSendRequest() {
    setRequestSent(true)
  }

  function handleExpandedChange() {
    const nextExpanded = !isExpanded

    setIsExpanded(nextExpanded)
    writeLocalStorageValue(
      localStorageKeys.availabilityRequestExpanded,
      nextExpanded
    )
  }

  return (
    <Card size="sm" className="gap-2">
      <CardHeader className="border-b pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MailCheck className="size-4" />
            <T i18nKey="availability.yearly_availability_request.request_yearly_availability" />
          </CardTitle>
          <CardDescription className="text-xs">
            <T i18nKey="availability.yearly_availability_request.request_preview_only_real_email_delivery_is_not" />
          </CardDescription>
        </div>
        <CardAction className="flex items-center gap-1">
          <Button type="button" size="sm" onClick={handleSendRequest}>
            <T i18nKey="availability.yearly_availability_request.send_request" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? t("availability.yearly.collapse")
                : t("availability.yearly.expand")
            }
            onClick={handleExpandedChange}
          >
            {isExpanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <div className="rounded-lg border px-2.5 py-2">
            <p className="text-[11px] text-muted-foreground"><T i18nKey="availability.yearly_availability_request.selected_year" /></p>
            <p className="font-semibold">{year}</p>
          </div>
          <div className="rounded-lg border px-2.5 py-2">
            <p className="text-[11px] text-muted-foreground"><T i18nKey="availability.yearly_availability_request.target_guides" /></p>
            <p className="truncate font-semibold">
              {targetCount} ·{" "}
              {targetGuides === "missing-availability"
                ? t("availability.yearly.missing_only")
                : t("availability.yearly.all_active")}
            </p>
          </div>
          <div className="rounded-lg border px-2.5 py-2">
            <p className="text-[11px] text-muted-foreground">
              <T i18nKey="availability.yearly_availability_request.already_submitted" />
            </p>
            <p className="font-semibold">{alreadySubmitted}</p>
          </div>
          <div className="rounded-lg border px-2.5 py-2">
            <p className="text-[11px] text-muted-foreground">
              <T i18nKey="availability.yearly_availability_request.missing_availability" />
            </p>
            <p className="font-semibold">{missingAvailability}</p>
          </div>
          <div className="rounded-lg border px-2.5 py-2">
            <p className="text-[11px] text-muted-foreground"><T i18nKey="availability.yearly_availability_request.request_sent" /></p>
            <p className="font-semibold">
              {requestSent ? targetCount : 0}
            </p>
          </div>
        </div>

        {isExpanded ? (
          <>
            <div className="grid gap-2 md:grid-cols-[140px_minmax(240px,1fr)]">
              <div className="grid gap-1">
                <Label className="text-xs"><T i18nKey="common.year" /></Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1">
                <Label className="text-xs"><T i18nKey="availability.yearly_availability_request.target_guides" /></Label>
                <Select
                  value={targetGuides}
                  onValueChange={(value) => {
                    setTargetGuides(value as typeof targetGuides)
                    setRequestSent(false)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active"><T i18nKey="availability.yearly_availability_request.all_active_guides" /></SelectItem>
                    <SelectItem value="missing-availability">
                      <T i18nKey="availability.yearly_availability_request.guides_without_availability_for_selected_year" />
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {activeGuides.length} <T i18nKey="availability.yearly_availability_request.active_guides_future_guide_self_service_edits_should" />
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
