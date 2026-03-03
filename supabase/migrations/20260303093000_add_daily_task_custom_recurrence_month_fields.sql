alter table public.daily_tasks
add column if not exists recurrence_month_days integer[] null,
add column if not exists recurrence_custom_period text null;

comment on column public.daily_tasks.recurrence_month_days is
  'Explicit month-day recurrence values (1-31). Days beyond month length run on the last valid day.';

comment on column public.daily_tasks.recurrence_custom_period is
  'Custom recurrence period scope: week or month.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_tasks_recurrence_custom_period_check'
      and conrelid = 'public.daily_tasks'::regclass
  ) then
    alter table public.daily_tasks
      add constraint daily_tasks_recurrence_custom_period_check
      check (
        recurrence_custom_period is null
        or recurrence_custom_period in ('week', 'month')
      );
  end if;
end
$$;
