"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import Link from "next/link"
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit,
  MoreHorizontal,
  SlidersHorizontal,
  UserPlus,
} from "lucide-react"
import { useMemo, useSyncExternalStore } from "react"

import {
  AssignmentStatusBadge,
  ConfirmationStatusBadge,
  GroupStatusBadge,
} from "@/components/groups/status-badges"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { formatDateDisplay } from "@/lib/utils/date-format"
import {
  localStorageKeys,
  readLocalStorageValue,
  subscribeToLocalStorage,
  writeLocalStorageValue,
} from "@/lib/utils/local-storage"
import type { Circuit, Guide, TourGroup } from "@/lib/types/domain"

type DisplayTourGroup = TourGroup & {
  circuitName?: string
  currentGuideName?: string | null
}

type GroupsTableProps = {
  circuits: Circuit[]
  guides: Guide[]
  groups: DisplayTourGroup[]
  totalGroups?: number
  onEditGroup: (group: TourGroup) => void
  canAssignGuide?: boolean
  canConfirmGuide?: boolean
  canEditGroup?: boolean
  assignPermissionMessage?: string
  confirmPermissionMessage?: string
  editPermissionMessage?: string
}

type GroupsTableColumnKey =
  | "circuit"
  | "startDate"
  | "endDate"
  | "requiredLanguage"
  | "groupStatus"
  | "confirmation"

type GroupsTableColumnVisibility = Record<GroupsTableColumnKey, boolean>

const defaultColumnVisibility: GroupsTableColumnVisibility = {
  circuit: true,
  startDate: true,
  endDate: true,
  requiredLanguage: true,
  groupStatus: true,
  confirmation: true,
}

const configurableColumns: Array<{
  key: GroupsTableColumnKey
  labelKey: UiTranslationKey
}> = [
  { key: "circuit", labelKey: "common.circuit" },
  { key: "startDate", labelKey: "common.start_date" },
  { key: "endDate", labelKey: "common.end_date" },
  { key: "requiredLanguage", labelKey: "groups.table.required_language" },
  { key: "groupStatus", labelKey: "groups.table.group_status" },
  { key: "confirmation", labelKey: "groups.table.confirmation" },
]

function useGroupsTableColumnVisibility() {
  const storedVisibility = useSyncExternalStore(
    subscribeToLocalStorage,
    () =>
      readLocalStorageValue<Partial<GroupsTableColumnVisibility>>(
        localStorageKeys.groupsTableColumns,
        defaultColumnVisibility
      ),
    () => defaultColumnVisibility
  )

  const visibility = useMemo(
    () =>
      configurableColumns.reduce<GroupsTableColumnVisibility>(
        (currentVisibility, column) => ({
          ...currentVisibility,
          [column.key]:
            typeof storedVisibility[column.key] === "boolean"
              ? storedVisibility[column.key]
              : defaultColumnVisibility[column.key],
        }),
        defaultColumnVisibility
      ),
    [storedVisibility]
  )

  function setColumnVisibility(column: GroupsTableColumnKey, visible: boolean) {
    writeLocalStorageValue(localStorageKeys.groupsTableColumns, {
      ...visibility,
      [column]: visible,
    })
  }

  function resetColumnVisibility() {
    writeLocalStorageValue(
      localStorageKeys.groupsTableColumns,
      defaultColumnVisibility
    )
  }

  const isCustomized = configurableColumns.some(
    (column) => visibility[column.key] !== defaultColumnVisibility[column.key]
  )

  return {
    visibility,
    setColumnVisibility,
    resetColumnVisibility,
    isCustomized,
  }
}

function getCircuitName(circuits: Circuit[], group: DisplayTourGroup, t: ReturnType<typeof useI18n>["t"]) {
  return (
    circuits.find((circuit) => circuit.id === group.circuitId)?.name ??
    group.circuitName ??
    t("common.unknown")
  )
}

function getGuideName(guides: Guide[], group: DisplayTourGroup, t: ReturnType<typeof useI18n>["t"]) {
  if (!group.guideId) {
    return t("status.unassigned")
  }

  return (
    guides.find((guide) => guide.id === group.guideId)?.name ??
    group.currentGuideName ??
    t("common.unknown")
  )
}

function getStartUrgency(startDateIso: string, t: ReturnType<typeof useI18n>["t"]) {
  const startDate = new Date(`${startDateIso}T00:00:00`)

  if (Number.isNaN(startDate.getTime())) {
    return null
  }

  const now = new Date()
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime()
  const groupStart = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  ).getTime()
  const daysUntilStart = Math.round(
    (groupStart - todayStart) / (1000 * 60 * 60 * 24)
  )

  if (daysUntilStart < 0) {
    return {
      label: t("groups.urgency.past"),
      className: "border-zinc-200 bg-zinc-50 text-zinc-700",
    }
  }

  if (daysUntilStart === 0) {
    return {
      label: t("groups.urgency.today"),
      className: "border-red-200 bg-red-50 text-red-700",
    }
  }

  if (daysUntilStart === 1) {
    return {
      label: t("groups.urgency.tomorrow"),
      className: "border-amber-200 bg-amber-50 text-amber-800",
    }
  }

  if (daysUntilStart <= 7) {
    return {
      label: t("groups.urgency.in_days", { count: daysUntilStart }),
      className: "border-revival-primary/25 bg-revival-primary/10 text-foreground",
    }
  }

  return null
}

export function GroupsTable({
  circuits,
  guides,
  groups,
  totalGroups,
  onEditGroup,
  canAssignGuide = true,
  canConfirmGuide = true,
  canEditGroup = true,
  assignPermissionMessage = "You do not have permission to assign guides.",
  confirmPermissionMessage = "You do not have permission to confirm guides.",
  editPermissionMessage = "You do not have permission to edit groups.",
}: GroupsTableProps) {
  const { t } = useI18n()
  const {
    visibility: columnVisibility,
    setColumnVisibility,
    resetColumnVisibility,
    isCustomized,
  } = useGroupsTableColumnVisibility()
  const hasActiveFilters =
    typeof totalGroups === "number" && totalGroups !== groups.length
  const emptyColSpan =
    3 + Object.values(columnVisibility).filter(Boolean).length

  return (
    <Card>
      <CardHeader className="border-b">
        <div>
          <CardTitle><T i18nKey="navigation.groups" /></CardTitle>
          <CardDescription>
            <T i18nKey="groups.groups_filters.showing" /> {groups.length}
            {hasActiveFilters ? ` of ${totalGroups}` : ""} <T i18nKey="groups.groups_table.operational_groups" />
          </CardDescription>
        </div>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <SlidersHorizontal className="size-3.5" />
                <T i18nKey="groups.groups_table.columns" />
                {isCustomized ? (
                  <span className="text-[10px] text-muted-foreground">
                    <T i18nKey="groups.groups_table.customized" />
                  </span>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel><T i18nKey="groups.groups_table.visible_columns" /></DropdownMenuLabel>
              {configurableColumns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={columnVisibility[column.key]}
                  onCheckedChange={(checked) =>
                    setColumnVisibility(column.key, checked === true)
                  }
                >
                  {t(column.labelKey)}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={resetColumnVisibility}>
                <T i18nKey="groups.groups_table.reset_columns" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4"><T i18nKey="groups.create_group_dialog.group_code" /></TableHead>
              {columnVisibility.circuit ? <TableHead><T i18nKey="common.circuit" /></TableHead> : null}
              {columnVisibility.startDate ? <TableHead><T i18nKey="common.start_date" /></TableHead> : null}
              {columnVisibility.endDate ? <TableHead><T i18nKey="common.end_date" /></TableHead> : null}
              {columnVisibility.requiredLanguage ? (
                <TableHead><T i18nKey="settings.language.label" /></TableHead>
              ) : null}
              <TableHead><T i18nKey="common.guide" /></TableHead>
              {columnVisibility.groupStatus ? (
                <TableHead><T i18nKey="groups.edit_group_dialog.group_status" /></TableHead>
              ) : null}
              {columnVisibility.confirmation ? (
                <TableHead><T i18nKey="groups.groups_filters.confirmation" /></TableHead>
              ) : null}
              <TableHead className="pr-4 text-right"><T i18nKey="common.actions" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={emptyColSpan}
                  className="h-28 text-center text-muted-foreground"
                >
                  <T i18nKey="groups.groups_table.no_groups_match_the_selected_filters" />
                </TableCell>
              </TableRow>
            ) : null}
            {groups.map((group) => {
              const isCancelled = group.groupStatus === "cxl"
              const isMerged = group.groupStatus === "fusionado"
              const guideName = getGuideName(guides, group, t)
              const urgency = getStartUrgency(group.startDateIso, t)
              const needsAssignment = group.guideId === null
              const needsConfirmation =
                group.guideId !== null &&
                group.confirmationStatus === "pending-confirmation"

              return (
                <TableRow
                  key={group.id}
                  className={cn(
                    needsAssignment && "bg-red-50/30 hover:bg-red-50/50",
                    needsConfirmation && "bg-amber-50/30 hover:bg-amber-50/50",
                    isCancelled && "bg-zinc-50/80 hover:bg-zinc-50",
                    isMerged && "bg-amber-50/40 hover:bg-amber-50/60"
                  )}
                >
                  <TableCell className="pl-4 font-medium">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>{group.code}</span>
                      {urgency ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                            urgency.className
                          )}
                        >
                          <CalendarClock className="size-3" />
                          {urgency.label}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  {columnVisibility.circuit ? (
                    <TableCell>{getCircuitName(circuits, group, t)}</TableCell>
                  ) : null}
                  {columnVisibility.startDate ? (
                    <TableCell>{formatDateDisplay(group.startDateIso)}</TableCell>
                  ) : null}
                  {columnVisibility.endDate ? (
                    <TableCell>{formatDateDisplay(group.endDateIso)}</TableCell>
                  ) : null}
                  {columnVisibility.requiredLanguage ? (
                    <TableCell>
                      {group.requiredLanguage ?? group.language ?? t("assignments.selected.any_language")}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span
                        className={cn(
                          needsAssignment && "font-medium text-red-700"
                        )}
                      >
                        {guideName}
                      </span>
                      <AssignmentStatusBadge status={group.assignmentStatus} />
                    </div>
                  </TableCell>
                  {columnVisibility.groupStatus ? (
                    <TableCell>
                      <GroupStatusBadge status={group.groupStatus} />
                    </TableCell>
                  ) : null}
                  {columnVisibility.confirmation ? (
                    <TableCell>
                      <ConfirmationStatusBadge
                        status={group.confirmationStatus}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {needsAssignment && canAssignGuide ? (
                        <Button asChild size="sm">
                          <Link href="/assignments">
                            <UserPlus className="size-3.5" />
                            <T i18nKey="groups.groups_table.assign_guide" />
                          </Link>
                        </Button>
                      ) : null}
                      {needsConfirmation && canConfirmGuide ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href="/assignments">
                            <CheckCircle2 className="size-3.5" />
                            <T i18nKey="groups.groups_table.review" />
                          </Link>
                        </Button>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only"><T i18nKey="groups.groups_table.open_group_actions" /></span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuLabel><T i18nKey="common.actions" /></DropdownMenuLabel>
                          <DropdownMenuItem disabled={!canAssignGuide}>
                            <UserPlus className="size-4" />
                            <T i18nKey="groups.groups_table.assign_guide" />
                          </DropdownMenuItem>
                          {!canAssignGuide ? (
                            <DropdownMenuItem disabled>
                              {assignPermissionMessage}
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem disabled={!canConfirmGuide}>
                            <CheckCircle2 className="size-4" />
                            <T i18nKey="groups.groups_table.confirm_guide" />
                          </DropdownMenuItem>
                          {!canConfirmGuide ? (
                            <DropdownMenuItem disabled>
                              {confirmPermissionMessage}
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            disabled={!canEditGroup}
                            onSelect={() => onEditGroup(group)}
                          >
                            <Edit className="size-4" />
                            <T i18nKey="common.edit" />
                          </DropdownMenuItem>
                          {!canEditGroup ? (
                            <DropdownMenuItem disabled>
                              {editPermissionMessage}
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <Clock className="size-4" />
                            <T i18nKey="groups.groups_table.view_history" />
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
