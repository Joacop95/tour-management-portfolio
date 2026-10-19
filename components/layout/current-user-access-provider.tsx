"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

import {
  emptyCurrentUserAccess,
  getCurrentUserAccess,
  type CurrentUserAccessResult,
} from "@/lib/auth/current-user-access"
import { getAccessRefreshDisposition } from "@/lib/auth/current-user-access-refresh"
import { permissionsUpdatedEvent } from "@/lib/auth/permission-source"
import {
  getCurrentSupabaseSession,
  onSupabaseAuthStateChange,
} from "@/lib/auth/supabase-auth"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type CurrentUserAccessContextValue = {
  access: CurrentUserAccessResult
  isInitialLoading: boolean
  isRefreshing: boolean
  refresh: () => Promise<CurrentUserAccessResult | null>
}

const CurrentUserAccessContext = createContext<CurrentUserAccessContextValue | null>(null)

export function CurrentUserAccessProvider({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState(emptyCurrentUserAccess)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const mountedRef = useRef(true)
  const loadedUserIdRef = useRef<string | null>(null)
  const requestIdRef = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current
    const expectedUserId = loadedUserIdRef.current
    setIsRefreshing(true)
    let nextAccess: CurrentUserAccessResult

    try {
      nextAccess = await getCurrentUserAccess()
    } catch {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setAccess(emptyCurrentUserAccess)
        setIsInitialLoading(false)
        setIsRefreshing(false)
      }
      return null
    }

    if (!mountedRef.current) return null

    const activeSession = await getCurrentSupabaseSession()

    if (!mountedRef.current) return null

    const disposition = getAccessRefreshDisposition({
      requestId,
      latestRequestId: requestIdRef.current,
      expectedUserId,
      activeSessionUserId: activeSession?.user.id ?? null,
      refreshedUserId: nextAccess.userId,
    })

    if (disposition === "reject") {
      if (requestId === requestIdRef.current) {
        setAccess(emptyCurrentUserAccess)
        setIsInitialLoading(false)
        setIsRefreshing(false)
      }
      return null
    }

    // A newer same-user refresh owns provider state, but this caller may still
    // use its session-verified result (for example immediately after sign-in).
    if (disposition === "return-only") return nextAccess

    loadedUserIdRef.current = nextAccess.userId
    setAccess(nextAccess)
    setIsInitialLoading(false)
    setIsRefreshing(false)
    return nextAccess
  }, [])

  useEffect(() => {
    mountedRef.current = true

    if (!getSupabaseBrowserClient()) {
      Promise.resolve().then(() => {
        if (mountedRef.current) setIsInitialLoading(false)
      })
      return () => {
        mountedRef.current = false
        requestIdRef.current += 1
      }
    }

    const unsubscribe = onSupabaseAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null

      if (!nextUserId || event === "SIGNED_OUT") {
        requestIdRef.current += 1
        loadedUserIdRef.current = null
        setAccess(emptyCurrentUserAccess)
        setIsInitialLoading(false)
        setIsRefreshing(false)
        return
      }

      if (nextUserId !== loadedUserIdRef.current) {
        requestIdRef.current += 1
        loadedUserIdRef.current = nextUserId
        setAccess(emptyCurrentUserAccess)
        setIsInitialLoading(true)
      }

      // Supabase Auth callbacks must finish before another Auth query starts.
      // Token refreshes keep the current tree mounted while permissions reload.
      window.setTimeout(() => void refresh(), 0)
    })
    const handlePermissionsUpdated = () => void refresh()
    const handleWindowFocus = () => void refresh()
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    window.addEventListener(permissionsUpdatedEvent, handlePermissionsUpdated)
    window.addEventListener("focus", handleWindowFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      mountedRef.current = false
      requestIdRef.current += 1
      unsubscribe()
      window.removeEventListener(permissionsUpdatedEvent, handlePermissionsUpdated)
      window.removeEventListener("focus", handleWindowFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [refresh])

  return (
    <CurrentUserAccessContext.Provider
      value={{ access, isInitialLoading, isRefreshing, refresh }}
    >
      {children}
    </CurrentUserAccessContext.Provider>
  )
}

export function useCurrentUserAccess() {
  const context = useContext(CurrentUserAccessContext)

  if (!context) {
    throw new Error("useCurrentUserAccess must be used inside CurrentUserAccessProvider.")
  }

  return context
}
