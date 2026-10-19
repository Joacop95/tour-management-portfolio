export const localStorageKeys = {
  guides: "tour-guide-operations:guides",
  groups: "tour-guide-operations:groups",
  circuits: "tour-guide-operations:circuits",
  availability: "tour-guide-operations:availability",
  appSettings: "tour-guide-operations:app-settings",
  uiLanguage: "tour-guide-operations:ui-language",
  authRequiredMode: "tour-guide-operations:auth-required-mode",
  previewRole: "tour-guide-operations:preview-role",
  permissionSource: "tour-guide-operations:permission-source",
  guidePortalSource: "tour-guide-operations:guide-portal-source",
  previewGuideId: "tour-guide-operations:preview-guide-id",
  sidebarCollapsed: "tour-guide-operations:sidebar-collapsed",
  guidesTableColumns: "tour-guide-operations:guides-table-columns",
  groupsTableColumns: "tour-guide-operations:groups-table-columns",
  planningZoom: "tour-guide-operations:planning-zoom",
  planningCircuitsExpanded:
    "tour-guide-operations:planning-circuits-expanded",
  planningGuidesExpanded:
    "tour-guide-operations:planning-guides-expanded",
  planningCircuitSort: "tour-guide-operations:planning-circuit-sort",
  planningGuideSort: "tour-guide-operations:planning-guide-sort",
  availabilityRequestExpanded:
    "tour-guide-operations:availability-request-expanded",
  circuitEquivalences: "tour-guide-operations:circuit-equivalences",
} as const

const localStorageChangeEvent = "tour-guide-operations:local-storage-change"
const parsedValueCache = new Map<string, { rawValue: string; value: unknown }>()

export function readLocalStorageValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback
  }

  try {
    const rawValue = window.localStorage.getItem(key)

    if (!rawValue) {
      return fallback
    }

    const cachedValue = parsedValueCache.get(key)

    if (cachedValue?.rawValue === rawValue) {
      return cachedValue.value as T
    }

    const parsedValue = JSON.parse(rawValue) as T
    parsedValueCache.set(key, { rawValue, value: parsedValue })

    return parsedValue
  } catch {
    return fallback
  }
}

export function writeLocalStorageValue<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
  parsedValueCache.delete(key)
  window.dispatchEvent(new CustomEvent(localStorageChangeEvent))
}

export function subscribeToLocalStorage(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {}
  }

  function handleStorageChange() {
    callback()
  }

  window.addEventListener("storage", handleStorageChange)
  window.addEventListener(localStorageChangeEvent, handleStorageChange)

  return () => {
    window.removeEventListener("storage", handleStorageChange)
    window.removeEventListener(localStorageChangeEvent, handleStorageChange)
  }
}
