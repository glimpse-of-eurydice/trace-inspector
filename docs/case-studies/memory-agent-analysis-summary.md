# Memory-conditioned agent: automatic analysis

> This report describes one nine-run case study. It does not estimate a population effect or establish that a memory representation caused an observed difference.

## Run table

| Run | Status | Exposure | Commands | Plans | Failures | Proposal writes | Tokens |
|---|---|---|---:|---:|---:|---:|---:|
| M1-R1 | completed | exposed @ 42 | 5 | 0 | 0 | 2 | 156781 |
| M2-R1 | completed | exposed @ 43 | 4 | 0 | 0 | 1 | 115302 |
| M3-R1 | completed | exposed @ 43 | 4 | 0 | 0 | 1 | 115907 |
| M2-R2 | completed | exposed @ 44 | 3 | 0 | 0 | 1 | 94795 |
| M3-R2 | completed | exposed @ 44 | 4 | 0 | 0 | 1 | 116288 |
| M1-R2 | completed | exposed @ 42 | 3 | 0 | 0 | 1 | 97677 |
| M3-R3 | completed | exposed @ 43 | 4 | 0 | 0 | 1 | 114917 |
| M1-R3 | completed | exposed @ 45 | 3 | 0 | 0 | 1 | 96451 |
| M2-R3 | completed | exposed @ 45 | 4 | 0 | 0 | 1 | 115444 |

## Comparisons

| Comparison | Category | Generic alignment | Downstream result | First downstream alignment |
|---|---|---|---|---:|
| M2-R1-vs-M1-R1 ★ | cross_condition | ambiguous | ambiguous_alignment | n/a |
| M3-R1-vs-M2-R1 ★ | cross_condition | ambiguous | ambiguous_alignment | n/a |
| M2-R2-vs-M1-R2 | cross_condition | resolved | divergence_observed | 0 |
| M3-R2-vs-M2-R2 | cross_condition | ambiguous | ambiguous_alignment | n/a |
| M2-R3-vs-M1-R3 | cross_condition | ambiguous | ambiguous_alignment | n/a |
| M3-R3-vs-M2-R3 | cross_condition | resolved | divergence_observed | 3 |
| M1-R2-vs-M1-R1 | within_condition | ambiguous | ambiguous_alignment | n/a |
| M1-R3-vs-M1-R1 | within_condition | ambiguous | ambiguous_alignment | n/a |
| M2-R2-vs-M2-R1 | within_condition | ambiguous | ambiguous_alignment | n/a |
| M2-R3-vs-M2-R1 | within_condition | ambiguous | ambiguous_alignment | n/a |
| M3-R2-vs-M3-R1 | within_condition | resolved | divergence_observed | 0 |
| M3-R3-vs-M3-R1 | within_condition | resolved | divergence_observed | 0 |

★ Primary display pair selected by the predeclared first-complete-run rule.

## Evidence boundary

- Runtime events and generated artifacts are observed.
- The operation projection, event alignment, retry candidates, and divergence positions are inferred.
- The report does not expose hidden reasoning and does not make causal claims.
