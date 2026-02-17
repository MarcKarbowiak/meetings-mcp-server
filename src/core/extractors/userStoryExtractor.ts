import type { ExtractedUserStory, UserStoryExtractionResult } from '../types.js';
import { toLines, spanForLineRange } from '../textUtils.js';

// Heuristic extractor:
// - Finds explicit "As a ... I want ... so that ..." patterns
// - Optionally attaches nearby "AC:" / "Acceptance Criteria:" bullet lines
// This is intentionally deterministic and lightweight for a showcase repo.

const asARegex = /^\s*as\s+an?\s+(.+?)\s*(?:,|\s+)i\s+want\s+(.+?)(?:\s+so\s+that\s+(.+?))?\s*$/i;

function takeAcceptanceCriteria(lines: string[], startIndex: number): { ac: string[]; endIndex: number } {
  const ac: string[] = [];

  for (let i = startIndex; i < Math.min(lines.length, startIndex + 8); i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (/^(ac|acceptance criteria)\s*:/i.test(trimmed)) {
      const remainder = trimmed.replace(/^(ac|acceptance criteria)\s*:\s*/i, '');
      if (remainder) ac.push(remainder);
      continue;
    }

    // bullet lines often used for AC
    if (/^[-*]\s+/.test(trimmed)) {
      ac.push(trimmed.replace(/^[-*]\s+/, ''));
      continue;
    }

    // stop on first non-empty, non-bullet line after AC started
    if (ac.length > 0 && trimmed.length > 0) {
      return { ac, endIndex: i - 1 };
    }

    if (ac.length > 0 && trimmed.length === 0) {
      return { ac, endIndex: i };
    }
  }

  return { ac, endIndex: startIndex };
}

export function extractUserStories(text: string, tenantId?: string): UserStoryExtractionResult {
  const lines = toLines(text);

  const userStories: ExtractedUserStory[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const match = line.match(asARegex);
    if (!match) continue;

    const asA = (match[1] ?? '').trim();
    const iWant = (match[2] ?? '').trim();
    const soThat = (match[3] ?? '').trim() || undefined;

    const { ac, endIndex } = takeAcceptanceCriteria(lines, i + 1);

    userStories.push({
      asA,
      iWant,
      soThat,
      acceptanceCriteria: ac,
      sourceSpans: [spanForLineRange(i + 1, Math.max(i + 1, endIndex + 1))]
    });
  }

  const gaps: string[] = [];
  const followUpQuestions: string[] = [];

  if (userStories.length === 0) {
    gaps.push('No explicit "As a ... I want ..." user story statements found.');
    followUpQuestions.push('Did the meeting include requirements phrased as user stories, or should I infer them from discussion?');
    followUpQuestions.push('Who is the primary user/persona for these requirements?');
  }

  for (const story of userStories) {
    if (!story.soThat) {
      gaps.push(`User story missing "so that": As a ${story.asA} I want ${story.iWant}`);
      followUpQuestions.push(`What is the underlying benefit/value ("so that") for: As a ${story.asA} I want ${story.iWant}?`);
    }
    if (story.acceptanceCriteria.length === 0) {
      gaps.push(`No acceptance criteria captured for: As a ${story.asA} I want ${story.iWant}`);
      followUpQuestions.push(`What would make this story "done" (acceptance criteria) for: As a ${story.asA} I want ${story.iWant}?`);
    }
  }

  return { tenantId, userStories, gaps, followUpQuestions };
}
