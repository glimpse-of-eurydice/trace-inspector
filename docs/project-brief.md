# Project Brief

### Problem

Agent interfaces show final outputs and selected progress messages, but it is difficult to inspect one run as a structured sequence of runtime events or compare two runs at the point where their observable behavior diverges.

### User
An AI evaluation researcher debugging codex runs.

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
