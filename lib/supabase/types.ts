/**
 * Database types for the Supabase client.
 *
 * Hand-written to match supabase/migrations/0001_init.sql. Once the Supabase
 * project exists, regenerate the authoritative version with:
 *
 *   npx supabase gen types typescript --project-id <ref> > lib/supabase/types.ts
 *
 * until then this stub keeps the typed client honest.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ApplicationStatus =
  | "saved"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "accepted";

export type DocType = "resume" | "cover_letter";

export interface Database {
  public: {
    Tables: {
      career_memory: {
        Row: {
          id: string;
          user_id: string;
          profile: Json;
          voice_samples: string[];
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          profile: Json;
          voice_samples?: string[];
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          profile?: Json;
          voice_samples?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      base_resumes: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          sections: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          sections: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          sections?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      applications: {
        Row: {
          id: string;
          user_id: string;
          company: string;
          role_title: string;
          job_description: string;
          jd_extraction: Json | null;
          status: ApplicationStatus;
          applied_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company: string;
          role_title: string;
          job_description: string;
          jd_extraction?: Json | null;
          status?: ApplicationStatus;
          applied_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          company?: string;
          role_title?: string;
          job_description?: string;
          jd_extraction?: Json | null;
          status?: ApplicationStatus;
          applied_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          user_id: string;
          application_id: string;
          base_resume_id: string | null;
          doc_type: DocType;
          version: number;
          content: Json;
          score: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          application_id: string;
          base_resume_id?: string | null;
          doc_type: DocType;
          version: number;
          content: Json;
          score?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          application_id?: string;
          base_resume_id?: string | null;
          doc_type?: DocType;
          version?: number;
          content?: Json;
          score?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      suggestion_edits: {
        Row: {
          id: string;
          user_id: string;
          application_id: string | null;
          ai_suggested: string;
          user_final: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          application_id?: string | null;
          ai_suggested: string;
          user_final: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          application_id?: string | null;
          ai_suggested?: string;
          user_final?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      application_status: ApplicationStatus;
      doc_type: DocType;
    };
    CompositeTypes: Record<never, never>;
  };
}
