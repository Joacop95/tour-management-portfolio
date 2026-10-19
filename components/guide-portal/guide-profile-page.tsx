"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import { useState } from "react"
import { Mail, Phone, Repeat } from "lucide-react"

import { GuideChangeRequestDialog } from "@/components/guide-portal/guide-change-request-dialog"
import { useGuidePortalData } from "@/components/guide-portal/guide-portal-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { normalizeSpokenLanguages } from "@/lib/utils/language-options"

export function GuideProfilePage() {
  const { t } = useI18n()
  const {
    circuits,
    groups,
    guidePortalAuthStatus,
    guidePortalSource,
    refreshGuidePortalData,
    selectedGuide,
  } = useGuidePortalData()
  const [requestOpen, setRequestOpen] = useState(false)

  if (!selectedGuide) {
    return null
  }

  function getCircuitName(circuitId: string) {
    return circuits.find((circuit) => circuit.id === circuitId)?.name ?? circuitId
  }

  const spokenLanguages = normalizeSpokenLanguages(
    selectedGuide.languages,
    selectedGuide.preferredLanguage
  )
  const canCreateRequest =
    guidePortalSource === "auth" && guidePortalAuthStatus === "ready"

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{selectedGuide.name}</CardTitle>
              <CardDescription>
                <T i18nKey="guide_portal.guide_profile.your_contact_details_languages_and_account_status" />
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canCreateRequest}
              title={
                canCreateRequest
                  ? t("guide_portal.profile.request_update_title")
                  : guidePortalSource === "preview"
                    ? t("guide_portal.assignment.preview_read_only")
                    : t("guide_portal.request.sign_in_hint")
              }
              onClick={() => setRequestOpen(true)}
            >
              <Repeat />
              <T i18nKey="guide_portal.guide_profile.request_profile_change" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border p-3">
              <div className="text-xs font-medium text-muted-foreground">
                <T i18nKey="guide_portal.guide_profile.authorized_email" />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" />
                {selectedGuide.email}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs font-medium text-muted-foreground">
                <T i18nKey="guide_portal.guide_profile.phone_whatsapp" />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" />
                {selectedGuide.phone ?? t("guide_portal.profile.no_phone")}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs font-medium text-muted-foreground">
                <T i18nKey="guide_portal.guide_profile.preferred_language" />
              </div>
              <div className="mt-1">{selectedGuide.preferredLanguage || "—"}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs font-medium text-muted-foreground">
                <T i18nKey="guide_portal.guide_profile.spoken_languages" />
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {spokenLanguages.map((language) => (
                  <Badge key={language} variant="outline">
                    {language}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs font-medium text-muted-foreground">
                <T i18nKey="common.status" />
              </div>
              <div className="mt-1 capitalize">
                {selectedGuide.status.replaceAll("-", " ")}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle><T i18nKey="guide_portal.guide_profile.circuit_capabilities" /></CardTitle>
          <CardDescription><T i18nKey="guide_portal.guide_profile.circuits_listed_for_this_guide" /></CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {selectedGuide.circuitIds.length > 0 ? (
            selectedGuide.circuitIds.map((circuitId) => (
              <Badge key={circuitId} variant="outline">
                {getCircuitName(circuitId)}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              <T i18nKey="guide_portal.guide_profile.no_circuit_capabilities_are_listed" />
            </p>
          )}
        </CardContent>
      </Card>
      {requestOpen ? (
        <GuideChangeRequestDialog
          open={requestOpen}
          onOpenChange={setRequestOpen}
          groups={groups}
          guidePortalSource={guidePortalSource}
          guidePortalAuthStatus={guidePortalAuthStatus}
          defaultRequestType="profile_change"
          onCreated={refreshGuidePortalData}
        />
      ) : null}
    </div>
  )
}
