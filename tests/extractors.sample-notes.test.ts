import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { extractGherkin } from '../src/core/extractors/gherkinExtractor.js';
import { extractMeetingSignals } from '../src/core/extractors/meetingSignalsExtractor.js';
import { extractUserStories } from '../src/core/extractors/userStoryExtractor.js';

async function readUtf8(path: string): Promise<string> {
  return await readFile(new URL(path, import.meta.url), 'utf8');
}

async function readGoldenJson(path: string): Promise<unknown> {
  const raw = await readUtf8(path);
  return JSON.parse(raw) as unknown;
}

describe('extractors (sample-notes.txt)', () => {
  it('extractUserStories matches golden output', async () => {
    const text = await readFile(new URL('../examples/inputs/sample-notes.txt', import.meta.url), 'utf8');
    const result = extractUserStories(text, 'demo');
    const expected = await readGoldenJson('./golden/userStories.sample-notes.json');
    expect(result).toEqual(expected);
  });

  it('extractGherkin matches golden output', async () => {
    const text = await readFile(new URL('../examples/inputs/sample-notes.txt', import.meta.url), 'utf8');
    const result = extractGherkin(text, 'demo');
    const expected = await readGoldenJson('./golden/gherkin.sample-notes.json');
    expect(result).toEqual(expected);
  });

  it('extractMeetingSignals matches golden output', async () => {
    const text = await readFile(new URL('../examples/inputs/sample-notes.txt', import.meta.url), 'utf8');
    const result = extractMeetingSignals(text, 'demo');
    const expected = await readGoldenJson('./golden/signals.sample-notes.json');
    expect(result).toEqual(expected);
  });
});
