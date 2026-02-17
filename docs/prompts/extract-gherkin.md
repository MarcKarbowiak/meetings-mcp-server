# Prompt: extract-gherkin

## Purpose
A reusable prompt template that asks for:
- Gherkin `Feature`/`Scenario`
- `Given/When/Then` steps
- Suggestions to clean up non-Gherkin text

## Arguments
```json
{
  "text": "<transcript or notes>",
  "tenantId": "demo"
}
```

## What it returns
An MCP prompt result containing a single user message with:
- Instructions for Gherkin extraction
- Optional `Tenant: <tenantId>` header
- The raw `TEXT:` content
