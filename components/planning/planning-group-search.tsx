"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { LoaderCircle, Search, X } from "lucide-react"

import { GroupStatusBadge } from "@/components/groups/status-badges"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  searchSupabaseGroupsByCode,
  type SupabaseGroupSearchItem,
} from "@/lib/supabase/queries/groups"
import type { Circuit, Guide, TourGroup } from "@/lib/types/domain"
import { formatDateDisplay } from "@/lib/utils/date-format"

type PlanningDataSource = "local-fallback" | "supabase"

function getSearchRank(groupCode: string, query: string) {
  const code = groupCode.toLocaleLowerCase()
  const normalizedQuery = query.toLocaleLowerCase()

  if (code === normalizedQuery) return 0
  if (code.startsWith(normalizedQuery)) return 1
  return 2
}

function getLocalResults(
  groups: TourGroup[],
  circuits: Circuit[],
  guides: Guide[],
  query: string,
  t: ReturnType<typeof useI18n>["t"]
): SupabaseGroupSearchItem[] {
  const normalizedQuery = query.toLocaleLowerCase()
  const circuitById = new Map(circuits.map((circuit) => [circuit.id, circuit]))
  const guideById = new Map(guides.map((guide) => [guide.id, guide]))

  return groups
    .filter((group) => group.code.toLocaleLowerCase().includes(normalizedQuery))
    .sort(
      (firstGroup, secondGroup) =>
        getSearchRank(firstGroup.code, query) -
          getSearchRank(secondGroup.code, query) ||
        firstGroup.code.localeCompare(secondGroup.code, undefined, {
          sensitivity: "base",
        }) ||
        firstGroup.id.localeCompare(secondGroup.id)
    )
    .slice(0, 10)
    .map((group) => ({
      group,
      circuitName: circuitById.get(group.circuitId)?.name ?? t("planning.timeline.unknown_circuit"),
      currentGuideName: group.guideId
        ? (guideById.get(group.guideId)?.name ?? t("change_requests.fallback.unknown_guide"))
        : null,
    }))
}

export function PlanningGroupSearch({
  circuits,
  dataSource,
  groups,
  guides,
  onSelect,
}: {
  circuits: Circuit[]
  dataSource: PlanningDataSource
  groups: TourGroup[]
  guides: Guide[]
  onSelect: (result: SupabaseGroupSearchItem) => Promise<void> | void
}) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const requestSequence = useRef(0)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SupabaseGroupSearchItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchedQuery, setSearchedQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const trimmedQuery = query.trim()
  const localResults = useMemo(
    () =>
      trimmedQuery.length >= 2
        ? getLocalResults(groups, circuits, guides, trimmedQuery, t)
        : [],
    [circuits, groups, guides, trimmedQuery, t]
  )

  useEffect(() => {
    if (!isOpen) return

    function handleOutsidePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false)
    }

    document.addEventListener("pointerdown", handleOutsidePointer)
    return () => document.removeEventListener("pointerdown", handleOutsidePointer)
  }, [isOpen])

  useEffect(() => {
    if (dataSource === "local-fallback" || trimmedQuery.length < 2) return

    const sequence = ++requestSequence.current
    const timeout = window.setTimeout(async () => {
      const result = await searchSupabaseGroupsByCode(trimmedQuery)
      if (sequence !== requestSequence.current) return

      setResults(result.data)
      setError(result.error)
      setSearchedQuery(trimmedQuery)
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [dataSource, trimmedQuery])

  function clearSearch() {
    requestSequence.current += 1
    setQuery("")
    setResults([])
    setError(null)
    setSearchedQuery("")
    setIsOpen(false)
    setActiveIndex(0)
  }

  function selectResult(result: SupabaseGroupSearchItem) {
    clearSearch()
    void onSelect(result)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false)
      return
    }
    if (!isOpen || displayedResults.length === 0) return

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((current) => (current + 1) % displayedResults.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex(
        (current) =>
          (current - 1 + displayedResults.length) % displayedResults.length
      )
    } else if (event.key === "Enter") {
      event.preventDefault()
      selectResult(displayedResults[activeIndex] ?? displayedResults[0])
    }
  }

  const showResults = isOpen && trimmedQuery.length >= 2
  const isLoading =
    dataSource === "supabase" &&
    trimmedQuery.length >= 2 &&
    searchedQuery !== trimmedQuery
  const displayedResults =
    dataSource === "local-fallback" ? localResults : results

  return (
    <div ref={containerRef} className="relative w-full sm:w-80 sm:shrink-0">
      <label htmlFor="planning-group-search" className="sr-only">
        <T i18nKey="planning.planning_group_search.search_group_code" />
      </label>
      <InputGroup className="h-9 bg-background">
        <InputGroupAddon>
          {isLoading ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="size-4" aria-hidden="true" />
          )}
        </InputGroupAddon>
        <InputGroupInput
          id="planning-group-search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="planning-group-search-results"
          aria-expanded={showResults}
          aria-activedescendant={
            showResults && displayedResults[activeIndex]
              ? `planning-group-result-${displayedResults[activeIndex].group.id}`
              : undefined
          }
          autoComplete="off"
          placeholder={t("planning.planning_group_search.placeholder_search_group_code")}
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value
            setQuery(nextQuery)
            setError(null)
            setActiveIndex(0)
            setIsOpen(nextQuery.trim().length >= 2)
            if (nextQuery.trim().length < 2) {
              requestSequence.current += 1
              setResults([])
              setSearchedQuery("")
            }
          }}
          onFocus={() => {
            if (trimmedQuery.length >= 2) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />
        {query ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label={t("planning.planning_group_search.aria_label_clear_group_search")}
              onClick={clearSearch}
            >
              <X className="size-3.5" />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>

      {showResults ? (
        <div
          id="planning-group-search-results"
          role="listbox"
          aria-label={t("planning.planning_group_search.aria_label_matching_groups")}
          className="absolute z-50 mt-1 max-h-96 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-md"
        >
          {isLoading ? (
            <div className="px-3 py-5 text-center text-sm text-muted-foreground">
              <T i18nKey="planning.planning_group_search.searching_groups" />
            </div>
          ) : error ? (
            <div className="px-3 py-5 text-center text-sm text-destructive">
              {error}
            </div>
          ) : displayedResults.length === 0 ? (
            <div className="px-3 py-5 text-center text-sm text-muted-foreground">
              <T i18nKey="planning.planning_group_search.no_groups_found" />
            </div>
          ) : (
            displayedResults.map((result, index) => (
              <Button
                key={result.group.id}
                id={`planning-group-result-${result.group.id}`}
                role="option"
                aria-selected={index === activeIndex}
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start px-2.5 py-2 text-left aria-selected:bg-muted"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectResult(result)}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {result.group.code}
                    </span>
                    <GroupStatusBadge status={result.group.groupStatus} />
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {result.circuitName} · {formatDateDisplay(result.group.startDateIso)} -{" "}
                    {formatDateDisplay(result.group.endDateIso)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {result.currentGuideName ?? t("status.without_guide")}
                  </span>
                </span>
              </Button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
