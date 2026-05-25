import { spawn } from "node:child_process";

export interface ShellExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface ShellExecResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export async function executeShellCommand(
  command: string,
  options: ShellExecOptions = {},
): Promise<ShellExecResult> {
  if (!command || !command.trim()) {
    throw new Error("Command is required");
  }

  const cwd = options.cwd ?? process.cwd();
  const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;

  return await new Promise<ShellExecResult>((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      env: {
        ...process.env,
        ...(options.env ?? {}),
      },
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let finished = false;

    const timer = setTimeout(() => {
      if (finished) return;
      child.kill("SIGKILL");
      finished = true;
      resolve({
        command,
        exitCode: 124,
        stdout,
        stderr: stderr + "\nProcess timed out",
        timedOut: true,
      });
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (finished) return;
      clearTimeout(timer);
      finished = true;
      reject(error);
    });

    child.on("close", (code) => {
      if (finished) return;
      clearTimeout(timer);
      finished = true;
      resolve({
        command,
        exitCode: typeof code === "number" ? code : 1,
        stdout,
        stderr,
        timedOut: false,
      });
    });
  });
}
