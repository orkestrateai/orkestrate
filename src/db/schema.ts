import { pgSchema, pgTable, text, timestamp, uuid, boolean, jsonb, integer, uniqueIndex, index } from 'drizzle-orm/pg-core';

const auth = pgSchema('auth');
const authUsers = auth.table('users', {
    id: uuid('id').notNull(),
});

export const agentStates = pgTable('agent_states', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => authUsers.id),
    projectId: text('project_id').default('default').notNull(), // Groups agents working on the same repo
    clientId: text('client_id').notNull(), // e.g. "cursor", "cline"
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
        table.clientId
    ),
}));

export const agentTelemetry = pgTable('agent_telemetry', {
    userId: uuid('user_id').references(() => authUsers.id),
    roomId: text('room_id').default('unassigned').notNull(),
    clientId: text('client_id').notNull(),
    agent: text('agent').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at').notNull(),
}, (table) => ({
    telemetryRoomCreatedIdx: index('agent_telemetry_room_created_idx').on(table.roomId, table.createdAt),
    telemetryUserCreatedIdx: index('agent_telemetry_user_created_idx').on(table.userId, table.createdAt),
    telemetryClientAgentCreatedIdx: index('agent_telemetry_client_agent_created_idx').on(table.clientId, table.agent, table.createdAt),
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

export const userRoomPreferences = pgTable('user_room_preferences', {
    userId: uuid('user_id').primaryKey().references(() => authUsers.id),
    activeRoomId: text('active_room_id').notNull().references(() => rooms.id),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
