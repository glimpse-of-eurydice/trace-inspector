# Learning Journal

## 2026-07-22 — Evidence levels and client boundary

### I learned

- The Timeline Viewer is a user-visible client of the tracing system. It shows
  runtime events that the system exposes, but not the model's complete internal
  computation.
- “Observed” means supported by a recorded event or inspectable artifact. It is
  broader and more precise than “something I can see with my eyes.”
- A final summary is observed as an emitted message, but the truth of the
  summary's claims still needs tool, command, file-change, or diff evidence.
- A model saying that it will call a tool is model-reported; the runtime
  recording the actual tool execution is observed.
- A relationship such as “the failed read caused a strategy change” remains
  inferred even if the failed read and later plan update are both observed.
- First observable divergence is weaker than a causal explanation because many
  later processes and uncontrolled differences can affect the final answer.

### I verified

- I can distinguish a model-reported intention from an observed runtime action.
- I can explain why first observable divergence is not necessarily the cause of
  the final-answer difference.

### I am still uncertain about

- Which exact Codex App Server events are available for every category shown in
  the planned timeline.
- How raw start/completion events will be paired into spans in code.
- How to represent evidence references in the normalized V0 schema.

These are implementation questions for V0 rather than gaps that block the
initial project-definition commit.

## 2026-07-29 — Spans and evidence-linked findings

### I learned

- An event is an observed point in the runtime stream; a span is a rebuildable
  operation reconstructed from start, output, and completion events.
- A failed or interrupted finding is `observed` only when the runtime explicitly
  reports that status.
- An incomplete finding is `inferred`: it means collection ended without a
  matching completion event, not that the operation definitely crashed or
  became stuck.
- A finding is useful infrastructure only when it carries stable rule metadata
  and links back through event IDs to raw evidence.
- A UI warning is the presentation of a finding, not the finding itself.

### I verified

- A synthetic fixture reconstructs a failed command span and one observed
  failure finding.
- Thirteen unit tests cover normalization, span reconstruction, and three
  diagnostic rules.
- A real Codex turn executing `/bin/zsh -c false` generated an observed failed
  command finding linked to its start and completion events.
- The local API returns events, spans, findings, and raw records together.

### I am still uncertain about

- Which additional diagnostics provide the most value before SQLite and
  redaction work.
- How the viewer should expose span hierarchy without making the event evidence
  harder to inspect.

## 2026-07-29 — Reproducible public demo

### I learned

- A demo fixture is input evidence, not a separate toy implementation. It is
  more credible when it enters the same replay and viewer pipeline as a live
  trace.
- An evidence chain can reduce JSON-reading burden while preserving the path
  back to normalized and raw records.
- Synthetic data should explicitly declare that it contains no sensitive data;
  live traces should retain the opposite default.

### I verified

- `npm run view:demo` materializes a synthetic trace with 7 events, 2 spans,
  and 1 observed failure finding.
- The finding links the ordered sequence `02 STARTED → 03 OUTPUT → 04 FAILED`.
- The demo API reports `containsSensitiveData: false`.
- A fourteenth test checks the committed fixture for known private-path and
  credential-like patterns.
- The README screenshot was captured from the synthetic demo after selecting
  event 04, so it exposes no private live-trace data.

## 2026-07-29 — V2 deterministic trace comparison

### I learned

- Comparing traces is an alignment problem because IDs, timestamps, and
  sequence lengths can differ even when two events play the same role.
- “First observable divergence” depends on a comparison policy. It is therefore
  inferred from observed events rather than directly emitted by the runtime.
- A high substitution cost for different event kinds allows insertions and
  deletions to remain visible instead of forcing unrelated events into a pair.
- Normalizing configured workspace roots prevents environment-specific paths
  from creating a false divergence.

### I verified

- `v2-default` uses versioned deterministic dynamic-programming alignment.
- The constructed success/failure pair produces 7 aligned rows: 4 same,
  2 changed, 1 right-side insertion, and 0 deletions.
- The first observable divergence is the command-output change at alignment
  index 2: `7 tests passed` versus `1 test failed`.
- Later differences remain visible: command status changes and the failed
  variant adds a plan update before the traces realign at turn completion.
- Eighteen tests pass, including invariance to harmless IDs, timestamps, raw
  references, and configured workspace-root prefixes.

### I am still uncertain about

- Which policy controls should be user-adjustable without making the UI harder
  to audit.

## 2026-07-29 — V2 ambiguity handling and golden-set exit

### I learned

- A deterministic tie-break does not make the underlying optimum unique.
- Counting minimum-cost dynamic-programming paths can detect when two event
  mappings are equally supported by the selected policy.
- An ambiguous comparison may still show one deterministic preview for
  inspection, but it should not report that preview's first difference as the
  first observable divergence.
- Repeated identical events and different-kind replacements can create
  ambiguity for different reasons.

### I verified

- Policy `v2-default` `0.2.0` reports `resolved` for one minimum-cost path and
  `ambiguous` for two or more.
- Ambiguous comparisons withhold `firstObservableDivergence`.
- The eight-pair golden set covers exact match, output change, insertion,
  deletion, status change, metadata invariance, and two ambiguity patterns.
- `npm run eval:golden` passes 8/8 cases.
- Twenty tests, typecheck, and build pass.

### I am still uncertain about

- Whether future real traces need event-family-specific matching keys before
  expanding beyond the current material fields.
- How streamed output chunks should be aggregated before semantic comparison.
