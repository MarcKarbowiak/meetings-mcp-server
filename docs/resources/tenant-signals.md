# Resource (data channel): tenant://<tenantId>/signals

## Purpose
Exposes tenant-specific meeting signal taxonomy and optional extraction rules as a read-only MCP resource.

## URI
- `tenant://<tenantId>/signals`

## Backing data
- `data/tenants/<tenantId>/signals.json`

## MIME type
- `application/json`

## Shape (demo tenant)
The file includes:
- `signals`: a list of signal types + examples (for humans and for prompt-building)
- `extractionRules` (optional): rules used by `MeetingSignals-Extractor` when `tenantId` is provided

## Notes
- This is designed to be tenant-editable without code changes.
- Invalid `extractionRules` should not break the server; it will fall back to built-in defaults.
