create table if not exists public.personal_quest_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_common_template_id text,
  normalized_title text not null,
  title text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  estimated_duration integer,
  notes text,
  subtasks text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists personal_quest_templates_user_normalized_title_idx
  on public.personal_quest_templates (user_id, normalized_title);

create index if not exists personal_quest_templates_user_updated_at_idx
  on public.personal_quest_templates (user_id, updated_at desc);

alter table public.personal_quest_templates enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'personal_quest_templates'
      and policyname = 'Users can view own personal quest templates'
  ) then
    create policy "Users can view own personal quest templates"
      on public.personal_quest_templates
      for select
      using (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'personal_quest_templates'
      and policyname = 'Users can insert own personal quest templates'
  ) then
    create policy "Users can insert own personal quest templates"
      on public.personal_quest_templates
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
      and tablename = 'personal_quest_templates'
      and policyname = 'Users can update own personal quest templates'
  ) then
    create policy "Users can update own personal quest templates"
      on public.personal_quest_templates
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end;
$$;

grant select, insert, update on public.personal_quest_templates to authenticated;
