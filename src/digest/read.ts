import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildNight } from './parse.js';
import type { ReadNight } from './types.js';

// Also the path-traversal guard: only a plain date ever reaches the file system.
const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

// Plan morning-digest § 1 (issue #1).
export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  return buildNight(night, text);
};
