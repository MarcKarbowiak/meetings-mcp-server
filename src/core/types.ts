export type SourceSpan = {
  kind: 'line-range';
  startLine: number; // 1-based
  endLine: number; // 1-based, inclusive
};

export type ExtractedUserStory = {
  asA: string;
  iWant: string;
  soThat?: string;
  acceptanceCriteria: string[];
  sourceSpans: SourceSpan[];
};

export type UserStoryExtractionResult = {
  tenantId?: string;
  userStories: ExtractedUserStory[];
  gaps: string[];
  followUpQuestions: string[];
};

export type GherkinScenario = {
  name: string;
  tags: string[];
  given: string[];
  when: string[];
  then: string[];
  sourceSpans: SourceSpan[];
};

export type GherkinFeature = {
  name: string;
  description?: string;
  scenarios: GherkinScenario[];
  sourceSpans: SourceSpan[];
};

export type GherkinExtractionResult = {
  tenantId?: string;
  features: GherkinFeature[];
  nonGherkinFindings: string[];
};

export type MeetingSignal = {
  type: 'Decision' | 'ActionItem' | 'Risk' | 'Dependency' | 'OpenQuestion';
  confidence: 'low' | 'medium' | 'high';
  text: string;
  sourceSpans: SourceSpan[];
};

export type MeetingSignalsResult = {
  tenantId?: string;
  signals: MeetingSignal[];
  suggestedActions: string[];
};

export type Evidence = {
  quote: string;
  sourceSpans: SourceSpan[];
};

export type SynthesizedUserStory = {
  asA: string;
  iWant: string;
  soThat?: string;
  acceptanceCriteria: string[];
  evidence: Evidence[];
  confidence: 'low' | 'medium' | 'high';
};

export type UserStorySynthesisResult = {
  tenantId?: string;
  modeUsed: 'deterministic' | 'llm';
  stories: SynthesizedUserStory[];
  gaps: string[];
  followUpQuestions: string[];
};

export type SynthesizedGherkinScenario = {
  name: string;
  given: string[];
  when: string[];
  then: string[];
  evidence: Evidence[];
  confidence: 'low' | 'medium' | 'high';
};

export type SynthesizedGherkinFeature = {
  name: string;
  scenarios: SynthesizedGherkinScenario[];
};

export type GherkinSynthesisResult = {
  tenantId?: string;
  modeUsed: 'deterministic' | 'llm';
  features: SynthesizedGherkinFeature[];
  gaps: string[];
  followUpQuestions: string[];
};
