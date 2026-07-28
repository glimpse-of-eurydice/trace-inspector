# Trace Inspector

Local-first execution observability for AI agents.


> Status: V1 in progress. A working local collector can record one real Codex
> App Server turn, preserve raw JSONL, normalize supported events, and replay
> them in terminal and browser timelines with linked raw evidence. Replay now
> also reconstructs derived operation spans and produces evidence-linked
> deterministic findings.

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
  timing, and clickable raw and normalized evidence;
- reconstruct paired, failed, interrupted, incomplete, and orphan spans without
  replacing their source events.
- generate deterministic findings for failed, interrupted, and incomplete
  operations;
- jump from a browser finding to the normalized events and raw runtime messages
  that support it.

## What V1 will add

Rebuildable SQLite indexing, broader diagnostics, span navigation in the
viewer, redaction, and a reproducible visual demo.

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

V1 in progress. The V0 collector-to-viewer path is implemented. Replay also
reconstructs derived spans, writes `spans.jsonl`, and writes deterministic
diagnostics to `findings.jsonl`. Thirteen tests cover normalization, span
reconstruction, and evidence-level boundaries. A real Codex run that executed
the harmless failing command `false` produced one observed failure finding
linked to its start and completion events. Interrupted and incomplete
diagnostics are currently verified with synthetic tests, not claimed as live
runtime demonstrations. SQLite indexing, broader diagnostics, span navigation,
browser QA, and a redacted reproducible visual demo remain.

The implementation sequence is documented in
[TRACE_INSPECTOR_GUIDANCE_BOOK.md](TRACE_INSPECTOR_GUIDANCE_BOOK.md).
