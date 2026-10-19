"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import {
  CalendarDays,
  Edit,
  Mail,
  MessageCircle,
  MoreHorizontal,
  LoaderCircle,
  Power,
  RefreshCw,
  Route,
  SlidersHorizontal,
  Users,
} from "lucide-react"
import { useMemo, useSyncExternalStore } from "react"

import { GuideStatusBadge } from "@/components/guides/guide-status-badges"
import { Badge } from "@/components/ui/badge"
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
import { normalizeSpokenLanguages } from "@/lib/utils/language-options"
import { getWhatsAppContact } from "@/lib/utils/whatsapp"
import {
  localStorageKeys,
  readLocalStorageValue,
  subscribeToLocalStorage,
  writeLocalStorageValue,
} from "@/lib/utils/local-storage"
import type {
  Circuit,
  Guide,
  GuideAuthorizedEmailStatus,
  TourGroup,
} from "@/lib/types/domain"

type GuidesTableProps = {
  circuits: Circuit[]
  guides: Guide[]
  totalGuides: number
  groups: TourGroup[]
  assignedGroupCounts?: Record<string, number> | null
  showChangeRequestMetrics?: boolean
  showInternalGuideMetrics?: boolean
  showInternalRating?: boolean
  showSalesRanking?: boolean
  showSalesScore?: boolean
  onViewGuide: (guide: Guide) => void
  onEditGuide: (guide: Guide) => void
  onToggleGuideStatus: (guide: Guide) => void
  pendingStatusGuideId: string | null
  canViewGuide?: boolean
  canEditGuide?: boolean
  editPermissionMessage?: string
}

type GuideTableColumnKey =
  | "authorizedEmail"
  | "phone"
  | "preferredLanguage"
  | "spokenLanguages"
  | "circuits"
  | "assignedGroups"
  | "changeRequests"
  | "metrics"

type GuideTableColumnVisibility = Record<GuideTableColumnKey, boolean>

const defaultColumnVisibility: GuideTableColumnVisibility = {
  authorizedEmail: true,
  phone: true,
  preferredLanguage: true,
  spokenLanguages: true,
  circuits: true,
  assignedGroups: true,
  changeRequests: true,
  metrics: false,
}

const configurableColumns: Array<{
  key: GuideTableColumnKey
  labelKey: UiTranslationKey
}> = [
  { key: "authorizedEmail", labelKey: "guides.table.authorized_email" },
  { key: "phone", labelKey: "guides.table.phone_whatsapp" },
  { key: "preferredLanguage", labelKey: "guides.table.preferred_language" },
  { key: "spokenLanguages", labelKey: "guides.table.spoken_languages" },
  { key: "circuits", labelKey: "guides.table.circuits" },
  { key: "assignedGroups", labelKey: "guides.table.assigned_groups" },
  { key: "changeRequests", labelKey: "navigation.change_requests" },
  { key: "metrics", labelKey: "guides.table.metrics" },
]

function useGuideTableColumnVisibility() {
  const storedVisibility = useSyncExternalStore(
    subscribeToLocalStorage,
    () =>
      readLocalStorageValue<Partial<GuideTableColumnVisibility>>(
        localStorageKeys.guidesTableColumns,
        defaultColumnVisibility
      ),
    () => defaultColumnVisibility
  )

  const visibility = useMemo(
    () =>
      configurableColumns.reduce<GuideTableColumnVisibility>(
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

  function setColumnVisibility(column: GuideTableColumnKey, visible: boolean) {
    writeLocalStorageValue(localStorageKeys.guidesTableColumns, {
      ...visibility,
      [column]: visible,
    })
  }

  function resetColumnVisibility() {
    writeLocalStorageValue(
      localStorageKeys.guidesTableColumns,
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

function getCircuitName(circuits: Circuit[], circuitId: string, t: ReturnType<typeof useI18n>["t"]) {
  return circuits.find((circuit) => circuit.id === circuitId)?.name ?? t("common.unknown")
}

function getAssignedGroupsCount(groups: TourGroup[], guideId: string) {
  return groups.filter((group) => group.guideId === guideId).length
}

function getChangeRequestMetric(value: number | undefined) {
  return value ?? 0
}

function formatOptionalMetric(value: number | null | undefined) {
  return value ?? "—"
}

function getAuthorizedEmailStatusClass(status: GuideAuthorizedEmailStatus) {
  if (status === "registered") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700"
  }

  if (status === "invited") {
    return "border-blue-200 bg-blue-50 text-blue-700"
  }

  if (status === "revoked") {
    return "border-zinc-200 bg-zinc-100 text-zinc-600"
  }

  return "border-amber-200 bg-amber-50 text-amber-700"
}

function getAuthorizedEmailStatusLabel(status: GuideAuthorizedEmailStatus, t: ReturnType<typeof useI18n>["t"]) {
  if (status === "invited") {
    return t("status.invited")
  }

  if (status === "allowed") {
    return t("status.allowed")
  }

  if (status === "registered") {
    return t("status.registered")
  }

  if (status === "revoked") {
    return t("status.revoked")
  }

  return status
}

function getCurrentAuthorizedLoginEmail(guide: Guide) {
  return [...(guide.authorizedEmails ?? [])]
    .reverse()
    .find((emailRecord) => emailRecord.status !== "revoked")
}

export function GuidesTable({
  circuits,
  guides,
  totalGuides,
  groups,
  assignedGroupCounts,
  showChangeRequestMetrics = true,
  showInternalGuideMetrics = true,
  showInternalRating = true,
  showSalesRanking = true,
  showSalesScore = true,
  onViewGuide,
  onEditGuide,
  onToggleGuideStatus,
  pendingStatusGuideId,
  canViewGuide = true,
  canEditGuide = true,
  editPermissionMessage = "You do not have permission to edit guides.",
}: GuidesTableProps) {
  const { t } = useI18n()
  const {
    visibility: columnVisibility,
    setColumnVisibility,
    resetColumnVisibility,
    isCustomized,
  } = useGuideTableColumnVisibility()
  const hasActiveFilters = guides.length !== totalGuides
  const showAuthorizedEmail = columnVisibility.authorizedEmail
  const showPhone = columnVisibility.phone
  const showPreferredLanguage = columnVisibility.preferredLanguage
  const showSpokenLanguages = columnVisibility.spokenLanguages
  const showCircuits = columnVisibility.circuits
  const showAssignedGroups = columnVisibility.assignedGroups
  const showChangeRequests =
    showChangeRequestMetrics && columnVisibility.changeRequests
  const showMetrics = showInternalGuideMetrics && columnVisibility.metrics
  const emptyColSpan =
    3 +
    [
      showAuthorizedEmail,
      showPhone,
      showPreferredLanguage,
      showSpokenLanguages,
      showCircuits,
      showAssignedGroups,
      showChangeRequests,
      showMetrics,
    ].filter(Boolean).length

  return (
    <Card>
      <CardHeader className="border-b">
        <div>
          <CardTitle><T i18nKey="navigation.guides" /></CardTitle>
          <CardDescription>
            <T i18nKey="guides.guides_filters.showing" /> {guides.length}
            {hasActiveFilters ? ` of ${totalGuides}` : ""} <T i18nKey="guides.guides_table.mock_guide_profiles" />
            {" "}<T i18nKey="guides.guides_table.internal_metrics_are_mock_only_until_survey_and" />
          </CardDescription>
        </div>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <SlidersHorizontal className="size-3.5" />
                <T i18nKey="guides.guides_table.columns" />
                {isCustomized ? (
                  <span className="text-[10px] text-muted-foreground">
                    <T i18nKey="guides.guides_table.customized" />
                  </span>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel><T i18nKey="guides.guides_table.visible_columns" /></DropdownMenuLabel>
              {configurableColumns.map((column) => {
                const disabled =
                  (column.key === "changeRequests" &&
                    !showChangeRequestMetrics) ||
                  (column.key === "metrics" && !showInternalGuideMetrics)

                return (
                  <DropdownMenuCheckboxItem
                    key={column.key}
                    checked={columnVisibility[column.key]}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      setColumnVisibility(column.key, checked === true)
                    }
                  >
                    {t(column.labelKey)}
                  </DropdownMenuCheckboxItem>
                )
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={resetColumnVisibility}>
                <T i18nKey="guides.guides_table.reset_columns" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4"><T i18nKey="guides.guides_table.guide_name" /></TableHead>
              {showAuthorizedEmail ? <TableHead><T i18nKey="guides.guides_table.authorized_email" /></TableHead> : null}
              {showPhone ? <TableHead><T i18nKey="guides.guide_form_dialog.phone_whatsapp" /></TableHead> : null}
              {showPreferredLanguage ? (
                <TableHead><T i18nKey="guides.guide_form_dialog.preferred_language" /></TableHead>
              ) : null}
              {showSpokenLanguages ? <TableHead><T i18nKey="guides.guide_form_dialog.spoken_languages" /></TableHead> : null}
              {showCircuits ? <TableHead><T i18nKey="guides.guides_table.circuits" /></TableHead> : null}
              <TableHead><T i18nKey="common.status" /></TableHead>
              {showAssignedGroups ? <TableHead><T i18nKey="guides.guides_table.assigned_groups" /></TableHead> : null}
              {showChangeRequests ? (
                <TableHead><T i18nKey="guide_portal.navigation.change_requests" /></TableHead>
              ) : null}
              {showMetrics ? <TableHead><T i18nKey="guides.guides_table.metrics" /></TableHead> : null}
              <TableHead className="pr-4 text-right"><T i18nKey="common.actions" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {guides.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={emptyColSpan}
                  className="h-28 text-center text-muted-foreground"
                >
                  <T i18nKey="guides.guides_table.no_guides_match_the_selected_filters" />
                </TableCell>
              </TableRow>
            ) : null}
            {guides.map((guide) => {
              const assignedGroupsCount = assignedGroupCounts === undefined
                ? getAssignedGroupsCount(groups, guide.id)
                : assignedGroupCounts === null
                  ? null
                  : (assignedGroupCounts[guide.id] ?? 0)
              const currentAuthorizedLoginEmail =
                getCurrentAuthorizedLoginEmail(guide)
              const hasAuthorizedEmailRecords =
                guide.authorizedEmails !== undefined
              const spokenLanguages = normalizeSpokenLanguages(
                guide.languages,
                guide.preferredLanguage
              )
              const whatsAppContact = getWhatsAppContact(guide.phone)

              return (
                <TableRow
                  key={guide.id}
                  className={cn(
                    guide.status === "blocked" &&
                      "bg-red-50/60 hover:bg-red-50",
                    guide.status === "inactive" &&
                      "bg-zinc-50/80 hover:bg-zinc-50",
                    guide.status === "pending-invitation" &&
                      "bg-amber-50/50 hover:bg-amber-50"
                  )}
                >
                  <TableCell className="pl-4 font-medium">
                    {guide.name}
                  </TableCell>
                  {showAuthorizedEmail ? (
                    <TableCell>
                    <div className="grid max-w-64 gap-1">
                      {currentAuthorizedLoginEmail ? (
                        <>
                          <span>{currentAuthorizedLoginEmail.email}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "w-fit",
                              getAuthorizedEmailStatusClass(
                                currentAuthorizedLoginEmail.status
                              )
                            )}
                          >
                            {getAuthorizedEmailStatusLabel(
                              currentAuthorizedLoginEmail.status,
                              t
                            )}
                          </Badge>
                        </>
                      ) : hasAuthorizedEmailRecords ? (
                        <span className="text-xs font-medium text-amber-700">
                          <T i18nKey="guides.guides_table.no_login_email" />
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {guide.email}
                        </span>
                      )}
                    </div>
                    </TableCell>
                  ) : null}
                  {showPhone ? (
                    <TableCell>
                    {guide.phone ? (
                      <div className="flex items-center gap-2">
                        <span>{guide.phone}</span>
                        {whatsAppContact.available ? (
                          <Button asChild variant="outline" size="sm">
                            <a
                              href={whatsAppContact.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle className="size-4" />
                              <T i18nKey="guides.guides_table.whatsapp" />
                            </a>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled
                            title={t("planning.communication.whatsapp_international_required")}
                          >
                            <MessageCircle className="size-4" />
                            <T i18nKey="guides.guides_table.whatsapp" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground"><T i18nKey="guides.guides_table.no_phone" /></span>
                    )}
                    </TableCell>
                  ) : null}
                  {showPreferredLanguage ? (
                    <TableCell>
                    {guide.preferredLanguage || (
                      <span className="text-muted-foreground"><T i18nKey="guides.guide_form_dialog.no_preference" /></span>
                    )}
                    </TableCell>
                  ) : null}
                  {showSpokenLanguages ? (
                    <TableCell>
                    <div className="flex max-w-40 flex-wrap gap-1">
                      {spokenLanguages.length > 0 ? (
                        spokenLanguages.map((language) => (
                          <Badge key={language} variant="outline">
                            {language}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground"><T i18nKey="guides.guides_table.not_listed" /></span>
                      )}
                    </div>
                    </TableCell>
                  ) : null}
                  {showCircuits ? (
                    <TableCell>
                    <div className="flex max-w-72 flex-wrap gap-1">
                      {guide.circuitIds.map((circuitId) => (
                        <Badge key={circuitId} variant="outline">
                          {getCircuitName(circuits, circuitId, t)}
                        </Badge>
                      ))}
                    </div>
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <GuideStatusBadge status={guide.status} />
                  </TableCell>
                  {showAssignedGroups ? (
                    <TableCell>{assignedGroupsCount ?? "—"}</TableCell>
                  ) : null}
                  {showChangeRequests ? (
                    <TableCell>
                      <div className="grid gap-0.5 text-xs">
                        <span>
                          <T i18nKey="guides.guides_table.requested" />{" "}
                          {getChangeRequestMetric(guide.changeRequestsCount)}
                        </span>
                        <span>
                          <T i18nKey="guides.guides_table.completed" />{" "}
                          {getChangeRequestMetric(
                            guide.completedChangeRequestsCount
                          )}
                        </span>
                        <span>
                          <T i18nKey="guides.guides_table.pending" />{" "}
                          {getChangeRequestMetric(
                            guide.pendingChangeRequestsCount
                          )}
                        </span>
                        <span>
                          <T i18nKey="guides.guides_table.rejected" />{" "}
                          {getChangeRequestMetric(
                            guide.rejectedChangeRequestsCount
                          )}
                        </span>
                      </div>
                    </TableCell>
                  ) : null}
                  {showMetrics ? (
                    <TableCell>
                      <div className="grid gap-1 text-xs">
                        {showInternalRating ? (
                          <Badge variant="outline" className="w-fit">
                            <T i18nKey="guides.guides_table.rating" /> {formatOptionalMetric(guide.internalRating)}
                            {guide.internalRating != null ? "/5" : ""}
                          </Badge>
                        ) : null}
                        {showSalesRanking ? (
                          <Badge variant="outline" className="w-fit">
                            <T i18nKey="guides.guides_table.sales_rank" />{" "}
                            {guide.salesRanking != null
                              ? `#${guide.salesRanking}`
                              : "—"}
                          </Badge>
                        ) : null}
                        {showSalesScore ? (
                          <span className="text-muted-foreground">
                            <T i18nKey="guides.guides_table.score" /> {formatOptionalMetric(guide.salesScore)}
                          </span>
                        ) : null}
                        {!showInternalRating &&
                        !showSalesRanking &&
                        !showSalesScore ? (
                          <span className="text-muted-foreground">—</span>
                        ) : null}
                      </div>
                    </TableCell>
                  ) : null}
                  <TableCell className="pr-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only"><T i18nKey="guides.guides_table.open_guide_actions" /></span>
                        </Button>
                      </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel><T i18nKey="common.actions" /></DropdownMenuLabel>
                          <DropdownMenuItem
                            disabled={!canViewGuide}
                            onSelect={() => onViewGuide(guide)}
                          >
                            <T i18nKey="guides.guides_table.view_profile" />
                          </DropdownMenuItem>
                          <DropdownMenuItem
                          disabled={!canEditGuide}
                          onSelect={() => onEditGuide(guide)}
                        >
                          <Edit className="size-4" />
                          <T i18nKey="guides.guides_table.edit_profile" />
                        </DropdownMenuItem>
                        {!canEditGuide ? (
                          <DropdownMenuItem disabled>
                            {editPermissionMessage}
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem>
                          <Mail className="size-4" />
                          <T i18nKey="guides.guides_table.send_invitation" />
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <RefreshCw className="size-4" />
                          <T i18nKey="guides.guides_table.re_send_invitation" />
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <CalendarDays className="size-4" />
                          <T i18nKey="guides.guides_table.view_availability" />
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Route className="size-4" />
                          <T i18nKey="guides.guides_table.view_assigned_groups" />
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={!canEditGuide || pendingStatusGuideId !== null}
                          aria-busy={pendingStatusGuideId === guide.id}
                          onSelect={() => onToggleGuideStatus(guide)}
                          variant={
                            guide.status === "active"
                              ? "destructive"
                              : "default"
                          }
                        >
                          {pendingStatusGuideId === guide.id ? (
                            <LoaderCircle className="size-4 animate-spin" />
                          ) : guide.status === "active" ? (
                            <Power className="size-4" />
                          ) : (
                            <Users className="size-4" />
                          )}
                          {guide.status === "active"
                            ? t("guides.table.deactivate")
                            : t("guides.table.activate")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
