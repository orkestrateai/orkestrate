WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, project_id, client_id
           ORDER BY last_ping_at DESC, id DESC
         ) AS rn
  FROM agent_states
)
DELETE FROM agent_states
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_states_user_project_client_uq
  ON agent_states (user_id, project_id, client_id);
