create extension if not exists pgcrypto;

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'orky_landing_waitlist',
  status text not null default 'joined' check (status in ('joined', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists waitlist_email_unique
  on public.waitlist (email);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_waitlist_updated_at on public.waitlist;
create trigger touch_waitlist_updated_at
before update on public.waitlist
for each row execute function public.touch_updated_at();

alter table public.waitlist enable row level security;
