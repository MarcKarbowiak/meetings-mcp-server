# Mapping plain English to stories & Gherkin

This guidance is optimized for turning messy meeting notes into:
- a small set of actionable user stories (backlog items)
- executable-style examples in Gherkin (acceptance criteria)

## 1) Detect requirement candidates
Treat a sentence as a requirement candidate if it contains one or more of:
- **Obligation/need**: “must”, “should”, “need to”, “have to”, “required to”, “cannot/must not”
- **Conditionals**: “if/when/unless … then …”, “only if”, “otherwise”
- **Behavior outcomes**: “so that…”, “in order to…”, “this enables…”, “we want to prevent…”
- **Rules & constraints**: limits, permissions, time windows, rate limits, validation rules
- **Non-functional requirements (NFRs)**: performance (“within 2s”), reliability, auditability, security

Exclude (or mark low confidence): pure brainstorming (“maybe”, “could”, “nice to have”), or implementation chatter without a user-visible behavior.

## 2) Normalize each requirement into a structured intent
For each candidate sentence, try to extract these fields:
- **Actor/persona**: who benefits or performs the action (customer, admin, agent, API client)
- **Goal/capability**: what the system must allow/produce/prevent
- **Trigger**: when it happens (event/action)
- **Preconditions**: what must already be true
- **Outcome**: observable result (UI message, response, notification, state visible externally)
- **Constraints**: “must not…”, “only…”, “within…”, “log/audit…”, “GDPR…”

If any field is missing, keep the story/scenario minimal and add follow-up questions.

## 3) Map to a user story (backlog item)
Use the user story template as a checklist, not a rigid mold.

Rules:
- Prefer the **narrowest real persona** mentioned (e.g., “support agent” vs “user”). If unclear, default to “user”.
- The **I want** clause should be a capability, not a UI instruction.
- The **so that** clause should capture business value or avoided risk; omit if unknown.
- Split into multiple stories if you see:
	- multiple distinct personas
	- multiple independent outcomes
	- a big epic (“do everything”) that won’t fit in one iteration

## 4) Map to Gherkin (acceptance criteria as examples)
Use scenarios as concrete examples of behavior. Keep them short (roughly 3–5 steps).

Step intent rules:
- **Given**: context/preconditions (avoid user interaction here)
- **When**: the action/event (one primary action)
- **Then**: observable outcome (what a user/external system can see)
- Use **And/But** for additional context or outcomes.
- Avoid UI details unless the meeting explicitly makes UI behavior a requirement.

Scenario selection rules:
- Add a **happy path** scenario for every story.
- Add at least one **edge/error** scenario if the text implies constraints (“cannot”, “only if”, “invalid”).
- If the requirement is parameterized (“for each role/status”), prefer a **Scenario Outline**.

## 5) Preserve traceability
Always attach evidence and gaps:
- Evidence: quote the original sentence(s).
- Follow-up questions: short questions that would make the AC precise.

## Worked example (end-to-end)

Plain English:
"If a user enters an invalid verification code, we should show an error and let them try again. After 5 failed attempts, lock the account for 15 minutes."

User story:
- As a user, I want to verify my account with a code so that I can securely access the product.

Acceptance criteria (Gherkin):
Feature: Account verification

Scenario: Invalid code shows an error and allows retry
	Given a user has requested a verification code
	When the user submits an invalid verification code
	Then the user is told the code is invalid
	And the user can try again

Scenario: Too many failed attempts locks verification
	Given a user has requested a verification code
	And the user has submitted 5 invalid verification codes
	When the user submits another verification attempt
	Then verification is blocked for 15 minutes

Follow-up questions:
- What counts as an “attempt” (per code, per user, per device)?
- What exact message should be shown (or error code returned) for lockout?
