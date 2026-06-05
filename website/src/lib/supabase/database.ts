export type Database = {
  public: {
    Tables: {
      waitlist: {
        Row: {
          id: string;
          email: string;
          source: string;
          status: "joined" | "removed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          source?: string;
          status?: "joined" | "removed";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          source?: string;
          status?: "joined" | "removed";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      orky_public_context: {
        Row: {
          id: string;
          status: "live" | "napping";
          session_id: string | null;
          payload: Record<string, unknown>;
          last_event_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          status?: "live" | "napping";
          session_id?: string | null;
          payload?: Record<string, unknown>;
          last_event_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          status?: "live" | "napping";
          session_id?: string | null;
          payload?: Record<string, unknown>;
          last_event_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      publisher_profiles: {
        Row: {
          id: string;
          user_id: string;
          display_name: string;
          github_handle: string | null;
          website_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          display_name: string;
          github_handle?: string | null;
          website_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          display_name?: string;
          github_handle?: string | null;
          website_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      registry_items: {
        Row: {
          id: string;
          slug: string;
          kind: "pack" | "profile-pack" | "adapter" | "skill-pack" | "mcp-pack" | "command-pack";
          name: string;
          description: string;
          publisher_id: string | null;
          source_url: string;
          manifest_url: string | null;
          status: "pending" | "approved" | "rejected" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          kind: "pack" | "profile-pack" | "adapter" | "skill-pack" | "mcp-pack" | "command-pack";
          name: string;
          description: string;
          publisher_id?: string | null;
          source_url: string;
          manifest_url?: string | null;
          status?: "pending" | "approved" | "rejected" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          kind?: "pack" | "profile-pack" | "adapter" | "skill-pack" | "mcp-pack" | "command-pack";
          name?: string;
          description?: string;
          publisher_id?: string | null;
          source_url?: string;
          manifest_url?: string | null;
          status?: "pending" | "approved" | "rejected" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      registry_versions: {
        Row: {
          id: string;
          registry_item_id: string;
          version: string;
          manifest_json: Record<string, unknown>;
          source_url: string;
          status: "pending" | "approved" | "rejected" | "archived";
          created_at: string;
        };
        Insert: {
          id?: string;
          registry_item_id: string;
          version: string;
          manifest_json: Record<string, unknown>;
          source_url: string;
          status?: "pending" | "approved" | "rejected" | "archived";
          created_at?: string;
        };
        Update: {
          id?: string;
          registry_item_id?: string;
          version?: string;
          manifest_json?: Record<string, unknown>;
          source_url?: string;
          status?: "pending" | "approved" | "rejected" | "archived";
          created_at?: string;
        };
        Relationships: [];
      };
      registry_submissions: {
        Row: {
          id: string;
          submitter_id: string;
          publisher_id: string | null;
          registry_item_id: string | null;
          registry_version_id: string | null;
          kind: "pack" | "profile-pack" | "adapter" | "skill-pack" | "mcp-pack" | "command-pack";
          slug: string;
          name: string;
          description: string;
          version: string;
          source_url: string;
          manifest_url: string | null;
          manifest_json: Record<string, unknown> | null;
          review_status: "pending" | "approved" | "rejected";
          reviewer_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          submitter_id: string;
          publisher_id?: string | null;
          registry_item_id?: string | null;
          registry_version_id?: string | null;
          kind: "pack" | "profile-pack" | "adapter" | "skill-pack" | "mcp-pack" | "command-pack";
          slug: string;
          name: string;
          description: string;
          version?: string;
          source_url: string;
          manifest_url?: string | null;
          manifest_json?: Record<string, unknown> | null;
          review_status?: "pending" | "approved" | "rejected";
          reviewer_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          submitter_id?: string;
          publisher_id?: string | null;
          registry_item_id?: string | null;
          registry_version_id?: string | null;
          kind?: "pack" | "profile-pack" | "adapter" | "skill-pack" | "mcp-pack" | "command-pack";
          slug?: string;
          name?: string;
          description?: string;
          version?: string;
          source_url?: string;
          manifest_url?: string | null;
          manifest_json?: Record<string, unknown> | null;
          review_status?: "pending" | "approved" | "rejected";
          reviewer_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
