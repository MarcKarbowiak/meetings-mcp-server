import type { MinedRequirement } from './requirementMiner.js';
import type { SynthesizedUserStory, UserStorySynthesisResult } from '../types.js';

import {
  extractInvalidThing,
  extractLockout,
  extractOnlyConstraint,
  extractPerformance,
  inferPersona,
  normalizeCapabilityFromIWant,
  splitButNotConstraint,
  splitInlineConstraint,
  toSentence
} from './intentParsing.js';

function normalizeCriterionForCompare(s: string): string {
  return s.trim().replace(/[.]+$/g, '').replace(/\s+/g, ' ').toLowerCase();
}

function pushUniqueSentence(list: string[], sentence: string): void {
  const normalized = normalizeCriterionForCompare(sentence);
  if (!normalized) return;
  if (list.some(existing => normalizeCriterionForCompare(existing) === normalized)) return;
  list.push(sentence);
}

function inferGoal(reqText: string): { iWant: string; soThat?: string } {
  // Special-case: conditional invalid input -> treat as validation/feedback capability.
  if (/^\s*if\b/i.test(reqText) && /\b(show|display)\b/i.test(reqText) && /\berror\b/i.test(reqText)) {
    const thing = extractInvalidThing(reqText) ?? 'input';
    return { iWant: `to see an error message when I provide an invalid ${thing}` };
  }

  // Special-case: lockout language.
  const lockout = extractLockout(reqText);
  if (lockout) {
    const thing = lockout.thing ?? 'input';
    return { iWant: `to prevent repeated invalid ${thing} attempts by temporarily locking searches` };
  }

  // Special-case: performance / latency.
  const perf = extractPerformance(reqText);
  if (perf && /\b(search results|results)\b/i.test(reqText)) {
    return { iWant: `to receive search results within ${perf.withinSeconds} seconds` };
  }

  // Prefer explicit “so that ...” if present.
  const soThatMatch = reqText.match(/\bso that\b\s+(.+)$/i);
  const soThat = soThatMatch ? soThatMatch[1]?.trim() : undefined;

  // Grab the part after the strongest modal phrase.
  const goalMatch = reqText.match(/\b(need to|needs to|must|should|have to|has to|we want to|we need to)\b\s+(.+?)(?:\bso that\b|$)/i);
  const goal = (goalMatch?.[2] ?? reqText).trim().replace(/[.]+$/g, '');

  // Normalize to “to <verb phrase>” style.
  const iWant = goal.toLowerCase().startsWith('to ') ? goal : `to ${goal}`;

  return { iWant, soThat: soThat?.replace(/[.]+$/g, '') };
}

export function synthesizeUserStoriesDeterministic(params: {
  text: string;
  tenantId?: string;
  requirements: MinedRequirement[];
  maxStories?: number;
}): UserStorySynthesisResult {
  const { tenantId, requirements } = params;
  const maxStories = Math.max(1, Math.min(params.maxStories ?? 10, 50));

  const stories: SynthesizedUserStory[] = [];
  for (const req of requirements.slice(0, maxStories)) {
    const persona = inferPersona(req.text);
    const goal = inferGoal(req.text);
    const { iWant, soThat } = goal;

    const capabilityRaw = normalizeCapabilityFromIWant(iWant);
    const afterButNot = splitButNotConstraint(capabilityRaw);
    const afterInline = splitInlineConstraint(afterButNot.capability);
    const capability = afterInline.capability;
    const constraint = afterInline.constraint ?? afterButNot.constraint;
    const invalidThing = extractInvalidThing(req.text);
    const lockout = extractLockout(req.text);
    const perf = extractPerformance(req.text);
    const onlyConstraint = extractOnlyConstraint(req.text);

    const acceptanceCriteria: string[] = [];

    // Happy path
    if (invalidThing) {
      pushUniqueSentence(acceptanceCriteria, toSentence(`If a valid ${invalidThing} is provided, the system accepts it`));
    } else if (/^(show|display)\b/i.test(capability)) {
      const shown = capability.replace(/^(show|display)\s+/i, '').trim();
      pushUniqueSentence(acceptanceCriteria, toSentence(`The system shows ${shown}`));
    } else {
      pushUniqueSentence(acceptanceCriteria, toSentence(`The ${persona} can ${capability}`));
    }

    // Constraint / error / edge
    if (lockout) {
      const thing = lockout.thing ?? 'input';
      pushUniqueSentence(
        acceptanceCriteria,
        toSentence(`After ${lockout.attempts} invalid ${thing} attempts, further searches are blocked for ${lockout.durationMinutes} minutes`)
      );
    } else if (perf && /\b(search results|results)\b/i.test(req.text)) {
      pushUniqueSentence(acceptanceCriteria, toSentence(`Search results are returned within ${perf.withinSeconds} seconds`));
    } else if (onlyConstraint) {
      pushUniqueSentence(acceptanceCriteria, toSentence(`The ${persona} can only ${onlyConstraint}`));
    } else if (constraint) {
      pushUniqueSentence(acceptanceCriteria, toSentence(`The ${persona} ${constraint}`));
    } else if (invalidThing) {
      pushUniqueSentence(acceptanceCriteria, toSentence(`If an invalid ${invalidThing} is provided, the system shows an error message`));
    } else if (/\b(cannot|can't|must not|invalid|error|denied|reject|fails?)\b/i.test(req.text)) {
      pushUniqueSentence(acceptanceCriteria, toSentence('Invalid input or prohibited actions result in a clear error message'));
    } else {
      pushUniqueSentence(acceptanceCriteria, toSentence('If the action cannot be completed, the system provides a clear error message'));
    }

    stories.push({
      asA: persona,
      iWant: `to ${capability}`,
      ...(soThat !== undefined ? { soThat } : {}),
      acceptanceCriteria,
      evidence: req.evidence,
      confidence: 'low'
    });
  }

  const gaps: string[] = [];
  const followUpQuestions: string[] = [];
  if (stories.length > 0) {
    followUpQuestions.push('Which user roles/personas should we prioritize?');
    followUpQuestions.push('What are the acceptance criteria for each story (success + error cases)?');
    followUpQuestions.push('Are there non-functional requirements (latency, audit, security) that apply?');
  }

  return { tenantId, modeUsed: 'deterministic', stories, gaps, followUpQuestions };
}
