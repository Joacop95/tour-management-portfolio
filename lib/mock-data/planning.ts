import { circuits, guides, tourGroups } from "@/lib/mock-data/groups"
import type { PlanningDate, PlanningTimelineData } from "@/lib/types/planning"

const planningStart = "2026-06-01"
const planningEnd = "2026-06-30"

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function createPlanningDates(startDateIso: string, endDateIso: string) {
  const dates: PlanningDate[] = []
  const current = new Date(`${startDateIso}T00:00:00.000Z`)
  const end = new Date(`${endDateIso}T00:00:00.000Z`)

  while (current <= end) {
    dates.push({
      iso: formatDate(current),
      day: current.getUTCDate(),
      weekday: current.toLocaleDateString("en-US", {
        timeZone: "UTC",
        weekday: "short",
      }),
    })
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return dates
}

export const planningTimeline: PlanningTimelineData = {
  monthLabel: "June 2026",
  startDateIso: planningStart,
  endDateIso: planningEnd,
  dates: createPlanningDates(planningStart, planningEnd),
  circuits,
  guides,
  groups: tourGroups,
}
