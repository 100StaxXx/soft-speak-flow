create table if not exists public.support_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  correlation_id text not null unique,
  category text not null check (category in ('bug', 'billing', 'sync', 'performance', 'other')),
  summary text not null,
  reproduction_steps text not null default '',
  expected_behavior text not null default '',
  actual_behavior text not null default '',
  screenshot_data_url text,
  consent_diagnostics boolean not null default false,
  diagnostics jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_reports_user_created_at_idx
  on public.support_reports (user_id, created_at desc);

alter table public.support_reports enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'support_reports'
      and policyname = 'Users can insert own support reports'
  ) then
    create policy "Users can insert own support reports"
      on public.support_reports
      for insert
      with check (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'support_reports'
      and policyname = 'Users can view own support reports'
  ) then
    create policy "Users can view own support reports"
      on public.support_reports
      for select
      using (auth.uid() = user_id);
  end if;
end;
$$;

grant insert, select on public.support_reports to authenticated;
