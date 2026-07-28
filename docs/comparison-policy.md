# Comparison Policy `v2-default` `0.2.0`

## Purpose

This policy deterministically aligns two normalized event sequences. It is an
inspectable baseline, not a semantic or causal judge.

## Material fields

The comparator checks:

- normalized event `kind`;
- command text;
- runtime-reported `status`;
- command or message output delta;
- plan content;
- original source-event type for unsupported events.

Configured left and right workspace roots are replaced with `<WORKSPACE>`, and
whitespace is collapsed before text comparison.

## Ignored fields

These fields do not create a difference:

- event ID;
- entity ID;
- absolute occurrence time;
- raw file path;
- raw sequence reference.

They remain available as evidence references but are not alignment identity.

## Algorithm

The implementation uses global dynamic-programming sequence alignment:

| Operation | Cost |
|---|---:|
| Exact material match | 0 |
| Same kind with a material change | 1 |
| Insert right-side event | 2 |
| Delete left-side event | 2 |
| Substitute different event kinds | 5 |

A different-kind substitution costs more than one insertion plus one deletion.
This prevents the matcher from silently pairing unrelated event kinds.

While filling the cost matrix, the comparator also counts minimum-cost paths.
The count is capped at two because the decision only needs to distinguish a
unique optimum from multiple optima.

Backtracking prefers a same-kind diagonal match when it has the optimal cost.
It otherwise checks a left deletion before a right insertion. This produces one
inspectable deterministic path, but that path is authoritative only when the
minimum-cost alignment is unique.

When at least two minimum-cost paths exist:

- `alignment.status` is `ambiguous`;
- `optimalPathCount` is `multiple`;
- `alignedPairs` is retained as a deterministic preview;
- `firstObservableDivergence` is withheld.

This prevents a tie-breaking preference from being presented as an observed
property of the traces.

## First observable divergence

The first observable divergence is:

> The earliest aligned row classified as `changed`, `inserted`, or `deleted`
> under this exact policy and version.

The underlying runtime events can be `observed`, while the alignment and choice
of first row are `inferred`. The result does not identify the cause of later
tool use, planning, or final output.

## Synthetic golden set

Run:

```bash
npm run eval:golden
```

The committed eight-pair set covers:

- exact material match;
- command-output change;
- right-side plan insertion;
- left-side plan deletion;
- runtime status change;
- ignored metadata changes;
- ambiguity from duplicate events;
- ambiguity from an equally cheap different-kind replacement.

Every case predeclares alignment status, first divergence, reason codes, event
sequences, and the selected-path summary. The golden set tests known policy
behavior; it does not establish semantic alignment accuracy on real traces.
