-- Add optional region metadata to circuits.
-- This aligns the database schema with the current circuit shape used by the mock app.

alter table circuits
  add column region text null;

update circuits
set region = case name
  when 'Barcelona Essentials' then 'Spain'
  when 'Paris to Loire' then 'France'
  when 'Istanbul Heritage' then 'Turkey'
  when 'Andalusia Highlights' then 'Spain'
  when 'Madrid Art Week' then 'Spain'
  else region
end
where name in (
  'Barcelona Essentials',
  'Paris to Loire',
  'Istanbul Heritage',
  'Andalusia Highlights',
  'Madrid Art Week'
);
