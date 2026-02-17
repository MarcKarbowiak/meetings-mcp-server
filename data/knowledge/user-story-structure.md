# User story structure

Use user stories as a compact *requirement container*.

## Canonical format
- **As a** `<persona>`
- **I want** `to <capability>`
- **so that** `<value/outcome>` (optional but preferred)

Notes:
- Treat this as a checklist: the story can be phrased more naturally if it still captures **who/what/why**.
- Prefer a specific persona (“support agent”, “billing admin”, “mobile user”) over a generic “user” when the meeting text supports it.
- Avoid embedding UI design (“click the blue button”) unless it is explicitly required.

## Small examples

Plain English:
"Agents need to search customers by email so they can respond faster."

User story:
- As a support agent, I want to search customers by email so that I can find the right account quickly.

Plain English:
"We must keep an audit trail of permission changes."

User story (NFR / compliance):
- As a compliance auditor, I want permission changes to be recorded so that we can prove who changed access and when.

## Acceptance criteria (AC)
Write AC as observable, testable statements.

Minimum bar:
- At least 2 AC per story (happy path + at least one edge/error path).
- Avoid implementation details unless they are constraints.

Good AC patterns:
- Outcomes are externally visible (message shown, response returned, notification sent).
- Constraints are explicit (limits, permissions, time windows).
- Terms are consistent with the domain language used in the meeting.

If details are missing, prefer:
- one minimal happy-path AC
- one minimal error/edge AC based on stated constraints
- follow-up questions for the rest

## Evidence
When synthesizing from meeting notes, attach evidence:
- Quote the relevant sentence(s).
- Include line-based source spans.

## Confidence
If meeting language is vague ("maybe", "we could"), or if key details are missing, mark confidence as `low` and add follow-up questions.
