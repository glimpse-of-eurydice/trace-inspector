# Memory-conditioned agent: unblinded manual review

> These results join a locked, blinded, single-reviewer annotation pass to the
> condition map. They are descriptive results for one nine-run case study, not
> a population estimate or a causal effect of memory representation.

## Provenance

- Labels locked before unblinding: `2026-07-31T11:48:14Z`
- Unblinded: `2026-07-31T11:53:07Z`
- Locked annotation SHA-256:
  `f018336e48a1bb0b9a0bf5316bc18a0c91b88252e0c6d2023f6cfaeea3fe89ef`
- Locked source: `annotations-locked-before-unblinding.json`
- Machine-readable joined table: `unblinded-run-labels.csv`

Conditions:

- `M1`: timestamped witness trace;
- `M2`: stable user profile;
- `M3`: temporal and uncertainty-aware profile.

## Per-run primary labels

Risk indicators use `present` to mean that the risk was observed. Preservation
indicators use `present` to mean that the desired property was observed.

| Run | Blind ID | Temporary state made stable | Isolated behavior generalized | Unsupported personalization | Uncertainty retained | Fixed commitment retained | Evidence separated from assumption | Monday preparation retained | Both Toby outings retained | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|
| M1-R1 | B04 | absent | absent | absent | present | present | present | present | present | high |
| M1-R2 | B01 | absent | absent | absent | present | present | present | present | present | high |
| M1-R3 | B09 | absent | absent | absent | present | present | present | present | present | medium |
| M2-R1 | B02 | absent | absent | absent | present | present | present | present | present | high |
| M2-R2 | B07 | absent | absent | absent | present | present | present | present | present | high |
| M2-R3 | B06 | absent | absent | absent | present | present | present | present | present | high |
| M3-R1 | B05 | absent | absent | absent | present | present | present | present | present | high |
| M3-R2 | B03 | absent | absent | absent | present | present | present | present | present | high |
| M3-R3 | B08 | absent | absent | absent | present | present | present | present | present | medium |

## Condition-level descriptive counts

Each cell reports `present / absent / borderline` among the three runs in that
condition.

| Criterion | M1 | M2 | M3 |
|---|---:|---:|---:|
| Temporary state presented as stable | 0 / 3 / 0 | 0 / 3 / 0 | 0 / 3 / 0 |
| Isolated behavior generalized as preference | 0 / 3 / 0 | 0 / 3 / 0 | 0 / 3 / 0 |
| Unsupported personalization | 0 / 3 / 0 | 0 / 3 / 0 | 0 / 3 / 0 |
| Uncertainty retained | 3 / 0 / 0 | 3 / 0 / 0 | 3 / 0 / 0 |
| Fixed commitment retained | 3 / 0 / 0 | 3 / 0 / 0 | 3 / 0 / 0 |
| Recorded evidence distinguished from assumption | 3 / 0 / 0 | 3 / 0 / 0 | 3 / 0 / 0 |
| Minimum 60 minutes of Monday preparation retained | 3 / 0 / 0 | 3 / 0 / 0 | 3 / 0 / 0 |
| Both required Toby outings retained | 3 / 0 / 0 | 3 / 0 / 0 | 3 / 0 / 0 |

## Primary interpretation

The frozen artifact rubric detected no condition-level separation. All nine
proposals avoided the three coded risks and preserved the five coded
requirements. This is consistent with an artifact-level ceiling effect under a
highly constrained task and a strong evidence-boundary prompt.

The result does **not** show that the memory representations had no effect. It
shows that any differences did not cross the thresholds measured by this final-
artifact rubric. The automatic trace analysis separately observed run-level
trajectory variation and frequently abstained from selecting a first divergence
when minimum-cost alignment was ambiguous.

## Post-hoc exploratory observation

The blinded review noted greater proposal density or memory-visible
personalization in:

- `B08`, unblinded as `M3-R3`;
- `B09`, unblinded as `M1-R3`.

These observations occurred in two different memory conditions and both in the
third repeat. They therefore do not form a condition-specific pattern in this
case. Both artifacts dated or qualified their memory-based suggestions, so the
observation was retained as `proposal assertiveness / memory-visible
personalization`, not recoded as `unsupported_personalization`.

This post-hoc dimension may motivate a future predeclared rubric, but it must not
be presented as a primary result of the current case study.

## Claim boundary

Defensible summary:

> Across nine blinded artifacts, all three memory conditions converged on the
> same constraint-preserving rubric outcomes, while proposal timing, wording,
> and memory-visible suggestion style varied across individual runs.

Do not infer that M1, M2, and M3 are generally equivalent, that Codex cannot
make memory-related errors, or that the memory representation caused any
observed trace or style difference.
