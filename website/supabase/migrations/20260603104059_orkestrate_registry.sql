create table if not exists public.publisher_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  github_handle text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registry_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  kind text not null check (kind in ('profile-pack', 'adapter', 'skill-pack', 'mcp-pack', 'command-pack')),
  name text not null,
  description text not null,
  publisher_id uuid references public.publisher_profiles(id) on delete set null,
  source_url text not null,
  manifest_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registry_versions (
  id uuid primary key default gen_random_uuid(),
  registry_item_id uuid not null references public.registry_items(id) on delete cascade,
  version text not null,
  manifest_json jsonb not null,
  source_url text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'archived')),
  created_at timestamptz not null default now(),
  unique (registry_item_id, version)
);

create table if not exists public.registry_submissions (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid not null references auth.users(id) on delete cascade,
  publisher_id uuid references public.publisher_profiles(id) on delete set null,
  registry_item_id uuid references public.registry_items(id) on delete set null,
  registry_version_id uuid references public.registry_versions(id) on delete set null,
  kind text not null check (kind in ('profile-pack', 'adapter', 'skill-pack', 'mcp-pack', 'command-pack')),
  slug text not null,
  name text not null,
  description text not null,
  version text not null default '0.1.0',
  source_url text not null,
  manifest_url text,
  manifest_json jsonb,
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  reviewer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists registry_items_status_created_at_idx
on public.registry_items (status, created_at desc);

create index if not exists registry_submissions_submitter_created_at_idx
on public.registry_submissions (submitter_id, created_at desc);

create index if not exists registry_submissions_review_status_created_at_idx
on public.registry_submissions (review_status, created_at desc);

drop trigger if exists touch_publisher_profiles_updated_at on public.publisher_profiles;
create trigger touch_publisher_profiles_updated_at
before update on public.publisher_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists touch_registry_items_updated_at on public.registry_items;
create trigger touch_registry_items_updated_at
before update on public.registry_items
for each row execute function public.touch_updated_at();

drop trigger if exists touch_registry_submissions_updated_at on public.registry_submissions;
create trigger touch_registry_submissions_updated_at
before update on public.registry_submissions
for each row execute function public.touch_updated_at();

alter table public.publisher_profiles enable row level security;
alter table public.registry_items enable row level security;
alter table public.registry_versions enable row level security;
alter table public.registry_submissions enable row level security;

drop policy if exists "publisher profiles are public" on public.publisher_profiles;
create policy "publisher profiles are public"
on public.publisher_profiles
for select
to anon, authenticated
using (true);

drop policy if exists "users can create their publisher profile" on public.publisher_profiles;
create policy "users can create their publisher profile"
on public.publisher_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "users can update their publisher profile" on public.publisher_profiles;
create policy "users can update their publisher profile"
on public.publisher_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "approved registry items are public" on public.registry_items;
create policy "approved registry items are public"
on public.registry_items
for select
to anon, authenticated
using (status = 'approved');

drop policy if exists "approved registry versions are public" on public.registry_versions;
create policy "approved registry versions are public"
on public.registry_versions
for select
to anon, authenticated
using (
  status = 'approved'
  and exists (
    select 1
    from public.registry_items item
    where item.id = registry_versions.registry_item_id
      and item.status = 'approved'
  )
);

drop policy if exists "users can view their submissions" on public.registry_submissions;
create policy "users can view their submissions"
on public.registry_submissions
for select
to authenticated
using ((select auth.uid()) = submitter_id);

drop policy if exists "users can create submissions" on public.registry_submissions;
create policy "users can create submissions"
on public.registry_submissions
for insert
to authenticated
with check ((select auth.uid()) = submitter_id);

drop policy if exists "users can update pending submissions" on public.registry_submissions;
create policy "users can update pending submissions"
on public.registry_submissions
for update
to authenticated
using ((select auth.uid()) = submitter_id and review_status = 'pending')
with check ((select auth.uid()) = submitter_id and review_status = 'pending');

grant select on public.publisher_profiles to anon, authenticated;
grant select on public.registry_items to anon, authenticated;
grant select on public.registry_versions to anon, authenticated;
grant select, insert, update on public.publisher_profiles to authenticated;
grant select, insert, update on public.registry_submissions to authenticated;
grant all on public.publisher_profiles to service_role;
grant all on public.registry_items to service_role;
grant all on public.registry_versions to service_role;
grant all on public.registry_submissions to service_role;
