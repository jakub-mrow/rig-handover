import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

// Fixtures live in a temp dir; runs/ is read-only and never touched here.
let runsDir: string;

const appFor = (dir: string) =>
  createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });

// Job names in the order they first appear in the page HTML.
const jobsInPageOrder = (html: string, jobs: string[]) =>
  [...jobs].sort((a, b) => html.indexOf(a) - html.indexOf(b));

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));

  // Good lines, deliberately not in job order in the file.
  writeFileSync(
    join(runsDir, '2026-10-29.jsonl'),
    [
      '{"at":"2026-10-29T01:00:00+01:00","job":"notes/backup","status":"fail","owner":"lane-07","error":"quota exceeded"}',
      '{"at":"2026-10-29T01:05:00+01:00","job":"digest/render","status":"ok","owner":null}',
      '{"at":"2026-10-29T01:10:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook"}',
      '{"at":"2026-10-29T01:12:00+01:00","job":"fixtures/refresh","status":"ok","owner":"rook"}',
      '{"at":"2026-10-29T01:20:00+01:00","job":"lane/sync","status":"ok","owner":"lane-07"}',
      '',
    ].join('\n'),
  );

  // Exists, 0 bytes.
  writeFileSync(join(runsDir, '2026-10-30.jsonl'), '');

  // One line that does not parse, between good ones.
  writeFileSync(
    join(runsDir, '2026-10-31.jsonl'),
    [
      '{"at":"2026-10-31T02:00:00+01:00","job":"lane/sync","status":"ok","owner":"lane-07"}',
      'not a run line',
      '{"at":"2026-10-31T02:01:00+01:00","job":"digest/render","status":"ok","owner":null}',
      '',
    ].join('\n'),
  );
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('GET /digest/:night', () => {
  it('answers 200 and lists each job of the night', async () => {
    const res = await appFor(runsDir).request('/digest/2026-10-29');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of ['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup']) {
      expect(html).toContain(job);
    }
  });

  it('answers 404 for a night with no file', async () => {
    const res = await appFor(runsDir).request('/digest/2026-11-01');
    const html = await res.text();
    expect(res.status).toBe(404);
    expect(html).toContain('no run log for that night');
  });

  it('says nothing ran for the empty night', async () => {
    const res = await appFor(runsDir).request('/digest/2026-10-30');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('still lists the good jobs of a night with a bad line, and says so', async () => {
    const res = await appFor(runsDir).request('/digest/2026-10-31');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('lane/sync');
    expect(html).toContain('digest/render');
    expect(html).toContain('1 line(s) did not parse');
  });
});

describe('GET /api/digest/:night', () => {
  it('answers 200 with the night, rows in the same job order as the page', async () => {
    const page = await appFor(runsDir).request('/digest/2026-10-29');
    const html = await page.text();
    const res = await appFor(runsDir).request('/api/digest/2026-10-29');
    expect(res.status).toBe(200);
    const night = (await res.json()) as Night;
    expect(night.night).toBe('2026-10-29');
    expect(night.counts).toEqual({ ok: 3, retry: 1, fail: 1 });
    expect(night.badLines).toBe(0);
    const jobs = night.rows.map((r) => r.job);
    expect(jobs).toEqual(['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup']);
    expect(jobs.every((job) => html.indexOf(job) >= 0)).toBe(true);
    expect(jobsInPageOrder(html, jobs)).toEqual(jobs);
  });

  it('answers 404 with an error for a night with no file', async () => {
    const res = await appFor(runsDir).request('/api/digest/2026-11-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for that night' });
  });

  it('answers 200 with no rows for the empty night', async () => {
    const res = await appFor(runsDir).request('/api/digest/2026-10-30');
    expect(res.status).toBe(200);
    const night = (await res.json()) as Night;
    expect(night.rows).toEqual([]);
  });

  it('counts the bad line and keeps the good jobs', async () => {
    const res = await appFor(runsDir).request('/api/digest/2026-10-31');
    expect(res.status).toBe(200);
    const night = (await res.json()) as Night;
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual(['digest/render', 'lane/sync']);
  });
});
