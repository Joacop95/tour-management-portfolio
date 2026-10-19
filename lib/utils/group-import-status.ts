export type GroupImportStatus = "active" | "cxl" | "fusionado"

export function getGroupImportStatus(guideValue: string): GroupImportStatus {
  const normalized = guideValue.trim().toLocaleLowerCase()

  if (normalized === "cxl") return "cxl"
  if (normalized === "fusionado") return "fusionado"
  return "active"
}
