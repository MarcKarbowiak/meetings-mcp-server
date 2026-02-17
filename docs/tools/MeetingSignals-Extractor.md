# Tool: MeetingSignals-Extractor

## Purpose
Detects meeting “signals” (structured notes) such as:
- Decision
- Action item
- Open question
- Risk
- Dependency

Returns each detected signal with confidence and source line span.

## Input
```json
{
  "text": "<transcript or notes>",
  "tenantId": "demo"
}
```

## Output
`structuredContent`:
```json
{
  "ok": true,
  "result": {
    "tenantId": "demo",
    "signals": [
      {
        "type": "Decision",
        "confidence": "high",
        "text": "Decision: ...",
        "sourceSpans": [{ "kind": "line-range", "startLine": 1, "endLine": 1 }]
      }
    ],
    "suggestedActions": ["..."]
  }
}
```

## Detection rules
### Defaults
If `tenantId` is not provided (or tenant config is missing/invalid), the server uses built-in deterministic patterns that match lines like:
- `Decision:` / `Decided:`
- `Action item:` / `TODO:`
- `Open question:` / `Question:`
- `Risk:` / `Concern:`
- `Dependency:` / `Depends on:`

### Tenant-configured patterns
If `tenantId` is provided, the server attempts to load tenant rules from:
- `data/tenants/<tenantId>/signals.json` → `extractionRules`

Each rule is:
```json
{
  "type": "Decision",
  "confidence": "high",
  "patterns": ["^\\s*(decision)\\s*[:\\-]"]
}
```

Pattern strings can be:
- Plain regex source (compiled with `i` flag)
- Or `/.../flags` form

If any pattern is invalid, the tool falls back to defaults.

## Suggested actions
The tool emits generic follow-up actions based on detected signal types, e.g.:
- If ActionItems exist → “Assign each ActionItem an owner and due date.”
- If Decisions exist → “Record each Decision with rationale and impacted systems.”

## Limitations
- Only detects signals that match explicit markers/patterns.
- Does not split a single line into multiple signals.
- Does not assign owners/dates; that’s a higher-level workflow/tool.
