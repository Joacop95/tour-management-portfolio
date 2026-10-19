"use client"

import { T } from "@/components/i18n/i18n-provider"
import { useEffect, useState } from "react"
import type { DateRange } from "react-day-picker"

import { DatePickerInput } from "@/components/common/date-picker-input"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { dateIsoToDate, dateToIso } from "@/lib/utils/date-format"

type DateRangePickerInputProps = {
  startId: string
  endId: string
  startDateIso: string
  endDateIso: string
  minDateIso: string
  maxDateIso: string
  disabled?: boolean
  onChange: (startDateIso: string, endDateIso: string) => void
}

export function DateRangePickerInput({
  startId,
  endId,
  startDateIso,
  endDateIso,
  minDateIso,
  maxDateIso,
  disabled,
  onChange,
}: DateRangePickerInputProps) {
  const [open, setOpen] = useState(false)
  const [numberOfMonths, setNumberOfMonths] = useState(1)
  const [draftRange, setDraftRange] = useState<DateRange | undefined>()
  const minDate = dateIsoToDate(minDateIso)
  const maxDate = dateIsoToDate(maxDateIso)

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)")
    const update = () => setNumberOfMonths(media.matches ? 2 : 1)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  function openPicker() {
    if (disabled) return
    setDraftRange({
      from: dateIsoToDate(startDateIso),
      to: dateIsoToDate(endDateIso),
    })
    setOpen(true)
  }

  function confirmRange() {
    if (!draftRange?.from || !draftRange.to) return
    onChange(dateToIso(draftRange.from), dateToIso(draftRange.to))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <DatePickerInput
            id={startId}
            value={startDateIso}
            minDateIso={minDateIso}
            maxDateIso={maxDateIso}
            disabled={disabled}
            hideCalendarButton
            onOpenPicker={openPicker}
            onChange={(value) => onChange(value, endDateIso)}
          />
          <span className="hidden pb-2 text-sm text-muted-foreground sm:block"><T i18nKey="common.date_range_picker_input.to" /></span>
          <DatePickerInput
            id={endId}
            value={endDateIso}
            minDateIso={minDateIso}
            maxDateIso={maxDateIso}
            disabled={disabled}
            hideCalendarButton
            onOpenPicker={openPicker}
            onChange={(value) => onChange(startDateIso, value)}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-2">
        <Calendar
          mode="range"
          showOutsideDays={false}
          selected={draftRange}
          onSelect={setDraftRange}
          numberOfMonths={numberOfMonths}
          defaultMonth={draftRange?.from ?? minDate}
          startMonth={minDate}
          endMonth={maxDate}
          disabled={[
            ...(minDate ? [{ before: minDate }] : []),
            ...(maxDate ? [{ after: maxDate }] : []),
          ]}
        />
        <div className="flex items-center justify-between gap-2 border-t pt-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraftRange(undefined)
              onChange("", "")
              setOpen(false)
            }}
          >
            <T i18nKey="common.clear" />
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!draftRange?.from || !draftRange.to}
            onClick={confirmRange}
          >
            <T i18nKey="common.confirm" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
