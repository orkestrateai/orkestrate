insert into public.orky_public_context (id, status, payload)
values (
  'public',
  'napping',
  '{"active":false,"sessionId":null,"messages":[],"goal":null,"files":null}'::jsonb
)
on conflict (id) do nothing;
