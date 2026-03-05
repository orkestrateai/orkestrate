import { boolean, index, jsonb, pgTable, pgSchema, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

const auth = pgSchema('auth');
const authUsers = auth.table('users', {
  id: uuid('id').notNull(),
});

export const rooms = pgTable('rooms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => authUsers.id),
  repoUrl: text('repo_url'), // Git repository URL for Git-Rooted Coordination
  defaultBranch: text('default_branch').default('main'), // Default branch for this room
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  roomsOwnerUserIdx: index('rooms_owner_user_idx').on(table.ownerUserId),
  roomsUpdatedIdx: index('rooms_updated_idx').on(table.updatedAt),
  roomsRepoUrlIdx: index('rooms_repo_url_idx').on(table.repoUrl),
}));

export const members = pgTable('members', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => authUsers.id),
  role: text('role').default('member').notNull(),
  isActive: boolean('is_active').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  membersRoomUserUq: uniqueIndex('members_room_user_uq').on(table.roomId, table.userId),
  membersUserIdx: index('members_user_idx').on(table.userId),
  membersRoomIdx: index('members_room_idx').on(table.roomId),
  membersUserActiveIdx: index('members_user_active_idx').on(table.userId, table.isActive),
}));

export const agents = pgTable('agents', {
  id: text('id').primaryKey(),
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  client: text('client').notNull(),
  label: text('label').notNull(),
  status: text('status').default('active').notNull(),
  lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
  pluginConnectedAt: timestamp('plugin_connected_at'),
  disconnectedAt: timestamp('disconnected_at'),
  repoUrl: text('repo_url'),
  currentBranch: text('current_branch'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  agentsMemberIdx: index('agents_member_idx').on(table.memberId),
  agentsRoomIdx: index('agents_room_idx').on(table.roomId),
  agentsStatusIdx: index('agents_status_idx').on(table.status),
  agentsLastMessageIdx: index('agents_last_message_idx').on(table.lastMessageAt),
  agentsPluginConnectedIdx: index('agents_plugin_connected_idx').on(table.pluginConnectedAt),
  agentsMemberLabelUq: uniqueIndex('agents_member_label_uq').on(table.memberId, table.label),
}));

export const agentSessions = pgTable('agent_sessions', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  status: text('status').default('active').notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
  transcript: jsonb('transcript').$type<Array<Record<string, unknown>>>().default([]).notNull(),
  transcriptUpdatedAt: timestamp('transcript_updated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  agentSessionsAgentIdx: index('agent_sessions_agent_idx').on(table.agentId),
  agentSessionsRoomIdx: index('agent_sessions_room_idx').on(table.roomId),
  agentSessionsStatusIdx: index('agent_sessions_status_idx').on(table.status),
  agentSessionsLastMessageIdx: index('agent_sessions_last_message_idx').on(table.lastMessageAt),
  agentSessionsTranscriptUpdatedIdx: index('agent_sessions_transcript_updated_idx').on(table.transcriptUpdatedAt),
}));

export const agentStates = pgTable('agent_states', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull().references(() => agentSessions.id, { onDelete: 'cascade' }),
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  status: text('status').default('active').notNull(),
  objective: text('objective').default('').notNull(),
  claimedPaths: jsonb('claimed_paths').$type<string[]>().default([]).notNull(),
  plan: jsonb('plan').$type<string[]>().default([]).notNull(),
  completed: jsonb('completed').$type<string[]>().default([]).notNull(),
  notes: text('notes').default('').notNull(),
  version: text('version').default('v0').notNull(),
  // Git-Rooted Coordination fields
  gitRemote: text('git_remote'), // git remote get-url origin
  gitBranch: text('git_branch'), // Current branch agent is on
  gitHeadSha: text('git_head_sha'), // Current commit SHA
  gitAheadBehind: text('git_ahead_behind'), // e.g., "ahead 2, behind 1" or "up-to-date"
  gitUncommittedChanges: boolean('git_uncommitted_changes').default(false), // Has uncommitted changes
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  agentStatesAgentIdx: index('agent_states_agent_idx').on(table.agentId),
  agentStatesSessionIdx: uniqueIndex('agent_states_session_idx').on(table.sessionId),
  agentStatesRoomIdx: index('agent_states_room_idx').on(table.roomId),
  agentStatesGitBranchIdx: index('agent_states_git_branch_idx').on(table.gitBranch),
}));

export const knowledgeDocs = pgTable('knowledge_docs', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').default('').notNull(),
  content: text('content').default('').notNull(),
  parentId: text('parent_id'),
  isFolder: boolean('is_folder').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  knowledgeDocsRoomIdx: index('knowledge_docs_room_idx').on(table.roomId),
  knowledgeDocsRoomParentIdx: index('knowledge_docs_room_parent_idx').on(table.roomId, table.parentId),
  knowledgeDocsRoomUpdatedIdx: index('knowledge_docs_room_updated_idx').on(table.roomId, table.updatedAt),
  knowledgeDocsRoomParentTitleUq: uniqueIndex('knowledge_docs_room_parent_title_uq').on(table.roomId, table.parentId, table.title),
}));
