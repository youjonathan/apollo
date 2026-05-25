export type ApolloJobStatus = "queued" | "running" | "completed" | "failed" | "canceled";

export interface ApolloJob {
  id: string;
  command: string;
  status: ApolloJobStatus;
  created_at?: string;
  updated_at?: string;
  claimed_at?: string | null;
  completed_at?: string | null;
  exit_code?: number | null;
  stdout?: string | null;
  stderr?: string | null;
  logs?: string | null;
  error_message?: string | null;
  cwd?: string | null;
  env?: Record<string, string> | null;
}

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
  tableName?: string;
}

export interface JobLogPatch {
  status?: ApolloJobStatus;
  claimed_at?: string | null;
  completed_at?: string | null;
  exit_code?: number | null;
  stdout?: string | null;
  stderr?: string | null;
  logs?: string | null;
  error_message?: string | null;
}

function assertConfig(config: SupabaseConfig): Required<SupabaseConfig> {
  if (!config.url) throw new Error("Missing Supabase url");
  if (!config.serviceRoleKey) throw new Error("Missing Supabase service role key");
  return {
    url: config.url.replace(/\/$/, ""),
    serviceRoleKey: config.serviceRoleKey,
    tableName: config.tableName ?? "apollo_jobs",
  };
}

async function supabaseRequest<T>(
  config: SupabaseConfig,
  path: string,
  init: RequestInit,
): Promise<T> {
  const cfg = assertConfig(config);
  const headers = new Headers(init.headers ?? undefined);
  headers.set("apikey", cfg.serviceRoleKey);
  headers.set("Authorization", `Bearer ${cfg.serviceRoleKey}`);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  headers.set("Prefer", "return=representation");

  const response = await fetch(`${cfg.url}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}): ${text}`);
  }

  return (text ? JSON.parse(text) : null) as T;
}

export async function fetchNextQueuedJob(config: SupabaseConfig): Promise<ApolloJob | null> {
  const cfg = assertConfig(config);
  const path = `/rest/v1/${cfg.tableName}` +
    `?status=eq.queued&order=created_at.asc&limit=1&select=*`;
  const rows = await supabaseRequest<ApolloJob[]>(config, path, { method: "GET" });
  return rows[0] ?? null;
}

export async function claimJob(config: SupabaseConfig, jobId: string): Promise<ApolloJob | null> {
  const cfg = assertConfig(config);
  const now = new Date().toISOString();
  const path = `/rest/v1/${cfg.tableName}?id=eq.${encodeURIComponent(jobId)}&status=eq.queued&select=*`;
  const rows = await supabaseRequest<ApolloJob[]>(config, path, {
    method: "PATCH",
    body: JSON.stringify({ status: "running", claimed_at: now, updated_at: now }),
  });
  return rows[0] ?? null;
}

export async function updateJob(config: SupabaseConfig, jobId: string, patch: JobLogPatch): Promise<ApolloJob | null> {
  const cfg = assertConfig(config);
  const now = new Date().toISOString();
  const path = `/rest/v1/${cfg.tableName}?id=eq.${encodeURIComponent(jobId)}&select=*`;
  const rows = await supabaseRequest<ApolloJob[]>(config, path, {
    method: "PATCH",
    body: JSON.stringify({ ...patch, updated_at: now }),
  });
  return rows[0] ?? null;
}

export async function appendJobLogs(
  config: SupabaseConfig,
  jobId: string,
  message: string,
): Promise<ApolloJob | null> {
  const existing = await fetchJobById(config, jobId);
  const mergedLogs = [existing?.logs, message].filter(Boolean).join("\n");
  return await updateJob(config, jobId, { logs: mergedLogs });
}

export async function fetchJobById(config: SupabaseConfig, jobId: string): Promise<ApolloJob | null> {
  const cfg = assertConfig(config);
  const path = `/rest/v1/${cfg.tableName}?id=eq.${encodeURIComponent(jobId)}&select=*`;
  const rows = await supabaseRequest<ApolloJob[]>(config, path, { method: "GET" });
  return rows[0] ?? null;
}
