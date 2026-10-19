"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LoaderCircle, LogOut, Map, UserRoundX } from "lucide-react"
import { useEffect, useState } from "react"

import { useGuidePortalData } from "@/components/guide-portal/guide-portal-data"
import { useI18n, T } from "@/components/i18n/i18n-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatePanel } from "@/components/ui/state-panel"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { guidePortalNavigationItems } from "@/lib/mock-data/dashboard"
import { signOutSupabaseUser } from "@/lib/auth/supabase-auth"
import { cn } from "@/lib/utils"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"

type GuidePortalShellProps = {
  titleKey: UiTranslationKey
  descriptionKey: UiTranslationKey
  children: React.ReactNode
}

function isActiveRoute(pathname: string, href: string) {
  if (href === "/guide") {
    return pathname === "/guide"
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function GuidePortalShell({
  titleKey,
  descriptionKey,
  children,
}: GuidePortalShellProps) {
  const pathname = usePathname()
  const { t } = useI18n()
  const router = useRouter()
  const {
    guides,
    selectedGuide,
    selectedGuideId,
    setSelectedGuideId,
    guidePortalSource,
    dataSource,
    dataSourceMessage,
    guidePortalAuthStatus,
    isLoading,
  } = useGuidePortalData()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const canSignOutGuideSession =
    guidePortalSource === "auth" &&
    (guidePortalAuthStatus === "ready" ||
      guidePortalAuthStatus === "no_profile" ||
      guidePortalAuthStatus === "no_guide_linked" ||
      guidePortalAuthStatus === "access_denied" ||
      guidePortalAuthStatus === "error")

  useEffect(() => {
    if (guidePortalSource !== "auth" || isLoading) return

    const next = encodeURIComponent(pathname)
    if (guidePortalAuthStatus === "not_signed_in") {
      router.replace(`/guide/login?next=${next}`)
    } else if (guidePortalAuthStatus === "access_denied") {
      router.replace(`/guide/login?reason=access-revoked&next=${next}`)
    }
  }, [
    guidePortalAuthStatus,
    guidePortalSource,
    isLoading,
    pathname,
    router,
  ])

  async function handleGuideSignOut() {
    setIsSigningOut(true)
    setSignOutError(null)

    try {
      const result = await signOutSupabaseUser()

      if (result.error) {
        setSignOutError(result.error)
        return
      }

      router.replace("/guide/login")
      router.refresh()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <main className="guide-portal min-h-screen bg-muted/40 text-foreground">
      <div className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Map className="size-4" />
            </div>
            <div>
              <p className="font-semibold">{t("guide_portal.brand")}</p>
              <p className="text-sm text-muted-foreground">
                {t("guide_portal.brand_description")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {guidePortalSource === "preview" ? (
              <>
                <Badge variant="outline" className="h-8 rounded-lg px-3">
                  <T i18nKey="layout.guide_portal_shell.development_preview" />
                </Badge>
                <Select
                  value={selectedGuideId}
                  onValueChange={setSelectedGuideId}
                >
                  <SelectTrigger
                    className="h-8 min-w-56"
                    aria-label={t("layout.guide_portal_shell.aria_label_preview_as_guide")}
                  >
                    <SelectValue placeholder={t("layout.guide_portal_shell.aria_label_preview_as_guide")} />
                  </SelectTrigger>
                  <SelectContent>
                    {guides.map((guide) => (
                      <SelectItem key={guide.id} value={guide.id}>
                        {guide.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : null}
            {guidePortalSource === "auth" && guidePortalAuthStatus === "ready" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGuideSignOut}
                disabled={isSigningOut}
              >
                <LogOut />
                {isSigningOut ? t("auth.signing_out") : t("auth.sign_out")}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mx-auto hidden max-w-7xl gap-2 overflow-x-auto px-4 pb-3 md:flex md:px-6">
          {guidePortalNavigationItems.map((item) => {
            const Icon = item.icon
            const isActive = isActiveRoute(pathname, item.href)

            return (
              <Button
                key={item.href}
                asChild
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className={cn("shrink-0", isActive && "font-semibold")}
              >
                <Link href={item.href} aria-current={isActive ? "page" : undefined}>
                  <Icon className="size-4" />
                  {t(
                    item.href === "/guide"
                      ? "guide_portal.navigation.home"
                      : item.href === "/guide/groups"
                        ? "guide_portal.navigation.groups"
                        : item.href === "/guide/availability"
                          ? "guide_portal.navigation.availability"
                          : item.href === "/guide/change-requests"
                            ? "guide_portal.navigation.change_requests"
                            : "guide_portal.navigation.profile"
                  )}
                </Link>
              </Button>
            )
          })}
        </div>
      </div>

      <section className="mx-auto max-w-7xl space-y-5 p-4 pb-24 md:p-6">
        <div>
          <h1 className="text-xl font-semibold">{t(titleKey)}</h1>
          <p className="text-sm text-muted-foreground">{t(descriptionKey)}</p>
        </div>
        {guidePortalSource === "preview" ? (
          <div className="flex flex-col gap-2 rounded-lg border bg-background px-3 py-2 text-sm md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary"><T i18nKey="layout.guide_portal_shell.development_preview" /></Badge>
              <span className="text-muted-foreground">
                {dataSource === "supabase" ? t("guide_portal.shell.supabase_preview") : t("guide_portal.shell.local_preview")} · {dataSourceMessage}
              </span>
            </div>
            <Link href="/dev/guide-portal-auth-check" className="shrink-0 text-primary underline-offset-4 hover:underline">
              <T i18nKey="layout.guide_portal_shell.change_source_mode" />
            </Link>
          </div>
        ) : null}
        {isLoading ||
        (guidePortalSource === "auth" &&
          (guidePortalAuthStatus === "not_signed_in" ||
            guidePortalAuthStatus === "access_denied")) ? (
          <StatePanel
            className="bg-background"
            icon={LoaderCircle}
            title={t("layout.guide_portal_shell.title_loading_your_guide_portal")}
            description={t("layout.guide_portal_shell.description_preparing_your_assigned_groups_and_availability")}
          />
        ) : selectedGuide ? (
          children
        ) : (
          <StatePanel
            className="bg-background"
            icon={UserRoundX}
            title={guidePortalSource === "auth" ? t("guide_portal.shell.access_unavailable") : t("guide_portal.shell.no_preview_guide")}
            description={guidePortalSource === "auth" ? t("guide_portal.shell.access_help") : t("guide_portal.shell.preview_guide_help")}
          >
            {guidePortalSource === "auth" ? (
              <>
                <Button asChild size="sm">
                  <Link href="/guide/login"><T i18nKey="layout.guide_portal_shell.guide_portal_login" /></Link>
                </Button>
                <p className="basis-full text-sm text-muted-foreground">
                  <T i18nKey="layout.guide_portal_shell.new_guide_account" />{" "}
                  <Link
                    href="/guide/register"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    <T i18nKey="layout.guide_portal_shell.register_with_your_authorized_email" />
                  </Link>
                </p>
                {canSignOutGuideSession ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGuideSignOut}
                    disabled={isSigningOut}
                  >
                    {isSigningOut ? t("auth.signing_out") : t("auth.sign_out")}
                  </Button>
                ) : null}
                {signOutError ? (
                  <p className="basis-full text-destructive">{signOutError}</p>
                ) : null}
              </>
            ) : null}
          </StatePanel>
        )}
      </section>

      <nav
        aria-label={t("layout.guide_portal_shell.aria_label_guide_portal_navigation")}
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {guidePortalNavigationItems.map((item) => {
            const Icon = item.icon
            const isActive = isActiveRoute(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] text-muted-foreground",
                  isActive && "bg-primary/10 font-semibold text-foreground"
                )}
              >
                <Icon className="size-4" />
                <span className="max-w-full text-center leading-tight whitespace-normal">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </main>
  )
}
