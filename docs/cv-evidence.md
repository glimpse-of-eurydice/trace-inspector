## Verified
- [x] Real Codex events captured
- [x] Normalized schema tested
- [x] Trace replay demonstrated in a terminal timeline
- [ ] SQLite persistence implemented
- [ ] Diagnostics linked to raw event IDs
- [ ] First observable divergence implemented

## Metrics
- Traces recorded: 1 safe smoke-test turn
- Event types supported: [not measured]
- Diagnostic rules: [not measured]
- Test count: 4

## Evidence notes

- Verified locally with Codex CLI `0.145.0-alpha.18`.
- The smoke test captured 28 raw App Server messages and reached
  `turn/completed`.
- The local trace is intentionally ignored by Git; only synthetic or redacted
  fixtures may be committed.

## Claims not yet allowed
- “causal attribution”
- “framework-agnostic”
- “production monitoring”
