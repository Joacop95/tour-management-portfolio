import { ImportExportModule } from "@/components/import-export/import-export-module"
import { AdminShell } from "@/components/layout/admin-shell"
export default function ImportExportPage() {
  return (
    <AdminShell
      titleKey="import_export.page.title"
      descriptionKey="import_export.page.description"
    >
      <ImportExportModule />
    </AdminShell>
  )
}
