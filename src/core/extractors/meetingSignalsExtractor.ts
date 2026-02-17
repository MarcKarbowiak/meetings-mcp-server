import type { MeetingSignalsResult, MeetingSignal } from '../types.js';
import { toLines, spanForSingleLine } from '../textUtils.js';

// Deterministic, keyword-based signal extraction.
// This is intentionally conservative and explainable.

const patterns: Array<{
  type: MeetingSignal['type'];
  confidence: MeetingSignal['confidence'];
  regex: RegExp;
}> = [
  { type: 'Decision', confidence: 'high', regex: /^\s*(decision|decided|we decided|final decision)\s*[:\-]/i },
  { type: 'ActionItem', confidence: 'high', regex: /^\s*(action item|ai|todo|to do|next step)\s*[:\-]/i },
  { type: 'OpenQuestion', confidence: 'high', regex: /^\s*(question|open question|unknown)\s*[:\-]/i },
  { type: 'Risk', confidence: 'medium', regex: /^\s*(risk|concern|blocker|issue)\s*[:\-]/i },
  { type: 'Dependency', confidence: 'medium', regex: /^\s*(dependency|depends on|waiting on)\s*[:\-]/i }
];

export function extractMeetingSignals(text: string, tenantId?: string): MeetingSignalsResult {
  const lines = toLines(text);

  const signals: MeetingSignal[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const p of patterns) {
      if (!p.regex.test(trimmed)) continue;

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
