import {
  AlertTriangle,
  CalendarRange,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  Gauge,
  Map,
  Repeat,
  Settings,
  UserCheck,
  Users,
} from "lucide-react"

import type {
  DashboardMetric,
  NavItem,
  UpcomingGroup,
} from "@/lib/types/dashboard"

export const navigationItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: Gauge, moduleKey: "dashboard" },
  { label: "Groups", href: "/groups", icon: Users, moduleKey: "groups" },
  {
    label: "Planning",
    href: "/planning",
    icon: CalendarRange,
    moduleKey: "planning",
  },
  { label: "Guides", href: "/guides", icon: UserCheck, moduleKey: "guides" },
  {
    label: "Availability",
    href: "/availability",
    icon: CalendarDays,
    moduleKey: "availability",
  },
  {
    label: "Assignments",
    href: "/assignments",
    icon: ClipboardList,
    moduleKey: "assignments",
  },
  {
    label: "Change Requests",
    href: "/change-requests",
    icon: Repeat,
    moduleKey: "change-requests",
  },
  {
    label: "Import / Export",
    href: "/import-export",
    icon: Download,
    moduleKey: "import-export",
  },
  { label: "Settings", href: "/settings", icon: Settings, moduleKey: "settings" },
]

export const guidePortalNavigationItems: NavItem[] = [
  {
    label: "Home",
    href: "/guide",
    icon: Gauge,
    moduleKey: "dashboard",
  },
  {
    label: "My groups",
    href: "/guide/groups",
    icon: Users,
    moduleKey: "groups",
  },
  {
    label: "Availability",
    href: "/guide/availability",
    icon: CalendarDays,
    moduleKey: "availability",
  },
  {
    label: "Change requests",
    href: "/guide/change-requests",
    icon: Repeat,
    moduleKey: "assignments",
  },
  {
    label: "Profile",
    href: "/guide/profile",
    icon: UserCheck,
    moduleKey: "guides",
  },
]

export const dashboardMetrics: DashboardMetric[] = [
  {
    label: "Upcoming groups without guide",
    value: "6",
    detail: "Need assignment in the next 14 days",
    icon: Map,
    tone: "text-amber-700 bg-amber-50 ring-amber-200",
  },
  {
    label: "Groups without confirmed guide",
    value: "9",
    detail: "Assigned but waiting for confirmation",
    icon: AlertTriangle,
    tone: "text-red-700 bg-red-50 ring-red-200",
  },
  {
    label: "Available guides this week",
    value: "24",
    detail: "Across ES, EN, FR, and TR languages",
    icon: UserCheck,
    tone: "text-emerald-700 bg-emerald-50 ring-emerald-200",
  },
  {
    label: "Pending alerts",
    value: "4",
    detail: "Schedule conflicts and missing documents",
    icon: CheckCircle2,
    tone: "text-blue-700 bg-blue-50 ring-blue-200",
  },
]

export const upcomingGroups: UpcomingGroup[] = [
  {
    code: "BT-ES-1048",
    circuit: "Barcelona Essentials",
    startDate: "Jun 04, 2026",
    endDate: "Jun 07, 2026",
    startDateIso: "2026-06-04",
    endDateIso: "2026-06-07",
    guide: "Unassigned",
    status: "Needs guide",
    confirmation: "Open",
  },
  {
    code: "BT-FR-2210",
    circuit: "Paris to Loire",
    startDate: "Jun 06, 2026",
    endDate: "Jun 12, 2026",
    startDateIso: "2026-06-06",
    endDateIso: "2026-06-12",
    guide: "Camille Laurent",
    status: "Assigned",
    confirmation: "Pending",
  },
  {
    code: "BT-TR-3197",
    circuit: "Istanbul Heritage",
    startDate: "Jun 09, 2026",
    endDate: "Jun 11, 2026",
    startDateIso: "2026-06-09",
    endDateIso: "2026-06-11",
    guide: "Emre Yilmaz",
    status: "Confirmed",
    confirmation: "Confirmed",
  },
  {
    code: "BT-EN-0872",
    circuit: "Andalusia Highlights",
    startDate: "Jun 12, 2026",
    endDate: "Jun 18, 2026",
    startDateIso: "2026-06-12",
    endDateIso: "2026-06-18",
    guide: "Unassigned",
    status: "Needs guide",
    confirmation: "Open",
  },
  {
    code: "BT-FR-1405",
    circuit: "Madrid Art Week",
    startDate: "Jun 15, 2026",
    endDate: "Jun 19, 2026",
    startDateIso: "2026-06-15",
    endDateIso: "2026-06-19",
    guide: "Luc Moreau",
    status: "Assigned",
    confirmation: "Pending",
  },
]
