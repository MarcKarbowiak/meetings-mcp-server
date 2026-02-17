# Tool: UserStory-Synthesizer

## Purpose
Synthesizes user stories from **plain-English** meeting transcripts/notes.

This tool supports 2 modes:
- **Deterministic**: lightweight requirement mining + conservative mapping to user stories.
- **LLM** (optional): if an OpenAI-compatible chat-completions endpoint is configured, the tool can ask the model to synthesize stories. If the LLM fails (in `auto` mode), the tool falls back to deterministic output.

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
- `maxItems` (optional): Max stories to synthesize (1–50).

## Output
The tool returns MCP `structuredContent` with:
```json
{
  "ok": true,
  "result": {
    "tenantId": "demo",
    "modeUsed": "deterministic",
    "stories": [
      {
        "asA": "user",
        "iWant": "to ...",
        "soThat": "...",
        "acceptanceCriteria": ["..."],
        "evidence": [{ "quote": "...", "sourceSpans": [{ "kind": "line-range", "startLine": 1, "endLine": 1 }] }],
        "confidence": "low"
      }
    ],
    "gaps": ["..."],
    "followUpQuestions": ["..."]
  }
}
```

## LLM configuration (optional)
This repo uses an **OpenAI-compatible** chat-completions endpoint via environment variables:

- `LLM_CHAT_COMPLETIONS_URL` (required to enable LLM)
- `LLM_API_KEY` (required unless `LLM_AUTH_MODE=none`)
- `LLM_AUTH_MODE` (optional): `bearer` (default) | `api-key` | `none`
- `LLM_MODEL` (optional): passed as `model` in the request body
- `LLM_EXTRA_HEADERS_JSON` (optional): JSON object of extra headers to send

Examples:

OpenAI:
```bash
set LLM_CHAT_COMPLETIONS_URL=https://api.openai.com/v1/chat/completions
set LLM_AUTH_MODE=bearer
set LLM_API_KEY=...your key...
set LLM_MODEL=...optional...
```

Azure OpenAI (OpenAI-compatible chat-completions):
```bash
set LLM_CHAT_COMPLETIONS_URL=https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT/chat/completions?api-version=YYYY-MM-DD
set LLM_AUTH_MODE=api-key
set LLM_API_KEY=...your key...
```

If your endpoint requires additional headers, set `LLM_EXTRA_HEADERS_JSON`, for example:
```bash
set LLM_EXTRA_HEADERS_JSON={"x-ms-client-request-id":"meetings-mcp"}
```

## Notes
- Deterministic synthesis is intentionally conservative and returns `confidence: low`.
- This tool is meant for “turning discussion into a starting point”, not final backlog quality.
