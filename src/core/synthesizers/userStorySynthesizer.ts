import type { MinedRequirement } from './requirementMiner.js';
import type { SynthesizedUserStory, UserStorySynthesisResult } from '../types.js';

function inferPersona(reqText: string): string {
  const t = reqText.toLowerCase();
  // Prefer explicit operational roles over generic nouns that might appear in object phrases (e.g., "customer email").
  if (t.includes('support agent') || t.includes('support agents') || /\bagents?\b/.test(t)) return 'support agent';
  if (t.includes('admin')) return 'admin';
  if (t.includes('manager')) return 'manager';
  if (t.includes('product owner')) return 'product owner';
  if (t.includes('audit') || t.includes('audit log') || t.includes('compliance')) return 'compliance auditor';
  if (/\bcustomers?\b\s+(want|wants|need|needs|must|should|can|cannot|can't)\b/.test(t)) return 'customer';
  return 'user';
}

function toSentence(s: string): string {
  const trimmed = s.trim().replace(/[.]+$/g, '');
  if (!trimmed) return '';
  return `${trimmed[0]!.toUpperCase()}${trimmed.slice(1)}.`;
}

function normalizeCapabilityFromIWant(iWant: string): string {
  let c = iWant.trim();
  c = c.replace(/^to\s+/i, '');
  c = c.replace(/^be\s+able\s+to\s+/i, '');
  c = c.replace(/^able\s+to\s+/i, '');
  c = c.replace(/\s+/g, ' ').trim();
  return c;
}

function splitInlineConstraint(capability: string): { capability: string; constraint?: string } {
  // Common transcript pattern: "... add X that customers cannot see"
  const m = capability.match(/^(.*)\bthat\b\s+(.+\b(cannot|can't|must not)\b.+)$/i);
  if (!m) return { capability };
  const base = m[1]?.trim().replace(/[.]+$/g, '') ?? capability;
  const constraint = m[2]?.trim() ?? undefined;
  return { capability: base, constraint };
}

function splitButNotConstraint(capability: string): { capability: string; constraint?: string } {
  // Common requirements phrasing: "view progress, but not edit anything"
  const m = capability.match(/^(.*?)(?:,)?\s*\bbut\s+not\b\s+(.+)$/i);
  if (!m) return { capability };
  const base = (m[1] ?? capability).trim().replace(/[.]+$/g, '');
  const constraint = (m[2] ?? '').trim().replace(/[.]+$/g, '');
  if (!constraint) return { capability: base };
  return { capability: base, constraint: `cannot ${constraint}` };
}

function extractOnlyConstraint(reqText: string): string | undefined {
  // Example: "should only see the tasks they're assigned to"
  const m = reqText.match(/\bonly\b\s+(.+)$/i);
  const remainder = m?.[1]?.trim();
  if (!remainder) return undefined;
  // If the sentence already includes a verb phrase like "see ...", keep it.
  return remainder.replace(/[.]+$/g, '');
}

function extractInvalidThing(reqText: string): string | undefined {
  const m = reqText.match(/\binvalid\s+([a-z][a-z0-9_-]*)\b/i);
  return m?.[1]?.toLowerCase();
}

function extractLockout(reqText: string): { attempts: number; thing?: string; durationMinutes: number } | undefined {
  const t = reqText.toLowerCase();
  if (!t.includes('lock')) return undefined;

  const attemptsMatch = t.match(/\bafter\s+(\d+)\s+.*?(failed|invalid).*?(attempts?)\b|\b(\d+)\s+(failed|invalid)\s+(attempts?)\b/i);
  const attemptsRaw = attemptsMatch?.[1] ?? attemptsMatch?.[4];
  const attempts = attemptsRaw ? Number.parseInt(attemptsRaw, 10) : NaN;
  if (!Number.isFinite(attempts) || attempts <= 0) return undefined;

  const durationMatch = t.match(/\bfor\s+(\d+)\s+(minutes?|mins?)\b/i);
  const durationRaw = durationMatch?.[1];
  const durationMinutes = durationRaw ? Number.parseInt(durationRaw, 10) : NaN;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return undefined;

  return { attempts, thing: extractInvalidThing(reqText), durationMinutes };
}

function extractPerformance(reqText: string): { withinSeconds: number } | undefined {
  const t = reqText.toLowerCase();
  if (!t.includes('within')) return undefined;
  const m = t.match(/\bwithin\s+(\d+)\s*(seconds?|secs?|s)\b/i);
  const raw = m?.[1];
  const withinSeconds = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(withinSeconds) || withinSeconds <= 0) return undefined;
  return { withinSeconds };
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
      acceptanceCriteria.push(toSentence(`If a valid ${invalidThing} is provided, the system accepts it`));
    } else if (/^(show|display)\b/i.test(capability)) {
      const shown = capability.replace(/^(show|display)\s+/i, '').trim();
      acceptanceCriteria.push(toSentence(`The system shows ${shown}`));
    } else {
      acceptanceCriteria.push(toSentence(`The ${persona} can ${capability}`));
    }

    // Constraint / error / edge
    if (lockout) {
      const thing = lockout.thing ?? 'input';
      acceptanceCriteria.push(toSentence(`After ${lockout.attempts} invalid ${thing} attempts, further searches are blocked for ${lockout.durationMinutes} minutes`));
    } else if (perf && /\b(search results|results)\b/i.test(req.text)) {
      acceptanceCriteria.push(toSentence(`Search results are returned within ${perf.withinSeconds} seconds`));
    } else if (onlyConstraint) {
      acceptanceCriteria.push(toSentence(`The ${persona} can only ${onlyConstraint}`));
    } else if (constraint) {
      acceptanceCriteria.push(toSentence(`The ${persona} ${constraint}`));
    } else if (invalidThing) {
      acceptanceCriteria.push(toSentence(`If an invalid ${invalidThing} is provided, the system shows an error message`));
    } else if (/\b(cannot|can't|must not|invalid|error|denied|reject|fails?)\b/i.test(req.text)) {
      acceptanceCriteria.push(toSentence('Invalid input or prohibited actions result in a clear error message'));
    } else {
      acceptanceCriteria.push(toSentence('If the action cannot be completed, the system provides a clear error message'));
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
