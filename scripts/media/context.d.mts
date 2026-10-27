import type { Sql } from "postgres";
import type { SupabaseClient } from "@supabase/supabase-js";
export function mediaContext(): Promise<{ db: Sql; storage: SupabaseClient }>;
