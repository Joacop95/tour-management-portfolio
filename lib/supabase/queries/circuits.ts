import type { Circuit } from "@/lib/types/domain"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { readAllPages, readByIdBatches } from "@/lib/supabase/queries/paginated-read"

type CircuitRow = {
  id: string
  name: string
  code: string | null
  region: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
  updated_by: string | null
  is_archived: boolean
  default_end_date_offset_days: number | null
  planning_sort_order: number | null
}

type CircuitAliasRow = {
  circuit_id: string
  alias: string
}

export type SupabaseCircuitsResult = {
  data: Circuit[]
  error: string | null
}

async function getSupabaseCircuits({
  activeOnly,
}: {
  activeOnly: boolean
}): Promise<SupabaseCircuitsResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return {
      data: [],
      error: "Supabase environment variables are not configured.",
    }
  }

  const { data: circuits, error: circuitsError } =
    await readAllPages((start, end) => {
      let query = supabase
        .from("circuits")
        .select(
          "id, name, code, region, is_active, notes, created_at, updated_at, updated_by, is_archived, default_end_date_offset_days, planning_sort_order"
        )
        .eq("is_archived", false)
        .order("name", { ascending: true })
        .order("id", { ascending: true })
      if (activeOnly) query = query.eq("is_active", true)
      return query.range(start, end).returns<CircuitRow[]>()
    })

  if (circuitsError) {
    return {
      data: [],
      error: circuitsError,
    }
  }

  const circuitIds = circuits.map((circuit) => circuit.id)

  if (circuitIds.length === 0) {
    return {
      data: [],
      error: null,
    }
  }

  const { data: aliases, error: aliasesError } = await readByIdBatches(
    circuitIds,
    (batch, start, end) => supabase.from("circuit_aliases")
      .select("circuit_id, alias")
      .in("circuit_id", batch)
      .eq("is_active", true)
      .eq("is_archived", false)
      .order("alias", { ascending: true })
      .order("circuit_id", { ascending: true })
      .range(start, end)
      .returns<CircuitAliasRow[]>()
  )

  if (aliasesError) {
    return {
      data: [],
      error: aliasesError,
    }
  }

  const aliasesByCircuitId = new Map<string, string[]>()

  aliases.forEach((alias) => {
    const currentAliases = aliasesByCircuitId.get(alias.circuit_id) ?? []

    aliasesByCircuitId.set(alias.circuit_id, [
      ...currentAliases,
      alias.alias,
    ])
  })

  return {
    data: circuits.map((circuit) => ({
      id: circuit.id,
      name: circuit.name,
      code: circuit.code ?? "",
      region: circuit.region ?? "",
      aliases: aliasesByCircuitId.get(circuit.id) ?? [],
      isActive: circuit.is_active,
      notes: circuit.notes ?? undefined,
      createdAtIso: circuit.created_at,
      updatedAtIso: circuit.updated_at,
      updatedBy: circuit.updated_by ?? undefined,
      defaultEndDateOffsetDays: circuit.default_end_date_offset_days,
      planningSortOrder: circuit.planning_sort_order,
    })),
    error: null,
  }
}

export async function getActiveSupabaseCircuits(): Promise<SupabaseCircuitsResult> {
  return getSupabaseCircuits({ activeOnly: true })
}

export async function getAllSupabaseCircuits(): Promise<SupabaseCircuitsResult> {
  return getSupabaseCircuits({ activeOnly: false })
}
