-- Allow modern "pack" kind alongside legacy profile-pack label.
alter table public.registry_items drop constraint if exists registry_items_kind_check;
alter table public.registry_items add constraint registry_items_kind_check
  check (kind in ('pack', 'profile-pack', 'adapter', 'skill-pack', 'mcp-pack', 'command-pack'));

alter table public.registry_submissions drop constraint if exists registry_submissions_kind_check;
alter table public.registry_submissions add constraint registry_submissions_kind_check
  check (kind in ('pack', 'profile-pack', 'adapter', 'skill-pack', 'mcp-pack', 'command-pack'));

-- Seed official bundled packs (idempotent).
insert into public.registry_items (slug, kind, name, description, source_url, status)
values
  (
    'coding',
    'pack',
    'Coding',
    'General-purpose coding agent for day-to-day software work. OpenCode harness with Orkestrate launch wiring.',
    'https://github.com/orkestrateai/orkestrate',
    'approved'
  ),
  (
    'extension-builder',
    'pack',
    'Extension builder',
    'Meta pack for authoring Orkestrate packs, drivers, and platform extensions with guided skills.',
    'https://github.com/orkestrateai/orkestrate',
    'approved'
  )
on conflict (slug) do update
set
  kind = excluded.kind,
  name = excluded.name,
  description = excluded.description,
  source_url = excluded.source_url,
  status = 'approved',
  updated_at = now();

insert into public.registry_versions (registry_item_id, version, manifest_json, source_url, status)
select
  item.id,
  '0.1.0',
  case item.slug
    when 'coding' then jsonb_build_object(
      'id', 'coding',
      'name', 'coding',
      'description', 'General-purpose coding agent for day-to-day software work.',
      'harness', 'opencode',
      'version', '0.1.0',
      'orkestrate', jsonb_build_object('ref', 'main', 'packPath', 'orkestrate/packs/coding')
    )
    when 'extension-builder' then jsonb_build_object(
      'id', 'extension-builder',
      'name', 'extension-builder',
      'description', 'Build Orkestrate packs, drivers, and platform extensions.',
      'harness', 'opencode',
      'version', '0.1.0',
      'orkestrate', jsonb_build_object('ref', 'main', 'packPath', 'orkestrate/packs/extension-builder')
    )
    else '{}'::jsonb
  end,
  item.source_url,
  'approved'
from public.registry_items item
where item.slug in ('coding', 'extension-builder')
  and not exists (
    select 1
    from public.registry_versions version
    where version.registry_item_id = item.id
      and version.version = '0.1.0'
  );