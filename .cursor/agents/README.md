# Menolisa — Subagent Roster

Use these subagents to keep context focused and get domain-specific help. Delegate by name, e.g. *Use the **idea-review** subagent to evaluate this feature.*

| Subagent | When to use |
|----------|-------------|
| **idea-review** | New feature ideas, product concepts, UX proposals — before writing specs or code. |
| **product-lead** | Feature specs, acceptance criteria, Menolisa persona/voice, UX copy, product decisions. |
| **ui-designer** | Screens, components, styling, navigation — implementation using design tokens and conventions. |
| **tester** | Unit/integration tests, test setup (Jest, React Native Testing Library), test strategy. |
| **backend-specialist** | API contracts, Supabase auth, env config, new endpoints, mobile–backend integration. |
| **code-reviewer** | Review code for quality, security, conventions after writing or changing code. |
| **debugger** | Errors, test failures, build issues, unexpected behavior — root cause and fix. |

## Suggested flow

- **New feature**: idea-review → product-lead (spec) → ui-designer and/or backend-specialist (implementation) → tester (tests) → code-reviewer (review).
- **Bug or failure**: debugger (diagnose and fix) → tester (add/update tests if needed) → code-reviewer (quick review).
- **Backend/API work**: backend-specialist (contract + mobile usage) → ui-designer if UI changes → tester.

All agents assume the Menolisa Expo/React Native app; see `docs/CLAUDE.md` for full context.
