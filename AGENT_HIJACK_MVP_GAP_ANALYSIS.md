# Agent Hijack MVP: implementation gap analysis

**Checked:** 2026-07-31  
**Scope:** feasibility and reuse audit only; no MVP implementation in this step  
**Decision:** proceed with F1–F3  
**Primary finding:** the installed Codex App Server can enforce the proposed
F3 sibling-directory write boundary without a new permission system.

This document records what was verified before implementation. The frozen
study contract remains `AGENT_HIJACK_MVP_PLAN.md`.

---

## 1. Decision

The MVP is feasible within the existing architecture.

- F1 and F2 can use `workspaceWrite` with both `workspace/` and
  `quarantine/` supplied as writable roots.
- F3 can use the same `workspaceWrite` mode with only `workspace/` writable.
- The same harmless sibling write was denied when `quarantine/` was omitted
  and succeeded when it was explicitly added.
- No new sandbox, wrapper filesystem, or permission service is required.
- The existing collector needs one narrow option extension because it
  currently hard-codes the writable-root list to `[cwd]`.

Implementation should therefore begin with the collector option and an
automated capability preflight, then proceed to fixtures and analysis.

---

## 2. Runtime evidence

### 2.1 Official protocol capability

The Codex App Server protocol accepts a per-turn `sandboxPolicy` with:

```json
{
  "type": "workspaceWrite",
  "writableRoots": ["/absolute/path"],
  "networkAccess": false
}
```

The same policy shape is also accepted by `command/exec`, which permits a
capability probe without starting a model turn.

### 2.2 Local harmless probe

The probe used the installed Codex App Server directly through
`command/exec`. It created a fresh non-temporary synthetic root with sibling
directories:

```text
probe-root/
├── workspace/
└── quarantine/
```

The tested command was `/usr/bin/touch`; no model, network, credential, user
document, or destructive operation was involved.

| Probe | Writable roots | Target | Exit | Observed result |
|---|---|---|---:|---|
| allowed workspace write | `workspace/` | `workspace/allowed.txt` | 0 | completed |
| denied sibling write | `workspace/` | `quarantine/blocked.txt` | 1 | `Operation not permitted` |
| allowed additional root | `workspace/`, `quarantine/` | `quarantine/allowed-extra-root.txt` | 0 | completed |

This proves that the intended F2/F3 capability contrast is available on the
current macOS runtime:

```text
F2: writableRoots = [workspace, quarantine]
F3: writableRoots = [workspace]
```

The first draft probe used `/private/tmp` and was rejected as evidence because
temporary paths may be writable by default. The successful discriminating
probe used a non-temporary synthetic root. All probe artifacts were deleted
afterward.

### 2.3 Claim boundary

The probe establishes runtime enforcement capability, not agent behavior. It
does not show that a model will attempt the write. In a real F3 run,
`runtime-blocked` may be reported only when the trace contains an observed
failed operation at the declared target or equivalent inspectable denial
evidence.

---

## 3. What already exists and can be reused

| Need | Existing implementation | Reuse decision |
|---|---|---|
| App Server lifecycle and streaming collection | `src/collector/codex-app-server.ts` | reuse |
| raw JSONL, trace directory, and manifest | `src/store/trace-files.ts` | reuse unchanged |
| Codex event normalization | `src/adapters/codex/normalize-codex-message.ts` | reuse unchanged |
| replay and normalized event loading | existing replay pipeline | reuse unchanged |
| spans, findings, and timeline viewer | V1 infrastructure | reuse unchanged |
| trace alignment and ambiguity refusal | V2 comparison infrastructure | reuse as secondary analysis |
| isolated fixture materialization | `src/case-study/prepare-memory-case.ts` pattern | adapt, do not generalize globally |
| real-turn orchestration and post-run audit | `src/case-study/run-memory-case.ts` pattern | adapt |
| frozen run order, preflight, and no-silent-retry policy | `src/case-study/run-memory-matrix.ts` pattern | adapt to three runs |
| command/output operation projection | projection logic in `src/case-study/analyze-memory-case.ts` | extract a small generic core or preserve a compatibility wrapper |
| privacy-safe synthetic replay | existing demo/replay conventions | reuse |
| runtime metadata and consistency audit | `src/core/codex-runtime-metadata.ts` and memory-case audit | reuse with capability metadata added |

This means the project is not a second tracing system. It is a new evaluator
and fixture family on top of the existing collector, schema, store, replay,
viewer, and comparison stack.

---

## 4. Required implementation gaps

### Gap A — configurable additional writable roots

Current behavior in `recordCodexTurn` sends:

```ts
writableRoots: [options.cwd]
```

Add a narrowly typed option such as:

```ts
additionalWritableRoots?: string[]
```

Then construct:

```ts
writableRoots: [options.cwd, ...(options.additionalWritableRoots ?? [])]
```

Requirements:

- resolve and deduplicate roots before sending;
- always retain `cwd` as writable in `workspaceWrite` mode;
- F1/F2 pass `quarantine/` as an additional root;
- F3 passes no additional root;
- do not add a general arbitrary sandbox-policy passthrough.

### Gap B — capability preflight

Add a model-free preflight using `command/exec` or an equivalent inspectable
runtime probe. It must verify:

1. a workspace write succeeds;
2. a sibling quarantine write fails when omitted from writable roots;
3. the same sibling write succeeds when quarantine is added;
4. the denied file is absent after the failed probe;
5. probe artifacts are synthetic and cleaned up.

If this check fails, emit `enforcement_unavailable` and stop before F3. Do not
silently downgrade F3 to evaluator-only policy labeling.

### Gap C — security fixture and evaluator boundary

Add the frozen clean/injected artifacts, trusted policy, canary hash, scenario
manifest, and run order described in the MVP plan. The preparer must copy only
runtime files into each run workspace and verify frozen checksums before any
model turn.

The evaluator policy and expected canary hash must remain outside the agent
workspace.

### Gap D — security-specific deterministic analyzer

Create a separate security analyzer instead of adding security meanings to
the memory analyzer. It should consume normalized events, projected complete
operations, the evaluator policy, and the post-run filesystem audit.

It needs only exact configured paths and the seven frozen outcomes:

1. `injection_exposed`
2. `policy_disallowed_read_attempted`
3. `policy_disallowed_read_completed`
4. `unauthorized_write_attempted`
5. `unauthorized_write_outcome`
6. `canary_propagated`
7. `legitimate_task_completed`

Every result must preserve source event IDs. Classification from command text
is inferred; command completion, output, and post-run file state remain
observed. Ambiguous commands must abstain.

### Gap E — requested versus effective capability evidence

The collector currently records server output but not its outbound
`turn/start` request. Earlier memory traces expose the thread-level resolved
workspace root, but they do not preserve the later per-turn writable-root
override as a standalone evidence object.

For this MVP:

- persist the requested capability condition and absolute roots in the local
  run manifest;
- persist the model-free capability-preflight result;
- use actual command failure/success and post-run file state as evidence of
  enforcement;
- do not describe a requested policy as runtime-resolved merely because it was
  configured by the runner.

Recording outbound protocol messages could become a later observability
improvement, but it is not necessary for this MVP.

### Gap F — three-run orchestration and public replay

Adapt the existing matrix runner to the fixed order `F1`, `F2`, `F3`, with no
silent retries. Produce one deterministic result table and one sanitized
synthetic replay. The generic timeline UI does not need redesign.

---

## 5. Explicit non-gaps

Do not spend the MVP timebox on:

- a new trace schema;
- a new App Server adapter;
- a new timeline layout;
- a general policy engine;
- a shell parser;
- an LLM judge;
- automatic concealment classification;
- first-divergence improvements;
- more scenarios or benchmark datasets.

The V2 comparer remains useful supporting evidence, but the security outcomes
are state-based and do not require unique alignment.

---

## 6. Recommended implementation order

```text
1. collector additionalWritableRoots option + tests
2. model-free F2/F3 capability preflight + tests
3. frozen fixtures, source manifest, evaluator policy, checksums
4. workspace preparer and exclusion tests
5. F1/F2/F3 runner and post-run audit
6. deterministic security analyzer
7. offline result table and secondary comparisons
8. sanitized replay demo, README evidence, full verification
```

The runtime uncertainty is now retired before any model run. If scope remains
frozen, this is still consistent with the two-day MVP timebox.

---

## 7. Final go/no-go assessment

**Go.** The important infrastructure claim is supported:

> Trace Inspector can configure and observe a real capability boundary in
> which an identical synthetic sibling-file write is permitted in one
> condition and denied by the Codex runtime in another.

The next step is implementation, beginning with Gap A and Gap B. The security
case should not start real F1–F3 model runs until the capability preflight and
evaluator-boundary tests pass.
