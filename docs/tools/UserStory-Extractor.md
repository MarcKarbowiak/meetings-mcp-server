# Tool: UserStory-Extractor

## Purpose
Extracts explicit user stories and nearby acceptance criteria from meeting transcripts or notes.

This tool is **deterministic** (no model calls). It only extracts what it can find from the text.

## Input
JSON object:
```json
{
  "text": "<transcript or notes>",
  "tenantId": "demo"
}
```

- `text` (required): The meeting transcript/notes.
- `tenantId` (optional): Returned back in the result for traceability.

## Output
The tool returns MCP `structuredContent` with:
```json
{
  "ok": true,
  "result": {
    "tenantId": "demo",
    "userStories": [
      {
        "asA": "...",
        "iWant": "...",
        "soThat": "...",
        "acceptanceCriteria": ["..."],
        "sourceSpans": [{ "kind": "line-range", "startLine": 1, "endLine": 3 }]
      }
    ],
    "gaps": ["..."],
    "followUpQuestions": ["..."]
  }
}
```

## Extraction rules (current)
### User story line
Matches lines shaped like:
- `As a <persona> I want <goal> so that <value>`

Notes:
- Matching is case-insensitive.
- `so that ...` is optional; if missing, the tool adds a gap + follow-up question.

### Acceptance criteria capture
After a matched story line, the tool looks ahead up to ~8 lines for:
- A line starting with `AC:` or `Acceptance Criteria:` (may contain inline text)
- Bullet lines `- ...` or `* ...`

It stops when it hits a non-empty non-bullet line after criteria have started, or a blank line after criteria have started.

## Gaps and follow-ups
If no explicit stories are found, the tool emits a gap and suggests follow-ups (e.g., clarify persona/value).

If stories are found but:
- `soThat` is missing → emits a gap + a targeted question
- `acceptanceCriteria` is empty → emits a gap + a targeted question

## Limitations
- Does not infer stories from discussion; it only extracts explicit `As a ... I want ...` statements.
- No de-duplication or clustering.
- Acceptance criteria capture is heuristic and may miss criteria that are far from the story line.

## Example
Run the stdio demo:
```bash
npm run demo:stdio
```

The sample input is in `examples/inputs/sample-notes.txt`.
