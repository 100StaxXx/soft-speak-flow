alter table public.habits
add column if not exists custom_month_days integer[] null;
