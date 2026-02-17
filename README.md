# meetings-mcp-server

[![CI](https://github.com/marckarbowiak/meetings-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/marckarbowiak/meetings-mcp-server/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)

Showcase **MCP (Model Context Protocol)** server in TypeScript.

It exposes:
- Tools: `UserStory-Extractor`, `Gherkin-Extractor`, `MeetingSignals-Extractor`, `UserStory-Synthesizer`, `Gherkin-Synthesizer`
- Resources: tenant-specific meeting guidance + signal taxonomy from `data/tenants/*`
- Prompts: reusable templates to drive consistent extraction

This repo is **deterministic by default** (no API keys required).

- The *Extractors* are deterministic only.
- The *Synthesizers* can optionally use an **OpenAI-compatible** chat-completions endpoint if you provide env vars; they always support a deterministic fallback.

## Prereqs
- Node.js 20+

## Install
```bash
npm install
```

## Run (stdio) — default
```bash
npm run dev:stdio
```

## Demo (stdio) — runs tools end-to-end
This runs a small demo client that spawns the stdio server, reads `examples/inputs/sample-notes.txt`, calls the three tools, and prints JSON results.

```bash
npm run demo:stdio
```

## Demo (Streamable HTTP) — runs tools end-to-end
This runs a small demo client that spawns the HTTP server entrypoint on localhost, connects via the Streamable HTTP client transport, calls the three tools, and prints JSON results.

```bash
npm run demo:http
```

## Run (Streamable HTTP) — optional
This is included as a second entrypoint for later scenarios. It binds to `127.0.0.1`.

```bash
npm run dev:http
```

Then POST MCP JSON-RPC requests to:
- `http://127.0.0.1:3000/mcp`

## What the MCP surfaces do

### Tools
Extractor tools accept the same input shape:
```json
{ "text": "...", "tenantId": "demo" }
```
All tools return `structuredContent` shaped like:
```json
{ "ok": true, "result": { "tenantId": "demo", "...": "..." } }
```

- `UserStory-Extractor`
	- Extracts explicit user stories from lines like: `As a <persona> I want <goal> so that <value>`.
	- Captures nearby Acceptance Criteria (`AC:` / `Acceptance Criteria:` + bullets).
	- Emits `gaps` + `followUpQuestions` when stories are missing fields.
	- Details: `docs/tools/UserStory-Extractor.md`

- `Gherkin-Extractor`
	- Extracts `Feature:` / `Scenario:` blocks and `Given/When/Then` steps.
	- Supports `And` / `But` continuation steps.
	- Emits `nonGherkinFindings` for lines that don’t fit Gherkin structure.
	- Details: `docs/tools/Gherkin-Extractor.md`

- `MeetingSignals-Extractor`
	- Detects meeting “signals” like `Decision:`, `Action item:`, `Risk:`, `Dependency:`, `Open question:`.
	- If `tenantId` is provided, it can use tenant-configured `extractionRules` from `data/tenants/<tenantId>/signals.json`.
	- Emits `suggestedActions` based on what signals were detected.
	- Details: `docs/tools/MeetingSignals-Extractor.md`

- `UserStory-Synthesizer`
	- Synthesizes user stories from plain-English transcripts/notes.
	- Supports `mode`: `auto` (default), `deterministic`, `llm`.
	- Details: `docs/tools/UserStory-Synthesizer.md`

- `Gherkin-Synthesizer`
	- Synthesizes Gherkin-style Features/Scenarios from plain-English transcripts/notes.
	- Supports `mode`: `auto` (default), `deterministic`, `llm`.
	- Details: `docs/tools/Gherkin-Synthesizer.md`

### Optional LLM configuration (Synthesizers only)
Set these environment variables to enable LLM-backed synthesis:

- `LLM_CHAT_COMPLETIONS_URL` (required to enable LLM)
- `LLM_API_KEY` (required unless `LLM_AUTH_MODE=none`)
- `LLM_AUTH_MODE` (optional): `bearer` (default) | `api-key` | `none`
- `LLM_MODEL` (optional)
- `LLM_EXTRA_HEADERS_JSON` (optional): JSON object of extra headers

OpenAI example:
```bash
set LLM_CHAT_COMPLETIONS_URL=https://api.openai.com/v1/chat/completions
set LLM_AUTH_MODE=bearer
set LLM_API_KEY=...your key...
```

Azure OpenAI example (OpenAI-compatible chat-completions):
```bash
set LLM_CHAT_COMPLETIONS_URL=https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT/chat/completions?api-version=YYYY-MM-DD
set LLM_AUTH_MODE=api-key
set LLM_API_KEY=...your key...
```

### Resources (data channels)
Resources expose tenant files as MCP resources:

- `tenant://<tenantId>/guidance` → Markdown guidance text.
	- Backed by: `data/tenants/<tenantId>/guidance.md`
	- Details: `docs/resources/tenant-guidance.md`

- `tenant://<tenantId>/signals` → JSON signal taxonomy + optional extraction rules.
	- Backed by: `data/tenants/<tenantId>/signals.json`
	- Details: `docs/resources/tenant-signals.md`

Static knowledge resources (repo-owned guidance):

- `knowledge://user-story-structure` → User story structure guidance.
- `knowledge://gherkin-structure` → Gherkin structure guidance.
- `knowledge://mapping-guidelines` → How to map meeting text to stories/scenarios.
	- Backed by: `data/knowledge/*`
	- Details: `docs/resources/knowledge-docs.md`

### Prompts
Prompts are reusable message templates for clients that want to drive consistent extraction.

- `extract-user-stories` → A prompt that asks for user stories + acceptance criteria + follow-up questions.
	- Details: `docs/prompts/extract-user-stories.md`

- `extract-gherkin` → A prompt that asks for Gherkin Features/Scenarios/steps.
	- Details: `docs/prompts/extract-gherkin.md`

## Tenant data
Tenant files live in:
- `data/tenants/<tenantId>/guidance.md`
- `data/tenants/<tenantId>/signals.json`

A sample tenant `demo` is included.

### Tenant signal extraction rules
`signals.json` can optionally include `extractionRules` to control how `MeetingSignals-Extractor` detects signals for that tenant.

- If `tenantId` is provided to the tool and `extractionRules` exist, those rules are used.
- If rules are missing or invalid, the server falls back to its built-in defaults.

Pattern format:
- Plain regex source string (compiled with case-insensitive flag), e.g. `"^\\s*(decision)\\s*[:\\-]"`
- Or `/.../flags` form, e.g. `"/^\\s*decision\\s*[:\\-]/i"`

## Notes
- Extraction logic is intentionally lightweight (heuristics + parsing) to keep the repo runnable with no API keys.
- You can optionally configure an OpenAI-compatible endpoint to improve synthesis accuracy without changing tool contracts.
