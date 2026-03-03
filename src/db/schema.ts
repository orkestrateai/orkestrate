import { pgSchema, pgTable, text, timestamp, uuid, boolean, jsonb, integer, uniqueIndex, index } from 'drizzle-orm/pg-core';

const auth = pgSchema('auth');
const authUsers = auth.table('users', {
    id: uuid('id').notNull(),
});

export const agents = pgTable('agents', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => authUsers.id),
    projectId: text('project_id').default('default').notNull(),
    scopedAgentId: text('scoped_agent_id').notNull(),
    family: text('family').default('agent').notNull(),
    agentProfile: text('agent_profile').default('Agent').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    userProjectScopedUq: uniqueIndex('agents_user_project_scoped_uq').on(
        table.userId,
        table.projectId,
        table.scopedAgentId
    ),
}));

export const agentStates = pgTable('agent_states', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => authUsers.id),
    projectId: text('project_id').default('default').notNull(), // Groups agents working on the same repo
    scopedAgentId: text('scoped_agent_id').notNull(), // Unified
    agentId: uuid('agent_id').references(() => agents.id), // Link to master identity
    stateContent: jsonb('state_content').notNull(), // Storing raw JSON 
    stateHash: text('state_hash').default('').notNull(),

    // Rate Limiting
    lastPingAt: timestamp('last_ping_at').defaultNow().notNull(),
    pingCount: integer('ping_count').default(1).notNull(),
    windowStartAt: timestamp('window_start_at').defaultNow().notNull(),
}, (table) => ({
    userProjectClientUq: uniqueIndex('agent_states_user_project_client_uq').on(
        table.userId,
        table.projectId,
        table.scopedAgentId
    ),
}));

export const agentTelemetry = pgTable('agent_telemetry', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => authUsers.id),
    roomId: text('room_id').default('unassigned').notNull(),
    scopedAgentId: text('scoped_agent_id').notNull(), // Standardized
    agentId: uuid('agent_id').references(() => agents.id),
    sessionId: uuid('session_id'),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at').notNull(),
}, (table) => ({
    telemetryRoomCreatedIdx: index('agent_telemetry_room_created_idx').on(table.roomId, table.createdAt),
    telemetryUserCreatedIdx: index('agent_telemetry_user_created_idx').on(table.userId, table.createdAt),
    telemetryClientAgentCreatedIdx: index('agent_telemetry_client_agent_created_idx').on(table.scopedAgentId, table.createdAt),
    telemetrySessionIdx: index('agent_telemetry_session_idx').on(table.sessionId),
}));

export const agentCommands = pgTable('agent_commands', {
    id: uuid('id').defaultRandom().primaryKey(),
    roomId: text('room_id').notNull(),
    scopedAgentId: text('scoped_agent_id').notNull(),
    agentId: uuid('agent_id').references(() => agents.id),
    sessionId: uuid('session_id'),
    text: text('text').notNull(),
    status: text('status').default('queued').notNull(),
    pulledAt: timestamp('pulled_at'),
    dispatchedAt: timestamp('dispatched_at'),
    failedAt: timestamp('failed_at'),
    expiredAt: timestamp('expired_at'),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    agentCommandsScopedCreatedIdx: index('agent_commands_scoped_created_idx').on(table.roomId, table.scopedAgentId, table.createdAt),
    agentCommandsScopedStatusCreatedIdx: index('agent_commands_scoped_status_created_idx').on(table.roomId, table.scopedAgentId, table.status, table.createdAt),
    agentCommandsSessionIdx: index('agent_commands_session_idx').on(table.sessionId),
}));

export const rooms = pgTable('rooms', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    ownerUserId: uuid('owner_user_id').notNull().references(() => authUsers.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const roomMemberships = pgTable('room_memberships', {
    roomId: text('room_id').notNull().references(() => rooms.id),
    userId: uuid('user_id').notNull().references(() => authUsers.id),
    role: text('role').default('member').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    roomUserUq: uniqueIndex('room_memberships_room_user_uq').on(table.roomId, table.userId),
}));

export const projects = pgTable('projects', {
    id: uuid('id').defaultRandom().primaryKey(),
    roomId: text('room_id').notNull().references(() => rooms.id),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').default('todo').notNull(), // todo, in-progress, completed, archived
    assigneeScopedId: text('assignee_scoped_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const agentSessions = pgTable('agent_sessions', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => authUsers.id),
    roomId: text('room_id').notNull().references(() => rooms.id),
    scopedAgentId: text('scoped_agent_id').notNull(),
    agentId: uuid('agent_id').references(() => agents.id),
    title: text('title').default('New Session').notNull(),
    summary: text('summary'),
    status: text('status').default('active').notNull(), // active, completed, interrupted
    createdAt: timestamp('created_at').defaultNow().notNull(),
    endedAt: timestamp('ended_at'),
    metadata: jsonb('metadata'),
}, (table) => ({
    sessionWorkspaceIdx: index('agent_sessions_workspace_idx').on(table.roomId),
    sessionUserIdx: index('agent_sessions_user_idx').on(table.userId),
    sessionAgentIdx: index('agent_sessions_agent_idx').on(table.scopedAgentId),
}));

export const userRoomPreferences = pgTable('user_room_preferences', {
    userId: uuid('user_id').primaryKey().references(() => authUsers.id),
    activeRoomId: text('active_room_id').notNull().references(() => rooms.id),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workspaceCodebases = pgTable('workspace_codebases', {
    workspaceId: text('workspace_id').primaryKey().references(() => rooms.id),
    canonicalRemote: text('canonical_remote').notNull(),
    defaultBranch: text('default_branch'),
    createdBy: uuid('created_by').notNull().references(() => authUsers.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    workspaceCodebasesCanonicalRemoteIdx: index('workspace_codebases_canonical_remote_idx').on(table.canonicalRemote),
}));

export const knowledgeDocs = pgTable('knowledge_docs', {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => rooms.id),
    title: text('title').notNull(),
    description: text('description').default('').notNull(),
    content: text('content').default('').notNull(),
    parentId: uuid('parent_id'), // Self-reference for folder structure
    isFolder: boolean('is_folder').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    knowledgeDocWorkspaceIdx: index('knowledge_docs_workspace_idx').on(table.workspaceId),
    knowledgeDocParentIdx: index('knowledge_docs_parent_idx').on(table.parentId),
    knowledgeDocWorkspaceParentUpdatedIdx: index('knowledge_docs_workspace_parent_updated_idx').on(
        table.workspaceId,
        table.parentId,
        table.updatedAt,
    ),
}));

export const agentActivity = pgTable('agent_activity', {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: text('workspace_id').notNull().references(() => rooms.id),
    scopedAgentId: text('scoped_agent_id').notNull(),
    agentId: uuid('agent_id').references(() => agents.id),
    sessionId: uuid('session_id'),
    eventType: text('event_type').notNull(),
    repo: jsonb('repo').default({}).notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    agentActivityWorkspaceCreatedIdx: index('agent_activity_workspace_created_idx').on(table.workspaceId, table.createdAt),
    agentActivityWorkspaceAgentCreatedIdx: index('agent_activity_workspace_agent_created_idx').on(table.workspaceId, table.scopedAgentId, table.createdAt),
    agentActivityWorkspaceEventCreatedIdx: index('agent_activity_workspace_event_created_idx').on(table.workspaceId, table.eventType, table.createdAt),
}));
