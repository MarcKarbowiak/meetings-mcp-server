import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { mineRequirementsDeterministic } from '../src/core/synthesizers/requirementMiner.js';
import { synthesizeGherkinDeterministic } from '../src/core/synthesizers/gherkinSynthesizer.js';
import { synthesizeUserStoriesDeterministic } from '../src/core/synthesizers/userStorySynthesizer.js';

async function readUtf8(path: string): Promise<string> {
  return await readFile(new URL(path, import.meta.url), 'utf8');
}

async function readGoldenJson(path: string): Promise<unknown> {
  const raw = await readUtf8(path);
  return JSON.parse(raw) as unknown;
}

describe('synthesizers (plain-transcript.txt, deterministic)', () => {
  it('synthesizeUserStoriesDeterministic matches golden output', async () => {
    const text = await readFile(new URL('../examples/inputs/plain-transcript.txt', import.meta.url), 'utf8');
    const mined = mineRequirementsDeterministic(text);
    const result = synthesizeUserStoriesDeterministic({
      text,
      tenantId: 'demo',
      requirements: mined.requirements,
      maxStories: 10
    });
    result.gaps.push(...mined.gaps);
    result.followUpQuestions.push(...mined.followUpQuestions);

    const expected = await readGoldenJson('./golden/userStories.plain-transcript.synth.json');
    expect(result).toEqual(expected);
  });

  it('synthesizeGherkinDeterministic matches golden output', async () => {
    const text = await readFile(new URL('../examples/inputs/plain-transcript.txt', import.meta.url), 'utf8');
    const mined = mineRequirementsDeterministic(text);
    const result = synthesizeGherkinDeterministic({
      text,
      tenantId: 'demo',
      requirements: mined.requirements,
      maxScenarios: 10
    });
    result.gaps.push(...mined.gaps);
    result.followUpQuestions.push(...mined.followUpQuestions);

    const expected = await readGoldenJson('./golden/gherkin.plain-transcript.synth.json');
    expect(result).toEqual(expected);
  });
});
