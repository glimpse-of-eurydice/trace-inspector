# Architecture and Visibility Boundary

## Timeline Viewer as a client

In this project, a **client（客户端）** is a program that consumes data or
services provided by another component. It does not mean a paying customer.

The Timeline Viewer is a user-visible client because it reads normalized trace
data and presents it as an interactive interface.

```text
Agent Runtime
     ↓ raw execution events
Collector and Adapter
     ↓ normalized events
Trace Core and Store
     ↓ queries and replay data
Timeline Viewer
     ↓
User
```

Future clients could include a command-line interface, an editor extension, or
an MCP integration. The Timeline Viewer is the first client, not the entire
tracing system.

## Timeline orientation

V0 uses a vertical chronological flow because its current data is dominated by
point events and streaming deltas. Each row retains a lane label, absolute
timestamp, sequence node, status, evidence level, and the elapsed time from the
previous event. A continuous spine makes the observed execution direction
explicit.

A horizontal duration view becomes more useful after V1 reconstructs spans,
concurrency, and parent-child operations. At that stage, the viewer can add a
timing mode or small duration bars without replacing the evidence-oriented
vertical flow.

## Derived spans

V1 reconstructs operation spans from normalized lifecycle events:

```text
started event ── output events ── completed event
       \___________ derived span ___________/
```

Raw JSONL remains authoritative. Normalized events remain the ordered evidence
layer. `spans.jsonl` is rebuildable and records whether each span was paired,
missing its start, or missing its end. Parent turn relationships and all source
event IDs remain inspectable.

## What the timeline can display

When the relevant runtime events are available, the timeline can display:

- thread and turn lifecycle;
- plan updates;
- tool-call and command execution;
- web-search execution and returned tool output;
- approvals, failures, and waiting intervals;
- file changes and diffs;
- model-reported reasoning summaries;
- final messages.

## What the timeline cannot establish

The timeline does not expose the model's complete internal computation. It
cannot by itself show:

- hidden-state or neuron activations;
- attention-score computation;
- residual-stream representations;
- how model parameters jointly produced a decision;
- the private or complete chain of thought;
- the true causal contribution of a context or memory item.

The project therefore describes V0 and V1 as **execution observability**, not
mechanistic interpretability.
