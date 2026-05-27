-- Apollo job queue schema reference for Supabase.
-- Canonical status values: queued, running, success, failed.
-- This file is documentation/reference unless you wire it into your migration flow.

create extension if not exists pgcrypto;

do $$
begin
  create type public.apollo_job_status as enum ('queued', 'running', 'success', 'failed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  command text not null,
  status public.apollo_job_status not null default 'queued',
  device_id text null,
  claimed_at timestamptz null,
  completed_at timestamptz null,
  exit_code integer null,
  stdout text null,
  stderr text null,
  logs text null,
  error_message text null,
  cwd text null,
  env jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_claimed_at_idx on public.jobs (claimed_at);
create index if not exists jobs_device_id_idx on public.jobs (device_id);

comment on table public.jobs is 'Queue of shell jobs processed by Apollo listeners.';
comment on column public.jobs.id is 'Primary job identifier.';
comment on column public.jobs.command is 'Shell command to execute.';
comment on column public.jobs.status is 'Job lifecycle state: queued, running, success, failed.';
comment on column public.jobs.device_id is 'Identifier for the device or worker that claimed the job.';
comment on column public.jobs.claimed_at is 'Timestamp when the job was claimed.';
comment on column public.jobs.completed_at is 'Timestamp when the job finished.';
comment on column public.jobs.exit_code is 'Process exit code returned by the shell command.';
comment on column public.jobs.stdout is 'Captured standard output.';
comment on column public.jobs.stderr is 'Captured standard error.';
comment on column public.jobs.logs is 'Append-only log buffer for job progress.';
comment on column public.jobs.error_message is 'High-level error message for failures.';
comment on column public.jobs.cwd is 'Working directory used for execution.';
comment on column public.jobs.env is 'Environment variables supplied to the command.';
comment on column public.jobs.created_at is 'Row creation timestamp.';
comment on column public.jobs.updated_at is 'Row update timestamp.';
