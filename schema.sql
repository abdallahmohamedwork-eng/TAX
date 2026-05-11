create table if not exists app_state (
  id integer primary key,
  data jsonb not null,
  updated_at timestamp with time zone default now()
);

insert into app_state(id, data)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

-- For easiest private/internal use, keep RLS disabled at first.
-- If you enable RLS later, add proper policies or authentication.
