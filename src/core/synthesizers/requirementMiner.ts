import { spanForSingleLine, toLines } from '../textUtils.js';
import type { Evidence } from '../types.js';

export type MinedRequirement = {
  text: string;
  evidence: Evidence[];
};

// Keep this fairly inclusive: realistic requirements meetings often use softer language like
// "I'd like...", "we need...", "should be able to...".
const requirementLineRegex = /\b(need to|needs to|need|needs|must|should|have to|has to|can|cannot|can't|we want to|we need to|we need|users want to|user wants to|would like to|i'd like to|we'd like to|we would like to)\b/i;

function normalizeSentence(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function stripSpeakerPrefix(s: string): string {
  // Common meeting transcript format: "Name: sentence..."
  // Keep this conservative to avoid mangling legitimate content.
  // Support optional role in parentheses: "Jordan (Product Owner): ..."
  return s.replace(/^[A-Z][A-Za-z0-9 ._'\-()]{0,60}:\s+/, '');
}

function stripDiscourseMarkers(s: string): string {
  // Remove leading filler words that often appear in transcripts.
  return s.replace(/^(so,|so|okay,|ok,|alright,|right,|well,)\s+/i, '');
}

function cleanRequirementText(s: string): string {
  const withoutSpeaker = stripSpeakerPrefix(s);
  const withoutFiller = stripDiscourseMarkers(withoutSpeaker);
  return normalizeSentence(withoutFiller);
}

function isInterrogativeSentence(s: string): boolean {
  return /\?\s*$/.test(s.trim());
}

function isMeetingMetaSentence(s: string): boolean {
  const t = s.trim().toLowerCase();
  if (/^(thanks|thank you)\s+for\s+joining\b/.test(t)) return true;
  if (/^(today'?s\s+)?goal\s+is\b/.test(t)) return true;
  if (/^(the\s+)?purpose\s+is\b/.test(t)) return true;
  if (/^(the\s+)?agenda\s+is\b/.test(t)) return true;
  if (/^let'?s\s+(talk\s+about|discuss|review)\b/.test(t)) return true;
  return false;
}

export function mineRequirementsDeterministic(text: string): { requirements: MinedRequirement[]; gaps: string[]; followUpQuestions: string[] } {
  const lines = toLines(text);
  const requirements: MinedRequirement[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const line = raw.trim();
    if (!line) continue;
    if (!requirementLineRegex.test(line)) continue;

    // Split long lines into rough sentences for better atomicity.
    const sentences = line
      .split(/(?<=[.!?])\s+/)
      .map(normalizeSentence)
      .filter(Boolean);

    for (const s of sentences) {
      // Questions in transcripts are often discovery prompts, not requirements.
      // Example: "Should everyone see the same information?"
      if (isInterrogativeSentence(s)) continue;
      if (!requirementLineRegex.test(s)) continue;
      const cleaned = cleanRequirementText(s);
      if (!cleaned) continue;
      if (isMeetingMetaSentence(cleaned)) continue;
      requirements.push({
        text: cleaned,
        evidence: [{ quote: s, sourceSpans: [spanForSingleLine(i + 1)] }]
      });
    }
  }

  const gaps: string[] = [];
  const followUpQuestions: string[] = [];

  if (requirements.length === 0) {
    gaps.push('No obvious requirement statements detected (e.g., “need to”, “must”, “should”).');
    followUpQuestions.push('Who is the target user/persona for this meeting?');
    followUpQuestions.push('What are the top 3 required capabilities discussed?');
    followUpQuestions.push('Are there any explicit constraints (security, performance, compliance)?');
  }

  return { requirements, gaps, followUpQuestions };
}
