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
