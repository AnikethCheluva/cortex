---
title: "Attention Is All You Need"
summary: "The 2017 paper introducing the Transformer — an architecture built entirely on attention, dropping recurrence and convolution."
tags: [paper, ml, transformers, nlp]
sources: [sources/research/readings/attention-is-all-you-need.md]
updated: 2026-08-09
---

Vaswani et al., 2017. The paper that introduced the **Transformer**, replacing
recurrence and convolution with **self-attention** so sequences are processed in
parallel rather than step by step.

## Key ideas
- **Self-attention** — every token attends to every other token; the model learns
  which context matters for each position.
- **Scaled dot-product attention** — `softmax(QKᵀ / √d_k) V`; the `√d_k` scaling
  keeps gradients stable as dimensionality grows.
- **Multi-head attention** — several attention "heads" in parallel let the model
  attend to different relationships at once.
- **Positional encoding** — since there is no recurrence, position is injected
  explicitly so order is preserved.

## Why it mattered
Parallelism made training on much larger corpora practical, and the architecture
scaled — it underpins essentially every modern large language model.

## Related
- [[transformer-attention]] — the attention mechanism in more depth
- [[getting-started]] — how this page fits the example wiki
