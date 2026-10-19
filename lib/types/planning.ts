import type { Circuit, Guide, TourGroup } from "@/lib/types/domain"

export type PlanningDate = {
  iso: string
  day: number
  weekday: string
}

export type PlanningTimelineData = {
  monthLabel: string
  startDateIso: string
  endDateIso: string
  dates: PlanningDate[]
  circuits: Circuit[]
  guides: Guide[]
  groups: TourGroup[]
}
