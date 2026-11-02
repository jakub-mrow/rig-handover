import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');
  const row = (job: string) => night?.rows.find((r) => r.job === job);

  it('has one row per job, sorted by job, and counts the bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.night).toBe('2026-10-28');
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.badLines).toBe(1);
    expect(night?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('takes runs, retries, status and owner per job', () => {
    expect(row('fixtures/refresh')).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null, owner: 'rook' });
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', owner: 'lane-07' });
    expect(row('digest/render')?.owner).toBeNull();
  });

  it('keeps times exactly as logged', () => {
    expect(row('fixtures/refresh')?.firstAt).toBe('2026-10-29T01:30:00+01:00');
    expect(row('fixtures/refresh')?.lastAt).toBe('2026-10-29T01:37:00+01:00');
  });
});

describe('readNight edge cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('returns null for a night with no file', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
  });

  it('returns null for a night that is not YYYY-MM-DD', () => {
    expect(readNight('runs', '../package')).toBeNull();
    expect(readNight('runs', '2026-10-28.jsonl')).toBeNull();
  });

  it('reads an empty file as a night with no rows', () => {
    writeFileSync(join(dir, '2026-11-01.jsonl'), '');
    expect(readNight(dir, '2026-11-01')).toEqual({
      night: '2026-11-01',
      rows: [],
      counts: { ok: 0, retry: 0, fail: 0 },
      badLines: 0,
    });
  });

  it('counts valid JSON of the wrong shape as bad, and skips blank lines', () => {
    const lines = [
      '{"at":"t1","job":"a","status":"ok","owner":null}',
      '',
      '{"at":"t2","job":"a","status":"weird","owner":null}',
      '[1,2]',
      '{"at":"t3","job":"a","status":"fail","owner":"x","error":5}',
      '',
    ];
    writeFileSync(join(dir, '2026-11-02.jsonl'), lines.join('\n'));
    const n = readNight(dir, '2026-11-02');
    expect(n?.badLines).toBe(3);
    expect(n?.rows).toHaveLength(1);
    expect(n?.counts).toEqual({ ok: 1, retry: 0, fail: 0 });
  });
});
