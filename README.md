# Trace Inspector

Local-first execution observability for AI agents.


> Status: pre-V0. The repository currently contains a design and learning plan;
> it does not yet provide a working collector.

## Problem
Agent interfaces show final outputs and selected progress messages, but it is difficult to inspect one run as a structured sequence of runtime events or compare two runs at the point where their observable behavior diverges.

### User
An AI evaluation researcher debugging codex runs.

## What V0 will do
Record one real Codex turn and replay it as a clickable timeline with raw evidence.

## What it does not claim
- multiple agent frameworks;
- hosted multi-user service;
- neural interpretability;
- automatic causal attribution;
- production authentication;
- a general-purpose LLM monitoring platform.

## Architecture

```text
Codex App Server
        ↓ raw runtime events
Collector and Codex Adapter
        ↓ normalized append-only events
Trace Core and Local Store
        ↓
Timeline Viewer
```

See [docs/architecture.md](docs/architecture.md) for the client and visibility
boundary.

## Planned demo

Record a small Codex repository task, replay it as a clickable timeline, select
a failed event, and verify the displayed finding against the corresponding raw
runtime message.

## Development milestones

- **V0 — See one run:** capture, normalize, save, and visualize one real Codex
  turn.
- **V1 — Diagnose one run:** persist traces, reconstruct spans, and produce
  evidence-linked diagnostics.
- **V2 — Compare two runs:** align traces and locate their first observable
  divergence under a documented comparison policy.

## Evidence model

Trace Inspector separates `observed`, `model_reported`, and `inferred` claims.
Every future diagnostic should link back to inspectable evidence. See
[docs/evidence-model.md](docs/evidence-model.md).

## Privacy and security

Raw traces may contain prompts, file paths, command output, diffs, and other
sensitive local data. Local traces, databases, logs, and environment files are
excluded through `.gitignore`. Only synthetic or manually redacted fixtures
will be committed.

## Local development

Not available yet. TypeScript project scaffolding and reproducible commands are
the first V0 implementation milestone.

## Project status

Pre-V0. The repository currently contains the project definition, evidence
model, architecture boundary, CV evidence ledger, and learning plan. It does
not yet provide a working collector.

The implementation sequence is documented in
[TRACE_INSPECTOR_GUIDANCE_BOOK.md](TRACE_INSPECTOR_GUIDANCE_BOOK.md).
