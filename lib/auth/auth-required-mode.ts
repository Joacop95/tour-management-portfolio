export const authRequiredModeOptions = ["enabled", "disabled"] as const

export type AuthRequiredMode = (typeof authRequiredModeOptions)[number]

export const defaultAuthRequiredMode: AuthRequiredMode = "disabled"

export function isAuthRequiredMode(value: unknown): value is AuthRequiredMode {
  return authRequiredModeOptions.includes(value as AuthRequiredMode)
}

export function isAuthRequiredEnabled(mode: AuthRequiredMode) {
  return mode === "enabled"
}
