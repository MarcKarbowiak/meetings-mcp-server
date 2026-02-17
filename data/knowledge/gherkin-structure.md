# Gherkin structure

Use Gherkin as a readable specification format.

## Canonical structure
- **Feature**: the capability area
- **Scenario**: one behavior example
- **Given**: preconditions / context
- **When**: the action
- **Then**: expected outcome
- **And/But**: additional steps

## Step guidelines
- Use present tense.
- Keep steps business-readable.
- Avoid UI-level details unless they are requirements.

More mapping tips:
- Prefer 3–5 steps per scenario.
- Keep **Given** for context (not clicks/typing).
- Keep **When** to one primary action.
- Make **Then** an observable outcome (message shown, response returned, notification sent).
- Use **Background** for setup repeated across all scenarios in a feature.
- Use **Scenario Outline** when the same behavior repeats for multiple values.

## Small example

Plain English:
"When the payment fails, the user should see a failure message and the order should remain unpaid."

Gherkin:
Feature: Checkout

Scenario: Payment failure leaves order unpaid
	Given a user has an order ready to pay
	When the payment is declined
	Then the user is told the payment failed
	And the order remains unpaid

## Evidence
When synthesizing from meeting notes, attach evidence:
- Quote the relevant sentence(s).
- Include line-based source spans.
