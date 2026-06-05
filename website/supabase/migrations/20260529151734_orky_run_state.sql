create table if not exists public.orky_public_context (
  id text primary key default 'public',
  status text not null default 'napping' check (status in ('live', 'napping')),
  session_id text,
  payload jsonb not null default '{}'::jsonb,
  last_event_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint orky_public_context_singleton check (id = 'public')
);

drop trigger if exists touch_orky_public_context_updated_at on public.orky_public_context;
create trigger touch_orky_public_context_updated_at
before update on public.orky_public_context
for each row execute function public.touch_updated_at();

alter table public.orky_public_context enable row level security;
