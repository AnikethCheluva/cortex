// Tiny, surgical frontmatter editing. We deliberately do NOT re-serialize the
// whole YAML block (which would churn quoting/spacing and create noisy diffs in
// a repo that WikiBot + /ingest also edit). Instead we line-edit specific keys
// and leave everything else byte-for-byte intact.

/** Replace `key: value` inside the frontmatter block, or append it before the
 *  closing fence if the key is absent. No frontmatter → returns input unchanged. */
export function setFrontmatterField(raw: string, key: string, value: string): string {
  const m = raw.match(/^(---\n)([\s\S]*?)(\n---\s*\n?)/);
  if (!m) return raw;
  const [, open, block, close] = m;
  const keyRe = new RegExp(`^${key}:\\s?.*$`);
  let found = false;
  const next = block.split("\n").map((l) => {
    if (keyRe.test(l)) {
      found = true;
      return `${key}: ${value}`;
    }
    return l;
  });
  if (!found) next.push(`${key}: ${value}`);
  return open + next.join("\n") + close + raw.slice(m[0].length);
}

/** Replace the markdown body (everything after the frontmatter block). */
export function replaceBody(raw: string, newBody: string): string {
  const m = raw.match(/^(---\n[\s\S]*?\n---\s*\n)/);
  const fm = m ? m[1] : "";
  return fm + (fm ? "\n" : "") + newBody.replace(/\s+$/, "") + "\n";
}
