"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Map, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useSyncExternalStore } from "react"

import { useCurrentUserAccess } from "@/components/layout/current-user-access-provider"
import { useI18n } from "@/components/i18n/i18n-provider"

import {
  useAppSettings,
  usePermissionSource,
  usePreviewRole,
} from "@/components/settings/settings-client-store"
import { Button } from "@/components/ui/button"
import {
  permissionKeysAllowModule,
  resolveActivePermissionKeys,
} from "@/lib/auth/permission-source"
import { navigationItems } from "@/lib/mock-data/dashboard"
import { isDevToolsEnabled } from "@/lib/auth/runtime-mode"
import type { NavItem } from "@/lib/types/dashboard"
import { cn } from "@/lib/utils"
import {
  localStorageKeys,
  readLocalStorageValue,
  subscribeToLocalStorage,
  writeLocalStorageValue,
} from "@/lib/utils/local-storage"

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/"
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function useSidebarCollapsed() {
  return useSyncExternalStore(
    subscribeToLocalStorage,
    () => readLocalStorageValue(localStorageKeys.sidebarCollapsed, false),
    () => false
  )
}

function useVisibleNavigationItems() {
  const appSettings = useAppSettings()
  const previewRole = usePreviewRole()
  const permissionSource = usePermissionSource()
  const { access: authAccess, isInitialLoading: isLoadingAuthAccess } =
    useCurrentUserAccess()
  const activePermissionResolution = resolveActivePermissionKeys({
    permissionSource,
    appSettings,
    previewRole,
    authAccess,
  })

  if (isLoadingAuthAccess) {
    return []
  }

  return navigationItems.filter((item) =>
    permissionKeysAllowModule(
      activePermissionResolution.activePermissionKeys,
      item.moduleKey
    )
  )
}

function NavigationButton({
  item,
  size,
  className,
  collapsed = false,
}: {
  item: NavItem
  size?: "default" | "sm"
  className?: string
  collapsed?: boolean
}) {
  const { t } = useI18n()
  const pathname = usePathname()
  const Icon = item.icon
  const isActive = isActiveRoute(pathname, item.href)

  return (
    <Button
      asChild
      variant={isActive ? "secondary" : "ghost"}
      size={size}
      className={cn(
        className,
        isActive &&
          "bg-revival-primary/10 font-medium text-foreground shadow-sm ring-1 ring-revival-primary/25 hover:bg-revival-primary/16"
      )}
    >
      <Link
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        title={collapsed ? t(`navigation.${item.moduleKey.replaceAll("-", "_")}` as Parameters<typeof t>[0]) : undefined}
      >
        <Icon className="size-4" />
        <span className={collapsed ? "sr-only" : undefined}>
          {t(`navigation.${item.moduleKey.replaceAll("-", "_")}` as Parameters<typeof t>[0])}
        </span>
      </Link>
    </Button>
  )
}

export function AppSidebar() {
  const { t } = useI18n()
  const previewRole = usePreviewRole()
  const visibleItems = useVisibleNavigationItems()
  const isCollapsed = useSidebarCollapsed()

  function toggleCollapsed() {
    writeLocalStorageValue(localStorageKeys.sidebarCollapsed, !isCollapsed)
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r border-sidebar-border/80 bg-sidebar py-5 text-sidebar-foreground transition-[width,padding] duration-200 lg:block",
        isCollapsed ? "w-[4.5rem] px-2" : "w-64 px-4"
      )}
    >
      <div
        className={cn(
          "mb-8 flex items-center",
          isCollapsed ? "justify-center" : "gap-3 px-2"
        )}
      >
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/20">
          <Map className="size-4" />
        </div>
        <div className={isCollapsed ? "sr-only" : undefined}>
          <p className="text-sm font-semibold">{t("navigation.tour_ops")}</p>
          <p className="text-xs text-muted-foreground">
            {isDevToolsEnabled && previewRole === "guide"
              ? t("navigation.guide_portal")
              : t("navigation.admin_console")}
          </p>
        </div>
      </div>

      <nav className="space-y-1">
        {visibleItems.map((item) => (
          <NavigationButton
            key={item.href}
            item={item}
            collapsed={isCollapsed}
            className={cn(
              "w-full",
              isCollapsed ? "justify-center px-0" : "justify-start"
            )}
          />
        ))}
      </nav>
      <div className="mt-6 border-t border-sidebar-border/80 pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleCollapsed}
          title={isCollapsed ? t("navigation.expand_sidebar") : t("navigation.collapse_sidebar")}
          className={cn(
            "w-full",
            isCollapsed ? "justify-center px-0" : "justify-start"
          )}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
          <span className={isCollapsed ? "sr-only" : undefined}>
            {isCollapsed ? t("navigation.expand_sidebar") : t("navigation.collapse_sidebar")}
          </span>
        </Button>
      </div>
    </aside>
  )
}

export function MobileNavigation() {
  const visibleItems = useVisibleNavigationItems()

  return (
    <div className="border-b bg-background px-4 py-2 lg:hidden">
      <nav className="flex gap-2 overflow-x-auto pb-1">
        {visibleItems.map((item) => (
          <NavigationButton
            key={item.href}
            item={item}
            size="sm"
            className="shrink-0"
          />
        ))}
      </nav>
    </div>
  )
}
