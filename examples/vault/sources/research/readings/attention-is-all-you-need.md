# Reading — Attention Is All You Need (Vaswani et al., 2017)

Raw reading notes (a **source** — the wiki page [[attention-is-all-you-need]] is
synthesized from this). This is the kind of file you drop into `sources/`; Claude
compiles it into the wiki.

- The Transformer drops recurrence entirely — attention does all the sequence
  mixing, so training parallelizes across positions.
- Scaled dot-product attention: `softmax(QKᵀ/√d_k)V`. The `√d_k` term stops the
  dot products from getting huge as dimension grows.
- Multi-head attention = several attention functions in parallel, each with its
  own projections, concatenated at the end.
- No recurrence means position must be added explicitly → sinusoidal positional
  encodings.
- Result: state-of-the-art translation, much faster to train than RNN/CNN models.

Questions I still have: why sinusoidal vs learned positions? How do heads
specialize in practice?
