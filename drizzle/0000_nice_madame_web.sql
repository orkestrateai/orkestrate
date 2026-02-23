CREATE TABLE "mcp_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"autostart" boolean DEFAULT false NOT NULL,
	"trigger_phrase" text,
	"behavior_rules" text
);
ALTER TABLE "mcp_configs" ADD CONSTRAINT "mcp_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;
