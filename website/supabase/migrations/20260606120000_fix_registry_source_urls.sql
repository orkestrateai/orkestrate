-- Point official registry packs at the canonical monorepo.
update public.registry_items
set
  source_url = 'https://github.com/orkestrateai/orkestrate',
  updated_at = now()
where slug in ('coding', 'extension-builder');

update public.registry_versions
set
  source_url = 'https://github.com/orkestrateai/orkestrate'
where registry_item_id in (
  select id from public.registry_items where slug in ('coding', 'extension-builder')
);