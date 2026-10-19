import {
  CalendarRange,
  FileSpreadsheet,
  Settings,
  UserPlus,
  Users,
  Waypoints,
} from "lucide-react"

import type { ModulePage } from "@/lib/types/modules"

export const modulePages = {
  groups: {
    title: "Groups",
    description:
      "Manage travel groups, dates, circuits, and guide assignment status.",
    cardTitle: "Group operations workspace",
    cardDescription:
      "This module will list incoming travel groups, their circuit dates, language needs, and current guide assignment state.",
    actionLabel: "New group",
    icon: Users,
  },
  guides: {
    title: "Guides",
    description:
      "Manage guide profiles, authorized emails, status, and invitations.",
    cardTitle: "Guide directory workspace",
    cardDescription:
      "This module will track guide profiles, invitation status, authorized login emails, working languages, and operational status.",
    actionLabel: "Invite guide",
    icon: UserPlus,
  },
  availability: {
    title: "Availability",
    description: "View and manage guide availability by date range.",
    cardTitle: "Availability planning workspace",
    cardDescription:
      "This module will show guide availability calendars, blackout dates, and date-range filters for assignment planning.",
    actionLabel: "Add availability",
    icon: CalendarRange,
  },
  assignments: {
    title: "Assignments",
    description: "Assign guides to groups and check date conflicts.",
    cardTitle: "Assignment control workspace",
    cardDescription:
      "This module will match guides with groups, surface date conflicts, and track confirmation status before departure.",
    actionLabel: "Create assignment",
    icon: Waypoints,
  },
  importExport: {
    title: "Import / Export",
    description:
      "Upload the fixed Excel template and export filtered group data.",
    cardTitle: "Data exchange workspace",
    cardDescription:
      "This module will support importing a fixed Excel template, validating rows, and exporting filtered operational data.",
    actionLabel: "Upload template",
    icon: FileSpreadsheet,
  },
  settings: {
    title: "Settings",
    description:
      "Manage users, roles, permissions, languages, email templates, and system settings.",
    cardTitle: "System configuration workspace",
    cardDescription:
      "This module will centralize user roles, permissions, language settings, email templates, and administrative defaults.",
    actionLabel: "Open settings",
    icon: Settings,
  },
} satisfies Record<string, ModulePage>
