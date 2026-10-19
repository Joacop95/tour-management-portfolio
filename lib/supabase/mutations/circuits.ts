import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  dedupeCircuitAliases,
  normalizeCircuitValue,
} from "@/lib/utils/circuit-equivalences"

export type SupabaseCircuitMutationInput = {
  name: string
  code: string
  region: string
  notes: string
  isActive: boolean
  aliases: string[]
  planningSortOrder: number | null
}

export type SupabaseCircuitMutationResult = {
  error: string | null
}

type AliasCollisionRow = {
  alias: string
  normalized_alias: string
  circuit_id: string
}

function getSupabaseUnavailableResult(): SupabaseCircuitMutationResult {
  return {
    error: "Supabase environment variables are not configured.",
  }
}

function getFriendlySupabaseError(error: { code?: string; message?: string }) {
  const message = error.message ?? "Supabase write failed."

  if (error.code === "23505" || message.includes("duplicate key")) {
    if (message.includes("circuits_name_key")) {
      return "This official circuit name already exists."
    }

    if (message.includes("circuits_code_key")) {
      return "This circuit code already exists."
    }

    if (message.includes("circuit_aliases_normalized_alias_key")) {
      return "One alias already belongs to another circuit."
    }

    return "This circuit conflicts with an existing circuit or alias."
  }

  return "Unable to save this circuit. Refresh and try again."
}

function prepareAliasRows(aliases: string[]) {
  return dedupeCircuitAliases(aliases)
    .map((alias) => ({
      alias: alias.trim(),
      normalizedAlias: normalizeCircuitValue(alias),
    }))
    .filter((alias) => alias.alias && alias.normalizedAlias)
}

async function getAliasCollision(
  normalizedAliases: string[],
  currentCircuitId?: string
) {
  const supabase = getSupabaseBrowserClient()

  if (!supabase || normalizedAliases.length === 0) {
    return null
  }

  const { data, error } = await supabase
    .from("circuit_aliases")
    .select("alias, normalized_alias, circuit_id")
    .in("normalized_alias", normalizedAliases)
    .returns<AliasCollisionRow[]>()

  if (error) {
    return getFriendlySupabaseError(error)
  }

  const collision = data.find(
    (alias) => alias.circuit_id !== currentCircuitId
  )

  if (!collision) {
    return null
  }

  return `"${collision.alias}" already belongs to another circuit.`
}

export async function createSupabaseCircuit(
  input: SupabaseCircuitMutationInput
): Promise<SupabaseCircuitMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  const aliases = prepareAliasRows(input.aliases)
  const aliasCollision = await getAliasCollision(
    aliases.map((alias) => alias.normalizedAlias)
  )

  if (aliasCollision) {
    return { error: aliasCollision }
  }

  const { data: circuit, error: circuitError } = await supabase
    .from("circuits")
    .insert({
      name: input.name.trim(),
      code: input.code.trim() || null,
      region: input.region.trim() || null,
      notes: input.notes.trim() || null,
      is_active: input.isActive,
      planning_sort_order: input.planningSortOrder,
    })
    .select("id")
    .single()

  if (circuitError) {
    return { error: getFriendlySupabaseError(circuitError) }
  }

  const circuitId =
    typeof circuit?.id === "string" && circuit.id ? circuit.id : null

  if (!circuitId) {
    return { error: "Circuit was created but Supabase did not return an id." }
  }

  if (aliases.length === 0) {
    return { error: null }
  }

  const { error: aliasesError } = await supabase.from("circuit_aliases").insert(
    aliases.map((alias) => ({
      circuit_id: circuitId,
      alias: alias.alias,
      normalized_alias: alias.normalizedAlias,
      is_active: true,
    }))
  )

  if (aliasesError) {
    return { error: getFriendlySupabaseError(aliasesError) }
  }

  return { error: null }
}

export async function updateSupabaseCircuit(
  id: string,
  input: SupabaseCircuitMutationInput
): Promise<SupabaseCircuitMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  const nowIso = new Date().toISOString()
  const aliases = prepareAliasRows(input.aliases)
  const aliasCollision = await getAliasCollision(
    aliases.map((alias) => alias.normalizedAlias),
    id
  )

  if (aliasCollision) {
    return { error: aliasCollision }
  }

  const { error: circuitError } = await supabase
    .from("circuits")
    .update({
      name: input.name.trim(),
      code: input.code.trim() || null,
      region: input.region.trim() || null,
      notes: input.notes.trim() || null,
      is_active: input.isActive,
      planning_sort_order: input.planningSortOrder,
      updated_at: nowIso,
    })
    .eq("id", id)

  if (circuitError) {
    return { error: getFriendlySupabaseError(circuitError) }
  }

  const { error: deactivateAliasesError } = await supabase
    .from("circuit_aliases")
    .update({
      is_active: false,
      updated_at: nowIso,
    })
    .eq("circuit_id", id)
    .eq("is_archived", false)

  if (deactivateAliasesError) {
    return { error: getFriendlySupabaseError(deactivateAliasesError) }
  }

  if (aliases.length === 0) {
    return { error: null }
  }

  const { error: aliasesError } = await supabase
    .from("circuit_aliases")
    .upsert(
      aliases.map((alias) => ({
        circuit_id: id,
        alias: alias.alias,
        normalized_alias: alias.normalizedAlias,
        is_active: true,
        is_archived: false,
        updated_at: nowIso,
      })),
      { onConflict: "normalized_alias" }
    )

  if (aliasesError) {
    return { error: getFriendlySupabaseError(aliasesError) }
  }

  return { error: null }
}

export async function deactivateSupabaseCircuit(
  id: string
): Promise<SupabaseCircuitMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  const { error } = await supabase
    .from("circuits")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) {
    return { error: getFriendlySupabaseError(error) }
  }

  return { error: null }
}

export async function reactivateSupabaseCircuit(
  id: string
): Promise<SupabaseCircuitMutationResult> {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return getSupabaseUnavailableResult()
  }

  const { error } = await supabase
    .from("circuits")
    .update({
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) {
    return { error: getFriendlySupabaseError(error) }
  }

  return { error: null }
}
