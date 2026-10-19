import type { Guide, GuideAvailability, TourGroup } from "@/lib/types/domain"
import {
  getGuideAssignmentConflicts,
  getGuideAvailabilityResult,
} from "@/lib/utils/availability-conflicts"
import { formatDateDisplay } from "@/lib/utils/date-format"
import { normalizeSpokenLanguages } from "@/lib/utils/language-options"

export type CandidateAvailabilityResult =
  | "available"
  | "needs-review"
  | "not-available"
  | "occupied"

export type CandidateConflictResult = "clear" | "conflict"

export type CandidateCircuitResult = "match" | "not-listed"
export type CandidateLanguageResult =
  | "match"
  | "not-listed"
  | "not-required"
  | "unknown"

export type CandidateGuide = {
  guide: Guide
  circuitResult: CandidateCircuitResult
  languageResult: CandidateLanguageResult
  availabilityResult: CandidateAvailabilityResult
  conflictResult: CandidateConflictResult
  notes: string
  isPrimaryCandidate: boolean
  canAssign: boolean
  blockingReason: string | null
  warningReason: string | null
}

export function buildCandidateGuides({
  selectedGroup,
  guides,
  groups,
  availability,
}: {
  selectedGroup: TourGroup
  guides: Guide[]
  groups: TourGroup[]
  availability: GuideAvailability[]
}) {
  return guides
    .map<CandidateGuide>((guide) => {
      const assignmentConflicts = getGuideAssignmentConflicts(
        guide.id,
        selectedGroup.startDateIso,
        selectedGroup.endDateIso,
        groups,
        { excludeGroupId: selectedGroup.id }
      )
      const hardAssignmentConflict = assignmentConflicts.find(
        (conflict) => conflict.type === "overlap"
      )
      const boundaryConflict = assignmentConflicts.find(
        (conflict) => conflict.type === "boundary"
      )
      const availabilityStatus = getGuideAvailabilityResult(
        guide.id,
        selectedGroup.startDateIso,
        selectedGroup.endDateIso,
        availability
      )
      const circuitResult = guide.circuitIds.includes(selectedGroup.circuitId)
        ? "match"
        : "not-listed"
      const groupLanguage =
        selectedGroup.requiredLanguage?.trim().toUpperCase() ??
        selectedGroup.language?.trim().toUpperCase() ??
        ""
      const guideSpokenLanguages = normalizeSpokenLanguages(
        guide.languages,
        guide.preferredLanguage
      )
      const languageResult = !groupLanguage
        ? "not-required"
        : guideSpokenLanguages.length === 0
          ? "unknown"
          : guideSpokenLanguages.includes(groupLanguage)
            ? "match"
            : "not-listed"
      const availabilityBlock = availabilityStatus.conflicts[0]
      const availabilityResult = hardAssignmentConflict
        ? "occupied"
        : availabilityStatus.status === "blocked"
          ? availabilityBlock?.type === "occupied"
            ? "occupied"
            : "not-available"
          : availabilityStatus.status === "available"
            ? "available"
            : "needs-review"
      const conflictResult =
        hardAssignmentConflict || availabilityStatus.status === "blocked"
          ? "conflict"
          : "clear"
      const isInactive =
        guide.status === "inactive" ||
        guide.status === "blocked" ||
        guide.status === "pending-invitation"
      const blockingReason = hardAssignmentConflict
        ? `Occupied by group ${hardAssignmentConflict.group.code}: ${formatDateDisplay(
            hardAssignmentConflict.group.startDateIso
          )} - ${formatDateDisplay(hardAssignmentConflict.group.endDateIso)}`
        : availabilityStatus.status === "blocked" && availabilityBlock
          ? availabilityBlock.type === "occupied"
            ? `Occupied: ${formatDateDisplay(
                availabilityBlock.record.startDateIso
              )} - ${formatDateDisplay(availabilityBlock.record.endDateIso)}`
            : `Not available: ${formatDateDisplay(
                availabilityBlock.record.startDateIso
              )} - ${formatDateDisplay(availabilityBlock.record.endDateIso)}`
          : isInactive
            ? "Guide is not active."
            : languageResult === "not-listed"
              ? `Guide does not list ${groupLanguage} as a spoken language.`
              : null
      const warningReason = boundaryConflict
        ? `This guide finishes another tour on the same day: ${boundaryConflict.group.code}. Please reconfirm.`
        : availabilityResult === "needs-review"
          ? "No availability loaded for this guide and date range. Assignment should be reviewed."
          : circuitResult === "not-listed"
            ? "Circuit is not listed in guide capabilities."
            : languageResult === "unknown"
              ? "Languages not configured. Confirm language compatibility before assignment."
              : null
      const notes = [
        guide.status !== "active"
          ? "Not a primary candidate: guide is not active."
          : null,
        circuitResult === "not-listed"
          ? "Selected circuit is not listed in guide capabilities."
          : null,
        languageResult === "not-listed"
          ? `Guide does not list ${groupLanguage} as a spoken language.`
          : null,
        languageResult === "unknown"
          ? "Languages are not configured. Confirm compatibility before assignment."
          : null,
        hardAssignmentConflict
          ? `Overlaps assigned group ${hardAssignmentConflict.group.code}.`
          : null,
        availabilityStatus.status === "blocked" ? blockingReason : null,
        boundaryConflict ? warningReason : null,
        availabilityResult === "needs-review"
          ? "No explicit availability record overlaps this group."
          : null,
        availabilityResult === "available" && circuitResult === "match"
          ? "Guide has overlapping availability and no assignment conflict."
          : null,
      ]
        .filter(Boolean)
        .join(" ")

      return {
        guide,
        circuitResult,
        languageResult,
        availabilityResult,
        conflictResult,
        notes,
        isPrimaryCandidate: guide.status === "active",
        canAssign: !blockingReason,
        blockingReason,
        warningReason,
      }
    })
    .sort((firstCandidate, secondCandidate) => {
      const score = (candidate: CandidateGuide) => {
        let value = 0

        if (candidate.guide.status === "active") value += 100
        if (candidate.circuitResult === "match") value += 30
        if (candidate.languageResult === "match") value += 25
        if (candidate.availabilityResult === "available") value += 20
        if (candidate.availabilityResult === "needs-review") value += 5
        if (candidate.circuitResult === "not-listed") value -= 10
        if (candidate.languageResult === "not-listed") value -= 40
        if (candidate.conflictResult === "conflict") value -= 40
        if (candidate.availabilityResult === "not-available") value -= 30
        if (!candidate.canAssign) value -= 100

        return value
      }

      return score(secondCandidate) - score(firstCandidate)
    })
}
