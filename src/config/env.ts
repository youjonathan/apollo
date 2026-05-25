import type { SupabaseConfig } from "../queue/supabase.ts";

export function readApolloConfigFromEnv(): SupabaseConfig {
  const url = process.env.SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const tableName = process.env.APOLLO_JOBS_TABLE ?? "apollo_jobs";

  if (!url) throw new Error("SUPABASE_URL is required");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");

  return { url, serviceRoleKey, tableName };
}
