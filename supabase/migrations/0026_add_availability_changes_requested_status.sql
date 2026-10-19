-- Add the explicit Operations review outcome in a separate transaction so the
-- enum value is committed before functions and constraints use it.

alter type public.guide_availability_submission_status
  add value if not exists 'changes_requested' after 'pending_review';
