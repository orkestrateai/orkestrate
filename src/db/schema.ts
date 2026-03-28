import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const auth = pgSchema("auth");
const authUsers = auth.table("users", {
  id: uuid("id").notNull(),
});

export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => authUsers.id),
    repoUrl: text("repo_url"), // Git repository URL for Git-Rooted Coordination
    defaultBranch: text("default_branch"), // Auto-created workspace branch: orkestrate/workspace-{id}
    baseBranch: text("base_branch").default("main").notNull(), // User-chosen branch to fork from (e.g. main)
    maxAgents: integer("max_agents").default(3).notNull(), // Maximum concurrent agents allowed
    maxMembers: integer("max_members").default(1).notNull(), // Maximum members allowed
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    workspacesOwnerUserIdx: index("workspaces_owner_user_idx").on(
      table.ownerUserId,
    ),
    workspacesUpdatedIdx: index("workspaces_updated_idx").on(table.updatedAt),
    workspacesRepoUrlIdx: index("workspaces_repo_url_idx").on(table.repoUrl),
  }),
);

export const members = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id),
    role: text("role").default("member").notNull(), // 'owner' | 'admin' | 'member'
    isActive: boolean("is_active").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    membersWorkspaceUserUq: uniqueIndex("members_workspace_user_uq").on(
      table.workspaceId,
      table.userId,
    ),
    membersUserIdx: index("members_user_idx").on(table.userId),
    membersWorkspaceIdx: index("members_workspace_idx").on(table.workspaceId),
    membersUserActiveIdx: index("members_user_active_idx").on(
      table.userId,
      table.isActive,
    ),
  }),
);

export const agents = pgTable(
  "agents",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    toolName: text("tool_name").notNull(),
    label: text("label").notNull(),
    status: text("status").default("active").notNull(),
    lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
    pluginConnectedAt: timestamp("plugin_connected_at"),
    disconnectedAt: timestamp("disconnected_at"),
    repoUrl: text("repo_url"),
    currentBranch: text("current_branch"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    agentsMemberIdx: index("agents_member_idx").on(table.memberId),
    agentsWorkspaceIdx: index("agents_workspace_idx").on(table.workspaceId),
    agentsStatusIdx: index("agents_status_idx").on(table.status),
    agentsLastMessageIdx: index("agents_last_message_idx").on(
      table.lastMessageAt,
    ),
    agentsPluginConnectedIdx: index("agents_plugin_connected_idx").on(
      table.pluginConnectedAt,
    ),
    agentsMemberLabelUq: uniqueIndex("agents_member_label_uq").on(
      table.memberId,
      table.label,
    ),
  }),
);

export const agentSessions = pgTable(
  "agent_sessions",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    status: text("status").default("active").notNull(),
    normalizedRemote: text("normalized_remote"),
    repoRoot: text("repo_root"),
    headShaAtJoin: text("head_sha_at_join"),
    branchAtJoin: text("branch_at_join"),
    toolNameRaw: text("tool_name_raw"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
    lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
    transcript: jsonb("transcript")
      .$type<Array<Record<string, unknown>>>()
      .default([])
      .notNull(),
    transcriptUpdatedAt: timestamp("transcript_updated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    agentSessionsAgentIdx: index("agent_sessions_agent_idx").on(table.agentId),
    agentSessionsWorkspaceIdx: index("agent_sessions_workspace_idx").on(
      table.workspaceId,
    ),
    agentSessionsStatusIdx: index("agent_sessions_status_idx").on(table.status),
    agentSessionsLastMessageIdx: index("agent_sessions_last_message_idx").on(
      table.lastMessageAt,
    ),
    agentSessionsTranscriptUpdatedIdx: index(
      "agent_sessions_transcript_updated_idx",
    ).on(table.transcriptUpdatedAt),
    agentSessionsWorkspaceStatusIdx: index(
      "agent_sessions_workspace_status_idx",
    ).on(table.workspaceId, table.status),
  }),
);

export const agentStates = pgTable(
  "agent_states",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    status: text("status").default("active").notNull(),
    objective: text("objective").default("").notNull(),
    footprint: jsonb("footprint").$type<string[]>().default([]).notNull(),
    plan: jsonb("plan").$type<string[]>().default([]).notNull(),
    completed: jsonb("completed").$type<string[]>().default([]).notNull(),
    notes: text("notes").default("").notNull(),
    version: text("version").default("v0").notNull(),
    // Git-Rooted Coordination fields
    gitRemote: text("git_remote"), // git remote get-url origin
    gitBranch: text("git_branch"), // Current branch agent is on
    gitHeadSha: text("git_head_sha"), // Current commit SHA
    gitAheadBehind: text("git_ahead_behind"), // e.g., "ahead 2, behind 1" or "up-to-date"
    gitUncommittedChanges: boolean("git_uncommitted_changes").default(false), // Has uncommitted changes
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    agentStatesAgentIdx: index("agent_states_agent_idx").on(table.agentId),
    agentStatesSessionIdx: uniqueIndex("agent_states_session_idx").on(
      table.sessionId,
    ),
    agentStatesWorkspaceIdx: index("agent_states_workspace_idx").on(
      table.workspaceId,
    ),
    agentStatesGitBranchIdx: index("agent_states_git_branch_idx").on(
      table.gitBranch,
    ),
  }),
);

export const agentScopeClaims = pgTable(
  "agent_scope_claims",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    paths: jsonb("paths").$type<string[]>().default([]).notNull(),
    status: text("status").default("active").notNull(),
    leaseExpiresAt: timestamp("lease_expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    agentScopeClaimsWorkspaceStatusIdx: index(
      "agent_scope_claims_workspace_status_idx",
    ).on(table.workspaceId, table.status),
    agentScopeClaimsAgentStatusIdx: index(
      "agent_scope_claims_agent_status_idx",
    ).on(table.agentId, table.status),
    agentScopeClaimsSessionIdx: index("agent_scope_claims_session_idx").on(
      table.sessionId,
    ),
  }),
);

export const knowledgeDocs = pgTable(
  "knowledge_docs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").default("").notNull(),
    content: text("content").default("").notNull(),
    parentId: text("parent_id"),
    isFolder: boolean("is_folder").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    knowledgeDocsWorkspaceIdx: index("knowledge_docs_workspace_idx").on(
      table.workspaceId,
    ),
    knowledgeDocsWorkspaceParentIdx: index(
      "knowledge_docs_workspace_parent_idx",
    ).on(table.workspaceId, table.parentId),
    knowledgeDocsWorkspaceUpdatedIdx: index(
      "knowledge_docs_workspace_updated_idx",
    ).on(table.workspaceId, table.updatedAt),
    knowledgeDocsWorkspaceParentTitleUq: uniqueIndex(
      "knowledge_docs_workspace_parent_title_uq",
    ).on(table.workspaceId, table.parentId, table.title),
  }),
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id),
    planType: text("plan_type").notNull(), // 'hobby', 'pro', 'team', 'enterprise'
    razorpaySubscriptionId: text("razorpay_subscription_id").unique(),
    status: text("status").notNull(), // 'active', 'past_due', 'cancelled', 'authenticated'
    currentPeriodEnd: timestamp("current_period_end"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    subscriptionsUserIdx: index("subscriptions_user_idx").on(table.userId),
    subscriptionsRazorpayIdx: uniqueIndex("subscriptions_razorpay_idx").on(
      table.razorpaySubscriptionId,
    ),
  }),
);

export const githubTokens = pgTable(
  "github_tokens",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at"),
    tokenType: text("token_type").default("github").notNull(),
    scope: text("scope"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    githubTokensUserIdx: uniqueIndex("github_tokens_user_idx").on(table.userId),
    githubTokensUserActiveIdx: index("github_tokens_user_active_idx").on(
      table.userId,
      table.tokenType,
    ),
  }),
);

export const workspaceInvites = pgTable(
  "workspace_invites",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    code: text("code").unique().notNull(),
    role: text("role").default("member").notNull(), // 'member' | 'admin'
    maxUses: integer("max_uses"), // null = unlimited
    usedCount: integer("used_count").default(0).notNull(),
    expiresAt: timestamp("expires_at"), // null = never expires
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => authUsers.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    workspaceInvitesWorkspaceIdx: index("workspace_invites_workspace_idx").on(
      table.workspaceId,
    ),
    workspaceInvitesCodeIdx: uniqueIndex("workspace_invites_code_idx").on(
      table.code,
    ),
  }),
);

// MCP Tool Permissions
export type McpToolCategory = 'workspace' | 'messaging' | 'knowledge';

export type McpSettings = {
  workspace?: { enabled: boolean; disabledTools?: string[] };
  messaging?: { enabled: boolean; disabledTools?: string[] };
  knowledge?: { enabled: boolean; disabledTools?: string[] };
};

export const userMcpSettings = pgTable(
  'user_mcp_settings',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id),
    settings: jsonb('settings').$type<McpSettings>().notNull().default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userMcpSettingsUserIdx: uniqueIndex('user_mcp_settings_user_idx').on(table.userId),
  }),
);
;