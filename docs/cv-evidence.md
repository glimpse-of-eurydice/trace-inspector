## Verified
- [x] Real Codex events captured
- [x] Normalized schema tested
- [x] Trace replay demonstrated in a terminal timeline
- [x] Deterministic span reconstruction implemented and tested
- [ ] SQLite persistence implemented
- [x] Diagnostics linked to raw event IDs
- [x] First observable divergence implemented
- [x] Versioned deterministic trace alignment implemented and tested
- [x] Side-by-side raw evidence API and viewer implemented
- [x] Ambiguous minimum-cost alignments surfaced with divergence abstention
- [x] Multi-pair synthetic golden set implemented

## Metrics
- Completed traces recorded locally: 3
- Real failed-command validation traces: 1
- Event types supported: [not measured]
- Deterministic diagnostic rules: 3
- Public synthetic demo traces: 2
- Public synthetic comparison pairs: 1
- Comparison rows in demo pair: 7
- Demo alignment result: 4 same, 2 changed, 1 inserted, 0 deleted
- Synthetic comparison golden cases: 8
- Golden cases passing: 8
- Ambiguity cases with divergence withheld: 2
- Test count: 20

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
- `npm run compare:demo` reproduces one success/failure pair and writes a
  versioned `diff.json` plus its intervention manifest.
- Under `v2-default`, the first observable divergence is the constructed
  command-output change at alignment index 2. The diff labels this
  policy-derived result `inferred` and explicitly denies causal attribution.
- Tests verify stability under changed event IDs, entity IDs, timestamps, raw
  references, and configured workspace-root prefixes.
- `v2-default` `0.2.0` counts minimum-cost alignment paths. Two committed
  ambiguity cases retain a deterministic preview while withholding first
  observable divergence.
- `npm run eval:golden` passes 8/8 predeclared comparison cases.
- The local trace is intentionally ignored by Git; only synthetic or redacted
  fixtures may be committed.

## Claims not yet allowed
- “causal attribution”
- “framework-agnostic”
- “production monitoring”
- “validated across agent frameworks”
