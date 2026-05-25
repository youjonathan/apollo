import { appendJobLogs, claimJob, fetchNextQueuedJob, updateJob, type ApolloJob, type SupabaseConfig } from "../queue/supabase.js";
import { executeShellCommand } from "../shell/exec.js";

export interface ApolloListenerOptions {
  pollIntervalMs?: number;
  shellTimeoutMs?: number;
  stopSignal?: AbortSignal;
}

function readConfigFromEnv(): SupabaseConfig {
  const url = process.env.SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const tableName = process.env.APOLLO_JOBS_TABLE ?? "jobs";

  if (!url) throw new Error("SUPABASE_URL is required");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");

  return { url, serviceRoleKey, tableName };
}

async function processJob(
  config: SupabaseConfig,
  job: ApolloJob,
  shellTimeoutMs: number,
): Promise<void> {
  const claimed = await claimJob(config, job.id);
  if (!claimed) {
    return;
  }

  await appendJobLogs(config, job.id, `Claimed job ${job.id} at ${new Date().toISOString()}`);
  await appendJobLogs(config, job.id, `Executing command: ${claimed.command}`);

  try {
    const result = await executeShellCommand(claimed.command, {
      cwd: claimed.cwd ?? undefined,
      env: claimed.env ?? undefined,
      timeoutMs: shellTimeoutMs,
    });

    const completedAt = new Date().toISOString();
    await updateJob(config, job.id, {
      status: result.exitCode === 0 ? "completed" : "failed",
      completed_at: completedAt,
      exit_code: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      logs: [
        `Claimed at ${claimed.claimed_at ?? completedAt}`,
        `Completed at ${completedAt}`,
        `Exit code: ${result.exitCode}`,
        result.timedOut ? "Timed out" : null,
      ].filter(Boolean).join("\n"),
      error_message: result.exitCode === 0 ? null : `Command exited with code ${result.exitCode}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateJob(config, job.id, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: message,
    });
    await appendJobLogs(config, job.id, `Execution error: ${message}`);
  }
}

export async function runApolloListener(options: ApolloListenerOptions = {}): Promise<void> {
  const config = readConfigFromEnv();
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const shellTimeoutMs = options.shellTimeoutMs ?? 10 * 60 * 1000;
  const stopSignal = options.stopSignal;

  while (!stopSignal?.aborted) {
    try {
      const job = await fetchNextQueuedJob(config);
      if (!job) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        continue;
      }

      await processJob(config, job, shellTimeoutMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Apollo listener error:", message);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }
}
