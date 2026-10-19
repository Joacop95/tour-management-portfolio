import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export type AssignmentNotificationEvent =
  | "confirmation_request"
  | "group_information"

export type AssignmentNotificationStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "blocked"

export type AssignmentNotificationStatusRow = {
  eventType: string
  status: AssignmentNotificationStatus
  createdAt: string
  sentAt: string | null
  failedAt: string | null
  lastErrorSafe: string | null
}

export type AssignmentNotificationHistoryRow = AssignmentNotificationStatusRow & {
  recipientEmail: string | null
  isManual: boolean
}

type StatusRpcRow = {
  event_type: string
  status: AssignmentNotificationStatus
  created_at: string
  sent_at: string | null
  failed_at: string | null
  last_error_safe: string | null
}

type EnqueueRpcRow = {
  success: boolean
  code: string
  message: string
  outbox_id: string | null
  status: AssignmentNotificationStatus | null
}

type HistoryRpcRow = StatusRpcRow & {
  recipient_email: string | null
  is_manual: boolean
}

const unavailableMessage =
  "Guide communication is temporarily unavailable. Please try again."

export async function enqueueManualAssignmentNotification({
  eventType,
  groupId,
}: {
  eventType: AssignmentNotificationEvent
  groupId: string
}) {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) return { error: unavailableMessage, message: null, status: null }

  const { data, error } = await supabase.rpc(
    "enqueue_manual_assignment_notification",
    {
      p_group_id: groupId,
      p_event_type: eventType,
    }
  )

  if (error) return { error: unavailableMessage, message: null, status: null }

  const row = (Array.isArray(data) ? data[0] : data) as EnqueueRpcRow | null

  if (!row?.success) {
    return {
      error: row?.message || unavailableMessage,
      message: null,
      status: row?.status ?? null,
    }
  }

  return { error: null, message: row.message, status: row.status }
}

export async function getGroupAssignmentNotificationStatus(groupId: string) {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return { data: [] as AssignmentNotificationStatusRow[], error: unavailableMessage }
  }

  const { data, error } = await supabase.rpc(
    "get_group_assignment_notification_status",
    { p_group_id: groupId }
  )

  if (error) {
    return { data: [] as AssignmentNotificationStatusRow[], error: unavailableMessage }
  }

  return {
    data: ((data ?? []) as StatusRpcRow[]).map((row) => ({
      eventType: row.event_type,
      status: row.status,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      failedAt: row.failed_at,
      lastErrorSafe: row.last_error_safe,
    })),
    error: null,
  }
}

export async function getGroupAssignmentNotificationHistory(groupId: string) {
  const supabase = getSupabaseBrowserClient()

  if (!supabase) {
    return { data: [] as AssignmentNotificationHistoryRow[], error: unavailableMessage }
  }

  const { data, error } = await supabase.rpc(
    "get_group_assignment_notification_history",
    { p_group_id: groupId }
  )

  if (error) {
    return { data: [] as AssignmentNotificationHistoryRow[], error: unavailableMessage }
  }

  return {
    data: ((data ?? []) as HistoryRpcRow[]).map((row) => ({
      eventType: row.event_type,
      recipientEmail: row.recipient_email,
      status: row.status,
      isManual: row.is_manual,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      failedAt: row.failed_at,
      lastErrorSafe: row.last_error_safe,
    })),
    error: null,
  }
}
