"use client"

import { useI18n } from "@/components/i18n/i18n-provider"
import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, MapPinned } from "lucide-react"

import { ChangeRequestSummaryCard } from "@/components/dashboard/change-request-summary-card"
import { MetricCard } from "@/components/dashboard/metric-card"
import { OperationalAlertsCard } from "@/components/dashboard/operational-alerts-card"
import { UpcomingGroupsTable } from "@/components/dashboard/upcoming-groups-table"
import { UnassignedGroupsCard } from "@/components/dashboard/unassigned-groups-card"
import {
  usePersistedCircuits,
  usePersistedGroups,
  usePersistedGuides,
} from "@/lib/hooks/use-persisted-mock-data"
import { getSupabaseGroups } from "@/lib/supabase/queries/groups"
import type { DashboardMetric, UpcomingGroup } from "@/lib/types/dashboard"
import type { Circuit, Guide, TourGroup } from "@/lib/types/domain"

type DashboardGroup = TourGroup & {
  circuitName?: string
  currentGuideName?: string | null
}

function getCircuitName(group: DashboardGroup, circuits: Circuit[]) {
  return (
    group.circuitName ??
    circuits.find((circuit) => circuit.id === group.circuitId)?.name ??
    "Unknown circuit"
  )
}

function getGuideName(group: DashboardGroup, guides: Guide[], t: ReturnType<typeof useI18n>["t"]) {
  if (!group.guideId) {
    return "Unassigned"
  }

  return (
    group.currentGuideName ??
    guides.find((guide) => guide.id === group.guideId)?.name ??
    t("dashboard.assigned_guide_fallback")
  )
}

function toUpcomingGroup(
  group: DashboardGroup,
  circuits: Circuit[],
  guides: Guide[],
  t: ReturnType<typeof useI18n>["t"]
): UpcomingGroup {
  const hasGuide = group.guideId !== null

  return {
    code: group.code,
    circuit: getCircuitName(group, circuits),
    startDate: group.startDate,
    endDate: group.endDate,
    startDateIso: group.startDateIso,
    endDateIso: group.endDateIso,
    guide: getGuideName(group, guides, t),
    status: !hasGuide
      ? "Needs guide"
      : group.confirmationStatus === "confirmed"
        ? "Confirmed"
        : "Assigned",
    confirmation: !hasGuide
      ? "Open"
      : group.confirmationStatus === "confirmed"
        ? "Confirmed"
        : "Pending",
  }
}

export function DashboardModule() {
  const { t } = useI18n()
  const localGroups = usePersistedGroups()
  const localCircuits = usePersistedCircuits()
  const localGuides = usePersistedGuides()
  const [supabaseGroups, setSupabaseGroups] = useState<DashboardGroup[] | null>(
    null
  )
  const [supabaseError, setSupabaseError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadSupabaseGroups() {
      const result = await getSupabaseGroups()

      if (!isMounted) return
      setSupabaseGroups(result.error ? null : result.data)
      setSupabaseError(result.error)
    }

    void loadSupabaseGroups()

    return () => {
      isMounted = false
    }
  }, [])

  const groups = supabaseGroups ?? localGroups
  const upcomingGroups = useMemo(
    () =>
      groups
        .filter((group) => group.groupStatus !== "cxl")
        .sort((firstGroup, secondGroup) =>
          firstGroup.startDateIso.localeCompare(secondGroup.startDateIso)
        )
        .map((group) =>
          toUpcomingGroup(group as DashboardGroup, localCircuits, localGuides, t)
        ),
    [groups, localCircuits, localGuides, t]
  )
  const groupsWithoutGuide = useMemo(
    () => upcomingGroups.filter((group) => group.status === "Needs guide"),
    [upcomingGroups]
  )
  const groupsPendingConfirmation = useMemo(
    () => upcomingGroups.filter((group) => group.confirmation === "Pending"),
    [upcomingGroups]
  )
  const metrics: DashboardMetric[] = [
    {
      label: t("dashboard.metrics.upcoming_without_guide"),
      value: String(groupsWithoutGuide.length),
      detail: t("dashboard.metrics.open_assignments_detail"),
      icon: MapPinned,
      tone: "bg-amber-50 text-amber-800 ring-amber-200",
      actionLabel: t("dashboard.metrics.assign_guide"),
      actionHref: "/assignments",
    },
    {
      label: t("dashboard.metrics.without_confirmed_guide"),
      value: String(groupsPendingConfirmation.length),
      detail: t("dashboard.metrics.awaiting_confirmation_detail"),
      icon: AlertTriangle,
      tone: "bg-red-50 text-red-700 ring-red-200",
      actionLabel: t("dashboard.metrics.view_groups"),
      actionHref: "/groups",
    },
  ]

  if (process.env.NODE_ENV === "production" && !supabaseGroups) {
    return (
      <p role="status" className="py-6 text-sm text-muted-foreground">
        {supabaseError ? t("dashboard.read_error") : t("common.loading")}
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
        <ChangeRequestSummaryCard />
        <OperationalAlertsCard
          groupsWithoutGuide={groupsWithoutGuide.length}
          groupsPendingConfirmation={groupsPendingConfirmation.length}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
        <UnassignedGroupsCard groups={groupsWithoutGuide.slice(0, 5)} />
        <UpcomingGroupsTable groups={upcomingGroups.slice(0, 12)} />
      </section>
    </div>
  )
}
