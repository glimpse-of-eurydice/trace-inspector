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
