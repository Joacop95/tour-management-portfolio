-- I18N-2 follow-up: shared display labels identified after the full UI seed.
insert into public.translation_entries (key, context, description, english_source)
values
  ('status.no_guide', 'Status', 'No guide is assigned to this group.', 'No guide'),
  ('status.protected', 'Status', 'Protected import-preview field state.', 'Protected')
on conflict (key) do nothing;
