# Tool: Gherkin-Extractor

## Purpose
Extracts Gherkin structures from text:
- `Feature:` blocks
- `Scenario:` / `Scenario Outline:` blocks
- `Given/When/Then` steps (plus `And` / `But` continuations)

This tool is **deterministic** and only extracts explicit Gherkin-like text.

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
    "features": [
      {
        "name": "...",
        "description": "...",
        "scenarios": [
          {
            "name": "...",
            "tags": ["@tag"],
            "given": ["..."],
            "when": ["..."],
            "then": ["..."],
            "sourceSpans": [{ "kind": "line-range", "startLine": 1, "endLine": 10 }]
          }
        ],
        "sourceSpans": [{ "kind": "line-range", "startLine": 1, "endLine": 10 }]
      }
    ],
    "nonGherkinFindings": ["Line 12: ..."]
  }
}
```

## Extraction rules (current)
### Tags
Lines starting with `@` are treated as tags (e.g. `@smoke @billing`) and applied to the next scenario.

### Feature
`Feature: <name>` starts a new feature.
- Any non-blank lines after the feature and before the first scenario are added as `description`.

### Scenario
`Scenario: <name>` or `Scenario Outline: <name>` starts a new scenario.
- If a scenario appears before any feature, an implicit feature named `Implicit Feature` is created.

### Steps
Within a scenario:
- `Given ...`, `When ...`, `Then ...` append steps to the corresponding list.
- `And ...` / `But ...` append to the most recent step kind.

Unrecognized non-step lines inside a scenario are recorded in `nonGherkinFindings`.

## Limitations
- Does not parse Background/Examples tables.
- Does not validate that each scenario has all Given/When/Then.
- Treats non-Gherkin lines as findings rather than trying to “repair” them.

## Example
```bash
npm run demo:stdio
```
