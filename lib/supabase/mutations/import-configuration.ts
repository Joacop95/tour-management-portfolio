import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export async function saveGroupCodeCircuitMapping(input: { prefix: string; circuitId: string | null; circuitName: string; isActive: boolean }) {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return { error: "Supabase is unavailable." }
  const { error } = await supabase.from("group_code_circuit_mappings").upsert({
    prefix: input.prefix.trim(), circuit_id: input.circuitId,
    configured_circuit_name: input.circuitName.trim(), is_active: input.isActive,
    updated_at: new Date().toISOString(),
  }, { onConflict: "prefix" })
  return { error: error?.message ?? null }
}

export async function deactivateGroupCodeCircuitMapping(prefix: string) {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return { error: "Supabase is unavailable." }
  const { error } = await supabase.from("group_code_circuit_mappings").update({ is_active: false, updated_at: new Date().toISOString() }).eq("prefix", prefix)
  return { error: error?.message ?? null }
}

export async function updateCircuitDefaultDuration(circuitId: string, days: number | null) {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return { error: "Supabase is unavailable." }
  const { error } = await supabase.from("circuits").update({ default_end_date_offset_days: days, updated_at: new Date().toISOString() }).eq("id", circuitId)
  return { error: error?.message ?? null }
}
