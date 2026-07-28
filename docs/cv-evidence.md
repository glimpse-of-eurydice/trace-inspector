## Verified
- [x] Real Codex events captured
- [x] Normalized schema tested
- [x] Trace replay demonstrated in a terminal timeline
- [x] Deterministic span reconstruction implemented and tested
- [ ] SQLite persistence implemented
- [x] Diagnostics linked to raw event IDs
- [ ] First observable divergence implemented

## Metrics
- Completed traces recorded locally: 3
- Real failed-command validation traces: 1
- Event types supported: [not measured]
- Deterministic diagnostic rules: 3
- Public synthetic demo traces: 1
- Test count: 14

## Evidence notes

- Verified locally with Codex CLI `0.145.0-alpha.18`.
- The smoke test captured 28 raw App Server messages and reached
  `turn/completed`.
- Replaying the smoke trace reconstructs 3 spans with parent-child links.
- A controlled real run of `/bin/zsh -c false` captured 55 raw messages,
  reconstructed 5 spans, and produced 1 observed `failed_operation` finding
  linked to command events 31 and 32.
- `interrupted_operation` and `incomplete_operation` are covered by synthetic
  unit tests; no live interrupted trace is claimed yet.
- `npm run view:demo` rebuilds a synthetic failed-command trace through the
  production replay path without requiring Codex credentials.
- The README includes a screenshot of that public demo with its finding,
  ordered evidence chain, selected failed event, and raw-reference metadata.
- A fixture privacy test rejects known personal paths and credential-like
  patterns; this is a narrow regression check, not a general secret scanner.
- The local trace is intentionally ignored by Git; only synthetic or redacted
  fixtures may be committed.

## Claims not yet allowed
- “causal attribution”
- “framework-agnostic”
- “production monitoring”
