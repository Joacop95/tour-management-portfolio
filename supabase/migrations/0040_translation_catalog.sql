create table public.translation_entries (
  key text primary key,
  context text not null,
  description text not null default '',
  english_source text not null default '',
  email_template_type text null,
  email_template_field text null check (email_template_field in ('subject', 'body')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.profiles(id),
  constraint translation_entries_key_format_check
    check (key ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'),
  constraint translation_entries_email_mapping_check
    check (
      (email_template_type is null and email_template_field is null)
      or (email_template_type is not null and email_template_field is not null)
    ),
  constraint translation_entries_email_mapping_key
    unique (email_template_type, email_template_field)
);

create table public.translation_values (
  translation_key text not null references public.translation_entries(key) on delete cascade,
  language_code text not null check (language_code in ('es', 'fr', 'tr')),
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.profiles(id),
  primary key (translation_key, language_code)
);

alter table public.translation_entries enable row level security;
alter table public.translation_values enable row level security;

revoke all on table public.translation_entries from public, anon, authenticated;
revoke all on table public.translation_values from public, anon, authenticated;

insert into public.translation_entries (
  key, context, description, english_source, email_template_type, email_template_field
)
values
  ('common.save', 'Common', 'Primary save action.', 'Save', null, null),
  ('common.cancel', 'Common', 'Cancel the current action.', 'Cancel', null, null),
  ('common.confirm', 'Common', 'Confirm the current action.', 'Confirm', null, null),
  ('email.assignment_information.subject', 'Email · Assignment information', 'Subject used for assignment information and manual group information.', '', 'assigned_groups_email', 'subject'),
  ('email.assignment_information.body', 'Email · Assignment information', 'Body used for assignment information and manual group information.', '', 'assigned_groups_email', 'body'),
  ('email.confirmation_request.subject', 'Email · Confirmation request', 'Subject requesting guide confirmation.', '', 'guide_confirmation_reminder', 'subject'),
  ('email.confirmation_request.body', 'Email · Confirmation request', 'Body requesting guide confirmation.', '', 'guide_confirmation_reminder', 'body'),
  ('email.assignment_removed.subject', 'Email · Assignment removed', 'Subject informing the previous guide that an assignment changed or was removed.', '', 'assignment_changed', 'subject'),
  ('email.assignment_removed.body', 'Email · Assignment removed', 'Body informing the previous guide that an assignment changed or was removed.', '', 'assignment_changed', 'body'),
  ('email.group_cancelled.subject', 'Email · Group cancelled', 'Subject informing the guide that an assigned group was cancelled.', '', 'group_cancelled_for_guide', 'subject'),
  ('email.group_cancelled.body', 'Email · Group cancelled', 'Body informing the guide that an assigned group was cancelled.', '', 'group_cancelled_for_guide', 'body'),
  ('email.group_merged.subject', 'Email · Group merged', 'Subject informing the guide that an assigned group was marked as merged.', '', 'group_merged_for_guide', 'subject'),
  ('email.group_merged.body', 'Email · Group merged', 'Body informing the guide that an assigned group was marked as merged.', '', 'group_merged_for_guide', 'body'),
  ('email.guide_invitation.subject', 'Email · Guide invitation', 'Guide invitation subject.', '', 'guide_invitation', 'subject'),
  ('email.guide_invitation.body', 'Email · Guide invitation', 'Guide invitation body.', '', 'guide_invitation', 'body'),
  ('email.reset_password.subject', 'Email · Reset password', 'Password reset subject managed by the existing template record.', '', 'reset_password', 'subject'),
  ('email.reset_password.body', 'Email · Reset password', 'Password reset body managed by the existing template record.', '', 'reset_password', 'body'),
  ('email.yearly_availability_request.subject', 'Email · Yearly availability request', 'Yearly availability request subject.', '', 'yearly_availability_request', 'subject'),
  ('email.yearly_availability_request.body', 'Email · Yearly availability request', 'Yearly availability request body.', '', 'yearly_availability_request', 'body');

update public.translation_entries as entry
set english_source = case entry.email_template_field
    when 'subject' then template.subject
    when 'body' then template.body
  end,
  updated_at = now()
from public.email_templates as template
where template.template_type = entry.email_template_type
  and template.language = 'english'
  and template.is_archived = false;

insert into public.translation_values (translation_key, language_code, value)
select
  entry.key,
  case template.language
    when 'spanish' then 'es'
    when 'french' then 'fr'
    when 'turkish' then 'tr'
  end,
  case entry.email_template_field
    when 'subject' then template.subject
    when 'body' then template.body
  end
from public.translation_entries as entry
join public.email_templates as template
  on template.template_type = entry.email_template_type
where template.language in ('spanish', 'french', 'turkish')
  and template.is_archived = false
  and trim(case entry.email_template_field
    when 'subject' then template.subject
    when 'body' then template.body
  end) <> ''
on conflict (translation_key, language_code) do nothing;

create function public.translation_placeholder_set(p_value text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    array_agg(distinct matches[1] order by matches[1]),
    array[]::text[]
  )
  from regexp_matches(coalesce(p_value, ''), '\{\{([A-Za-z0-9_]+)\}\}', 'g') as matches;
$$;

revoke all on function public.translation_placeholder_set(text) from public, anon, authenticated;

create function public.get_translation_catalog()
returns table (
  key text,
  context text,
  description text,
  english text,
  spanish text,
  french text,
  turkish text,
  email_template_type text,
  email_template_field text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_permission('settings.view') then
    raise exception using errcode = '42501', message = 'You do not have permission to view translations.';
  end if;

  return query
  select
    entry.key,
    entry.context,
    entry.description,
    entry.english_source,
    coalesce(max(value.value) filter (where value.language_code = 'es'), ''),
    coalesce(max(value.value) filter (where value.language_code = 'fr'), ''),
    coalesce(max(value.value) filter (where value.language_code = 'tr'), ''),
    entry.email_template_type,
    entry.email_template_field
  from public.translation_entries as entry
  left join public.translation_values as value
    on value.translation_key = entry.key
  group by entry.key
  order by entry.context, entry.key;
end;
$$;

revoke all on function public.get_translation_catalog() from public;
revoke all on function public.get_translation_catalog() from anon;
grant execute on function public.get_translation_catalog() to authenticated;

create function public.import_translation_values(p_rows jsonb)
returns table (success boolean, code text, message text, updated_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_item jsonb;
  v_key text;
  v_english text;
  v_language text;
  v_value text;
  v_existing_value text;
  v_seen_keys text[] := array[]::text[];
  v_updated_count integer := 0;
begin
  if v_actor_id is null or not public.has_permission('settings.manage_settings') then
    return query select false, 'not_authorized', 'You do not have permission to import translations.', 0;
    return;
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return query select false, 'invalid_payload', 'Translation import data is invalid.', 0;
    return;
  end if;

  if jsonb_array_length(p_rows) > 5000 then
    return query select false, 'too_many_rows', 'Translation import contains too many rows.', 0;
    return;
  end if;

  for v_item in select value from jsonb_array_elements(p_rows)
  loop
    v_key := trim(coalesce(v_item ->> 'key', ''));
    if v_key = '' then
      return query select false, 'key_required', 'Translation key is required.', 0;
      return;
    end if;
    if v_key = any(v_seen_keys) then
      return query select false, 'duplicate_key', 'A translation key appears more than once.', 0;
      return;
    end if;
    v_seen_keys := array_append(v_seen_keys, v_key);

    select entry.english_source into v_english
    from public.translation_entries as entry
    where entry.key = v_key;

    if not found then
      return query select false, 'unknown_key', 'Translation import contains an unknown key.', 0;
      return;
    end if;

    foreach v_language in array array['es', 'fr', 'tr']
    loop
      v_value := coalesce(v_item ->> v_language, '');
      if trim(v_value) <> '' then
        if trim(v_english) = '' then
          return query select false, 'missing_english_source', 'A translation cannot be imported without an English source.', 0;
          return;
        end if;
        if public.translation_placeholder_set(v_value)
          is distinct from public.translation_placeholder_set(v_english) then
          return query select false, 'invalid_placeholders', 'Translation placeholders do not match English.', 0;
          return;
        end if;
      end if;
    end loop;
  end loop;

  for v_item in select value from jsonb_array_elements(p_rows)
  loop
    v_key := trim(v_item ->> 'key');
    foreach v_language in array array['es', 'fr', 'tr']
    loop
      v_value := coalesce(v_item ->> v_language, '');
      if trim(v_value) = '' then
        continue;
      end if;

      select value.value into v_existing_value
      from public.translation_values as value
      where value.translation_key = v_key
        and value.language_code = v_language;

      if not found or v_existing_value is distinct from v_value then
        insert into public.translation_values (
          translation_key, language_code, value, updated_at, updated_by
        ) values (
          v_key, v_language, v_value, now(), v_actor_id
        )
        on conflict (translation_key, language_code) do update
        set value = excluded.value,
            updated_at = now(),
            updated_by = v_actor_id;
        v_updated_count := v_updated_count + 1;
      end if;
    end loop;
  end loop;

  insert into public.email_templates (
    template_type, language, subject, body, updated_at, updated_by
  )
  select
    subject_entry.email_template_type,
    language.supported_code,
    coalesce(subject_value.value, ''),
    coalesce(body_value.value, ''),
    now(),
    v_actor_id
  from public.translation_entries as subject_entry
  join public.translation_entries as body_entry
    on body_entry.email_template_type = subject_entry.email_template_type
    and body_entry.email_template_field = 'body'
  cross join (values
    ('es', 'spanish'::public.supported_language),
    ('fr', 'french'::public.supported_language),
    ('tr', 'turkish'::public.supported_language)
  ) as language(language_code, supported_code)
  left join public.translation_values as subject_value
    on subject_value.translation_key = subject_entry.key
    and subject_value.language_code = language.language_code
  left join public.translation_values as body_value
    on body_value.translation_key = body_entry.key
    and body_value.language_code = language.language_code
  where subject_entry.email_template_field = 'subject'
    and (
      coalesce(trim(subject_value.value), '') <> ''
      or coalesce(trim(body_value.value), '') <> ''
    )
  on conflict (template_type, language) do update
  set subject = excluded.subject,
      body = excluded.body,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by,
      is_archived = false,
      archived_at = null,
      archived_by = null,
      archive_reason = null;

  return query select true, 'updated', 'Translations imported.', v_updated_count;
end;
$$;

revoke all on function public.import_translation_values(jsonb) from public;
revoke all on function public.import_translation_values(jsonb) from anon;
grant execute on function public.import_translation_values(jsonb) to authenticated;

comment on table public.translation_entries is
  'Stable English-source translation catalog. English source is maintained by code/migrations, not CSV import.';
comment on table public.translation_values is
  'Human-provided Spanish, French, and Turkish catalog values. Blank CSV cells do not overwrite existing values.';
