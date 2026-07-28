# Trace Inspector

Local-first execution observability for AI agents.


> Status: V0 in progress. A working local collector can record one real Codex
> App Server turn, preserve raw JSONL, normalize supported events, and replay
> them in terminal and browser timelines with linked raw evidence.

## Problem
Agent interfaces show final outputs and selected progress messages, but it is difficult to inspect one run as a structured sequence of runtime events or compare two runs at the point where their observable behavior diverges.

### User
An AI evaluation researcher debugging codex runs.

## What works now

- record one real, ephemeral Codex App Server turn;
- preserve every received message in append-only raw JSONL;
- write a trace manifest and replay raw evidence through a versioned schema;
- normalize lifecycle, message, command, plan, usage, and RPC response events;
- preserve unsupported events as `unknown`;
- render a deterministic terminal timeline;
- open a vertical chronological browser flow with lane labels, transition
  timing, and clickable raw and normalized evidence.

## What V0 will add

Finish the reproducible demo fixture, browser QA, and README screenshot.

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

Requirements: Node.js 22+, an installed and authenticated Codex CLI, and a local
checkout that may be inspected by the recorded turn.

```bash
npm install
npm run typecheck
npm test
npm run demo:fixture
npm run record -- "Reply with exactly TRACE_INSPECTOR_SMOKE_OK. Do not run commands, use tools, or edit files."
npm run view -- latest
```

Local traces are written under `.trace-inspector/traces/` and are ignored by
Git because they may contain prompts, paths, command output, or code.

## Project status

V0 in progress. The live collector, raw store, manifest, deterministic replay,
normalizer, terminal viewer, vertical browser flow, synthetic fixture, and four
normalizer tests are implemented. Browser QA and a redacted reproducible visual
demo remain.

The implementation sequence is documented in
[TRACE_INSPECTOR_GUIDANCE_BOOK.md](TRACE_INSPECTOR_GUIDANCE_BOOK.md).
