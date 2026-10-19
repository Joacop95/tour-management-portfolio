import type { LucideIcon } from "lucide-react"
import type { AppModuleKey } from "@/lib/types/settings"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  moduleKey: AppModuleKey
}

export type DashboardMetric = {
  label: string
  value: string
  detail: string
  icon: LucideIcon
  tone: string
  actionLabel?: string
  actionHref?: string
}

export type UpcomingGroupStatus = "Needs guide" | "Assigned" | "Confirmed"

export type UpcomingGroupConfirmation = "Open" | "Pending" | "Confirmed"

export type UpcomingGroup = {
  code: string
  circuit: string
  startDate: string
  endDate: string
  startDateIso: string
  endDateIso: string
  guide: string
  status: UpcomingGroupStatus
  confirmation: UpcomingGroupConfirmation
}
