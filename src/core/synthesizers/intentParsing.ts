export type LockoutConstraint = {
  attempts: number;
  thing?: string;
  durationMinutes: number;
};

export type PerformanceConstraint = {
  withinSeconds: number;
};

export function inferPersona(reqText: string): string {
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

// Matches the historical persona logic used by the gherkin synthesizer, kept to
// preserve golden outputs while still centralizing parsing logic.
export function inferPersonaBasic(reqText: string): string {
  const t = reqText.toLowerCase();
  if (t.includes('support agent') || t.includes('support agents') || /\bagents?\b/.test(t)) return 'support agent';
  if (t.includes('admin')) return 'admin';
  if (/\bcustomers?\b\s+(want|wants|need|needs|must|should|can|cannot|can't)\b/.test(t)) return 'customer';
  return 'user';
}

export function toSentence(s: string): string {
  const trimmed = s.trim().replace(/[.]+$/g, '');
  if (!trimmed) return '';
  return `${trimmed[0]!.toUpperCase()}${trimmed.slice(1)}.`;
}

export function normalizeCapabilityFromIWant(iWant: string): string {
  let c = iWant.trim();
  c = c.replace(/^to\s+/i, '');
  c = c.replace(/^be\s+able\s+to\s+/i, '');
  c = c.replace(/^able\s+to\s+/i, '');
  c = c.replace(/\s+/g, ' ').trim();
  return c;
}

export function splitInlineConstraint(capability: string): { capability: string; constraint?: string } {
  // Common transcript pattern: "... add X that customers cannot see"
  const m = capability.match(/^(.*)\bthat\b\s+(.+\b(cannot|can't|must not)\b.+)$/i);
  if (!m) return { capability };
  const base = m[1]?.trim().replace(/[.]+$/g, '') ?? capability;
  const constraint = m[2]?.trim() ?? undefined;
  return { capability: base, constraint };
}

export function splitButNotConstraint(capability: string): { capability: string; constraint?: string } {
  // Common requirements phrasing: "view progress, but not edit anything"
  const m = capability.match(/^(.*?)(?:,)?\s*\bbut\s+not\b\s+(.+)$/i);
  if (!m) return { capability };
  const base = (m[1] ?? capability).trim().replace(/[.]+$/g, '');
  const constraint = (m[2] ?? '').trim().replace(/[.]+$/g, '');
  if (!constraint) return { capability: base };
  return { capability: base, constraint: `cannot ${constraint}` };
}

export function extractOnlyConstraint(reqText: string): string | undefined {
  // Example: "should only see the tasks they're assigned to"
  const m = reqText.match(/\bonly\b\s+(.+)$/i);
  const remainder = m?.[1]?.trim();
  if (!remainder) return undefined;
  // If the sentence already includes a verb phrase like "see ...", keep it.
  return remainder.replace(/[.]+$/g, '');
}

export function extractInvalidThing(reqText: string): string | undefined {
  const m = reqText.match(/\binvalid\s+([a-z][a-z0-9_-]*)\b/i);
  return m?.[1]?.toLowerCase();
}

export function extractLockout(reqText: string): LockoutConstraint | undefined {
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

export function extractPerformance(reqText: string): PerformanceConstraint | undefined {
  const t = reqText.toLowerCase();
  const m = t.match(/\bwithin\s+(\d+)\s*(seconds?|secs?|s)\b/i);
  const raw = m?.[1];
  const withinSeconds = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(withinSeconds) || withinSeconds <= 0) return undefined;
  return { withinSeconds };
}

export function isAuditRequirement(reqText: string): boolean {
  const t = reqText.toLowerCase();
  return t.includes('audit log') || (t.includes('audit') && (t.includes('record') || t.includes('log')));
}

export function extractVisibilityConstraint(reqText: string): { subject: string; object: string } | undefined {
  // Specific, high-signal pattern used frequently in product meetings.
  // Example: "customers cannot see" -> subject=customers, object=internal note
  const t = reqText.toLowerCase();
  const m = t.match(/\b(customers?|users?)\b\s+(cannot|can't|must not)\s+see\b/);
  if (!m) return undefined;
  // Try to recover the object by looking for "note" or a trailing noun phrase.
  if (t.includes('note')) return { subject: m[1]!, object: 'the internal note' };
  return { subject: m[1]!, object: 'the restricted content' };
}

export function isOnlyAssignedVisibility(reqText: string): boolean {
  const t = reqText.toLowerCase();
  return t.includes('only') && (t.includes('assigned') || t.includes("they're assigned") || t.includes('they are assigned')) && t.includes('see');
}

export function isViewButNotEdit(reqText: string): boolean {
  const t = reqText.toLowerCase();
  return t.includes('view') && t.includes('but not') && t.includes('edit');
}

export function normalizeCapabilityFromRequirement(reqText: string): string {
  // Best-effort extraction of the action/capability phrase.
  const m = reqText.match(/\b(need to|needs to|need|needs|must|should|have to|has to|can|would like to|i'd like to|we'd like to|we would like to)\b\s+(.+?)(?:\bso that\b|$)/i);
  const raw = (m?.[2] ?? reqText).trim().replace(/[.]+$/g, '');
  const cleaned = raw.replace(/^be\s+able\s+to\s+/i, '').trim();
  // Remove common inline constraint pattern: "... that customers cannot see"
  return cleaned.replace(/\bthat\b\s+.+\b(cannot|can't|must not)\b.+$/i, '').trim();
}

// Matches the historical capability normalization used by the gherkin synthesizer.
export function normalizeCapabilityFromRequirementBasic(reqText: string): string {
  const m = reqText.match(/\b(need to|needs to|must|should|have to|has to|can)\b\s+(.+?)(?:\bso that\b|$)/i);
  const raw = (m?.[2] ?? reqText).trim().replace(/[.]+$/g, '');
  const cleaned = raw.replace(/^be\s+able\s+to\s+/i, '').trim();
  return cleaned.replace(/\bthat\b\s+.+\b(cannot|can't|must not)\b.+$/i, '').trim();
}
