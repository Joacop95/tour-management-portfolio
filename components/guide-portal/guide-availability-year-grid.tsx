"use client"

import type { GuideAvailability } from "@/lib/types/domain"
import {
  getEffectiveAvailabilityState,
  type EffectiveAvailabilityState,
} from "@/lib/utils/availability-conflicts"
import { cn } from "@/lib/utils"

type GuideAvailabilityYearGridProps = {
  year: number
  records: GuideAvailability[]
  selectionStart?: string | null
  selectionEnd?: string | null
  onSelectDate?: (dateIso: string, records: GuideAvailability[]) => void
}

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"]

const stateStyles: Record<EffectiveAvailabilityState, string> = {
  conflict: "border-rose-500 bg-blue-100 text-blue-950 ring-1 ring-rose-400",
  available: "border-emerald-200 bg-emerald-100 text-emerald-900",
  "not-available": "border-rose-200 bg-rose-100 text-rose-900",
  "occupied-by-assignment": "border-blue-300 bg-blue-100 text-blue-900",
  "pending-review": "border-amber-200 bg-amber-100 text-amber-900",
  "not-provided": "border-transparent bg-muted/35 text-muted-foreground",
}

function dateIso(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function recordsForDate(records: GuideAvailability[], date: string) {
  return records.filter(
    (record) => record.startDateIso <= date && record.endDateIso >= date
  )
}

export function GuideAvailabilityYearGrid({
  year,
  records,
  selectionStart,
  selectionEnd,
  onSelectDate,
}: GuideAvailabilityYearGridProps) {
  const normalizedSelection =
    selectionStart && selectionEnd
      ? [selectionStart, selectionEnd].sort()
      : selectionStart
        ? [selectionStart, selectionStart]
        : null

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {monthNames.map((monthName, month) => {
        const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
        const firstWeekday =
          (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7

        return (
          <section key={monthName} className="rounded-lg border bg-card p-2.5">
            <h3 className="mb-2 text-sm font-semibold">{monthName}</h3>
            <div className="grid grid-cols-7 gap-1 text-center">
              {weekdayLabels.map((label, index) => (
                <div
                  key={`${monthName}-${label}-${index}`}
                  className="pb-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {label}
                </div>
              ))}
              {Array.from({ length: firstWeekday }).map((_, index) => (
                <div key={`blank-${index}`} aria-hidden="true" />
              ))}
              {Array.from({ length: daysInMonth }, (_, index) => index + 1).map(
                (day) => {
                  const iso = dateIso(year, month, day)
                  const dayRecords = recordsForDate(records, iso)
                  const state = getEffectiveAvailabilityState(dayRecords, iso)
                  const hasAvailabilityConflict = state === "conflict"
                  const selected = Boolean(
                    normalizedSelection &&
                      iso >= normalizedSelection[0] &&
                      iso <= normalizedSelection[1]
                  )

                  return (
                    <button
                      key={iso}
                      type="button"
                      aria-label={`${monthName} ${day}, ${year}: ${state.replaceAll("-", " ")}${hasAvailabilityConflict ? ", availability conflict" : ""}`}
                      aria-pressed={selected}
                      title={`${iso} · ${state.replaceAll("-", " ")}${hasAvailabilityConflict ? " · availability conflict" : ""}`}
                      className={cn(
                        "relative flex aspect-square min-h-8 items-center justify-center rounded-md border text-xs transition hover:ring-2 hover:ring-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        !onSelectDate && "cursor-default hover:ring-0",
                        stateStyles[state],
                        hasAvailabilityConflict &&
                          "border-rose-500 ring-1 ring-rose-400",
                        selected && "ring-2 ring-primary ring-offset-1"
                      )}
                      onClick={() => onSelectDate?.(iso, dayRecords)}
                    >
                      {day}
                      {hasAvailabilityConflict ? (
                        <span
                          aria-hidden="true"
                          className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold text-white"
                        >
                          !
                        </span>
                      ) : null}
                    </button>
                  )
                }
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
