# meetings-mcp-server

Showcase **MCP (Model Context Protocol)** server in TypeScript.

It exposes:
- Tools: `UserStory-Extractor`, `Gherkin-Extractor`, `MeetingSignals-Extractor`
- Resources: tenant-specific meeting guidance + signal taxonomy from `data/tenants/*`
- Prompts: reusable templates to drive consistent extraction

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

## Tenant data
Tenant files live in:
- `data/tenants/<tenantId>/guidance.md`
- `data/tenants/<tenantId>/signals.json`

A sample tenant `demo` is included.

## Notes
- Extraction logic is intentionally lightweight (heuristics + parsing) to keep the repo runnable with no API keys.
- You can later add an LLM provider to improve accuracy without changing tool contracts.
