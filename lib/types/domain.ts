export type AssignmentStatus = "without-guide" | "assigned"

export type GroupStatus = "active" | "cxl" | "fusionado" | "finalized"

export type ConfirmationStatus =
  | "not-required"
  | "pending-confirmation"
  | "confirmed"

export type GuideStatus =
  | "pending-invitation"
  | "invited"
  | "active"
  | "inactive"
  | "blocked"

export type GuideAuthorizedEmailStatus =
  | "allowed"
  | "invited"
  | "registered"
  | "revoked"

export type GuideAuthorizedEmailSource =
  | "manual"
  | "bulk_import"
  | "migration"
  | "invitation"

export type GuideAuthorizedEmail = {
  id: string
  guideId: string
  email: string
  normalizedEmail: string
  status: GuideAuthorizedEmailStatus
  source: GuideAuthorizedEmailSource
  notes: string | null
  invitedAt: string | null
  registeredAt: string | null
  revokedAt: string | null
  profileId: string | null
}

export type InternalAuthorizedUserStatus =
  | "allowed"
  | "invited"
  | "registered"
  | "revoked"

export type InternalAuthorizedUserRoleKey =
  | "super-admin"
  | "admin-administrativo"
  | "consulta-interna"

export type InternalAuthorizedUserRole = {
  id: string
  key: InternalAuthorizedUserRoleKey
  name: string
}

export type InternalAuthorizedUser = {
  id: string
  email: string
  normalizedEmail: string
  roleId: string
  roleKey: InternalAuthorizedUserRoleKey
  roleName: string
  status: InternalAuthorizedUserStatus
  profileId: string | null
  notes: string | null
  invitedAt: string | null
  registeredAt: string | null
  revokedAt: string | null
  createdAt: string
  updatedAt: string
}

export type AvailabilityStatus =
  | "available"
  | "not-available"
  | "occupied-by-assignment"
  | "pending-review"

export type AvailabilitySource =
  | "guide-submitted"
  | "admin-updated"
  | "assignment-generated"

export type GuideAvailabilitySubmissionStatus =
  | "draft"
  | "pending-review"
  | "changes-requested"
  | "approved"

export type GuideAvailabilitySubmission = {
  id: string
  guideId: string
  year: number
  status: GuideAvailabilitySubmissionStatus
  submittedAt: string | null
  reviewedAt: string | null
  reviewMessage: string | null
  updatedAt: string
}

export type Circuit = {
  id: string
  code: string
  name: string
  region: string
  aliases?: string[]
  isActive?: boolean
  notes?: string
  createdAtIso?: string
  updatedAtIso?: string
  updatedBy?: string
  defaultEndDateOffsetDays?: number | null
  planningSortOrder?: number | null
}

export type Guide = {
  id: string
  name: string
  email: string
  phone: string | null
  languages: string[]
  preferredLanguage: string
  circuitIds: string[]
  status: GuideStatus
  internalNotes?: string
  changeRequestsCount?: number
  completedChangeRequestsCount?: number
  rejectedChangeRequestsCount?: number
  pendingChangeRequestsCount?: number
  internalRating?: number | null
  salesRanking?: number | null
  salesScore?: number | null
  authorizedEmails?: GuideAuthorizedEmail[]
  birthDateIso?: string | null
  city?: string | null
}

export type TourGroup = {
  id: string
  code: string
  circuitId: string
  startDate: string
  endDate: string
  startDateIso: string
  endDateIso: string
  guideId: string | null
  currentAssignmentId?: string
  updatedAtIso?: string
  groupStatus: GroupStatus
  assignmentStatus: AssignmentStatus
  confirmationStatus: ConfirmationStatus
  requiredLanguage?: string | null
  /** @deprecated Legacy local data shape from before GL-2. */
  language?: string | null
  travelers: number
  internalNotes?: string
}

export type GuideAvailability = {
  id: string
  guideId: string
  startDate: string
  endDate: string
  startDateIso: string
  endDateIso: string
  status: AvailabilityStatus
  source: AvailabilitySource
  notes: string
  assignmentGroupId?: string
  assignmentGroupCode?: string
  assignmentGroupStartDateIso?: string
  assignmentGroupEndDateIso?: string
  assignmentCircuitName?: string
  assignmentCircuitCode?: string
  createdAtIso?: string
  updatedAtIso?: string
  updatedBy?: string
}
