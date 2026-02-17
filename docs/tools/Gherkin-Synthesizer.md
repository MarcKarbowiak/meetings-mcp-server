# Tool: Gherkin-Synthesizer

## Purpose
Synthesizes Gherkin-style Features/Scenarios from **plain-English** meeting transcripts/notes.

This tool supports 2 modes:
- **Deterministic**: mines requirement-like statements and maps them to simple Given/When/Then skeletons.
- **LLM** (optional): if an OpenAI-compatible chat-completions endpoint is configured, the tool can ask the model to synthesize scenarios. If the LLM fails (in `auto` mode), the tool falls back to deterministic output.

## Input
JSON object:
```json
{
  "text": "<transcript or notes>",
  "tenantId": "demo",
  "mode": "auto",
  "maxItems": 10
}
```

- `text` (required): The meeting transcript/notes (plain English is fine).
- `tenantId` (optional): Returned back in the result for traceability.
- `mode` (optional):
  - `auto` (default): use LLM if configured, else deterministic.
  - `deterministic`: never call LLM.
  - `llm`: require LLM; if not configured, returns `{ ok: false }`.
- `maxItems` (optional): Max scenarios to synthesize (1–50).

## Output
The tool returns MCP `structuredContent` with:
```json
{
  "ok": true,
  "result": {
    "tenantId": "demo",
    "modeUsed": "deterministic",
    "features": [
      {
        "name": "Meeting requirements",
        "scenarios": [
          {
            "name": "...",
            "given": ["..."],
            "when": ["..."],
            "then": ["..."],
            "evidence": [{ "quote": "...", "sourceSpans": [{ "kind": "line-range", "startLine": 1, "endLine": 1 }] }],
            "confidence": "low"
          }
        ]
      }
    ],
    "gaps": ["..."],
    "followUpQuestions": ["..."]
  }
}
```

## LLM configuration (optional)
Uses the same environment variables as [UserStory-Synthesizer.md](UserStory-Synthesizer.md).

## Notes
- Deterministic synthesis is intentionally conservative and returns `confidence: low`.
- The resulting Gherkin is a skeleton; it typically needs refinement (data setup, edge cases, priorities).
