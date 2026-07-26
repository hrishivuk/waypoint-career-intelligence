begin;

alter table public.typed_preferences
  drop constraint typed_preferences_v1_1_value_shape_check;

alter table public.typed_preferences
  add constraint typed_preferences_v1_1_value_shape_check check (
    record_type <> 'preference'
    or value_shape = 'legacy'
    or (
      value_shape = 'scalar'
      and jsonb_typeof(value) = 'string'
      and length(btrim(value #>> '{}')) > 0
      and (value #>> '{}') not like '%,%'
    )
    or (
      value_shape = 'ordered'
      and public.is_atomic_ordered_preference(value)
    )
  );

comment on constraint typed_preferences_v1_1_value_shape_check
on public.typed_preferences is
  'Atomic or ordered value rules apply to preference records; working/writing style prose may contain punctuation.';

commit;
