import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { readAllPages } from "@/lib/supabase/queries/paginated-read"

export type GroupCodeCircuitMapping = {
  prefix: string
  circuitId: string | null
  configuredCircuitName: string
  isActive: boolean
}

export async function getGroupCodeCircuitMappings() {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return { data: [] as GroupCodeCircuitMapping[], error: "Supabase is unavailable." }
  const { data, error } = await readAllPages((start, end) => supabase
    .from("group_code_circuit_mappings")
    .select("prefix, circuit_id, configured_circuit_name, is_active")
    .order("prefix").range(start, end))
  return {
    data: (data ?? []).map((row) => ({ prefix: row.prefix, circuitId: row.circuit_id, configuredCircuitName: row.configured_circuit_name, isActive: row.is_active })),
    error,
  }
}
