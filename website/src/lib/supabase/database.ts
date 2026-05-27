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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
