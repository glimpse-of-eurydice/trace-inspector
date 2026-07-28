# Trace Inspector Guidance Book

> A learn-by-building textbook for Jingwen Qiu  
> Project stage: pre-V0  
> Book version: 0.1 — 2026-07-17

---

## How to use this book

This is not a list of technologies to memorize. It is a sequence of small, testable systems. You will learn each concept when the project creates a reason to need it.

The project has one north-star capability:

> Given two executions of the same agent task, Trace Inspector can capture, replay, visualize, and identify their first observable divergence with evidence.

Do not try to build that entire sentence at once. The three versions in this book add one capability at a time:

- **V0 — See one run:** capture, normalize, save, and visualize one real Codex turn.
- **V1 — Diagnose one run:** persist traces, reconstruct spans, and produce evidence-linked diagnostics.
- **V2 — Compare two runs:** align traces, locate the first observable divergence, and support a small controlled intervention.

Each chapter contains:

1. the concepts you need;
2. the smallest implementation that proves you understand them;
3. exercises and questions;
4. an acceptance checklist;
5. the evidence the version adds to your README and CV.

### Your rule while building

For every claim the tool displays, ask:

1. **What did the runtime actually record?**
2. **What did the model report about itself?**
3. **What did our analyzer infer?**
4. **What intervention would be needed to make a causal claim?**

This evidence discipline is not an extra feature. It is the design principle that connects the project to your existing work in LLM evaluation, model-behavior auditing, memory, and controlled experiments.

---

# Chapter 0 — Positioning, README, and Repository Foundations

## 0.1 What you are building

Trace Inspector is a **local-first agent execution observability system**.

Its first runtime is Codex. Its first client is an interactive timeline. Its internal data model should not depend permanently on either one.

```text
Codex App Server
        ↓ raw JSON-RPC notifications
Codex Adapter
        ↓ normalized append-only events
Trace Core
        ↓
Local Store ─────────→ Diagnostics
        ↓                    ↓
Timeline Viewer ←──── evidence-linked findings
```

The timeline is the visible product experience. The infrastructure work lives in the collector, schema, event processing, storage, replay, and query boundaries.

## 0.2 What you are not claiming

V0–V2 do **not** reveal:

- the model's private or complete chain of thought;
- token-level attention or residual-stream computation;
- the true causal contribution of a memory item;
- the neural mechanism that produced a tool choice;
- consciousness, internal beliefs, or hidden intentions.

They can reveal observable execution facts such as:

- a turn started or completed;
- a plan was revised;
- a command ran and failed;
- an approval introduced waiting time;
- a file was changed;
- the runtime emitted a reasoning summary;
- two runs first became observably different at a particular event.

Use the phrase **execution observability** for V0 and V1. Use **controlled trace comparison** for V2. Reserve **causal observability** for later work that performs repeatable interventions and measures their effects.

## 0.3 Why this project fits your profile

Your existing evidence already supports:

- benchmark and rubric construction;
- controlled evaluation;
- LLM-as-judge and human-audit boundaries;
- failure-mode taxonomy;
- multilingual and Chinese-language analysis;
- careful separation of behavioral evidence from mechanistic claims.

Trace Inspector should add evidence that is currently weaker:

- runtime integration;
- streaming event consumption;
- schema and API design;
- local persistence and replay;
- asynchronous state reconstruction;
- developer-tool UX;
- observability and diagnostic engineering.

The intended profile shift is not “evaluation researcher becomes pure infrastructure engineer.” It is:

> An evaluation and model-behavior researcher who can encode research questions into inspectable agent infrastructure.

## 0.4 Write the project brief before code

Create a one-page project brief in `docs/project-brief.md`. It should answer:

### Problem

Agent interfaces show final outputs and selected progress messages, but it is difficult to inspect one run as a structured sequence of runtime events or compare two runs at the point where their observable behavior diverges.

### User

Start with one user: an AI evaluation researcher debugging Codex runs.

### V0 promise

Record one real Codex turn and replay it as a clickable timeline with raw evidence.

### Non-goals

- multiple agent frameworks;
- hosted multi-user service;
- neural interpretability;
- automatic causal attribution;
- production authentication;
- a general-purpose LLM monitoring platform.

### Success signal

A new user can run one documented command, record a turn, open the trace, click a failed event, and verify the finding against raw runtime data.

## 0.5 Start the README before implementation

The README is not a graduation report. It is a design constraint and an honesty check.

Create `README.md` with this initial structure:

```markdown
# Trace Inspector

Local-first execution observability for AI agents.

> Status: pre-V0. The repository currently contains a design and learning plan;
> it does not yet provide a working collector.

## Problem

## What V0 will do

## What it does not claim

## Architecture

## Planned demo

## Development milestones

## Evidence model

## Privacy and security

## Local development

## Project status
```

Keep the status sentence truthful after every milestone. Never leave screenshots or feature claims in the README after the implementation changes.

## 0.6 Repository structure

Start with one TypeScript project, not a monorepo:

```text
trace-inspector/
├── README.md
├── TRACE_INSPECTOR_GUIDANCE_BOOK.md
├── package.json
├── tsconfig.json
├── .gitignore
├── docs/
│   ├── project-brief.md
│   ├── architecture.md
│   ├── evidence-model.md
│   └── learning-journal.md
├── src/
│   ├── core/          # normalized types and pure transformations
│   ├── adapters/      # Codex-specific input boundary
│   ├── collector/     # process and stream lifecycle
│   ├── store/         # JSONL in V0, SQLite in V1
│   ├── analysis/      # diagnostics and diff algorithms
│   └── cli/           # record, list, view, diff
├── web/               # React timeline client
├── fixtures/
│   ├── raw/
│   └── normalized/
└── tests/
```

Do not split these folders into publishable packages until a real boundary requires independent versioning or reuse.

## 0.7 Technology choices

Recommended starting stack:

- **Node.js + TypeScript:** one type system across collector, core, CLI, and web UI.
- **npm:** fewer setup decisions for a first infrastructure project.
- **Vitest:** fast unit tests for event normalization and diagnostics.
- **React + Vite:** enough structure for an interactive inspector without building a framework.
- **JSONL in V0:** preserves event order and makes raw evidence inspectable.
- **SQLite in V1:** introduces queries and persistence without operating a database service.

Why TypeScript rather than Python for the first version?

You already have substantial Python evaluation experience. TypeScript gives this project a distinct engineering signal, matches browser UI development, and makes event schemas explicit. This is a recommendation, not a claim that TypeScript is inherently more “infrastructure.” If language learning begins to block the tracing concepts, a Python collector with a TypeScript viewer is an acceptable fallback.

## 0.8 Git as part of the learning evidence

This repository is already initialized on `main` and currently has no commits.

Use small milestone commits. A reasonable opening history is:

```text
docs: define trace inspector scope and evidence model
chore: scaffold typescript project and test runner
feat: normalize codex runtime events
feat: persist normalized events as jsonl
feat: render trace events on timeline
test: cover malformed and incomplete event streams
```

Before each commit:

```bash
git status --short
npm test
npm run typecheck
```

Commit messages should describe verified repository changes, not aspirations. Do not write `feat: causal trace analysis` if the code only compares two JSON files.

## 0.9 CV strategy from the beginning

Do not put a planned project into a formal CV as if it exists. Maintain a project evidence ledger in `docs/cv-evidence.md`:

```markdown
# CV Evidence Ledger

## Verified
- [ ] Real Codex events captured
- [ ] Normalized schema tested
- [ ] Trace replay demonstrated
- [ ] SQLite persistence implemented
- [ ] Diagnostics linked to raw event IDs
- [ ] First observable divergence implemented

## Metrics
- Traces recorded: [not measured]
- Event types supported: [not measured]
- Diagnostic rules: [not measured]
- Test count: [not measured]

## Claims not yet allowed
- “causal attribution”
- “framework-agnostic”
- “production monitoring”
```

Possible CV progression:

### After V0

> Built a local TypeScript prototype that consumes real Codex runtime events, normalizes them into an append-only JSONL trace, and replays agent execution in an interactive timeline.

### After V1

> Developed a local-first agent tracing system with streaming event collection, a versioned normalized schema, SQLite persistence, span reconstruction, and evidence-linked diagnostics for failures, plan revisions, approvals, and latency.

### After V2

> Extended an agent tracing system with trace alignment and first-divergence analysis to compare controlled reruns while separating observed runtime evidence, model-reported reasoning, and analyzer inference.

Replace these drafts with measured facts before using them.

## 0.10 Chapter 0 exercises

1. Explain in your own words why a timeline is a client of the tracing system rather than the entire system.
2. Write three examples each of observed, model-reported, and inferred claims.
3. Write one sentence explaining why “first observable divergence” is weaker than “cause of the final answer.”
4. Create the README skeleton and mark every unimplemented feature as planned.
5. Make the first commit only after you can explain every file in it.

## 0.11 Chapter 0 acceptance checklist

- [ ] `README.md` states the current implementation status.
- [ ] `docs/project-brief.md` identifies a single user and V0 promise.
- [ ] `docs/evidence-model.md` defines the three evidence levels.
- [ ] `docs/cv-evidence.md` separates verified and planned claims.
- [ ] `.gitignore` excludes secrets, local databases, trace content, and build artifacts.
- [ ] The first commit contains no API keys or private conversation content.

---

# Chapter 1 — V0: Capture and See One Real Run

## 1.1 V0 learning objective

At the end of V0, you should be able to explain and demonstrate:

> How a live agent runtime produces events, how an adapter converts them into a stable local representation, and how a viewer reconstructs a human-readable execution timeline.

V0 is complete when one real Codex turn can travel through the entire system:

```text
Codex → collector → raw JSONL → normalizer → normalized JSONL → timeline
```

## 1.2 Concept: runtime versus model

The **model** generates responses and tool-call decisions. The **runtime** manages the surrounding process: threads, turns, tools, approvals, file edits, streaming, errors, and lifecycle state.

Trace Inspector V0 observes the runtime boundary. This is why a command failure is strong observable evidence, while “the model ignored evidence” is usually an inference requiring additional analysis.

## 1.3 Concept: JSON-RPC and streaming notifications

Codex App Server communicates using JSON-RPC-style messages over a stream. You will encounter three shapes:

```json
{"method":"turn/start","id":30,"params":{"threadId":"thr_123","input":[]}}
```

This is a **request** because it has an `id` and expects a response.

```json
{"id":30,"result":{"turn":{"id":"turn_456","status":"inProgress"}}}
```

This is the matching **response**.

```json
{"method":"turn/started","params":{"turn":{"id":"turn_456"}}}
```

This is a server-initiated **notification** because it has no request `id`.

Codex documents lifecycle notifications for threads, turns, and items, including plan updates, command output, file changes, errors, and token usage. Read the current [Codex App Server documentation](https://learn.chatgpt.com/docs/app-server) before implementing the adapter because the schema is version-specific.

## 1.4 Concept: preserve raw data before interpreting it

Never make the normalized trace your only record. The collector should first append every received message to a raw JSONL file:

```json
{"receivedAt":"2026-07-17T10:00:00.123Z","sequence":1,"payload":{"method":"turn/started","params":{}}}
{"receivedAt":"2026-07-17T10:00:00.307Z","sequence":2,"payload":{"method":"item/started","params":{}}}
```

Why append-only JSONL?

- event order remains visible;
- partial traces remain debuggable after a crash;
- each line can be inspected with ordinary shell tools;
- normalization bugs can be fixed and replayed without rerunning the agent;
- raw evidence is not silently overwritten by later interpretation.

## 1.5 Design the normalized schema

Start with a versioned event envelope:

```ts
export type EvidenceLevel = "observed" | "model_reported" | "inferred";

export interface TraceEvent {
  schemaVersion: "0.1";
  eventId: string;
  traceId: string;
  sequence: number;
  source: "codex";
  sourceEventType: string;
  kind:
    | "thread.started"
    | "turn.started"
    | "turn.completed"
    | "plan.updated"
    | "item.started"
    | "item.completed"
    | "command.output"
    | "token_usage.updated"
    | "error"
    | "unknown";
  occurredAt: string;
  entityId?: string;
  parentEntityId?: string;
  status?: "pending" | "running" | "completed" | "failed" | "interrupted";
  title: string;
  evidenceLevel: EvidenceLevel;
  attributes: Record<string, unknown>;
  rawRef: { file: string; sequence: number };
}
```

Important choices:

- `schemaVersion` lets future code migrate old traces.
- `sequence` is necessary because timestamps may collide or arrive with different precision.
- `sourceEventType` preserves the original runtime name.
- `kind` gives the rest of your system a stable vocabulary.
- `unknown` prevents data loss when Codex adds an event you do not support.
- `rawRef` connects every normalized event back to evidence.

### Exercise: defend the schema

For every field, write one sentence explaining which future bug it prevents. If you cannot justify a field, remove it for V0.

## 1.6 Build a fixture before the live collector

Your first test should not launch Codex. Create a small raw fixture with:

1. turn started;
2. command started;
3. command output;
4. command completed;
5. plan updated;
6. turn completed;
7. one unknown event.

Then write a pure function:

```ts
normalizeCodexMessage(rawMessage, context): TraceEvent[]
```

It should have no filesystem access, no network access, and no global mutable state. Pure transformation functions are easy to test and replay.

Minimum tests:

- known event maps to the expected normalized kind;
- unknown event is preserved as `unknown`;
- source type and raw reference are never lost;
- missing optional fields do not crash normalization;
- malformed required input produces a structured ingestion error;
- sequence order remains stable.

## 1.7 Build the real Codex collector

The collector owns process lifecycle, not interpretation.

Responsibilities:

1. start `codex app-server` as a child process;
2. send initialization messages required by the current protocol;
3. start a thread and turn;
4. read newline-delimited messages continuously;
5. timestamp and append each message immediately;
6. stop after `turn/completed` or a controlled timeout;
7. flush files and record an incomplete status if the process ends early.

Do not parse stdout using a single `split("\n")` after process exit. Streams can deliver partial lines. Use a line reader or buffer incomplete chunks until a newline arrives.

### Security rule

The collector must never log environment variables, API keys, authentication tokens, or unrelated process state. Raw trace content can contain prompts, file paths, command output, and code. Treat the entire trace directory as potentially sensitive.

## 1.8 Give each trace a manifest

Alongside raw and normalized events, save a small manifest:

```json
{
  "traceFormatVersion": "0.1",
  "traceId": "trace_local_...",
  "source": "codex",
  "startedAt": "...",
  "endedAt": "...",
  "status": "completed",
  "collectorVersion": "0.1.0",
  "eventCount": 42,
  "containsSensitiveData": true
}
```

Suggested local layout:

```text
.trace-inspector/
└── traces/
    └── trace_local_.../
        ├── manifest.json
        ├── raw.jsonl
        └── events.jsonl
```

Add `.trace-inspector/` to `.gitignore`. Commit only carefully redacted fixtures.

## 1.9 Build the first timeline

V0 needs clarity, not visual spectacle.

Use six lanes:

- user/thread;
- plan;
- model/reasoning summary;
- tools/commands;
- files;
- system/errors.

Each event marker needs:

- horizontal time position;
- color by status, not by aesthetic category alone;
- short label;
- hover summary;
- click action opening a detail panel.

The detail panel should show:

- normalized fields;
- evidence level;
- original source event type;
- raw JSON;
- raw file and sequence reference.

Do not use an LLM to summarize events in V0. The viewer should first prove deterministic replay.

## 1.10 V0 CLI contract

Aim for three commands:

```bash
npm run cli -- record "Inspect the repository and report its current state"
npm run cli -- import fixtures/raw/basic-turn.jsonl
npm run cli -- view <trace-id>
```

The exact syntax may change, but document it before implementation. A CLI contract makes system boundaries concrete.

## 1.11 V0 demo scenario

Record a small, non-sensitive repository task in a demo fixture:

> Find the test command, run it, and summarize any failure without editing files.

The trace should include at least one tool or command event. If possible, create a safe fixture project with a deliberately failing test so the timeline has an informative failure.

The one-minute V0 demo:

1. run the record command;
2. show the trace directory being created;
3. open the timeline;
4. click the failed command;
5. show the same payload in raw JSONL;
6. state what the trace does and does not prove.

## 1.12 V0 learning questions

You should be able to answer without notes:

1. What is the difference between a request, response, and notification?
2. Why is a sequence number needed in addition to a timestamp?
3. Why preserve unknown event types?
4. Why is raw JSONL the source of truth rather than the UI state?
5. What happens if the process stops between `item/started` and `item/completed`?
6. Which displayed fields are direct observations and which are presentation choices?

## 1.13 V0 acceptance checklist

- [ ] One real Codex turn is captured from App Server.
- [ ] Raw messages are appended before normalization.
- [ ] Normalization is deterministic and unit tested.
- [ ] Unknown events are preserved.
- [ ] Every normalized event links to a raw sequence.
- [ ] Interrupted collection produces a readable partial trace.
- [ ] Timeline events are clickable and display raw evidence.
- [ ] A redacted example trace is safe to commit.
- [ ] README contains a reproducible V0 command.
- [ ] README does not claim causal or mechanistic visibility.

## 1.14 V0 exit decision

Do not begin SQLite or trace diff until a fresh clone can reproduce the full path from live event to timeline. If that path is unreliable, more features will hide rather than solve the system problem.

---

# Chapter 2 — V1: Store, Reconstruct, and Diagnose One Run

## 2.1 V1 learning objective

V1 turns a demo pipeline into a small tracing system.

At the end of V1, the system should answer:

- What traces exist?
- What happened during this trace?
- Which operations had duration?
- Which operations failed or remained incomplete?
- Which diagnostic claim is supported by which events?

## 2.2 Concept: event versus span

An **event** is something observed at a point in the sequence:

```text
item/started
command output delta
item/completed
```

A **span** represents an operation with a start and end:

```text
[ command execution -------------------- ]
start                                      end
```

Spans are usually reconstructed from events. Do not delete the original events after creating a span.

The OpenAI Agents SDK also models an end-to-end trace as nested spans for agent runs, generations, tools, guardrails, and handoffs. Its [tracing guide](https://openai.github.io/openai-agents-js/guides/tracing/) is useful comparative reading, but V1 should still use your own minimal normalized model.

## 2.3 Reconstruct spans as a derived view

Define a span separately from an event:

```ts
export interface TraceSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  kind: "turn" | "item" | "command" | "tool" | "approval" | "other";
  title: string;
  startedAt: string;
  endedAt?: string;
  startSequence: number;
  endSequence?: number;
  status: "running" | "completed" | "failed" | "interrupted" | "incomplete";
  sourceEventIds: string[];
}
```

Span reconstruction must handle:

- normal start and completion;
- completion without a visible start;
- start without completion;
- duplicate notifications;
- nested operations;
- interrupted turns;
- out-of-order timestamps while preserving received sequence.

An incomplete span is useful evidence, not merely invalid data.

## 2.4 Move manifests and normalized events into SQLite

Keep raw JSONL as immutable evidence. Add SQLite as an index and query layer.

Minimal tables:

```sql
CREATE TABLE traces (
  trace_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  event_count INTEGER NOT NULL,
  manifest_json TEXT NOT NULL
);

CREATE TABLE events (
  event_id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  kind TEXT NOT NULL,
  source_event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  evidence_level TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  UNIQUE(trace_id, sequence)
);

CREATE TABLE spans (
  span_id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  parent_span_id TEXT,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  source_event_ids_json TEXT NOT NULL
);
```

Questions to consider:

- What is authoritative: raw JSONL or SQLite?
- Can the database be rebuilt from trace files?
- What happens when schema version `0.2` appears?
- Which fields need indexes for the UI?

The recommended answer for V1: raw trace files are authoritative; SQLite is rebuildable.

## 2.5 Concept: replay

Replay does not mean rerunning the model. It means feeding recorded events through the current normalizer, span builder, diagnostics, and UI.

```text
raw.jsonl
   ↓ replay
normalizer version X
   ↓
events + spans + findings
```

Replay enables:

- regression tests;
- schema migrations;
- fixing analysis without paying for another agent run;
- comparing old and new diagnostic logic;
- reproducing a screenshot from committed fixtures.

Add a command such as:

```bash
npm run cli -- replay <trace-id> --rebuild
```

## 2.6 Design evidence-linked diagnostics

A finding must be a structured record, not just a red warning badge:

```ts
export interface DiagnosticFinding {
  findingId: string;
  traceId: string;
  ruleId: string;
  severity: "info" | "warning" | "error";
  title: string;
  description: string;
  evidenceLevel: EvidenceLevel;
  evidenceEventIds: string[];
  evidenceSpanIds: string[];
  createdBy: { type: "deterministic_rule"; version: string };
}
```

Every finding must answer: “Show me the evidence.”

## 2.7 Start with deterministic rules

### Rule 1: failed operation

Trigger when an observed command, tool, or turn completes with a failed status.

- Evidence level: `observed`
- Evidence: completion event and associated span
- Safe wording: “Command failed.”
- Unsafe wording: “The failure caused the incorrect answer.”

### Rule 2: incomplete operation

Trigger when collection ends with a start event that has no matching completion.

- Evidence level: `inferred`
- Safe wording: “No matching completion event was observed before trace end.”

### Rule 3: plan revision

Trigger when multiple distinct plan updates are observed.

- Evidence level: `observed` for the revisions
- Safe wording: “The runtime emitted three plan versions.”
- Unsafe wording: “The model became confused.”

### Rule 4: approval waiting

Measure time between an approval request and its resolution when both are available.

- Evidence level: `observed`
- Safe wording: “This approval interval lasted 8.2 seconds.”

### Rule 5: long operation

Compare duration with a user-configured threshold, not an invented universal norm.

- Evidence level: `observed` duration plus a configured judgment rule
- Safe wording: “Duration exceeded the configured 10-second threshold.”

### Rule 6: possible retry

Detect two similar operations after a failure.

- Evidence level: `inferred`
- Display the matching rule and both event IDs.
- Use “possible retry,” never silently label it as definite.

## 2.8 Add filters and trace navigation

V1 UI should support:

- filter by event or span kind;
- filter by status;
- show only findings;
- jump from a finding to supporting events;
- zoom to a time interval;
- expand/collapse nested spans;
- toggle normalized and raw representations;
- copy a redacted event reference, not an entire sensitive trace by default.

The timeline should make relationships clearer, not merely add more colors.

## 2.9 Privacy and redaction

Create an explicit field-level redaction policy.

Classify data:

| Data | Default handling |
|---|---|
| API keys and auth headers | Never record |
| Environment variables | Never record wholesale |
| User prompt | Local sensitive data |
| Tool input/output | Local sensitive data |
| File paths | Local sensitive data |
| File contents and diffs | Local sensitive data |
| Timing/status/event type | Usually safe after review |
| Committed fixtures | Must be synthetic or manually redacted |

Add a redaction transform that creates exportable fixtures without altering the local raw trace. Never overwrite evidence in place.

## 2.10 V1 tests

Add at least these test categories:

### Unit tests

- each normalization mapping;
- span pairing;
- incomplete spans;
- diagnostic rules;
- redaction.

### Golden trace tests

Given a fixed raw JSONL fixture, assert the complete normalized output and findings. Review golden changes manually.

### Integration test

Run the collector against a controlled fake App Server process that emits partial chunks, errors, and completion.

### UI test

Load a fixture and verify that clicking a finding reveals the expected raw sequence reference.

## 2.11 V1 README upgrade

The README should now include:

- a screenshot or short GIF using synthetic data;
- an architecture diagram;
- supported event types;
- diagnostics table with evidence levels;
- trace storage and privacy behavior;
- commands for record, replay, list, and view;
- known limitations;
- tested Codex version or generated schema version.

Avoid “framework agnostic” until a second adapter works.

## 2.12 V1 learning questions

1. Why are spans derived while events remain authoritative?
2. How can a database be useful without being the source of truth?
3. What makes replay deterministic?
4. Which diagnostics are observed and which are inferred?
5. How would you migrate stored events after a schema change?
6. Why should redaction create a derivative export instead of modifying raw evidence?

## 2.13 V1 acceptance checklist

- [ ] SQLite can be deleted and rebuilt from raw trace files.
- [x] Spans reconstruct normal, failed, interrupted, and incomplete operations.
- [x] Every diagnostic links to event or span evidence.
- [x] Diagnostic wording matches its evidence level.
- [ ] At least five deterministic diagnostic rules are tested.
- [ ] A fake streaming server tests partial-line handling.
- [ ] Synthetic fixtures contain no personal or repository-sensitive data.
- [ ] UI filters reduce complexity rather than hiding raw evidence.
- [ ] README documents supported Codex/schema versions.
- [ ] CV evidence ledger contains only verified features and measured counts.

Current checkpoint: three deterministic rules are implemented. A real Codex
run verifies the failed-operation path. Interrupted and incomplete paths are
covered by synthetic tests, so they should not yet be described as live runtime
demonstrations.

## 2.14 V1 exit decision

V1 is complete when you can give a trace directory to another developer and they can rebuild the database, reproduce the findings, and inspect the supporting raw events without access to your original live run.

---

# Chapter 3 — V2: Compare Runs and Locate First Observable Divergence

## 3.1 V2 learning objective

V2 connects infrastructure to your evaluation background.

The system should compare two runs of the same intended task and answer:

1. Which events can be aligned?
2. Where do the traces first become observably different?
3. What later differences follow in execution and output?
4. Which differences are observations and which interpretations?

It should not automatically answer: “What caused the behavioral difference?”

## 3.2 Concept: trace comparison is an alignment problem

Two executions rarely have identical event IDs, timestamps, or lengths.

```text
Run A: plan → read A → command fail → read B → edit → final
Run B: plan → read A → command pass ─────────→ edit → final
```

You need to decide which events represent comparable roles.

Start with a transparent matching key:

```ts
interface EventSignature {
  kind: string;
  operationName?: string;
  normalizedTarget?: string;
  parentKind?: string;
}
```

Examples:

- normalize temporary IDs;
- preserve meaningful command names while redacting secrets;
- normalize workspace-root prefixes in file paths;
- avoid embedding full model outputs as matching keys.

## 3.3 Implement comparison in stages

### Stage A: trace-level summary

Compare:

- status;
- total duration;
- event and span counts;
- failures;
- tool/command names;
- files changed;
- plan revision count;
- token usage where observed.

### Stage B: sequence alignment

Begin with a simple dynamic-programming sequence alignment over event signatures. Use explicit costs for:

- exact match;
- same kind with changed attributes;
- insertion;
- deletion.

Do not begin with embeddings or an LLM judge. A deterministic baseline gives you something inspectable and testable.

### Stage C: first observable divergence

Define it precisely:

> The earliest aligned position at which one run contains an insertion, deletion, changed status, or configured material attribute difference under the selected comparison policy.

Store the policy and algorithm version with every diff result.

## 3.4 Define the diff result

```ts
export interface TraceDiff {
  diffId: string;
  leftTraceId: string;
  rightTraceId: string;
  algorithm: { name: string; version: string; config: Record<string, unknown> };
  alignedPairs: Array<{
    leftEventId?: string;
    rightEventId?: string;
    relation: "same" | "changed" | "inserted" | "deleted";
    reasons: string[];
  }>;
  firstObservableDivergence?: {
    alignmentIndex: number;
    leftEventId?: string;
    rightEventId?: string;
    reasons: string[];
    evidenceLevel: "observed" | "inferred";
  };
}
```

The phrase “under the selected comparison policy” matters. A different policy can produce a different first divergence.

## 3.5 Build the side-by-side UI

Recommended interaction:

```text
Run A                                      Run B
────────────────────────────────────────────────────────
[plan] ──────────────────────────────── [plan]
[read results.json] failed              [read results.csv] completed
          ↑ FIRST OBSERVABLE DIVERGENCE ↑
[read archive summary]                  [run parser]
[edit note]                             [edit note]
[final answer A]                        [final answer B]
```

The user should be able to:

- lock both timelines to the same relative scale;
- follow alignment connectors;
- jump to first divergence;
- inspect both raw events;
- see why the matcher paired or separated them;
- change the comparison policy and observe the result;
- export a small diff report with evidence references.

## 3.6 Design one controlled intervention

Do not build a general experiment platform. Choose one intervention type.

A good first demonstration is **source availability** in a synthetic repository:

- Run A: a requested current result file is missing, and the agent reads an archive summary.
- Run B: the current result file is present, and the agent reads it successfully.

Record an intervention manifest:

```json
{
  "interventionId": "make-current-results-available",
  "baseTaskId": "update-experiment-note",
  "changedVariable": "filesystem.current_result_file",
  "leftCondition": "missing",
  "rightCondition": "present",
  "heldConstant": ["user prompt", "repository fixture", "model configuration where available"],
  "knownUncontrolledFactors": ["model sampling", "runtime scheduling"]
}
```

The tool may report:

> The first observed execution difference occurred at the result-file read. Later tool usage and final text also differed.

It should not report:

> The file caused the final answer to change.

One paired run is an illustrative intervention, not a stable causal estimate. Repeated trials and controlled configuration would be needed for stronger claims.

## 3.7 Add output comparison carefully

Start with deterministic output comparisons:

- exact text change;
- added/removed lines;
- changed numbers;
- changed file diff;
- presence of specified evidence references.

Only later add semantic comparison. If an LLM labels “goal drift” or “evidence mismatch,” record:

- prompt version;
- model identifier;
- raw input and output references;
- evidence level `inferred`;
- confidence or abstention behavior;
- a human-audit field.

This applies the same discipline as an LLM-as-judge benchmark.

## 3.8 Evaluation plan for the diff algorithm

Build a small golden set of trace pairs with known constructed divergence:

| Pair | Constructed difference | Expected first divergence |
|---|---|---|
| A | command success vs failure | command completion status |
| B | inserted approval | approval request |
| C | different plan wording only | policy-dependent |
| D | same events, different timing | duration attribute if enabled |
| E | missing completion event | incomplete span boundary |
| F | reordered independent events | should expose alignment ambiguity |

Measure:

- exact first-divergence accuracy on synthetic pairs;
- alignment stability when timestamps change;
- false divergence under harmless ID/path variation;
- abstention or ambiguity rate;
- runtime on increasing event counts.

Do not optimize a single aggregate score without inspecting failure cases. This is where your evaluation background becomes a system-design advantage.

## 3.9 V2 README and demo

The strongest demo is a two-condition story:

1. show the identical task statement;
2. show the controlled environment difference;
3. record both runs;
4. open side-by-side timelines;
5. jump to first observable divergence;
6. inspect raw evidence on both sides;
7. show later output difference;
8. state the causal limitation.

The README should include:

- comparison algorithm and policy;
- supported divergence types;
- golden-pair evaluation results;
- known ambiguous cases;
- intervention manifest;
- a short statement distinguishing observation, inference, and causal evidence.

## 3.10 V2 learning questions

1. Why can timestamps and event IDs not serve as alignment identity?
2. What information is lost when commands or paths are normalized?
3. Why is first observable divergence policy-dependent?
4. What makes two runs comparable?
5. Which variables are uncontrolled when the same prompt is run twice?
6. Why does a changed execution path not by itself prove the cause of changed output?
7. How would repeated interventions strengthen the evidence?

## 3.11 V2 acceptance checklist

- [ ] Trace comparison uses a documented, versioned deterministic algorithm.
- [ ] Matching rules are inspectable in the UI.
- [ ] First observable divergence has a precise definition.
- [ ] The diff links back to raw evidence on both sides.
- [ ] Harmless ID and workspace-path changes do not create false divergence.
- [ ] Ambiguous alignments are surfaced rather than hidden.
- [ ] A synthetic golden set tests known divergence points.
- [ ] One controlled intervention has a manifest of changed and held variables.
- [ ] Output comparison begins with deterministic signals.
- [ ] README avoids upgrading paired observation into causal attribution.

## 3.12 V2 exit decision

V2 is complete when another person can inspect a pair, understand why the algorithm chose the divergence point, reproduce the result from committed synthetic traces, and disagree with the matching policy without reverse-engineering your code.

---

# Chapter 4 — What Comes After V2

Do not plan these as current commitments. They are optional directions unlocked by a stable core.

## 4.1 Second runtime adapter

Add OpenAI Agents SDK traces or another runtime only after defining an adapter contract. A second adapter is what begins to justify “runtime-independent core.”

## 4.2 MCP server

MCP connects models to tools and context. After Trace Inspector has stable queries, expose a small read-only server:

```text
list_traces
get_trace_summary
get_finding
compare_traces
get_first_divergence
```

MCP is an integration layer, not the trace collector. See the current [Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp).

## 4.3 Trace analysis skill

A Skill can package a repeatable workflow for:

1. selecting a trace;
2. reviewing observed failures;
3. checking inferred findings;
4. comparing a rerun;
5. generating an evidence-bounded report.

The Skill should call stable project commands or MCP tools; it should not contain the core implementation. Codex describes Skills as reusable workflows containing instructions, resources, and optional scripts. See [Build skills](https://learn.chatgpt.com/docs/build-skills).

## 4.4 Research direction: repeated interventions

Possible future questions:

- Does removal of a context item reliably alter tool choice across repeated runs?
- Which retrieval changes produce stable downstream divergence?
- How sensitive is first divergence to model stochasticity?
- Can trace features predict failure without overclaiming mechanism?
- Can agent-level intervention methods inform hypotheses for token-level mechanistic work?

These are research programs, not V2 feature tickets.

---

# Appendix A — Glossary

## Adapter

A boundary that translates a source-specific representation into Trace Inspector's normalized representation.

## Agent runtime

The system coordinating model calls, tools, files, approvals, threads, turns, and execution lifecycle.

## Collector

The component that connects to a runtime and records its messages reliably.

## Diagnostic

A structured finding produced from trace evidence under a documented rule.

## Event

An append-only record that something was observed at a particular sequence position.

## Evidence level

The relationship between a displayed claim and its source: observed, model-reported, or inferred.

## First observable divergence

The earliest material difference produced by a specified alignment and comparison policy. It is not automatically the cause of later behavior.

## JSONL

A text format containing one JSON value per line, useful for append-only streams.

## JSON-RPC

A request/response protocol using structured JSON messages; it also supports notifications without response IDs.

## MCP

Model Context Protocol, a protocol for connecting models to tools and context.

## Normalization

Mapping source-specific data into a stable internal vocabulary while retaining references to the original data.

## Replay

Reprocessing recorded events through current normalization and analysis code without rerunning the original model task.

## Span

A derived operation with start, end, duration, status, and possible parent-child relationships.

## Trace

The recorded end-to-end execution of one logical workflow or run.

---

# Appendix B — Evidence Language Guide

| Evidence | Prefer | Avoid |
|---|---|---|
| Failed status event | “The command failed.” | “The model failed to understand.” |
| Multiple plan events | “Three plan versions were emitted.” | “The agent was confused.” |
| Similar repeated calls | “Possible retry detected by rule R6.” | “The runtime definitely retried.” |
| Reasoning summary | “The model-reported summary states…” | “The model's true reasoning was…” |
| Two runs diverge | “The first observed difference occurred at…” | “This event caused the final difference.” |
| Controlled paired change | “The changed condition coincided with…” | “The mechanism has been proven.” |

---

# Appendix C — Suggested Learning Schedule

The schedule is deliberately flexible. Advance by acceptance criteria, not calendar pressure.

## Foundation

- Read Chapter 0.
- Write project brief, README skeleton, evidence model, and CV ledger.
- Learn basic TypeScript types, npm scripts, and Git commits.

## V0

- Learn JSONL, streams, child processes, and JSON-RPC message shapes.
- Build fixture normalizer and tests.
- Connect the live collector.
- Build deterministic timeline replay.

## V1

- Learn events versus spans.
- Learn basic SQLite tables, indexes, and rebuildable state.
- Implement deterministic diagnostics.
- Add integration, golden, and privacy tests.

## V2

- Learn sequence alignment and matching policies.
- Build synthetic trace-pair evaluation.
- Implement first observable divergence.
- Run and document one controlled intervention.

At the end of each work session, add three lines to `docs/learning-journal.md`:

```markdown
## YYYY-MM-DD
- I learned:
- I verified:
- I am still uncertain about:
```

---

# Appendix D — Scope-Control Checklist

Before adding a feature, ask:

- Does V0/V1/V2 require it?
- Does it strengthen collector, schema, storage, replay, diagnostics, or diff?
- Can it be tested with a synthetic fixture?
- Does it create a new unsupported claim?
- Is it an integration layer that should wait until the core is stable?

Delay these until after V2 unless a verified blocker requires them:

- multiple agent frameworks;
- hosted accounts and collaboration;
- vector databases;
- LLM-generated diagnostics;
- MCP server;
- Skill packaging;
- attention or activation visualization;
- automatic memory attribution;
- elaborate dashboards and aggregate analytics.

---

# Appendix E — Primary References

Check current documentation when implementing protocol-specific code:

- [Codex App Server](https://learn.chatgpt.com/docs/app-server) — protocol, lifecycle, event notifications, schema generation.
- [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp) — later integration with tools and context.
- [Codex Build Skills](https://learn.chatgpt.com/docs/build-skills) — later reusable analysis workflow.
- [OpenAI Agents SDK tracing](https://openai.github.io/openai-agents-js/guides/tracing/) — comparative trace/span model and possible future adapter.

Record the date and relevant runtime version when copying protocol assumptions into code. Generated schemas from the installed Codex version are preferable to manually guessing undocumented fields.

---

# Final Project Definition

If the project becomes confusing, return to this definition:

> Trace Inspector is a local-first system that records real agent runtime events, preserves raw evidence, normalizes them into a versioned trace model, reconstructs inspectable execution, and compares controlled runs without presenting model self-report or analyzer inference as hidden mechanism.

The first product experience is a timeline. The lasting technical contribution is the evidence-preserving path underneath it.
