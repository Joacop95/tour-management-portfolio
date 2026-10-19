"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import Link from "next/link"
import { Repeat } from "lucide-react"
import { useEffect, useState } from "react"
import { useCurrentUserAccess } from "@/components/layout/current-user-access-provider"

import {
  useAppSettings,
  usePermissionSource,
  usePreviewRole,
} from "@/components/settings/settings-client-store"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  hasActivePermission,
  resolveActivePermissionKeys,
} from "@/lib/auth/permission-source"
import {
  getSupabaseChangeRequestCounts,
  type SupabaseChangeRequestCounts,
} from "@/lib/supabase/queries/change-requests"

const emptyCounts: SupabaseChangeRequestCounts = {
  pending: 0,
  in_progress: 0,
  approved: 0,
  rejected: 0,
  completed: 0,
  cancelled: 0,
  totalActive: 0,
}

export function ChangeRequestSummaryCard() {
  const { t } = useI18n()
  const appSettings = useAppSettings()
  const previewRole = usePreviewRole()
  const permissionSource = usePermissionSource()
  const { access: authAccess } = useCurrentUserAccess()
  const [counts, setCounts] = useState<SupabaseChangeRequestCounts>(emptyCounts)
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const activePermissionResolution = resolveActivePermissionKeys({
    permissionSource,
    appSettings,
    previewRole,
    authAccess,
  })
  const canViewChangeRequests = hasActivePermission(
    activePermissionResolution.activePermissionKeys,
    "change_requests.view"
  )

  useEffect(() => {
    let isMounted = true

    async function loadCounts() {
      if (!canViewChangeRequests) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setErrorMessage("")

      const result = await getSupabaseChangeRequestCounts()

      if (!isMounted) {
        return
      }

      setCounts(result.data)
      setErrorMessage(result.error ?? "")
      setIsLoading(false)
    }

    void loadCounts()

    return () => {
      isMounted = false
    }
  }, [canViewChangeRequests])

  if (!canViewChangeRequests) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">
          <T i18nKey="guide_portal.navigation.change_requests" />
        </CardTitle>
        <CardAction>
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/12 text-foreground ring-1 ring-primary/20">
            <Repeat className="size-4" />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">
          {isLoading ? "..." : counts.totalActive}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {errorMessage
            ? t("dashboard.requests.counts_unavailable")
            : t("dashboard.requests.counts_summary", { pending: counts.pending, in_progress: counts.in_progress })}
        </p>
        <Link
          href="/change-requests"
          className="mt-3 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <T i18nKey="dashboard.change_request_summary_card.open_inbox" />
        </Link>
      </CardContent>
    </Card>
  )
}
