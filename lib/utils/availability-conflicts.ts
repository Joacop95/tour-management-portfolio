import type { Guide, GuideAvailability, TourGroup } from "@/lib/types/domain"

export type AssignmentConflict = {
  group: TourGroup
  type: "overlap" | "boundary"
}

export type AvailabilityConflict = {
  record: GuideAvailability
  type: "not-available" | "occupied"
}

export type GuideAvailabilityResult = {
  status: "available" | "needs-review" | "blocked"
  conflicts: AvailabilityConflict[]
  availableRecords: GuideAvailability[]
  pendingRecords: GuideAvailability[]
}

export type EffectiveAvailabilityState =
  | "conflict"
  | "not-available"
  | "occupied-by-assignment"
  | "available"
  | "pending-review"
  | "not-provided"

export type EffectiveAvailabilitySummary = Record<
  EffectiveAvailabilityState,
  number
>

export type AssignableGuideStatus =
  | "available"
  | "needs-review"
  | "not-available"
  | "occupied"
  | "inactive"

export type AssignableGuideResult = {
  guide: Guide
  status: AssignableGuideStatus
  reason: string
  assignmentConflicts: AssignmentConflict[]
  availabilityResult: GuideAvailabilityResult
}

export function hasDateOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
) {
  return startA <= endB && endA >= startB
}

export function getEffectiveAvailabilityState(
  records: GuideAvailability[],
  dateIso: string
): EffectiveAvailabilityState {
  const active = records.filter(
    (record) =>
      record.startDateIso <= dateIso && record.endDateIso >= dateIso
  )
  const unavailable = active.some(
    (record) => record.status === "not-available"
  )
  const occupied = active.some(
    (record) => record.status === "occupied-by-assignment"
  )

  if (unavailable && occupied) return "conflict"
  if (unavailable) return "not-available"
  if (occupied) return "occupied-by-assignment"
  if (active.some((record) => record.status === "available")) return "available"
  if (active.some((record) => record.status === "pending-review")) return "pending-review"
  return "not-provided"
}

export function getEffectiveAvailabilitySummary(
  records: GuideAvailability[],
  year: number
): EffectiveAvailabilitySummary {
  const summary: EffectiveAvailabilitySummary = {
    conflict: 0,
    "not-available": 0,
    "occupied-by-assignment": 0,
    available: 0,
    "pending-review": 0,
    "not-provided": 0,
  }
  const cursor = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year, 11, 31))

  while (cursor <= end) {
    const dateIso = cursor.toISOString().slice(0, 10)
    summary[getEffectiveAvailabilityState(records, dateIso)] += 1
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return summary
}

function nextIsoDate(dateIso: string) {
  const date = new Date(`${dateIso}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function availableRecordsCoverRange(
  records: GuideAvailability[],
  startDateIso: string,
  endDateIso: string
) {
  const intervals = records
    .filter((record) => record.status === "available")
    .map((record) => ({
      start: record.startDateIso < startDateIso ? startDateIso : record.startDateIso,
      end: record.endDateIso > endDateIso ? endDateIso : record.endDateIso,
    }))
    .filter((interval) => interval.start <= interval.end)
    .sort((first, second) => first.start.localeCompare(second.start))

  let cursor = startDateIso
  for (const interval of intervals) {
    if (interval.start > cursor) return false
    if (interval.end >= endDateIso) return true
    const next = nextIsoDate(interval.end)
    if (next > cursor) cursor = next
  }
  return false
}

export function isTouchingBoundary(
  startA: string,
  endA: string,
  startB: string,
  endB: string
) {
  return (endA === startB && startA < startB) || (startA === endB && endA > endB)
}

export function overlapsYear(
  startDateIso: string,
  endDateIso: string,
  year: string
) {
  return hasDateOverlap(
    startDateIso,
    endDateIso,
    `${year}-01-01`,
    `${year}-12-31`
  )
}

export function getYearsWithAvailability(records: GuideAvailability[]) {
  return Array.from(
    new Set(
      records.flatMap((record) => [
        record.startDateIso.slice(0, 4),
        record.endDateIso.slice(0, 4),
      ])
    )
  ).sort()
}

export function getAvailabilityForGuideAndYear(
  guideId: string,
  year: string,
  records: GuideAvailability[]
) {
  return records
    .filter(
      (record) =>
        record.guideId === guideId &&
        overlapsYear(record.startDateIso, record.endDateIso, year)
    )
    .sort((a, b) => a.startDateIso.localeCompare(b.startDateIso))
}

export function getGuideAssignmentConflicts(
  guideId: string,
  startDateIso: string,
  endDateIso: string,
  groups: TourGroup[],
  options: { excludeGroupId?: string } = {}
) {
  return groups
    .filter((group) => {
      if (group.id === options.excludeGroupId) {
        return false
      }

      return (
        group.guideId === guideId &&
        group.groupStatus !== "cxl" &&
        hasDateOverlap(
          startDateIso,
          endDateIso,
          group.startDateIso,
          group.endDateIso
        )
      )
    })
    .map<AssignmentConflict>((group) => ({
      group,
      type: isTouchingBoundary(
        startDateIso,
        endDateIso,
        group.startDateIso,
        group.endDateIso
      )
        ? "boundary"
        : "overlap",
    }))
}

export function getGuideAvailabilityConflicts(
  guideId: string,
  startDateIso: string,
  endDateIso: string,
  availability: GuideAvailability[],
  options: { excludeAvailabilityId?: string } = {}
) {
  return availability
    .filter((record) => {
      if (record.id === options.excludeAvailabilityId) {
        return false
      }

      return (
        record.guideId === guideId &&
        (record.status === "not-available" ||
          record.status === "occupied-by-assignment") &&
        hasDateOverlap(
          startDateIso,
          endDateIso,
          record.startDateIso,
          record.endDateIso
        )
      )
    })
    .map<AvailabilityConflict>((record) => ({
      record,
      type: record.status === "not-available" ? "not-available" : "occupied",
    }))
}

export function getGuideAvailabilityResult(
  guideId: string,
  startDateIso: string,
  endDateIso: string,
  availability: GuideAvailability[],
  options: { excludeAvailabilityId?: string } = {}
): GuideAvailabilityResult {
  const guideRecords = availability.filter((record) => {
    if (record.id === options.excludeAvailabilityId) {
      return false
    }

    return (
      record.guideId === guideId &&
      hasDateOverlap(
        startDateIso,
        endDateIso,
        record.startDateIso,
        record.endDateIso
      )
    )
  })
  const conflicts = getGuideAvailabilityConflicts(
    guideId,
    startDateIso,
    endDateIso,
    availability,
    options
  )
  const availableRecords = guideRecords.filter(
    (record) => record.status === "available"
  )
  const pendingRecords = guideRecords.filter(
    (record) => record.status === "pending-review"
  )

  if (conflicts.length > 0) {
    return {
      status: "blocked",
      conflicts,
      availableRecords,
      pendingRecords,
    }
  }

  if (
    !availableRecordsCoverRange(
      availableRecords,
      startDateIso,
      endDateIso
    )
  ) {
    return {
      status: "needs-review",
      conflicts,
      availableRecords,
      pendingRecords,
    }
  }

  return {
    status: "available",
    conflicts,
    availableRecords,
    pendingRecords,
  }
}

export function getGuideAvailabilityStatusForRange(
  guideId: string,
  startDateIso: string,
  endDateIso: string,
  availability: GuideAvailability[],
  groups: TourGroup[],
  options: { excludeGroupId?: string; excludeAvailabilityId?: string } = {}
): AssignableGuideResult["status"] {
  const assignmentConflicts = getGuideAssignmentConflicts(
    guideId,
    startDateIso,
    endDateIso,
    groups,
    { excludeGroupId: options.excludeGroupId }
  ).filter((conflict) => conflict.type === "overlap")

  if (assignmentConflicts.length > 0) {
    return "occupied"
  }

  const availabilityResult = getGuideAvailabilityResult(
    guideId,
    startDateIso,
    endDateIso,
    availability,
    { excludeAvailabilityId: options.excludeAvailabilityId }
  )

  if (availabilityResult.status === "blocked") {
    const firstConflict = availabilityResult.conflicts[0]
    return firstConflict.type === "occupied" ? "occupied" : "not-available"
  }

  return availabilityResult.status
}

export function getAssignableGuidesForDates(
  guides: Guide[],
  groups: TourGroup[],
  availability: GuideAvailability[],
  startDateIso: string,
  endDateIso: string,
  options: { excludeGroupId?: string; showUnavailable?: boolean } = {}
) {
  if (!startDateIso || !endDateIso || endDateIso < startDateIso) {
    return guides
      .filter((guide) => guide.status !== "inactive" && guide.status !== "blocked")
      .map<AssignableGuideResult>((guide) => ({
        guide,
        status: "available",
        reason: "Select group dates to filter guides by availability.",
        assignmentConflicts: [],
        availabilityResult: {
          status: "available",
          conflicts: [],
          availableRecords: [],
          pendingRecords: [],
        },
      }))
  }

  return guides
    .map<AssignableGuideResult>((guide) => {
      const assignmentConflicts = getGuideAssignmentConflicts(
        guide.id,
        startDateIso,
        endDateIso,
        groups,
        { excludeGroupId: options.excludeGroupId }
      )
      const hardAssignmentConflict = assignmentConflicts.find(
        (conflict) => conflict.type === "overlap"
      )
      const availabilityResult = getGuideAvailabilityResult(
        guide.id,
        startDateIso,
        endDateIso,
        availability
      )

      if (guide.status === "inactive" || guide.status === "blocked") {
        return {
          guide,
          status: "inactive",
          reason: guide.status === "blocked" ? "Blocked guide" : "Inactive guide",
          assignmentConflicts,
          availabilityResult,
        }
      }

      if (hardAssignmentConflict) {
        return {
          guide,
          status: "occupied",
          reason: `Occupied by group ${hardAssignmentConflict.group.code}: ${hardAssignmentConflict.group.startDateIso} - ${hardAssignmentConflict.group.endDateIso}`,
          assignmentConflicts,
          availabilityResult,
        }
      }

      if (availabilityResult.status === "blocked") {
        const conflict = availabilityResult.conflicts[0]
        return {
          guide,
          status: conflict.type === "occupied" ? "occupied" : "not-available",
          reason:
            conflict.type === "occupied"
              ? `Occupied: ${conflict.record.startDateIso} - ${conflict.record.endDateIso}`
              : `Not available: ${conflict.record.startDateIso} - ${conflict.record.endDateIso}`,
          assignmentConflicts,
          availabilityResult,
        }
      }

      if (availabilityResult.status === "needs-review") {
        return {
          guide,
          status: "needs-review",
          reason: "Needs review",
          assignmentConflicts,
          availabilityResult,
        }
      }

      return {
        guide,
        status: "available",
        reason: "Available",
        assignmentConflicts,
        availabilityResult,
      }
    })
    .filter((result) => {
      if (result.status === "available" || result.status === "needs-review") {
        return (
          result.guide.status !== "inactive" && result.guide.status !== "blocked"
        )
      }

      return Boolean(options.showUnavailable)
    })
}
