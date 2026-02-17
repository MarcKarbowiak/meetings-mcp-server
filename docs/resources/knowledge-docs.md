# Resource: knowledge://...

## Purpose
Exposes static, repo-owned “how to interpret” guidance as MCP resources.

These resources are useful for:
- Clients that want to compose better prompts for an external LLM.
- The server’s optional LLM-backed Synthesizer tools (they inject this guidance into the LLM system prompt when available).

## URIs
- `knowledge://user-story-structure`
- `knowledge://gherkin-structure`
- `knowledge://mapping-guidelines`

## Backing files
These resources are backed by files in:
- `data/knowledge/*`

## Usage (client side)
Typical flow:
1) `listResources` → find the knowledge URIs
2) `readResource` → fetch the markdown text
3) Append the text into your LLM system prompt (or provide it as “context” in your app)

## Circularity note
This is **not** circular in the “LLM calls itself” sense.

- The knowledge resources are static, deterministic text.
- A client may choose to feed that text into an LLM call.
- The MCP server does not need to call itself; it simply serves resources and tools.
