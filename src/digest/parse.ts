import type { DigestRow, Night, RunStatus } from './types.js';

// One good line of a night's run log, after parsing at the edge.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

const isStatus = (value: unknown): value is RunStatus =>
  typeof value === 'string' && (STATUSES as readonly string[]).includes(value);

// A run line, or `null` when the text is not valid JSON or not of the run-line shape.
export const parseLine = (text: string): RunLine | null => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { at, job, status, owner, error } = value as Record<string, unknown>;
  if (typeof at !== 'string' || typeof job !== 'string' || !isStatus(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && typeof error !== 'string') return null;
  return error === undefined ? { at, job, status, owner } : { at, job, status, owner, error };
};

// The whole night from the file's text. Blank lines are skipped; bad lines are counted.
export const buildNight = (night: string, text: string): Night => {
  const counts: Record<RunStatus, number> = { ok: 0, retry: 0, fail: 0 };
  const rows = new Map<string, DigestRow>();
  let badLines = 0;

  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line === null) {
      badLines += 1;
      continue;
    }
    counts[line.status] += 1;
    const retry = line.status === 'retry' ? 1 : 0;
    const prev = rows.get(line.job);
    rows.set(line.job, {
      job: line.job,
      owner: line.owner,
      runs: (prev?.runs ?? 0) + 1,
      retries: (prev?.retries ?? 0) + retry,
      lastStatus: line.status,
      lastError: line.error ?? null,
      firstAt: prev?.firstAt ?? line.at,
      lastAt: line.at,
    });
  }

  const sorted = [...rows.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows: sorted, counts, badLines };
};
