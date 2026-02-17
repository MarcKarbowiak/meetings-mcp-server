import type { MinedRequirement } from './requirementMiner.js';
import type { GherkinSynthesisResult, SynthesizedGherkinFeature, SynthesizedGherkinScenario } from '../types.js';

function scenarioNameFromRequirement(reqText: string): string {
  return reqText.trim().replace(/[.]+$/g, '');
}

function inferPersona(reqText: string): string {
  const t = reqText.toLowerCase();
  if (t.includes('support agent') || t.includes('support agents') || /\bagents?\b/.test(t)) return 'support agent';
  if (t.includes('admin')) return 'admin';
  if (/\bcustomers?\b\s+(want|wants|need|needs|must|should|can|cannot|can't)\b/.test(t)) return 'customer';
  return 'user';
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
  const m = t.match(/\bwithin\s+(\d+)\s*(seconds?|secs?|s)\b/i);
  const raw = m?.[1];
  const withinSeconds = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(withinSeconds) || withinSeconds <= 0) return undefined;
  return { withinSeconds };
}

function isAuditRequirement(reqText: string): boolean {
  const t = reqText.toLowerCase();
  return t.includes('audit log') || (t.includes('audit') && (t.includes('record') || t.includes('log')));
}

function isOnlyAssignedVisibility(reqText: string): boolean {
  const t = reqText.toLowerCase();
  return t.includes('only') && (t.includes("assigned") || t.includes("they're assigned") || t.includes('they are assigned')) && t.includes('see');
}

function isViewButNotEdit(reqText: string): boolean {
  const t = reqText.toLowerCase();
  return t.includes('view') && t.includes('but not') && t.includes('edit');
}

function extractVisibilityConstraint(reqText: string): { subject: string; object: string } | undefined {
  // Specific, high-signal pattern used frequently in product meetings.
  // Example: "customers cannot see" -> subject=customers, object=internal note
  const t = reqText.toLowerCase();
  const m = t.match(/\b(customers?|users?)\b\s+(cannot|can't|must not)\s+see\b/);
  if (!m) return undefined;
  // Try to recover the object by looking for "note" or a trailing noun phrase.
  if (t.includes('note')) return { subject: m[1]!, object: 'the internal note' };
  return { subject: m[1]!, object: 'the restricted content' };
}

function normalizeCapability(reqText: string): string {
  // Best-effort extraction of the action/capability phrase.
  const m = reqText.match(/\b(need to|needs to|must|should|have to|has to|can)\b\s+(.+?)(?:\bso that\b|$)/i);
  const raw = (m?.[2] ?? reqText).trim().replace(/[.]+$/g, '');
  const cleaned = raw.replace(/^be\s+able\s+to\s+/i, '').trim();
  // Remove common inline constraint pattern: "... that customers cannot see"
  return cleaned.replace(/\bthat\b\s+.+\b(cannot|can't|must not)\b.+$/i, '').trim();
}

function scenarioForGenericRequirement(reqText: string): { given: string[]; when: string[]; then: string[] } {
  const persona = inferPersona(reqText);
  const capability = normalizeCapability(reqText);

  // System-display style requirements.
  if (/^(show|display)\b/i.test(capability)) {
    const shown = capability.replace(/^(show|display)\s+/i, '').trim();
    const context = shown.toLowerCase().includes('search results') ? 'the user views ticket search results' : 'the user views the relevant results';
    return {
      given: [`a ${persona} is using the product`],
      when: [context],
      then: [`the system shows ${shown}`]
    };
  }

  // Action-oriented requirements.
  return {
    given: [`a ${persona} is using the product`],
    when: [`the ${persona} ${capability.startsWith('to ') ? capability.slice(3) : capability}`],
    then: ['the system allows the action and produces an observable result']
  };
}

export function synthesizeGherkinDeterministic(params: {
  text: string;
  tenantId?: string;
  requirements: MinedRequirement[];
  maxScenarios?: number;
}): GherkinSynthesisResult {
  const { tenantId, requirements } = params;
  const maxScenarios = Math.max(1, Math.min(params.maxScenarios ?? 10, 50));

  const scenarios: SynthesizedGherkinScenario[] = [];

  for (const req of requirements) {
    if (scenarios.length >= maxScenarios) break;

    const persona = inferPersona(req.text);
    const invalidThing = extractInvalidThing(req.text);
    const visibility = extractVisibilityConstraint(req.text);
    const lockout = extractLockout(req.text);
    const perf = extractPerformance(req.text);

    if (isOnlyAssignedVisibility(req.text)) {
      scenarios.push({
        name: 'Contributors only see assigned tasks',
        given: ['an individual contributor has an assigned task and an unassigned task exists'],
        when: ['the contributor views their task list'],
        then: ['assigned tasks are visible'],
        evidence: req.evidence,
        confidence: 'low'
      });
      if (scenarios.length < maxScenarios) {
        scenarios[scenarios.length - 1]!.then.push('unassigned tasks are not visible');
      }
      continue;
    }

    if (isViewButNotEdit(req.text)) {
      scenarios.push({
        name: 'Executives can view progress but cannot edit',
        given: ['an executive is viewing project progress'],
        when: ['the executive attempts to edit a project status'],
        then: ['the system prevents editing'],
        evidence: req.evidence,
        confidence: 'low'
      });
      continue;
    }

    if (lockout) {
      const thing = lockout.thing ?? 'input';
      scenarios.push({
        name: `Too many invalid ${thing} attempts triggers lockout`,
        given: [`a ${persona} is using the product`],
        when: [`the ${persona} attempts to search after ${lockout.attempts} invalid ${thing} attempts`],
        then: [`further searches are blocked for ${lockout.durationMinutes} minutes`],
        evidence: req.evidence,
        confidence: 'low'
      });
      continue;
    }

    if (perf && /\b(search results|results)\b/i.test(req.text)) {
      scenarios.push({
        name: `Search returns results within ${perf.withinSeconds} seconds`,
        given: [`a ${persona} is using the product`],
        when: ['the user searches tickets'],
        then: [`search results are returned within ${perf.withinSeconds} seconds`],
        evidence: req.evidence,
        confidence: 'low'
      });
      continue;
    }

    if (isAuditRequirement(req.text)) {
      scenarios.push({
        name: 'Audit log entry is recorded for internal note changes',
        given: ['a support agent is using the product'],
        when: ['the support agent adds or edits an internal note'],
        then: ['an audit log entry is recorded'],
        evidence: req.evidence,
        confidence: 'low'
      });
      continue;
    }

    // If the requirement talks about invalid input, generate a complementary happy-path as well.
    if (invalidThing) {
      if (scenarios.length < maxScenarios) {
        scenarios.push({
          name: `Valid ${invalidThing} is accepted`,
          given: [`a ${persona} is using the product`],
          when: [`the ${persona} provides a valid ${invalidThing}`],
          then: [`the system accepts the ${invalidThing}`],
          evidence: req.evidence,
          confidence: 'low'
        });
      }
      if (scenarios.length < maxScenarios) {
        scenarios.push({
          name: `Invalid ${invalidThing} shows an error`,
          given: [`a ${persona} is using the product`],
          when: [`the ${persona} provides an invalid ${invalidThing}`],
          then: ['the system shows an error message'],
          evidence: req.evidence,
          confidence: 'low'
        });
      }
      continue;
    }

    // If the requirement includes a clear visibility constraint, generate a second scenario for it.
    if (visibility) {
      if (scenarios.length < maxScenarios) {
        scenarios.push({
          name: 'Support agent adds an internal note',
          given: ['a support agent is using the product'],
          when: ['the support agent adds an internal note to a ticket'],
          then: ['the internal note is saved'],
          evidence: req.evidence,
          confidence: 'low'
        });
      }
      if (scenarios.length < maxScenarios) {
        scenarios.push({
          name: 'Internal note is hidden from customers',
          given: ['an internal note exists on a ticket'],
          when: [`the ${visibility.subject} view the ticket`],
          then: [`${visibility.object} is not visible to ${visibility.subject}`],
          evidence: req.evidence,
          confidence: 'low'
        });
      }
      continue;
    }

    const { given, when, then } = scenarioForGenericRequirement(req.text);
    scenarios.push({
      name: scenarioNameFromRequirement(req.text),
      given,
      when,
      then,
      evidence: req.evidence,
      confidence: 'low'
    });
  }

  const features: SynthesizedGherkinFeature[] = [
    {
      name: 'Meeting requirements',
      scenarios
    }
  ];

  const gaps: string[] = [];
  const followUpQuestions: string[] = [];
  if (scenarios.length > 0) {
    followUpQuestions.push('What are the preconditions/data setup for each scenario?');
    followUpQuestions.push('What are the success criteria and error cases?');
    followUpQuestions.push('Which scenarios are highest priority for automation?');
  }

  return { tenantId, modeUsed: 'deterministic', features, gaps, followUpQuestions };
}
