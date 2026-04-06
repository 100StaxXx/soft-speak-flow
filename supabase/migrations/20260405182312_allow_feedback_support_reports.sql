alter table public.support_reports
drop constraint if exists support_reports_category_check;

alter table public.support_reports
add constraint support_reports_category_check
check (category in ('bug', 'billing', 'sync', 'performance', 'feedback', 'other'));
