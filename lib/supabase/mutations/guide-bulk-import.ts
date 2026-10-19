import {
  createSupabaseGuide,
  updateSupabaseGuide,
  upsertPrimaryGuideAuthorizedEmail,
} from "@/lib/supabase/mutations/guides"
import type { GuideBulkImportPreviewRow } from "@/lib/utils/guide-bulk-import"

export type GuideBulkImportRowResult = {
  rowNumber: number
  action: "created" | "updated" | "skipped" | "failed"
  message: string
  authorizedEmail: {
    created: number
    updated: number
    revoked: number
  }
  circuitCapabilitiesUpdated: number
}

function getAuthorizedEmailStatus(row: GuideBulkImportPreviewRow) {
  return row.status === "invited" ? "invited" : "allowed"
}

function getCircuitUpdateInput(row: GuideBulkImportPreviewRow) {
  const canUpdateCapabilities =
    row.hasCircuitValues && !row.hasUnknownCircuits

  return {
    circuitIds: canUpdateCapabilities ? row.matchedCircuitIds : [],
    replaceCircuitCapabilities: canUpdateCapabilities,
    circuitCapabilitiesUpdated: canUpdateCapabilities
      ? row.matchedCircuitIds.length
      : 0,
  }
}

function getGuideInput(row: GuideBulkImportPreviewRow) {
  const circuitUpdate = getCircuitUpdateInput(row)

  return {
    name: row.fullName,
    authorizedEmail: row.authorizedLoginEmail,
    phone: row.phone || null,
    preferredLanguage: row.preferredLanguage,
    languages: row.spokenLanguages,
    status: row.status,
    circuitIds: circuitUpdate.circuitIds,
    internalNotes: row.internalNotes || undefined,
    authorizedEmailSource: "bulk_import" as const,
    authorizedEmailNotes: "Managed by bulk guide import.",
    replaceCircuitCapabilities: circuitUpdate.replaceCircuitCapabilities,
  }
}

export async function applySupabaseGuideBulkImportRow(
  row: GuideBulkImportPreviewRow
): Promise<GuideBulkImportRowResult> {
  if (row.action === "blocked" || row.state === "error") {
    return {
      rowNumber: row.rowNumber,
      action: "skipped",
      message: "Skipped because this row has validation errors.",
      authorizedEmail: { created: 0, updated: 0, revoked: 0 },
      circuitCapabilitiesUpdated: 0,
    }
  }

  const guideInput = getGuideInput(row)
  const circuitUpdate = getCircuitUpdateInput(row)

  if (!row.existingGuideId) {
    const createResult = await createSupabaseGuide(guideInput)

    if (createResult.error) {
      return {
        rowNumber: row.rowNumber,
        action: "failed",
        message: createResult.error,
        authorizedEmail: { created: 0, updated: 0, revoked: 0 },
        circuitCapabilitiesUpdated: 0,
      }
    }

    return {
      rowNumber: row.rowNumber,
      action: "created",
      message:
        row.hasUnknownCircuits
          ? "Guide and authorized login email created. Unknown circuits were not linked."
          : "Guide, authorized login email, and validated circuit capabilities created.",
      authorizedEmail: { created: 1, updated: 0, revoked: 0 },
      circuitCapabilitiesUpdated: circuitUpdate.circuitCapabilitiesUpdated,
    }
  }

  const updateResult = await updateSupabaseGuide(
    row.existingGuideId,
    guideInput
  )

  if (updateResult.error) {
    return {
      rowNumber: row.rowNumber,
      action: "failed",
      message: updateResult.error,
      authorizedEmail: { created: 0, updated: 0, revoked: 0 },
      circuitCapabilitiesUpdated: 0,
    }
  }

  const emailResult = await upsertPrimaryGuideAuthorizedEmail({
    guideId: row.existingGuideId,
    email: row.authorizedLoginEmail,
    status: getAuthorizedEmailStatus(row),
    notes: "Managed by bulk guide import.",
    source: "bulk_import",
  })

  if (emailResult.error) {
    return {
      rowNumber: row.rowNumber,
      action: "failed",
      message: `Guide fields updated, but authorized login email could not be updated: ${emailResult.error}`,
      authorizedEmail: {
        created: emailResult.created ?? 0,
        updated: emailResult.updated ?? 0,
        revoked: emailResult.revoked ?? 0,
      },
      circuitCapabilitiesUpdated: circuitUpdate.circuitCapabilitiesUpdated,
    }
  }

  return {
    rowNumber: row.rowNumber,
    action: "updated",
    message:
      row.hasCircuitValues && row.hasUnknownCircuits
        ? "Guide and authorized login email updated. Existing circuit capabilities were kept because the CSV contains unknown circuits."
        : row.hasCircuitValues
          ? "Guide, authorized login email, and circuit capabilities updated."
          : "Guide and authorized login email updated. Existing circuit capabilities were kept because circuits were empty.",
    authorizedEmail: {
      created: emailResult.created ?? 0,
      updated: emailResult.updated ?? 0,
      revoked: emailResult.revoked ?? 0,
    },
    circuitCapabilitiesUpdated: circuitUpdate.circuitCapabilitiesUpdated,
  }
}
