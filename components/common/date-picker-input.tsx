"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { useEffect, useRef, useState } from "react"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  dateIsoToDate,
  dateToIso,
  formatDateDisplay,
  getDateDisplayValidationMessage,
  isValidDateDisplay,
  parseDateDisplayToIso,
} from "@/lib/utils/date-format"

type DatePickerInputProps = {
  id?: string
  value: string
  onChange: (dateIso: string) => void
  minDateIso?: string
  maxDateIso?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  hideCalendarButton?: boolean
  onOpenPicker?: () => void
  onValidationChange?: (state: {
    hasValue: boolean
    isValid: boolean
    message: string | null
  }) => void
  "aria-invalid"?: boolean
}

const defaultMinDateIso = "2026-01-01"
const defaultMaxDateIso = "2040-12-31"
const defaultMinDate = new Date(2026, 0, 1)
const defaultMaxDate = new Date(2040, 11, 31)

export function DatePickerInput({
  id,
  value,
  onChange,
  minDateIso = defaultMinDateIso,
  maxDateIso = defaultMaxDateIso,
  placeholder = "dd/mm/yyyy",
  disabled,
  className,
  hideCalendarButton = false,
  onOpenPicker,
  onValidationChange,
  "aria-invalid": ariaInvalid,
}: DatePickerInputProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [displayValue, setDisplayValue] = useState(
    value ? formatDateDisplay(value) : ""
  )
  const skipNextValueSync = useRef(false)
  const selectedDate = dateIsoToDate(value)
  const effectiveMinDateIso = dateIsoToDate(minDateIso)
    ? minDateIso
    : defaultMinDateIso
  const effectiveMaxDateIso = dateIsoToDate(maxDateIso)
    ? maxDateIso
    : defaultMaxDateIso
  const minDate = dateIsoToDate(effectiveMinDateIso) ?? defaultMinDate
  const maxDate = dateIsoToDate(effectiveMaxDateIso) ?? defaultMaxDate
  const minDateLabel = formatDateDisplay(effectiveMinDateIso)
  const maxDateLabel = formatDateDisplay(effectiveMaxDateIso)
  const parsedDisplayIso = parseDateDisplayToIso(displayValue)
  const hasInvalidDisplay =
    displayValue.length > 0 && !isValidDateDisplay(displayValue)
  const invalidDisplayMessage = getDateDisplayValidationMessage(displayValue, t)
  const hasOutOfRangeDisplay =
    parsedDisplayIso !== null &&
    (parsedDisplayIso < effectiveMinDateIso ||
      parsedDisplayIso > effectiveMaxDateIso)

  useEffect(() => {
    if (skipNextValueSync.current) {
      skipNextValueSync.current = false
      return
    }

    setDisplayValue(value ? formatDateDisplay(value) : "")
  }, [value])

  function handleInputChange(nextDisplayValue: string) {
    setDisplayValue(nextDisplayValue)
    const nextInvalidDisplayMessage =
      getDateDisplayValidationMessage(nextDisplayValue, t)

    if (!nextDisplayValue) {
      onValidationChange?.({
        hasValue: false,
        isValid: true,
        message: null,
      })
      onChange("")
      return
    }

    const nextDateIso = parseDateDisplayToIso(nextDisplayValue)

    if (
      nextDateIso &&
      nextDateIso >= effectiveMinDateIso &&
      nextDateIso <= effectiveMaxDateIso
    ) {
      onValidationChange?.({
        hasValue: true,
        isValid: true,
        message: null,
      })
      onChange(nextDateIso)
      return
    }

    skipNextValueSync.current = true
    onValidationChange?.({
      hasValue: true,
      isValid: false,
      message:
        nextInvalidDisplayMessage ??
        `Date must be between ${minDateLabel} and ${maxDateLabel}.`,
    })
    onChange("")
  }

  function handleCalendarSelect(date: Date | undefined) {
    if (!date) {
      return
    }

    const nextDateIso = dateToIso(date)

    if (
      nextDateIso < effectiveMinDateIso ||
      nextDateIso > effectiveMaxDateIso
    ) {
      return
    }

    onChange(nextDateIso)
    onValidationChange?.({
      hasValue: true,
      isValid: true,
      message: null,
    })
    setDisplayValue(formatDateDisplay(nextDateIso))
    setOpen(false)
  }

  return (
    <div className={cn("grid gap-1", className)}>
      <div className="flex">
        <Input
          id={id}
          value={displayValue}
          placeholder={placeholder}
          inputMode="numeric"
          disabled={disabled}
          aria-invalid={ariaInvalid || hasInvalidDisplay || hasOutOfRangeDisplay}
          onFocus={onOpenPicker}
          onChange={(event) => handleInputChange(event.target.value)}
          className={hideCalendarButton ? undefined : "rounded-r-none"}
        />
        {!hideCalendarButton ? <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled}
              aria-label={t("common.date_picker_input.aria_label_open_date_picker")}
              className="rounded-l-none border-l-0"
            >
              <CalendarIcon className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleCalendarSelect}
              captionLayout="dropdown"
              startMonth={minDate}
              endMonth={maxDate}
              disabled={[
                { before: minDate },
                { after: maxDate },
              ]}
            />
          </PopoverContent>
        </Popover> : null}
      </div>
      {hasInvalidDisplay ? (
        <p className="text-xs text-red-700">
          {invalidDisplayMessage ?? "Invalid date. Use dd/mm/yyyy."}
        </p>
      ) : hasOutOfRangeDisplay ? (
        <p className="text-xs text-red-700">
          <T i18nKey="common.date_picker_input.date_must_be_between" /> {minDateLabel} <T i18nKey="common.date_picker_input.and" /> {maxDateLabel}.
        </p>
      ) : null}
    </div>
  )
}
