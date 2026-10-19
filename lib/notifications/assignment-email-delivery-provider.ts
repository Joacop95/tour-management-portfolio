export type AssignmentEmailDeliveryMessage = {
  outboxId: string
  recipientEmail: string
  subject: string
  body: string
}

export type AssignmentEmailDeliveryResult =
  | { delivered: true; providerMessageId?: string }
  | { delivered: false; safeError: string }

export interface AssignmentEmailDeliveryProvider {
  deliver(
    message: AssignmentEmailDeliveryMessage
  ): Promise<AssignmentEmailDeliveryResult>
}

// Deployment must provide this from a secure server-side worker environment.
// Browser code and assignment transactions must never contain provider secrets.
export const assignmentEmailDeliveryProvider: AssignmentEmailDeliveryProvider | null =
  null
