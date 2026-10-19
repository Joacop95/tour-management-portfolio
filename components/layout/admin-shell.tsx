"use client"

import { AdminAuthRequiredGate } from "@/components/layout/admin-auth-required-gate"
import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar, MobileNavigation } from "@/components/layout/app-sidebar"
import { MockAccessGate } from "@/components/layout/mock-access-gate"
import { useI18n } from "@/components/i18n/i18n-provider"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"

type AdminShellProps = {
  titleKey?: UiTranslationKey
  descriptionKey?: UiTranslationKey
  children: React.ReactNode
}

export function AdminShell({
  titleKey = "dashboard.page.title",
  descriptionKey = "dashboard.page.description",
  children,
}: AdminShellProps) {
  const { t } = useI18n()

  return (
    <AdminAuthRequiredGate>
      <main className="min-h-screen bg-background text-foreground">
        <div className="flex min-h-screen">
          <AppSidebar />

          <section className="flex min-w-0 flex-1 flex-col">
            <AppHeader title={t(titleKey)} description={t(descriptionKey)} />
            <MobileNavigation />

            <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-7">
              <MockAccessGate>{children}</MockAccessGate>
            </div>
          </section>
        </div>
      </main>
    </AdminAuthRequiredGate>
  )
}
