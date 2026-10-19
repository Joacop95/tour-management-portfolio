export type GuidePortalSource = "preview" | "auth"

export const defaultGuidePortalSource: GuidePortalSource = "auth"

export function isGuidePortalSource(value: unknown): value is GuidePortalSource {
  return value === "preview" || value === "auth"
}
