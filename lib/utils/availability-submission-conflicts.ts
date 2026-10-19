import type { GuideAvailability, TourGroup } from "@/lib/types/domain"

export type AvailabilitySubmissionConflict = {
  availabilityId: string
  availabilityStartDateIso: string
  availabilityEndDateIso: string
  groupId: string
  groupCode: string
  circuitId: string
  assignmentStartDateIso: string
  assignmentEndDateIso: string
}

export function getAvailabilitySubmissionConflicts(
  guideId: string,
  year: number,
  availability: GuideAvailability[],
  groups: TourGroup[]
): AvailabilitySubmissionConflict[] {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  const unavailablePeriods = availability.filter(
    (record) =>
      record.guideId === guideId &&
      record.source === "guide-submitted" &&
      record.status === "not-available" &&
      record.startDateIso <= yearEnd &&
      record.endDateIso >= yearStart
  )
  const activeAssignedGroups = groups.filter(
    (group) =>
      group.guideId === guideId &&
      group.assignmentStatus === "assigned" &&
      group.groupStatus === "active" &&
      group.startDateIso <= yearEnd &&
      group.endDateIso >= yearStart
  )

  return unavailablePeriods.flatMap((record) =>
    activeAssignedGroups
      .filter(
        (group) =>
          record.startDateIso <= group.endDateIso &&
          record.endDateIso >= group.startDateIso
      )
      .map((group) => ({
        availabilityId: record.id,
        availabilityStartDateIso: record.startDateIso,
        availabilityEndDateIso: record.endDateIso,
        groupId: group.id,
        groupCode: group.code,
        circuitId: group.circuitId,
        assignmentStartDateIso: group.startDateIso,
        assignmentEndDateIso: group.endDateIso,
      }))
  )
}
