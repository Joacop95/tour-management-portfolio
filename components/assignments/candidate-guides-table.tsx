"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { UserPlus } from "lucide-react"

import {
  CandidateAvailabilityBadge,
  CandidateCircuitBadge,
  CandidateConflictBadge,
  CandidateGuideStatusBadge,
  CandidateLanguageBadge,
} from "@/components/assignments/assignment-status-badges"
import { StackedTableHeader } from "@/components/common/stacked-table-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import type { Guide } from "@/lib/types/domain"
import type { CandidateGuide } from "@/lib/utils/assignment-candidates"

export type { CandidateGuide } from "@/lib/utils/assignment-candidates"

type CandidateGuidesTableProps = {
  candidates: CandidateGuide[]
  hasCurrentGuide: boolean
  currentGuideId?: string | null
  variant?: "default" | "planning-dialog"
  tableClassName?: string
  actionsDisabled?: boolean
  actionsDisabledReason?: string
  description?: string
  onAssignGuide: (candidate: CandidateGuide) => void
}

function getGuideSpokenLanguages(guide: Guide) {
  return normalizeSpokenLanguages(guide.languages, guide.preferredLanguage)
}

function getCandidateReadiness(candidate: CandidateGuide) {
  if (!candidate.canAssign) {
    return {
      labelKey: "assignments.candidates.conflicts_unavailable" as const,
      className: "text-red-700",
    }
  }

  if (candidate.warningReason) {
    return {
      labelKey: "status.needs_review" as const,
      className: "text-amber-800",
    }
  }

  return {
    labelKey: "availability.status.available" as const,
    className: "text-emerald-700",
  }
}

export function CandidateGuidesTable({
  candidates,
  hasCurrentGuide,
  currentGuideId = null,
  variant = "default",
  tableClassName,
  actionsDisabled = false,
  actionsDisabledReason,
  description,
  onAssignGuide,
}: CandidateGuidesTableProps) {
  const { t } = useI18n()
  const primaryActionLabel = hasCurrentGuide
    ? t("assignments.candidates.change_guide")
    : t("assignments.candidates.assign_guide")
  const resolvedDescription =
    description ?? t("assignments.candidates.matching_description")
  const usesInlineActions = variant === "planning-dialog"

  return (
    <Card id="candidate-guides" size="sm">
      <CardHeader className="border-b py-2">
        <div>
          <CardTitle><T i18nKey="assignments.candidate_guides_table.candidate_guides" /></CardTitle>
          <CardDescription className="text-xs">
            {resolvedDescription}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table className={cn("text-xs", tableClassName)}>
          <TableHeader>
            <TableRow>
              <TableHead
                className={cn(
                  "h-8 px-1.5 pl-3",
                  usesInlineActions && "min-w-44"
                )}
              >
                <T i18nKey="common.guide" />
              </TableHead>
              <TableHead className="h-8 px-1.5"><T i18nKey="common.status" /></TableHead>
              <TableHead className="h-8 px-1.5">
                <StackedTableHeader top={t("assignments.candidates.preferred")} bottom={t("assignments.candidates.language_lower")} />
              </TableHead>
              <TableHead className="h-8 px-1.5">
                <StackedTableHeader top={t("assignments.candidates.language")} bottom={t("assignments.candidates.compatibility")} />
              </TableHead>
              <TableHead className="h-8 px-1.5">
                <StackedTableHeader top={t("common.circuit")} bottom={t("assignments.candidates.compatibility")} />
              </TableHead>
              <TableHead className="h-8 px-1.5">
                <StackedTableHeader top={t("assignments.candidates.availability")} bottom={t("assignments.candidates.result")} />
              </TableHead>
              <TableHead className="h-8 px-1.5">
                <StackedTableHeader top={t("assignments.candidates.conflict")} bottom={t("assignments.candidates.result")} />
              </TableHead>
              <TableHead className="h-8 px-1.5"><T i18nKey="common.notes" /></TableHead>
              {!usesInlineActions ? (
                <TableHead className="h-8 min-w-40 px-1.5 pr-3 text-right">
                  <T i18nKey="common.actions" />
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((candidate) => {
              const spokenLanguages = getGuideSpokenLanguages(candidate.guide)
              const readiness = getCandidateReadiness(candidate)
              const isCurrentGuide = candidate.guide.id === currentGuideId
              const actionIsDisabled =
                actionsDisabled || isCurrentGuide || !candidate.canAssign
              const actionReason = actionsDisabled
                ? actionsDisabledReason
                : isCurrentGuide
                  ? "This guide is already assigned."
                  : candidate.blockingReason

              return (
                <TableRow
                  key={candidate.guide.id}
                  className={cn(
                    !candidate.isPrimaryCandidate &&
                      "bg-zinc-50/80 hover:bg-zinc-50",
                    candidate.availabilityResult === "occupied" &&
                      "bg-blue-50/60 hover:bg-blue-50",
                    candidate.availabilityResult === "not-available" &&
                      "bg-red-50/60 hover:bg-red-50",
                    candidate.availabilityResult === "available" &&
                      candidate.circuitResult === "match" &&
                      (candidate.languageResult === "match" ||
                        candidate.languageResult === "not-required") &&
                      candidate.guide.status === "active" &&
                      "bg-emerald-50/50 hover:bg-emerald-50"
                  )}
                >
                <TableCell className="px-1.5 py-1.5 pl-3 font-medium">
                  <div
                    className={cn(
                      "flex flex-col",
                      usesInlineActions ? "max-w-44" : "max-w-[8.5rem]"
                    )}
                  >
                    <span className="truncate">{candidate.guide.name}</span>
                    <span
                      className="truncate text-[11px] text-muted-foreground"
                      title={candidate.guide.email}
                    >
                      {candidate.guide.email}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 text-[11px] font-medium",
                        readiness.className
                      )}
                    >
                      {t(readiness.labelKey)}
                    </span>
                    {usesInlineActions ? (
                      <div className="mt-1.5 flex flex-col items-start gap-1">
                        <Button
                          type="button"
                          size="sm"
                          className="min-w-[7.75rem]"
                          disabled={actionIsDisabled}
                          title={actionReason ?? undefined}
                          onClick={() => onAssignGuide(candidate)}
                        >
                          <UserPlus className="size-3.5" />
                          {isCurrentGuide
                            ? t("assignments.candidates.current_guide")
                            : primaryActionLabel}
                        </Button>
                        {actionReason ? (
                          <span
                            className="max-w-40 text-[10px] leading-snug font-normal text-muted-foreground"
                            title={actionReason}
                          >
                            {actionReason}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="px-1.5 py-1.5">
                  <CandidateGuideStatusBadge status={candidate.guide.status} />
                </TableCell>
                <TableCell className="px-1.5 py-1.5">
                  <div className="grid gap-0.5">
                    <span>{candidate.guide.preferredLanguage || "—"}</span>
                    <span
                      className="max-w-24 truncate text-[11px] text-muted-foreground"
                      title={spokenLanguages.join(", ")}
                    >
                      {spokenLanguages.join(", ") || "No spoken languages"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="px-1.5 py-1.5">
                  <CandidateLanguageBadge result={candidate.languageResult} />
                </TableCell>
                <TableCell className="px-1.5 py-1.5">
                  <CandidateCircuitBadge result={candidate.circuitResult} />
                </TableCell>
                <TableCell className="px-1.5 py-1.5">
                  <CandidateAvailabilityBadge
                    result={candidate.availabilityResult}
                  />
                </TableCell>
                <TableCell className="px-1.5 py-1.5">
                  <CandidateConflictBadge result={candidate.conflictResult} />
                </TableCell>
                <TableCell className="max-w-52 px-1.5 py-1.5 text-[11px] leading-snug whitespace-normal text-muted-foreground">
                  <span
                    className="overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                    title={candidate.notes}
                  >
                    {candidate.notes}
                  </span>
                </TableCell>
                {!usesInlineActions ? (
                  <TableCell className="min-w-40 px-1.5 py-1.5 pr-3 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        className="min-w-[7.75rem]"
                        disabled={actionIsDisabled}
                        title={actionReason ?? undefined}
                        onClick={() => onAssignGuide(candidate)}
                      >
                        <UserPlus className="size-3.5" />
                        {isCurrentGuide
                          ? t("assignments.candidates.current_guide")
                          : primaryActionLabel}
                      </Button>
                      {actionReason ? (
                        <span
                          className="max-w-32 text-right text-[10px] leading-snug text-muted-foreground"
                          title={actionReason}
                        >
                          {actionReason}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                ) : null}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
