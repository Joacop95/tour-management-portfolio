-- Shared operational ordering for Planning circuit rows.

alter table public.circuits
  add column if not exists planning_sort_order integer null,
  add constraint circuits_planning_sort_order_check
    check (planning_sort_order is null or planning_sort_order >= 0);

comment on column public.circuits.planning_sort_order is
  'Optional shared circuit position used by Planning custom-order sorting. Null values follow explicitly ordered circuits.';
