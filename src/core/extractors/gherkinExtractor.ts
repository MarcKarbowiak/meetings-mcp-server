import type { GherkinExtractionResult, GherkinFeature, GherkinScenario } from '../types.js';
import { isBlank, spanForLineRange, toLines } from '../textUtils.js';

type StepKind = 'given' | 'when' | 'then';

function normalizeTagLine(line: string): string[] {
  // Tags: "@tag1 @tag2"
  const trimmed = line.trim();
  if (!trimmed.startsWith('@')) return [];
  return trimmed
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.startsWith('@'));
}

function stepKindFromLine(line: string): StepKind | null {
  const t = line.trim().toLowerCase();
  if (t.startsWith('given ')) return 'given';
  if (t.startsWith('when ')) return 'when';
  if (t.startsWith('then ')) return 'then';
  if (t.startsWith('and ')) return null; // attaches to lastStepKind
  if (t.startsWith('but ')) return null; // attaches to lastStepKind
  return null;
}

function stepTextFromLine(line: string): string {
  return line.trim().replace(/^(given|when|then|and|but)\s+/i, '');
}

export function extractGherkin(text: string, tenantId?: string): GherkinExtractionResult {
  const lines = toLines(text);

  const features: GherkinFeature[] = [];
  const nonGherkinFindings: string[] = [];

  let currentFeature: GherkinFeature | null = null;
  let currentScenario: GherkinScenario | null = null;
  let pendingTags: string[] = [];
  let scenarioStartLine = 0;
  let featureStartLine = 0;
  let lastStepKind: StepKind | null = null;

  const flushScenario = (endLine1Based: number) => {
    if (!currentFeature || !currentScenario) return;
    currentScenario.sourceSpans = [spanForLineRange(scenarioStartLine, Math.max(scenarioStartLine, endLine1Based))];
    currentFeature.scenarios.push(currentScenario);
    currentScenario = null;
    lastStepKind = null;
  };

  const flushFeature = (endLine1Based: number) => {
    if (!currentFeature) return;
    // Close any scenario still open
    flushScenario(endLine1Based);
    currentFeature.sourceSpans = [spanForLineRange(featureStartLine, Math.max(featureStartLine, endLine1Based))];
    features.push(currentFeature);
    currentFeature = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineNo = i + 1;
    const trimmed = line.trim();

    if (isBlank(line)) {
      continue;
    }

    if (trimmed.startsWith('@')) {
      pendingTags = normalizeTagLine(trimmed);
      continue;
    }

    const featureMatch = trimmed.match(/^feature\s*:\s*(.+)$/i);
    if (featureMatch) {
      flushFeature(lineNo - 1);
      currentFeature = {
        name: (featureMatch[1] ?? '').trim(),
        scenarios: [],
        sourceSpans: []
      };
      featureStartLine = lineNo;
      continue;
    }

    const scenarioMatch = trimmed.match(/^(scenario|scenario outline)\s*:\s*(.+)$/i);
    if (scenarioMatch) {
      if (!currentFeature) {
        // create an implicit feature so we still output valid structure
        currentFeature = { name: 'Implicit Feature', scenarios: [], sourceSpans: [] };
        featureStartLine = lineNo;
      }

      flushScenario(lineNo - 1);
      currentScenario = {
        name: (scenarioMatch[2] ?? '').trim(),
        tags: pendingTags,
        given: [],
        when: [],
        then: [],
        sourceSpans: []
      };
      pendingTags = [];
      scenarioStartLine = lineNo;
      lastStepKind = null;
      continue;
    }

    // Feature description lines
    if (currentFeature && !currentScenario && !/^background\s*:/i.test(trimmed)) {
      currentFeature.description = currentFeature.description
        ? `${currentFeature.description}\n${trimmed}`
        : trimmed;
      continue;
    }

    if (currentScenario) {
      const kind = stepKindFromLine(trimmed);
      const isAnd = /^and\s+/i.test(trimmed) || /^but\s+/i.test(trimmed);

      if (kind) {
        const step = stepTextFromLine(trimmed);
        currentScenario[kind].push(step);
        lastStepKind = kind;
        continue;
      }

      if (isAnd && lastStepKind) {
        const step = stepTextFromLine(trimmed);
        currentScenario[lastStepKind].push(step);
        continue;
      }

      // Non-step line inside a scenario: keep as finding.
      nonGherkinFindings.push(`Line ${lineNo}: Unrecognized scenario line: ${trimmed}`);
      continue;
    }

    // Non-gherkin line outside known structures
    nonGherkinFindings.push(`Line ${lineNo}: Unrecognized line: ${trimmed}`);
  }

  flushFeature(lines.length);

  if (features.length === 0) {
    nonGherkinFindings.push('No Gherkin Feature/Scenario blocks found.');
  }

  return { tenantId, features, nonGherkinFindings };
}
