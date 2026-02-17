# Resource (data channel): tenant://<tenantId>/guidance

## Purpose
Exposes tenant-specific guidance as a read-only MCP resource.

This lets clients pull “how we run meetings / how we write notes” guidance without hardcoding it in the client.

## URI
- `tenant://<tenantId>/guidance`

## Backing data
- `data/tenants/<tenantId>/guidance.md`

## MIME type
- `text/markdown`

## Typical use
- A client reads this resource before running extraction.
- The client can show it to users or feed it into a model prompt (if you later add an LLM path).
