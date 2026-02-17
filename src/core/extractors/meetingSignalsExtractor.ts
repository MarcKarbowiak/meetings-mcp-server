import type { MeetingSignalsResult, MeetingSignal } from '../types.js';
import { toLines, spanForSingleLine } from '../textUtils.js';
import * as z from 'zod/v4';

// Deterministic, keyword-based signal extraction.
// This is intentionally conservative and explainable.

export type CompiledMeetingSignalRule = {
  type: MeetingSignal['type'];
  confidence: MeetingSignal['confidence'];
  regexes: RegExp[];
};

const defaultRules: CompiledMeetingSignalRule[] = [
  { type: 'Decision', confidence: 'high', regexes: [/^\s*(decision|decided|we decided|final decision)\s*[:\-]/i] },
  { type: 'ActionItem', confidence: 'high', regexes: [/^\s*(action item|ai|todo|to do|next step)\s*[:\-]/i] },
  { type: 'OpenQuestion', confidence: 'high', regexes: [/^\s*(question|open question|unknown)\s*[:\-]/i] },
  { type: 'Risk', confidence: 'medium', regexes: [/^\s*(risk|concern|blocker|issue)\s*[:\-]/i] },
  { type: 'Dependency', confidence: 'medium', regexes: [/^\s*(dependency|depends on|waiting on)\s*[:\-]/i] }
];

const MeetingSignalTypeSchema = z.enum(['Decision', 'ActionItem', 'Risk', 'Dependency', 'OpenQuestion']);
const MeetingSignalConfidenceSchema = z.enum(['low', 'medium', 'high']);

const TenantRuleSchema = z.object({
  type: MeetingSignalTypeSchema,
  confidence: MeetingSignalConfidenceSchema,
  patterns: z.array(z.string()).min(1)
});

const TenantSignalsConfigSchema = z.object({
  version: z.number().optional(),
  extractionRules: z.array(TenantRuleSchema).optional()
});

function compileRegex(pattern: string): RegExp {
  const trimmed = pattern.trim();
  // Allow /.../flags form. Otherwise default to case-insensitive.
  if (trimmed.startsWith('/') && trimmed.lastIndexOf('/') > 0) {
    const lastSlash = trimmed.lastIndexOf('/');
    const body = trimmed.slice(1, lastSlash);
    const flags = trimmed.slice(lastSlash + 1);
    return new RegExp(body, flags);
  }
  return new RegExp(trimmed, 'i');
}

export function compileMeetingSignalRulesFromTenantSignalsJson(signalsJson: unknown): CompiledMeetingSignalRule[] | undefined {
  const parsed = TenantSignalsConfigSchema.safeParse(signalsJson);
  if (!parsed.success) return undefined;

  const rules = parsed.data.extractionRules;
  if (!rules || rules.length === 0) return undefined;

  return rules.map(r => ({
    type: r.type,
    confidence: r.confidence,
    regexes: r.patterns.map(compileRegex)
  }));
}

export type ExtractMeetingSignalsOptions = {
  rules?: CompiledMeetingSignalRule[];
};

export function extractMeetingSignals(text: string, tenantId?: string, options?: ExtractMeetingSignalsOptions): MeetingSignalsResult {
  const lines = toLines(text);

  const rules = (options?.rules && options.rules.length > 0 ? options.rules : undefined) ?? defaultRules;

  const signals: MeetingSignal[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const p of rules) {
      const matches = p.regexes.some(r => r.test(trimmed));
      if (!matches) continue;

      signals.push({
        type: p.type,
        confidence: p.confidence,
        text: trimmed,
        sourceSpans: [spanForSingleLine(i + 1)]
      });
      break;
    }
  }

  const suggestedActions: string[] = [];
  if (signals.some(s => s.type === 'ActionItem')) {
    suggestedActions.push('Assign each ActionItem an owner and due date.');
  }
  if (signals.some(s => s.type === 'Decision')) {
    suggestedActions.push('Record each Decision with rationale and impacted systems.');
  }
  if (signals.some(s => s.type === 'OpenQuestion')) {
    suggestedActions.push('Convert OpenQuestions into tracked follow-ups with owners.');
  }

  if (signals.length === 0) {
    suggestedActions.push('No signals detected; consider adding explicit markers like "Decision:" and "Action item:" in notes.');
  }

  return { tenantId, signals, suggestedActions };
}
