# Prompt: extract-user-stories

## Purpose
A reusable prompt template that asks for:
- User stories (`As a ... I want ... so that ...`)
- Acceptance criteria
- Follow-up questions for missing information

## Arguments
```json
{
  "text": "<transcript or notes>",
  "tenantId": "demo"
}
```

## What it returns
An MCP prompt result containing a single user message with:
- Instructions for extraction
- Optional `Tenant: <tenantId>` header
- The raw `TEXT:` content

## Intended use
If you later add an LLM-backed extraction path, clients can call this prompt to generate consistent instructions.
