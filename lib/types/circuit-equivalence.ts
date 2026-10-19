export type CircuitAliasMatchStatus =
  | "matched"
  | "unknown-circuit"
  | "duplicate-alias-conflict"

export type CircuitAliasResolution = {
  status: CircuitAliasMatchStatus
  appCircuitId: string | null
  appCircuitName: string
  note: string
}
