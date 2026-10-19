-- GAE-1: Guide Authorized Login Emails foundation.
--
-- Scope:
-- - Create guide_authorized_emails.
-- - Backfill from guides.authorized_email.
-- - Enable RLS for authenticated internal/guide access only.
--
-- This migration does not implement login/register UI, open guide signup,
-- invitation email delivery, bulk import, API routes, server actions, or
-- service_role usage.

create table public.guide_authorized_emails (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.guides(id) on delete cascade,
  email text not null,
  normalized_email text generated always as (lower(btrim(email))) stored,
  status text not null default 'allowed',
  profile_id uuid null references public.profiles(id) on delete set null,
  source text not null default 'manual',
  notes text null,
  invited_at timestamptz null,
  registered_at timestamptz null,
  revoked_at timestamptz null,
  created_by_profile_id uuid null references public.profiles(id) on delete set null,
  updated_by_profile_id uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guide_authorized_emails_email_not_blank_check
    check (btrim(email) <> ''),
  constraint guide_authorized_emails_status_check
    check (status in ('allowed', 'invited', 'registered', 'revoked')),
  constraint guide_authorized_emails_source_check
    check (source in ('manual', 'bulk_import', 'migration', 'invitation')),
  constraint guide_authorized_emails_registered_profile_check
    check (status <> 'registered' or profile_id is not null),
  constraint guide_authorized_emails_revoked_timestamp_check
    check (status <> 'revoked' or revoked_at is not null)
);

create unique index guide_authorized_emails_active_normalized_email_key
  on public.guide_authorized_emails (normalized_email)
  where status <> 'revoked';

create index guide_authorized_emails_guide_id_idx
  on public.guide_authorized_emails (guide_id);

create index guide_authorized_emails_normalized_email_idx
  on public.guide_authorized_emails (normalized_email);

create index guide_authorized_emails_profile_id_idx
  on public.guide_authorized_emails (profile_id);

create index guide_authorized_emails_status_idx
  on public.guide_authorized_emails (status);

insert into public.guide_authorized_emails (
  guide_id,
  email,
  status,
  source,
  created_at,
  updated_at
)
select
  guides.id,
  guides.authorized_email,
  case
    when guides.status = 'invited' then 'invited'
    else 'allowed'
  end,
  'migration',
  now(),
  now()
from public.guides
where guides.authorized_email is not null
  and btrim(guides.authorized_email) <> ''
on conflict (normalized_email) where status <> 'revoked'
do nothing;

alter table public.guide_authorized_emails enable row level security;

revoke all on public.guide_authorized_emails from anon;
grant select, insert, update on public.guide_authorized_emails to authenticated;

create policy "guide_authorized_emails_select_internal_or_own"
on public.guide_authorized_emails
for select
to authenticated
using (
  guide_id = public.current_user_guide_id()
  or public.has_permission('guides.view')
);

create policy "guide_authorized_emails_insert_guides_create_or_edit"
on public.guide_authorized_emails
for insert
to authenticated
with check (
  public.has_permission('guides.create')
  or public.has_permission('guides.edit')
);

create policy "guide_authorized_emails_update_guides_edit"
on public.guide_authorized_emails
for update
to authenticated
using (
  public.has_permission('guides.edit')
)
with check (
  public.has_permission('guides.edit')
);

comment on table public.guide_authorized_emails is
  'Guide login email allowlist. RLS enabled. Anon has no access; internal guide managers can manage records; guide users can read only their own records.';

comment on column public.guide_authorized_emails.normalized_email is
  'Generated as lower(trim(email)). Used for active allowlist uniqueness and future secure guide registration checks.';
