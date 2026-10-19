"use client"

import { T, useI18n } from "@/components/i18n/i18n-provider"
import type { UiTranslationKey } from "@/lib/i18n/ui-catalog"
import { FormEvent, useMemo, useState } from "react"

import {
  MultiSelect,
  type MultiSelectOption,
} from "@/components/common/multi-select"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { isDevToolsEnabled } from "@/lib/auth/runtime-mode"
import type {
  Circuit,
  Guide,
  GuideAuthorizedEmail,
  GuideAuthorizedEmailStatus,
  GuideStatus,
} from "@/lib/types/domain"
import { normalizeSpokenLanguages } from "@/lib/utils/language-options"

type GuideFormDialogProps = {
  open: boolean
  mode: "create" | "edit"
  guide: Guide | null
  circuits: Circuit[]
  existingGuides: Guide[]
  onOpenChange: (open: boolean) => void
  onSaveGuide: (guide: Guide) => Promise<string | null> | string | null
  readOnly?: boolean
  currentAuthorizedLoginEmailEnabled?: boolean
  onSaveCurrentAuthorizedLoginEmail?: (input: {
    email: string
    status: Exclude<GuideAuthorizedEmailStatus, "revoked">
    notes: string | null
  }) => Promise<string | null> | string | null
  helperText?: string
}

type FormValues = {
  name: string
  email: string
  phone: string
  preferredLanguage: string
  spokenLanguages: string[]
  status: GuideStatus | ""
  circuitIds: string[]
  internalNotes: string
  authorizedLoginStatus: Exclude<GuideAuthorizedEmailStatus, "revoked">
  authorizedLoginNotes: string
}

type FormErrors = Partial<Record<keyof FormValues, string>>

const noLanguageValue = "__no-language"

const defaultFormValues: FormValues = {
  name: "",
  email: "",
  phone: "",
  preferredLanguage: noLanguageValue,
  spokenLanguages: [],
  status: "pending-invitation",
  circuitIds: [],
  internalNotes: "",
  authorizedLoginStatus: "allowed",
  authorizedLoginNotes: "",
}

const guideStatusOptions: { value: GuideStatus; labelKey: UiTranslationKey }[] = [
  { value: "pending-invitation", labelKey: "status.pending_invitation" },
  { value: "invited", labelKey: "status.invited" },
  { value: "active", labelKey: "status.active" },
  { value: "inactive", labelKey: "status.inactive" },
  { value: "blocked", labelKey: "status.blocked" },
]

const languageOptions = ["ES", "EN", "FR", "TR"]

const authorizedLoginStatusOptions: {
  value: Exclude<GuideAuthorizedEmailStatus, "revoked">
  labelKey: UiTranslationKey
}[] = [
  { value: "allowed", labelKey: "status.allowed" },
  { value: "invited", labelKey: "status.invited" },
  { value: "registered", labelKey: "status.registered" },
]

type CurrentAuthorizedLoginEmail = GuideAuthorizedEmail & {
  status: Exclude<GuideAuthorizedEmailStatus, "revoked">
}

function isCurrentAuthorizedLoginEmail(
  authorizedEmail: GuideAuthorizedEmail
): authorizedEmail is CurrentAuthorizedLoginEmail {
  return authorizedEmail.status !== "revoked"
}

function getCurrentAuthorizedLoginEmail(guide: Guide | null) {
  return [...(guide?.authorizedEmails ?? [])]
    .reverse()
    .find(isCurrentAuthorizedLoginEmail)
}

function getInitialValues(guide: Guide | null): FormValues {
  if (!guide) {
    return defaultFormValues
  }

  const currentAuthorizedLoginEmail = getCurrentAuthorizedLoginEmail(guide)

  return {
    name: guide.name,
    email: currentAuthorizedLoginEmail?.email ?? guide.email,
    phone: guide.phone ?? "",
    preferredLanguage: guide.preferredLanguage || noLanguageValue,
    spokenLanguages: normalizeSpokenLanguages(
      guide.languages,
      guide.preferredLanguage
    ),
    status: guide.status,
    circuitIds: guide.circuitIds,
    internalNotes: guide.internalNotes ?? "",
    authorizedLoginStatus:
      currentAuthorizedLoginEmail?.status ??
      (guide.status === "invited" ? "invited" : "allowed"),
    authorizedLoginNotes: currentAuthorizedLoginEmail?.notes ?? "",
  }
}

function buildGuideId(name: string, email: string) {
  const source = name.trim() || email.trim()
  const normalized = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  return `manual-guide-${normalized}-${Date.now()}`
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function GuideFormDialog({
  open,
  mode,
  guide,
  circuits,
  existingGuides,
  onOpenChange,
  onSaveGuide,
  readOnly = false,
  currentAuthorizedLoginEmailEnabled = false,
  onSaveCurrentAuthorizedLoginEmail,
  helperText,
}: GuideFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <GuideForm
          key={guide?.id ?? "create-guide"}
          mode={mode}
          guide={guide}
          circuits={circuits}
          existingGuides={existingGuides}
          onCancel={() => onOpenChange(false)}
          onSaveGuide={onSaveGuide}
          readOnly={readOnly}
          currentAuthorizedLoginEmailEnabled={currentAuthorizedLoginEmailEnabled}
          onSaveCurrentAuthorizedLoginEmail={onSaveCurrentAuthorizedLoginEmail}
          helperText={helperText}
        />
      ) : null}
    </Dialog>
  )
}

type GuideFormProps = {
  mode: "create" | "edit"
  guide: Guide | null
  circuits: Circuit[]
  existingGuides: Guide[]
  onCancel: () => void
  onSaveGuide: (guide: Guide) => Promise<string | null> | string | null
  readOnly: boolean
  currentAuthorizedLoginEmailEnabled: boolean
  onSaveCurrentAuthorizedLoginEmail?: (input: {
    email: string
    status: Exclude<GuideAuthorizedEmailStatus, "revoked">
    notes: string | null
  }) => Promise<string | null> | string | null
  helperText?: string
}

function GuideForm({
  mode,
  guide,
  circuits,
  existingGuides,
  onCancel,
  onSaveGuide,
  readOnly,
  currentAuthorizedLoginEmailEnabled,
  onSaveCurrentAuthorizedLoginEmail,
  helperText,
}: GuideFormProps) {
  const { t } = useI18n()
  const [values, setValues] = useState<FormValues>(() =>
    getInitialValues(guide)
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const circuitOptions: MultiSelectOption[] = circuits.map((circuit) => ({
    value: circuit.id,
    label: circuit.name,
  }))
  const existingEmails = useMemo(
    () =>
      new Map(
        existingGuides.map((existingGuide) => [
          existingGuide.email.toLowerCase(),
          existingGuide.id,
        ])
      ),
    [existingGuides]
  )

  function updateValue<Key extends keyof FormValues>(
    key: Key,
    value: FormValues[Key]
  ) {
    setValues((currentValues) => ({ ...currentValues, [key]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [key]: undefined }))
    setSubmitError(null)
  }

  function updatePreferredLanguage(preferredLanguage: string) {
    const normalizedPreferredLanguage =
      preferredLanguage === noLanguageValue ? "" : preferredLanguage

    setValues((currentValues) => ({
      ...currentValues,
      preferredLanguage,
      spokenLanguages: normalizeSpokenLanguages(
        currentValues.spokenLanguages,
        normalizedPreferredLanguage
      ),
    }))
    setErrors((currentErrors) => ({
      ...currentErrors,
      preferredLanguage: undefined,
    }))
    setSubmitError(null)
  }

  function validateForm() {
    const nextErrors: FormErrors = {}
    const normalizedEmail = values.email.trim().toLowerCase()
    const duplicateGuideId = existingEmails.get(normalizedEmail)

    if (!values.name.trim()) {
      nextErrors.name = "Full name is required."
    }

    if (!values.email.trim()) {
      nextErrors.email = "Authorized email is required."
    } else if (!isValidEmail(values.email.trim())) {
      nextErrors.email = "Enter a valid email address."
    } else if (duplicateGuideId && duplicateGuideId !== guide?.id) {
      nextErrors.email = "This authorized email already exists."
    }

    if (!values.status) {
      nextErrors.status = "Status is required."
    }

    setErrors(nextErrors)

    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)

    if (readOnly) {
      return
    }

    if (!validateForm()) {
      return
    }

    const preferredLanguage =
      values.preferredLanguage === noLanguageValue
        ? ""
        : values.preferredLanguage
    const savedGuide: Guide = {
      id: guide?.id ?? buildGuideId(values.name, values.email),
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim() || null,
      languages: normalizeSpokenLanguages(
        values.spokenLanguages,
        preferredLanguage
      ),
      preferredLanguage,
      circuitIds: values.circuitIds,
      status: values.status as GuideStatus,
      internalNotes: values.internalNotes.trim() || undefined,
      changeRequestsCount: guide?.changeRequestsCount ?? 0,
      completedChangeRequestsCount: guide?.completedChangeRequestsCount ?? 0,
      rejectedChangeRequestsCount: guide?.rejectedChangeRequestsCount ?? 0,
      pendingChangeRequestsCount: guide?.pendingChangeRequestsCount ?? 0,
      internalRating: guide?.internalRating ?? null,
      salesRanking: guide?.salesRanking ?? null,
      salesScore: guide?.salesScore ?? null,
      authorizedEmails: guide?.authorizedEmails ?? [],
    }

    setIsSubmitting(true)

    const saveError = await Promise.resolve(onSaveGuide(savedGuide)).catch(
      (error: unknown) =>
        error instanceof Error ? error.message : "Guide save failed."
    )

    if (saveError) {
      setIsSubmitting(false)
      setSubmitError(saveError)
      return
    }

    if (currentAuthorizedLoginEmailEnabled && onSaveCurrentAuthorizedLoginEmail) {
      const authorizedEmailError = await Promise.resolve(
        onSaveCurrentAuthorizedLoginEmail({
          email: values.email,
          status: values.authorizedLoginStatus,
          notes: values.authorizedLoginNotes.trim() || null,
        })
      ).catch((error: unknown) =>
        error instanceof Error
          ? error.message
          : "Authorized login email save failed."
      )

      if (authorizedEmailError) {
        setIsSubmitting(false)
        setSubmitError(authorizedEmailError)
        return
      }
    }

    setIsSubmitting(false)
    onCancel()
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? t("guides.form.create")
              : readOnly
                ? t("guides.form.details")
                : t("guides.form.edit")}
          </DialogTitle>
          <DialogDescription
            className={!readOnly && !helperText && !isDevToolsEnabled ? "sr-only" : undefined}
          >
            {readOnly
              ? "Guide details are read-only for your current permissions."
              : helperText || (isDevToolsEnabled
                ? "Guide changes are saved by the active data source for this module."
                : mode === "create"
                  ? t("guides.form.create")
                  : t("guides.form.edit"))}
          </DialogDescription>
        </DialogHeader>

        <fieldset disabled={readOnly} className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="guide-name"><T i18nKey="guides.guide_form_dialog.full_name" /></Label>
            <Input
              id="guide-name"
              value={values.name}
              onChange={(event) => updateValue("name", event.target.value)}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name ? (
              <p className="text-xs text-red-700">{errors.name}</p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="guide-email"><T i18nKey="guides.guide_form_dialog.authorized_login_email" /></Label>
            <Input
              id="guide-email"
              value={values.email}
              onChange={(event) => updateValue("email", event.target.value)}
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email ? (
              <p className="text-xs text-red-700">{errors.email}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              <T i18nKey="guides.guide_form_dialog.this_is_the_only_email_this_guide_can" />
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label><T i18nKey="guides.guide_form_dialog.login_email_status" /></Label>
            <Select
              value={values.authorizedLoginStatus}
              onValueChange={(value) =>
                updateValue(
                  "authorizedLoginStatus",
                  value as Exclude<GuideAuthorizedEmailStatus, "revoked">
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {authorizedLoginStatusOptions
                  .filter(
                    (option) =>
                      option.value !== "registered" ||
                      values.authorizedLoginStatus === "registered"
                  )
                  .map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="guide-phone"><T i18nKey="guides.guide_form_dialog.phone_whatsapp" /></Label>
            <Input
              id="guide-phone"
              value={values.phone}
              onChange={(event) => updateValue("phone", event.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label><T i18nKey="guides.guide_form_dialog.preferred_language" /></Label>
            <Select
              value={values.preferredLanguage}
              onValueChange={updatePreferredLanguage}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={noLanguageValue}><T i18nKey="guides.guide_form_dialog.no_preference" /></SelectItem>
                {languageOptions.map((language) => (
                  <SelectItem key={language} value={language}>
                    {language}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5 md:col-span-2">
            <Label><T i18nKey="guides.guide_form_dialog.spoken_languages" /></Label>
            <MultiSelect
              label={t("guides.guide_form_dialog.label_spoken_language")}
              values={values.spokenLanguages}
              options={languageOptions.map((language) => ({
                value: language,
                label: language,
              }))}
              emptyText={t("guides.guide_form_dialog.empty_text_no_language_found")}
              searchPlaceholder={t("common.search_languages")}
              allText={t("common.all_languages")}
              onValuesChange={(spokenLanguages) =>
                updateValue(
                  "spokenLanguages",
                  normalizeSpokenLanguages(
                    spokenLanguages,
                    values.preferredLanguage === noLanguageValue
                      ? ""
                      : values.preferredLanguage
                  )
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              <T i18nKey="guides.guide_form_dialog.use_spoken_languages_for_assignment_matching_preferred_language" />
            </p>
          </div>

          <div className="grid gap-1.5 md:col-span-2">
            <Label><T i18nKey="common.status" /></Label>
            <Select
              value={values.status}
              onValueChange={(value) =>
                updateValue("status", value as GuideStatus)
              }
            >
              <SelectTrigger
                aria-invalid={Boolean(errors.status)}
                className="w-full"
              >
                <SelectValue placeholder={t("guides.guide_form_dialog.placeholder_select_status")} />
              </SelectTrigger>
              <SelectContent>
                {guideStatusOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {t(status.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.status ? (
              <p className="text-xs text-red-700">{errors.status}</p>
            ) : null}
          </div>

          <div className="grid gap-1.5 md:col-span-2">
            <Label><T i18nKey="guides.guide_form_dialog.circuit_capabilities" /></Label>
            <MultiSelect
              label={t("common.circuit")}
              values={values.circuitIds}
              options={circuitOptions}
              emptyText={t("guides.guide_form_dialog.empty_text_no_circuit_found")}
              searchPlaceholder={t("common.search_circuits")}
              allText={t("common.all_circuits")}
              onValuesChange={(value) => updateValue("circuitIds", value)}
            />
          </div>

          <div className="grid gap-1.5 md:col-span-2">
            <Label htmlFor="guide-internal-notes"><T i18nKey="guides.guide_form_dialog.internal_notes" /></Label>
            <Textarea
              id="guide-internal-notes"
              value={values.internalNotes}
              onChange={(event) =>
                updateValue("internalNotes", event.target.value)
              }
              rows={3}
            />
          </div>

          <div className="grid gap-1.5 md:col-span-2">
            <Label htmlFor="guide-authorized-login-notes">
              <T i18nKey="guides.guide_form_dialog.login_email_notes" />
            </Label>
            <Textarea
              id="guide-authorized-login-notes"
              value={values.authorizedLoginNotes}
              onChange={(event) =>
                updateValue("authorizedLoginNotes", event.target.value)
              }
              rows={2}
            />
          </div>
        </fieldset>

        {guide?.authorizedEmails !== undefined &&
        !getCurrentAuthorizedLoginEmail(guide) ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            <T i18nKey="guides.guide_form_dialog.no_current_login_email_is_active_saving_this" />
          </p>
        ) : null}

        {submitError ? (
          <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {submitError}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            <T i18nKey="common.cancel" />
          </Button>
          {!readOnly ? (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("groups.form.saving") : t("guides.form.save")}
            </Button>
          ) : null}
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
