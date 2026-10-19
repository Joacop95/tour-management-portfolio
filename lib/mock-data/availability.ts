import { tourGroups } from "@/lib/mock-data/groups"
import type { GuideAvailability } from "@/lib/types/domain"

const manualAvailability: GuideAvailability[] = [
  {
    id: "avail-camille-available-june",
    guideId: "camille-laurent",
    startDate: "Jun 01, 2026",
    endDate: "Jun 30, 2026",
    startDateIso: "2026-06-01",
    endDateIso: "2026-06-30",
    status: "available",
    source: "guide-submitted",
    notes: "Available for France and Spain circuits except assigned dates.",
  },
  {
    id: "avail-emre-unavailable",
    guideId: "emre-yilmaz",
    startDate: "Jun 15, 2026",
    endDate: "Jun 18, 2026",
    startDateIso: "2026-06-15",
    endDateIso: "2026-06-18",
    status: "not-available",
    source: "admin-updated",
    notes: "Personal leave confirmed by operations.",
  },
  {
    id: "avail-luc-pending",
    guideId: "luc-moreau",
    startDate: "Jun 20, 2026",
    endDate: "Jun 27, 2026",
    startDateIso: "2026-06-20",
    endDateIso: "2026-06-27",
    status: "pending-review",
    source: "guide-submitted",
    notes: "Guide submitted partial availability; admin review needed.",
  },
  {
    id: "avail-sofia-available",
    guideId: "sofia-martin",
    startDate: "Jun 10, 2026",
    endDate: "Jun 24, 2026",
    startDateIso: "2026-06-10",
    endDateIso: "2026-06-24",
    status: "available",
    source: "guide-submitted",
    notes: "Available for Barcelona and Andalusia circuits.",
  },
  {
    id: "avail-marco-pending",
    guideId: "marco-rossi",
    startDate: "Jun 05, 2026",
    endDate: "Jun 16, 2026",
    startDateIso: "2026-06-05",
    endDateIso: "2026-06-16",
    status: "pending-review",
    source: "guide-submitted",
    notes: "New guide availability requires validation.",
  },
  {
    id: "avail-nora-unavailable",
    guideId: "nora-stein",
    startDate: "Jun 01, 2026",
    endDate: "Jun 30, 2026",
    startDateIso: "2026-06-01",
    endDateIso: "2026-06-30",
    status: "not-available",
    source: "admin-updated",
    notes: "Inactive profile; unavailable until reactivated.",
  },
  {
    id: "avail-daniel-available",
    guideId: "daniel-ortega",
    startDate: "Jun 01, 2026",
    endDate: "Jun 22, 2026",
    startDateIso: "2026-06-01",
    endDateIso: "2026-06-22",
    status: "available",
    source: "guide-submitted",
    notes: "Available for Spain circuits.",
  },
]

const assignmentAvailability: GuideAvailability[] = tourGroups
  .filter((group) => group.guideId)
  .map((group) => ({
    id: `assignment-${group.id}`,
    guideId: group.guideId as string,
    startDate: group.startDate,
    endDate: group.endDate,
    startDateIso: group.startDateIso,
    endDateIso: group.endDateIso,
    status: "occupied-by-assignment",
    source: "assignment-generated",
    notes: `Occupied by assigned group ${group.code}.`,
    assignmentGroupId: group.id,
  }))

export const guideAvailability: GuideAvailability[] = [
  ...manualAvailability,
  ...assignmentAvailability,
]
