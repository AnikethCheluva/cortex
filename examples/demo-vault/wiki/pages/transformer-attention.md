---
title: "Transformer attention"
summary: "How self-attention lets each token weigh every other token via query/key/value projections — the core computation of a Transformer."
tags: [concept, ml, transformers, attention]
sources: [sources/research/readings/attention-is-all-you-need.md, sources/daily/2026-08-09.md]
updated: 2026-08-09
---

**Attention** computes, for each token, a weighted sum over all tokens — the
weights say how much each other token matters to this one.

## The mechanism
Each token is projected into three vectors:
- **Query (Q)** — what this token is looking for.
- **Key (K)** — what each token offers.
- **Value (V)** — the content actually mixed in.

The attention weight between two tokens is the scaled dot product of one's query
with the other's key, passed through a softmax; the output is the weighted sum of
values: `Attention(Q,K,V) = softmax(QKᵀ / √d_k) V`.

## Multi-head
Running several attention heads in parallel — each with its own Q/K/V
projections — lets the model capture several kinds of relationship (syntax,
coreference, position) simultaneously, then concatenate the results.

## Why √d_k
Without the `√d_k` scaling, dot products grow with dimension, pushing softmax into
saturated regions where gradients vanish. The scaling keeps them well-behaved.

## Related
- [[attention-is-all-you-need]] — the source paper
- [[example-project]] — where cards about this get generated and reviewed
