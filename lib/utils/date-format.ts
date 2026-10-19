import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/
const displayDatePattern = /^(\d{2})\/(\d{2})\/(\d{4})$/

export function formatDateDisplay(dateIso: string): string {
  if (!dateIso) {
    return "—"
  }

  const match = isoDatePattern.exec(dateIso)

  if (!match) {
    return dateIso
  }

  const [, year, month, day] = match
  const date = new Date(`${dateIso}T00:00:00.000Z`)

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) {
    return dateIso
  }

  return `${day}/${month}/${year}`
}

export function formatMonthYearDisplay(
  dateValue: string,
  locale = "en-US"
): string {
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(dateValue)

  if (!match) {
    return dateValue
  }

  const [, year, month] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1))

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month)
  ) {
    return dateValue
  }

  return date.toLocaleDateString(locale, {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  })
}

export function parseDateDisplayToIso(dateDisplay: string): string | null {
  if (!dateDisplay) {
    return null
  }

  const match = displayDatePattern.exec(dateDisplay.trim())

  if (!match) {
    return null
  }

  const [, day, month, year] = match
  const dateIso = `${year}-${month}-${day}`
  const date = new Date(`${dateIso}T00:00:00.000Z`)

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) {
    return null
  }

  return dateIso
}

export function isValidDateDisplay(dateDisplay: string): boolean {
  if (!dateDisplay) {
    return true
  }

  return parseDateDisplayToIso(dateDisplay) !== null
}

export function getDateDisplayValidationMessage(dateDisplay: string, t?: (key: UiTranslationKey) => string) {
  if (!dateDisplay) {
    return null
  }

  const trimmedValue = dateDisplay.trim()
  const match = displayDatePattern.exec(trimmedValue)

  if (!match) {
    return t?.("validation.date_format") ?? "Invalid date. Use dd/mm/yyyy."
  }

  const [, day, month, year] = match
  const parsedDay = Number(day)
  const parsedMonth = Number(month)
  const parsedYear = Number(year)
  const dateIso = `${year}-${month}-${day}`
  const date = new Date(`${dateIso}T00:00:00.000Z`)

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== parsedYear ||
    date.getUTCMonth() + 1 !== parsedMonth ||
    date.getUTCDate() !== parsedDay
  ) {
    return t?.("validation.date_calendar") ?? "Invalid date. This day does not exist for the selected month."
  }

  return null
}

export function dateIsoToDate(dateIso: string): Date | undefined {
  const match = isoDatePattern.exec(dateIso)

  if (!match) {
    return undefined
  }

  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))

  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() + 1 !== Number(month) ||
    date.getDate() !== Number(day)
  ) {
    return undefined
  }

  return date
}

export function dateToIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export function formatDateTimeDisplay(dateTimeIso?: string | null): string {
  if (!dateTimeIso) {
    return "—"
  }

  const date = new Date(dateTimeIso)

  if (Number.isNaN(date.getTime())) {
    return dateTimeIso
  }

  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")

  return `${day}/${month}/${year} ${hours}:${minutes}`
}
