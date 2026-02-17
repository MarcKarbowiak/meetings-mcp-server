import * as z from 'zod/v4';

const SourceSpanSchema = z.object({
  kind: z.literal('line-range'),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1)
});

const EvidenceSchema = z.object({
  quote: z.string().min(1),
  sourceSpans: z.array(SourceSpanSchema).min(1)
});

export const SynthesizedUserStorySchema = z.object({
  asA: z.string().min(1),
  iWant: z.string().min(1),
  soThat: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).default([]),
  evidence: z.array(EvidenceSchema).min(1),
  confidence: z.enum(['low', 'medium', 'high']).default('low')
});

export const UserStorySynthesisResultSchema = z.object({
  stories: z.array(SynthesizedUserStorySchema),
  gaps: z.array(z.string()).default([]),
  followUpQuestions: z.array(z.string()).default([])
});

export const SynthesizedGherkinScenarioSchema = z.object({
  name: z.string().min(1),
  given: z.array(z.string()).default([]),
  when: z.array(z.string()).default([]),
  then: z.array(z.string()).default([]),
  evidence: z.array(EvidenceSchema).min(1),
  confidence: z.enum(['low', 'medium', 'high']).default('low')
});

export const GherkinSynthesisResultSchema = z.object({
  features: z.array(
    z.object({
      name: z.string().min(1),
      scenarios: z.array(SynthesizedGherkinScenarioSchema)
    })
  ),
  gaps: z.array(z.string()).default([]),
  followUpQuestions: z.array(z.string()).default([])
});
