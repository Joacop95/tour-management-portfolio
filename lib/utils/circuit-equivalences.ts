import type { Circuit } from "@/lib/types/domain"
import type { CircuitAliasResolution } from "@/lib/types/circuit-equivalence"

export function normalizeCircuitValue(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
}

export function parseCircuitAliases(value: string) {
  return value
    .split(/[\n,]+/)
    .map((alias) => alias.trim())
    .filter(Boolean)
}

export function dedupeCircuitAliases(aliases: string[]) {
  const seen = new Set<string>()

  return aliases.filter((alias) => {
    const normalizedAlias = normalizeCircuitValue(alias)

    if (seen.has(normalizedAlias)) {
      return false
    }

    seen.add(normalizedAlias)
    return true
  })
}

export function findDuplicateAlias(
  aliases: string[],
  circuits: Circuit[],
  excludeCircuitId?: string
) {
  const existingAliases = new Map<
    string,
    { alias: string; circuit: Circuit }
  >()

  circuits
    .filter((circuit) => circuit.id !== excludeCircuitId)
    .forEach((circuit) => {
      const circuitValues = [circuit.name, ...(circuit.aliases ?? [])]

      circuitValues.forEach((alias) => {
        existingAliases.set(normalizeCircuitValue(alias), {
          alias,
          circuit,
        })
      })
    })

  for (const alias of aliases) {
    const duplicate = existingAliases.get(normalizeCircuitValue(alias))

    if (duplicate) {
      return {
        alias,
        existingAlias: duplicate.alias,
        appCircuitName: duplicate.circuit.name,
      }
    }
  }

  return null
}

export function resolveCircuitAlias(
  rawValue: string,
  circuits: Circuit[]
): CircuitAliasResolution {
  const normalizedRawValue = normalizeCircuitValue(rawValue)

  if (!normalizedRawValue) {
    return {
      status: "unknown-circuit",
      appCircuitId: null,
      appCircuitName: "Unknown circuit",
      note: "Missing circuit value.",
    }
  }

  const activeCircuits = circuits.filter((circuit) => circuit.isActive !== false)
  const officialCircuit = activeCircuits.find(
    (circuit) => normalizeCircuitValue(circuit.name) === normalizedRawValue
  )

  const aliasMatches = activeCircuits.filter((circuit) =>
    (circuit.aliases ?? []).some(
      (alias) => normalizeCircuitValue(alias) === normalizedRawValue
    )
  )

  const uniqueCircuitIds = new Set(aliasMatches.map((match) => match.id))

  if (uniqueCircuitIds.size > 1) {
    return {
      status: "duplicate-alias-conflict",
      appCircuitId: null,
      appCircuitName: "Duplicate alias conflict",
      note: "This raw circuit value matches aliases for multiple app circuits.",
    }
  }

  const aliasMatch = aliasMatches[0]

  if (aliasMatch) {
    return {
      status: "matched",
      appCircuitId: aliasMatch.id,
      appCircuitName: aliasMatch.name,
      note: "Matched using aliases configured in Settings > Circuits.",
    }
  }

  if (officialCircuit) {
    return {
      status: "matched",
      appCircuitId: officialCircuit.id,
      appCircuitName: officialCircuit.name,
      note: "Matched official app circuit name.",
    }
  }

  return {
    status: "unknown-circuit",
    appCircuitId: null,
    appCircuitName: "Unknown circuit",
    note: "No active circuit alias or official circuit matched this value.",
  }
}
