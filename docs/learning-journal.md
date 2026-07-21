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
