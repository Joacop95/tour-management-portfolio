"use client"

import { useSyncExternalStore } from "react"

import type { PermissionSource } from "@/lib/auth/permission-source"
import type { GuidePortalSource } from "@/lib/auth/guide-portal-source"
import type { AuthRequiredMode } from "@/lib/auth/auth-required-mode"
import type { AppLanguage, RoleKey } from "@/lib/types/settings"
import { isDevToolsEnabled } from "@/lib/auth/runtime-mode"
import {
  localStorageKeys,
  subscribeToLocalStorage,
  writeLocalStorageValue,
} from "@/lib/utils/local-storage"
import {
  getDefaultAppSettings,
  getDefaultPermissionSource,
  getDefaultPreviewRole,
  getDefaultAuthRequiredMode,
  getDefaultGuidePortalSource,
  getStoredPreviewGuideId,
  getStoredAppSettings,
  getStoredAuthRequiredMode,
  getStoredGuidePortalSource,
  getStoredPermissionSource,
  getStoredPreviewRole,
  getStoredUiLanguage,
  getDefaultUiLanguage,
} from "@/lib/utils/settings-access"

export function useAppSettings() {
  return useSyncExternalStore(
    subscribeToLocalStorage,
    getStoredAppSettings,
    getDefaultAppSettings
  )
}

export function useUiLanguage() {
  return useSyncExternalStore(
    subscribeToLocalStorage,
    getStoredUiLanguage,
    getDefaultUiLanguage
  )
}

export function saveUiLanguage(language: AppLanguage) {
  writeLocalStorageValue(localStorageKeys.uiLanguage, language)
}

export function usePreviewRole() {
  return useSyncExternalStore(
    subscribeToLocalStorage,
    getStoredPreviewRole,
    getDefaultPreviewRole
  )
}

export function savePreviewRole(role: RoleKey) {
  if (!isDevToolsEnabled) return
  writeLocalStorageValue(localStorageKeys.previewRole, role)
}

export function usePermissionSource() {
  return useSyncExternalStore(
    subscribeToLocalStorage,
    getStoredPermissionSource,
    getDefaultPermissionSource
  )
}

export function savePermissionSource(source: PermissionSource) {
  if (!isDevToolsEnabled) return
  writeLocalStorageValue(localStorageKeys.permissionSource, source)
}

export function useAuthRequiredMode() {
  return useSyncExternalStore(
    subscribeToLocalStorage,
    getStoredAuthRequiredMode,
    getDefaultAuthRequiredMode
  )
}

export function saveAuthRequiredMode(mode: AuthRequiredMode) {
  if (!isDevToolsEnabled) return
  writeLocalStorageValue(localStorageKeys.authRequiredMode, mode)
}

export function useGuidePortalSource() {
  return useSyncExternalStore(
    subscribeToLocalStorage,
    getStoredGuidePortalSource,
    getDefaultGuidePortalSource
  )
}

export function saveGuidePortalSource(source: GuidePortalSource) {
  if (!isDevToolsEnabled) return
  writeLocalStorageValue(localStorageKeys.guidePortalSource, source)
}

export function usePreviewGuideId() {
  return useSyncExternalStore(
    subscribeToLocalStorage,
    getStoredPreviewGuideId,
    () => ""
  )
}

export function savePreviewGuideId(guideId: string) {
  if (!isDevToolsEnabled) return
  writeLocalStorageValue(localStorageKeys.previewGuideId, guideId)
}

export function useIsHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}
