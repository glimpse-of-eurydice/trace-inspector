# Trace Inspector: intern reviewer file packet

This list is designed for an internship application workspace or a reviewer
who does not have time to inspect the entire repository.

## Recommended five-file packet

If the workspace accepts only a few files, provide these five:

1. `README.md`
   - project scope, architecture, commands, milestones, and claim boundaries;
2. `docs/case-studies/agent-hijack-mvp-results.md`
   - the real F1–F3 case result, limitations, and interpretation;
3. `docs/assets/trace-inspector-agent-hijack-overview.png`
   - the clearest single product screenshot;
4. `docs/assets/trace-inspector-agent-hijack-evidence.png`
   - evidence navigation from a security stage into normalized/raw runtime data;
5. `docs/architecture.md`
   - collector → adapter → schema → replay → viewer system design.

This packet is enough for an HR or hiring-manager first pass. It shows the
product, the experiment, the evidence boundary, and the engineering structure
without requiring them to run the repository.

## Add these for a technical reviewer

If the reviewer accepts source code, add:

6. `src/collector/codex-app-server.ts`
   - real Codex App Server streaming collection and sandbox configuration;
7. `src/collector/codex-command-exec.ts`
   - model-free runtime capability preflight;
8. `src/case-study/agent-hijack-mvp.ts`
   - frozen run preparation, orchestration, deterministic outcomes, audit, and
     secondary comparison;
9. `src/web/app.ts`
   - attack-chain rendering and evidence navigation in the browser viewer;
10. `src/tests/agent-hijack-mvp.test.ts`
    - regression tests for exact operation-target classification and writable
      roots.

For an agent-evaluation or safety role, `src/case-study/agent-hijack-mvp.ts` is
the strongest code sample. For an infrastructure role, prioritize the two
collector files. For a product or AI-quality role, prioritize `src/web/app.ts`
and the two screenshots.

## Optional research-context files

Add these only when the role values evaluation methodology or research design:

- `docs/evidence-model.md` — observed, model-reported, and inferred claims;
- `docs/comparison-policy.md` — versioned alignment policy and ambiguity
  refusal;
- `AGENT_HIJACK_MVP_PLAN.md` — frozen case design and allowed claims;
- `AGENT_HIJACK_MVP_GAP_ANALYSIS.md` — implementation feasibility and runtime
  boundary audit;
- `docs/case-studies/memory-agent-analysis-summary.md` — complementary null or
  convergent memory case result.

## Do not upload

Do not provide the following to an external internship workspace:

- `.trace-inspector/**`;
- `trace-inspector/**` local result directories;
- real `raw.jsonl`, local run manifests, or `matrix.json` files;
- files containing absolute machine paths;
- downloaded datasets or source conversations not cleared for redistribution;
- the 1,000+ line long-term research roadmap unless explicitly requested.

The committed `fixtures/raw/demo-agent-hijack-resistant.jsonl` is safe to share:
it is a credential-free constructed replay, not a copied real raw trace.

## Suggested reviewer order

```text
README
  ↓
overview screenshot
  ↓
case-study result
  ↓
evidence screenshot
  ↓
architecture
  ↓
selected source code (technical review only)
```

## One-sentence handoff

> Trace Inspector is a local agent-observability system that captures Codex
> runtime events, normalizes and replays them, compares controlled runs, and
> turns security-relevant execution stages into evidence-linked outcomes while
> withholding hidden-mechanism and causal claims.
