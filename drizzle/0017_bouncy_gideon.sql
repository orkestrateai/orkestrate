CREATE TABLE "agent_scope_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"session_id" text NOT NULL,
	"paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"lease_expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_states" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"session_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"objective" text DEFAULT '' NOT NULL,
	"claimed_paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"plan" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"version" text DEFAULT 'v0' NOT NULL,
	"git_remote" text,
	"git_branch" text,
	"git_head_sha" text,
	"git_ahead_behind" text,
	"git_uncommitted_changes" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"client" text NOT NULL,
	"label" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"plugin_connected_at" timestamp,
	"disconnected_at" timestamp,
	"repo_url" text,
	"current_branch" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_docs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"parent_id" text,
	"is_folder" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_type" text NOT NULL,
	"razorpay_subscription_id" text,
	"status" text NOT NULL,
	"current_period_end" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_razorpay_subscription_id_unique" UNIQUE("razorpay_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"repo_url" text,
	"default_branch" text DEFAULT 'main',
	"max_agents" integer DEFAULT 3 NOT NULL,
	"max_members" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mcp_configs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "room_events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "room_members" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rooms" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "clients" CASCADE;--> statement-breakpoint
DROP TABLE "mcp_configs" CASCADE;--> statement-breakpoint
DROP TABLE "room_events" CASCADE;--> statement-breakpoint
DROP TABLE "room_members" CASCADE;--> statement-breakpoint
DROP TABLE "rooms" CASCADE;--> statement-breakpoint
ALTER TABLE "agent_sessions" DROP CONSTRAINT "agent_sessions_room_id_rooms_id_fk";
--> statement-breakpoint
ALTER TABLE "agent_sessions" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "agent_sessions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "agent_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "workspace_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "normalized_remote" text;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "repo_root" text;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "head_sha_at_join" text;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "branch_at_join" text;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "tool_name_raw" text;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "started_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "ended_at" timestamp;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "last_message_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "transcript" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "transcript_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_scope_claims" ADD CONSTRAINT "agent_scope_claims_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_scope_claims" ADD CONSTRAINT "agent_scope_claims_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_scope_claims" ADD CONSTRAINT "agent_scope_claims_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_states" ADD CONSTRAINT "agent_states_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_states" ADD CONSTRAINT "agent_states_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_states" ADD CONSTRAINT "agent_states_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_docs" ADD CONSTRAINT "knowledge_docs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_scope_claims_workspace_status_idx" ON "agent_scope_claims" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "agent_scope_claims_agent_status_idx" ON "agent_scope_claims" USING btree ("agent_id","status");--> statement-breakpoint
CREATE INDEX "agent_scope_claims_session_idx" ON "agent_scope_claims" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "agent_states_agent_idx" ON "agent_states" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_states_session_idx" ON "agent_states" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "agent_states_workspace_idx" ON "agent_states" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "agent_states_git_branch_idx" ON "agent_states" USING btree ("git_branch");--> statement-breakpoint
CREATE INDEX "agents_member_idx" ON "agents" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "agents_workspace_idx" ON "agents" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "agents_status_idx" ON "agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agents_last_message_idx" ON "agents" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "agents_plugin_connected_idx" ON "agents" USING btree ("plugin_connected_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_member_label_uq" ON "agents" USING btree ("member_id","label");--> statement-breakpoint
CREATE INDEX "knowledge_docs_workspace_idx" ON "knowledge_docs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "knowledge_docs_workspace_parent_idx" ON "knowledge_docs" USING btree ("workspace_id","parent_id");--> statement-breakpoint
CREATE INDEX "knowledge_docs_workspace_updated_idx" ON "knowledge_docs" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_docs_workspace_parent_title_uq" ON "knowledge_docs" USING btree ("workspace_id","parent_id","title");--> statement-breakpoint
CREATE UNIQUE INDEX "members_workspace_user_uq" ON "members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "members_user_idx" ON "members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "members_workspace_idx" ON "members" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "members_user_active_idx" ON "members" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_razorpay_idx" ON "subscriptions" USING btree ("razorpay_subscription_id");--> statement-breakpoint
CREATE INDEX "workspaces_owner_user_idx" ON "workspaces" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "workspaces_updated_idx" ON "workspaces" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "workspaces_repo_url_idx" ON "workspaces" USING btree ("repo_url");--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_sessions_agent_idx" ON "agent_sessions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_sessions_workspace_idx" ON "agent_sessions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "agent_sessions_status_idx" ON "agent_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_sessions_last_message_idx" ON "agent_sessions" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "agent_sessions_transcript_updated_idx" ON "agent_sessions" USING btree ("transcript_updated_at");--> statement-breakpoint
CREATE INDEX "agent_sessions_workspace_status_idx" ON "agent_sessions" USING btree ("workspace_id","status");--> statement-breakpoint
ALTER TABLE "agent_sessions" DROP COLUMN "room_id";--> statement-breakpoint
ALTER TABLE "agent_sessions" DROP COLUMN "client_id";--> statement-breakpoint
ALTER TABLE "agent_sessions" DROP COLUMN "last_ping_at";