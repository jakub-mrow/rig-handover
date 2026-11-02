// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log (runs/<night>.jsonl).
export type DigestRow = {
  job: string;
  // Owner on the job's last line. `null` stays `null`; views render it as `—`.
  owner: string | null;
  // Lines for this job, whatever their status.
  runs: number;
  // Lines for this job with status `retry`.
  retries: number;
  lastStatus: RunStatus;
  // `error` of the job's last line; `null` when that line has none.
  lastError: string | null;
  // `at` of the job's first and last lines, exactly as logged (offset kept, never converted).
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job
  // Lines with each status, across all jobs (the board shows these beside each night).
  counts: Record<RunStatus, number>;
  // Lines that did not parse as a run line. Counted, never thrown.
  badLines: number;
};

// `null` when runs/<night>.jsonl does not exist (or `night` is not YYYY-MM-DD): routes answer 404.
// An empty file is a Night with no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
