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

### Tenant signal extraction rules
`signals.json` can optionally include `extractionRules` to control how `MeetingSignals-Extractor` detects signals for that tenant.

- If `tenantId` is provided to the tool and `extractionRules` exist, those rules are used.
- If rules are missing or invalid, the server falls back to its built-in defaults.

Pattern format:
- Plain regex source string (compiled with case-insensitive flag), e.g. `"^\\s*(decision)\\s*[:\\-]"`
- Or `/.../flags` form, e.g. `"/^\\s*decision\\s*[:\\-]/i"`

## Notes
- Extraction logic is intentionally lightweight (heuristics + parsing) to keep the repo runnable with no API keys.
- You can later add an LLM provider to improve accuracy without changing tool contracts.
