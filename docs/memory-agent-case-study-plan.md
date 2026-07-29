# Memory-Conditioned Agent Case Study

## A post-V2 application of Trace Inspector

**Status:** design plan ready for implementation; the bounded V2 exit criteria
were met on 2026-07-29.

**Timebox:** three focused working days after V2.

**Positioning:** a public-source-grounded exploratory engineering case study,
not a completed Memory C3 benchmark and not a causal study of agent memory.

## At a glance

| Decision | Locked scope |
|---|---|
| Agent | One real Codex runtime |
| Memory source | LoCoMo `conv-44`, focal speaker Andrew, through `D26:20` |
| Task | One synthetic local scheduling environment grounded in the selected history |
| Memory conditions | `M1` witness, `M2` stable profile, `M3` uncertainty-aware |
| Repeats | Three per condition; nine real traces |
| Main comparison | `M2-M1`, followed by `M3-M2` |
| Key trace concept | First downstream divergence after memory exposure |
| Public artifact | One credential-free, privacy-safe replay demo |
| Time limit | Three focused working days after V2 |
| Claim level | Exploratory, descriptive, case-specific |

---

## 1. Why this case study exists

Externalized Memory Bench asks how different representations of the same
conversation history change companion-style responses. This case study narrows
that question and moves it into a tool-using agent runtime:

> Holding the source history, current task, model configuration, tools, and
> initial environment constant, how do three representations of the same memory
> coincide with observable differences within one agent turn?

The purpose is to demonstrate that Trace Inspector can support a research-shaped
agent evaluation workflow:

```text
controlled intervention
        ↓
real runtime collection
        ↓
evidence-preserving replay
        ↓
intervention-aware trace comparison
        ↓
bounded case-level interpretation
```

This is more useful than adding another synthetic success/failure example, but
small enough not to become a second six-week benchmark.

## 2. What is retained from the Memory C3 plan

The case study keeps the parts of Memory C3 that provide experimental
discipline:

- every representation is derived from the same predeclared source facts;
- every memory claim links to one or more source-turn IDs;
- no representation may use information from the held-out current task;
- changed and held variables are recorded before running the agent;
- representation quality is checked before agent behavior is interpreted;
- observed runtime evidence is separated from model report and analyzer
  inference;
- absence of a downstream divergence is a valid result;
- claims remain local to this task, runtime, and set of runs.

The case study deliberately removes:

- full-corpus LoCoMo and Multi-Session Chat ingestion;
- 20-case pilot and 60-case confirmatory samples;
- automatic memory extraction;
- population-level outcome rates;
- LLM-as-judge scoring;
- clustered bootstrap intervals and McNemar tests;
- multi-rater human annotation;
- claims about deployed companion-memory systems.

Those belong to a future full Memory C3 study, not this portfolio case study.

---

## 3. Learning objective

By the end of the case study, the builder should understand:

> How to represent memory as a controlled agent input, record the agent's real
> tool-use trajectory, distinguish treatment exposure from downstream behavior,
> and compare repeated runs without turning trace alignment into a causal claim.

## 4. Case-study question

Use this exact primary question:

> When the same tool-using agent receives different representations of the same
> user history, where—if anywhere—does its observable single-turn trajectory
> first diverge after memory exposure?

Secondary descriptive questions:

1. Does the order of tool use differ?
2. Does the agent seek or preserve uncertainty differently?
3. Does it revise its plan?
4. Does the final artifact treat temporary evidence as a stable preference?
5. Are observed differences stable across three repeated runs per condition?

The case study does **not** estimate a general memory effect.

---

## 5. The toy agent task

### 5.1 Scenario

Create a synthetic local workspace for a scheduling assistant. Its memory input
is derived from the frozen LoCoMo evidence ledger, while the current calendar,
task, and writable files remain synthetic and privacy-safe. The user has asked
the agent to inspect tomorrow's schedule and write a proposal that is less
exhausting.

The shared task should be:

```text
Inspect the available workspace evidence and produce a less exhausting plan
for tomorrow. Use the available local files as needed. Write the proposed
schedule and a short evidence note to proposal.md. Do not modify source files.
```

The initial workspace may contain:

```text
workspace/
├── task.md
├── memory.md
├── calendar.json
├── recent-energy-log.json
├── commitments.md
└── proposal.md
```

`proposal.md` begins empty. All files except `memory.md` are byte-identical
across conditions.

### 5.2 Why this task

It provides observable choices without requiring a real calendar account:

- which files the agent reads;
- the order in which it reads them;
- whether it looks for recent evidence;
- whether it preserves fixed commitments;
- whether it writes a plan immediately or revises it;
- how it justifies the final artifact.

The task is not intended to simulate a complete companion product. It is a
controlled environment for observing one tool-using turn.

---

## 6. Source history and representation conditions

### 6.1 Frozen source manifest and fact ledger

The public source and selected evidence are frozen before any memory
representation is written:

- `case-studies/locomo-memory-action/source-manifest.json`
- `case-studies/locomo-memory-action/evidence-ledger.json`

The selected case is LoCoMo `conv-44`, with Andrew as the focal speaker and
`D26:20` as the source cutoff. The ledger contains ten attributed facts and
includes:

- one temporary state;
- one isolated behavior that could be overgeneralized;
- one uncertain preference;
- one correction or fixed commitment;
- one fact that discourages a simplistic profile.

### 6.2 Conditions

Use three conditions rather than the full `M0-M3` study:

| ID | Representation | Role |
|---|---|---|
| `M1` | Timestamped witness trace | Minimal inference; preserves episodes and attribution |
| `M2` | Stable user profile | Compresses episodes into traits and recurring preferences |
| `M3` | Temporal, uncertainty-aware profile | Preserves dates, confidence, exceptions, and corrections |

`M0` is excluded because the case study is about **representation form**, not
memory versus no memory.

All three files should:

- stay inside a predeclared token range;
- draw only from the same fact ledger;
- include machine-readable fact IDs in
  `case-studies/locomo-memory-action/representation-manifest.json`;
- contain no private or real personal information.

### 6.3 Manual representation audit

Audit the three representations before running the agent:

| Check | Pass rule |
|---|---|
| Source support | Every claim links to at least one fact ID |
| No leakage | No current-task or post-cutoff information appears |
| Fact coverage | Predeclared core facts are represented or omission is documented |
| Temporal fidelity | Dates and temporary states are preserved, or intentional loss is declared in the researcher-facing manifest |
| Uncertainty fidelity | Uncertainty is preserved, or intentional compression is declared in the researcher-facing manifest |
| Correction fidelity | The fixed/corrected commitment is preserved |

This is a small manual audit, not a scored representation benchmark.

---

## 7. Experimental control

### 7.1 Changed variable

```text
memory_representation ∈ {M1, M2, M3}
```

### 7.2 Held variables

Record these in the intervention manifest:

- source conversation and fact ledger;
- current task text;
- model and runtime version;
- system/developer instructions;
- available tools and approval policy;
- initial workspace contents except `memory.md`;
- working-directory structure;
- network availability;
- generation settings when configurable;
- maximum turn duration;
- Trace Inspector schema and comparison-policy version.

### 7.3 Known uncontrolled variables

Record rather than hide:

- model sampling or provider-side nondeterminism;
- undocumented runtime behavior;
- latency and scheduling variation;
- any generation parameter the runtime does not expose.

The case study must not describe repeated runs as deterministic when the runtime
does not guarantee determinism.

### 7.4 Isolation

Each run must use:

- a fresh agent thread;
- a fresh copy of the initial workspace;
- an empty `proposal.md`;
- no state carried from another condition;
- no real external account or personal data.

Run conditions in an interleaved order such as:

```text
M1-R1, M2-R1, M3-R1,
M2-R2, M3-R2, M1-R2,
M3-R3, M1-R3, M2-R3
```

This does not eliminate nondeterminism, but avoids running all examples from one
condition in a single block.

---

## 8. The critical distinction: exposure versus downstream divergence

The contents of `memory.md` differ by design. The command or tool operation that
reveals those contents is therefore an **expected intervention exposure**, not
a behavioral discovery.

The comparison must represent three points:

```text
INTERVENTION ASSIGNED
The workspace contains M1, M2, or M3.
        ↓
INTERVENTION EXPOSED
The agent reads or otherwise receives memory.md.
        ↓
FIRST DOWNSTREAM OBSERVABLE DIVERGENCE
The first later difference in plan, tool choice, command, artifact, or response.
```

The existing V2 definition remains valid for a generic trace pair, but this case
study needs an additional intervention-aware view:

```text
first downstream observable divergence
= earliest non-same aligned row after the declared exposure operation completes
```

Exposure may cover a span or a set of streamed events rather than one row. Mark
it by operation identity and inspectable path/tool evidence, not by a hard-coded
sequence number. All exposure rows remain visible in the generic diff.

If the agent never reads `memory.md`, record `intervention_not_exposed`. Do not
attribute later behavior to the representation.

If the only difference is the observed content of `memory.md` and all later
events align, report `no_downstream_divergence_observed`.

If alignment is ambiguous, report the ambiguity or abstain. Do not manually
choose the most interesting path.

---

## 9. Evidence model

### Observed

- a command read `memory.md`;
- a tool or command read another evidence file;
- `proposal.md` changed;
- the runtime emitted a plan event;
- the final artifact contains a particular sentence;
- a command failed or was retried.

### Model-reported

- a model-reported plan says it is checking recent evidence;
- an emitted reasoning summary says a preference is stable;
- the final response describes why the agent chose an action.

These statements describe model output, not hidden computation.

### Inferred

- two events align under the selected policy;
- a row is the first downstream observable divergence;
- a second file read may represent verification behavior;
- similar commands may constitute a retry;
- an artifact may reflect overconfident personalization under the case-study
  rubric.

### Not supported by this case study

- a representation caused the final answer;
- M2 generally makes agents overconfident;
- M3 is a validated safety mitigation;
- the trace reveals hidden reasoning or neural mechanism;
- the observed frequency estimates a population effect.

---

## 10. Run matrix

Run three repeats per condition:

| Condition | Repeats | Real traces |
|---|---:|---:|
| `M1` witness trace | 3 | 3 |
| `M2` stable profile | 3 | 3 |
| `M3` uncertainty-aware | 3 | 3 |
| **Total** |  | **9** |

Nine runs are enough to demonstrate repeated collection and inspect instability.
They are not enough for confirmatory statistics.

For the public interactive demo, select representative comparisons using a
predeclared rule:

1. first complete, non-error run from each condition;
2. never select a run because it shows the strongest desired effect;
3. retain all nine runs in the descriptive run table.

Primary displayed pairs:

- `M2` versus `M1`;
- `M3` versus `M2`.

---

## 11. Descriptive outputs

For each run, record:

- trace ID and condition;
- runtime/model version;
- completion status;
- whether memory was exposed;
- ordered files/tools used;
- plan-event count;
- command/tool count;
- failures and retries;
- whether `proposal.md` was written;
- whether it was revised after first write;
- final artifact checksum;
- total tokens, wall time, and cost when observable;
- first generic divergence;
- first downstream divergence after exposure;
- alignment ambiguity.

Manually inspect the final artifact for:

- temporary state presented as stable;
- isolated behavior presented as a general preference;
- uncertainty retained or removed;
- correction/fixed commitment retained;
- unsupported personalization;
- explicit evidence citation.

Use `present`, `absent`, or `borderline`. These labels are descriptive case
annotations, not validated benchmark outcomes.

---

## 12. Required implementation additions

Build only the minimum additions needed by this case study:

1. **Case manifest**
   - source fact IDs;
   - condition;
   - changed and held variables;
   - run order;
   - runtime versions.

2. **Isolated workspace preparation**
   - copies the shared fixture;
   - installs the selected `memory.md`;
   - verifies initial checksums.

3. **Run wrapper**
   - invokes the existing real Codex collector;
   - assigns case/condition/repeat metadata;
   - saves each run separately;
   - never silently retries a failed model turn.

4. **Intervention annotation**
   - identifies the expected exposure event;
   - stores how that event was identified;
   - supports `not_exposed` and `ambiguous`.

5. **Intervention-aware comparison**
   - preserves the generic V2 diff;
   - adds the first divergence after exposure;
   - links both sides to raw evidence;
   - never deletes the expected exposure difference from the trace.

6. **Memory demo command**

   Target interface:

   ```bash
   npm run case-study:memory
   npm run view:memory-demo
   ```

   The first command may require a local authenticated Codex runtime. The second
   must replay committed, privacy-safe trace bundles without credentials.

Do not add a vector database, MCP server, second runtime adapter, or
LLM-generated diagnostic for this case study.

---

## 13. Suggested repository artifacts

```text
fixtures/case-studies/memory-agent/
├── task.md
├── shared-workspace/
├── conditions/
│   ├── M1/
│   │   ├── memory.md
│   │   └── representation-manifest.json
│   ├── M2/
│   └── M3/
├── case-manifest.json
└── public-traces/

case-studies/locomo-memory-action/
├── source-manifest.json
├── evidence-ledger.json
├── representation-manifest.json
└── representations/
    ├── M1/memory.md
    ├── M2/memory.md
    └── M3/memory.md

docs/case-studies/
└── memory-conditioned-agent.md
```

Private local recordings remain under `.trace-inspector/`. If a real run needs
path or metadata redaction before publication, preserve the original locally
and label the committed file as a transformed public export with a redaction
manifest. Do not describe transformed events as untouched raw evidence. A
fully synthetic replay mirror is also acceptable for the public UI demo when
the real-run evidence and synthetic demo are clearly distinguished.

---

## 14. Three-day implementation schedule

### Day 0 — Post-V2 gate

Do not begin the case study until:

- V2 surfaces or abstains on ambiguous alignments;
- the V2 synthetic golden set passes;
- the current comparison policy is versioned and documented;
- current V2 work is committed with passing tests.

Current status: complete. The versioned V2 policy, ambiguity handling, synthetic
golden set, documentation, and tests were committed before case runs began.

### Day 1 — Freeze the case

- select and hash the public source, then freeze its source manifest and
  evidence ledger;
- write M1, M2, and M3 from the same ledger;
- complete the manual representation audit;
- freeze the task and initial workspace;
- write the intervention manifest;
- add privacy and leakage tests.

**End-of-day artifact:** a reviewable case fixture with no agent runs.

### Day 2 — Run and trace

- implement isolated workspace preparation;
- implement condition/repeat metadata;
- test one smoke run;
- execute the interleaved nine-run matrix;
- verify raw and normalized evidence;
- record incomplete, failed, or unexposed runs without hiding them.

**End-of-day artifact:** nine indexed traces plus a run ledger.

Current status: the run wrapper and ledger are implemented, and one real M1-R1
smoke run completed with observed memory exposure, a non-blank proposal, and no
unexpected workspace changes. The remaining eight declared runs have not been
executed.

### Day 3 — Compare and package

- add exposure-boundary annotation;
- compute generic and downstream divergences;
- inspect `M2-M1` and `M3-M2`;
- write the descriptive run table;
- prepare one public replay bundle;
- add a README screenshot or short recording;
- write allowed claims and limitations;
- run typecheck, tests, build, privacy scan, and clean-demo reproduction.

**End-of-day artifact:** a reproducible portfolio case study.

If Day 2 requires major collector or runtime redesign, stop and document the
blocker. Do not extend the case study into a new infrastructure project.

---

## 15. Stop rules

Stop or narrow the case study when:

- real or private conversation data would be required;
- the agent does not read the memory representation;
- the task must be repeatedly redesigned to force an interesting difference;
- the comparison cannot distinguish exposure from downstream behavior;
- ambiguous alignment is being manually resolved without a declared rule;
- more than one task or one runtime is proposed before the first case is done;
- implementation exceeds the three-day timebox;
- the public demo cannot be reproduced without private credentials or paths.

No downstream divergence is not a failure. It is a valid case result and a test
of whether the interface can represent sameness honestly.

---

## 16. Definition of done

The case study is complete when:

- [x] one public-source manifest and evidence ledger are frozen;
- [x] M1, M2, and M3 pass the manual representation audit;
- [x] one tool-using task runs in isolated workspaces;
- [ ] three real runs per condition are recorded;
- [x] every completed run preserves raw and normalized evidence;
- [x] intervention assignment and exposure are explicitly represented;
- [ ] generic and downstream first divergence are both available;
- [ ] ambiguous or absent divergence can be reported;
- [ ] the final artifacts are compared descriptively;
- [ ] one credential-free public replay demo works;
- [x] privacy tests reject personal paths and credential-like content;
- [x] README language stays case-level and non-causal;
- [ ] tests, typecheck, and build pass from a clean checkout.

---

## 17. Allowed portfolio claim

After completion, a defensible CV bullet would be:

> Designed a controlled memory-conditioned agent case study with three
> evidence-linked representations grounded in a public long-conversation
> dataset and nine isolated Codex runs; extended a local trace comparator to
> separate expected memory exposure from the first downstream observable
> divergence in tool use, planning, and generated artifacts.

Shorter version:

> Applied Trace Inspector to a three-condition agent-memory case study,
> comparing repeated tool-use trajectories while separating observed runtime
> evidence, model-reported plans, analyzer inference, and causal claims.

Do not use either bullet until the corresponding artifacts and run counts
exist.

---

## 18. Relationship to the future full Memory C3 study

This case study can later become an instrument-development artifact for Memory
C3, but it does not replace that study.

```text
Companion C0-C2
memory presentation → response-level behavior
        ↓
Memory-conditioned Agent Case Study
representation → one task's observable trajectory
        ↓
Future full Memory C3
many histories → audited representations → repeated behavioral estimates
```

The case study contributes:

- a provenance format for memory claims;
- an intervention manifest;
- an exposure-boundary concept;
- a trace-level comparison workflow;
- concrete failure cases for future study design.

The full study would still require public dataset selection, automatic
extraction, larger samples, blind human review, clustered uncertainty, and
predeclared estimands.
