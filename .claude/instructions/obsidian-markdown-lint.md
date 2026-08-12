# Markdown Lint Guide for Obsidian Notes

Use this guide whenever asked to "lint," "fix formatting," or "clean up" a `.md` file — especially notes imported from Notion or other tools.

---

## Step 1 — Read the Full File First

Before making any edits, read the entire file. Build a mental model of:
- What kind of document it is (lecture notes, research paper summary, project doc, etc.)
- What structured elements it uses (headings, code blocks, tables, lists, callouts)
- What domain-specific syntax appears (math, generics, assembly, pseudocode)

Do **not** edit as you read. Collect all issues first, then fix in one pass.

---

## Step 2 — Spelling and Grammar

Fix typos and grammatical errors. Common Notion import artifacts to look for:
- Transposed characters: `teh`, `adn`, `becasue`, `becuase`
- Missing spaces: `int*ptr=NULL` → `int* ptr = NULL`, `i<n` → `i < n`
- Run-together words: `localsb`, `blcoks athat`, `returniing`
- Words with missing/extra letters: `memeory`, `uninitialzied`, `funciton`, `declerations`
- Dropped word-initial characters: `t first` → `at first`, `teh` → `the`

Rules:
- Fix spelling/grammar mistakes.
- Do **not** rewrite or paraphrase content — only fix clear errors.
- Preserve technical terminology exactly (function names, variable names, algorithm names).
- Preserve intentional shorthand in headings (e.g., "BFS", "O(n log n)").

---

## Step 3 — Markdown Formatting

### Headings

- Heading levels must be consistent and hierarchical: `#` → `##` → `###`, no skipping.
- One blank line before and after every heading.
- No trailing spaces after heading text.

**Heading structure convention for lecture/course notes:**

| Level | What goes here |
| --- | --- |
| `#` | Top-level grouping for the document — exam block, unit, module, or chapter (`# Exam 1`, `# Unit 3`, `# Chapter 5`) |
| `##` | Each distinct concept being introduced — an algorithm, data structure, topic, or named idea (`## Dijkstra's`, `## Hash Maps`, `## Sorting`) |
| `###` | Subsections within that concept — `### Intuition`, `### Algorithm`, `### Time Complexity`, specific operations, variants, comparisons, examples |
| `####` or deeper | **Never used** — if a `###` section needs further subdivision, use bold text or nested bullet points instead |

**How to apply this during a lint:**
- Read the document's top-level `#` headings to understand what the grouping unit is (exam, unit, chapter, etc.).
- Every named concept that could stand alone as a study topic should be a `##`. If a main concept is at `###`, promote it.
- Content that only makes sense as part of a parent concept (a specific operation, a sub-case, a comparison) belongs at `###`.
- If a heading is at `####` or deeper, either promote it to `###` or collapse it into a bold bullet under its parent section.
- Apply this structure uniformly across the whole file — if the later sections already follow the convention, use them as the reference and fix the earlier sections to match.

### Code Blocks

Always use a language tag on fenced code blocks:

| Content | Language Tag |
|---------|-------------|
| Java | ` ```java ` |
| Python | ` ```python ` |
| C / C++ | ` ```c ` |
| RISC-V / ARM assembly | ` ```asm ` |
| Pseudocode | ` ```text ` |
| ASCII art / diagrams | ` ```text ` |
| Plain output | ` ```text ` |

Never use `plain text` as a language tag — it doesn't syntax-highlight and is not valid in most renderers. Replace with `text`.

Check that every opened code fence (` ``` `) has a matching closing fence. An unclosed fence causes all content after it to render as code — scan the full file for this.

### Lists

- Consistent indentation: 2 or 4 spaces per level (pick whichever the file already uses).
- No mixed bullet styles within the same list (`-` and `*` together).
- One blank line between a heading and its first list item is optional but should be consistent throughout the file.

### Tables

- Every table must have a header row and a separator row (`| --- |`).
- All rows must have the same number of columns.
- Cells should not be empty unless intentional — add a dash or `N/A` if needed.
- Notion sometimes corrupts table cells with markdown hyperlinks like `[obj.field](http://obj.field/)` — strip these back to plain `obj.field`.

### Bold and Italics

- `**text**` must open and close on the same logical phrase. Look for misplaced markers like:
  - `its right** child has a BF of +1**` → `its **right child** has a **BF of +1**`
  - `the tree bends right** then left**` → `the tree bends **right then left**`
- Stray `**` with no matching pair will italicize or bold unintended content.

### Blank Lines

- One blank line between sections.
- Two blank lines before a top-level `##` heading is acceptable for visual separation, but not required.
- No double-blank-line runs inside a list or code block.

---

## Step 4 — Special Characters

### Angle Brackets Outside Code Fences

Obsidian (and most Markdown renderers) parse `<T>`, `<Vertex>`, `<char, int>` as HTML tags and **silently strip them** if they appear in plain prose or headings.

Whenever you see generic type syntax or any `<...>` pattern **outside** a code block, wrap it in backticks:

| Before | After |
|--------|-------|
| `### AVLNode <T>` | `` ### `AVLNode<T>` `` |
| `- Map<Vertex, List<Edge>>` | `` - `Map<Vertex, List<Edge>>` `` |
| `- Map<char, int>` | `` - `Map<char, int>` `` |
| `returns Node<T>` | `` returns `Node<T>` `` |

**How to find them:** Grep the file for `<[A-Za-z]` and check each hit — if it's inside a ` ```lang ` fence, it's safe. If it's in a heading, bullet, or prose line, wrap it.

### Other Characters That Need Escaping (if not in a code block)

| Character | Issue | Fix |
|-----------|-------|-----|
| `<T>`, `<K, V>` | Parsed as HTML tag | Wrap in backticks |
| `&` followed by word | May render as HTML entity | Usually fine in modern renderers; backtick if it looks wrong |
| `|` inside a table cell | Breaks table structure | Escape as `\|` |
| `*` not intended as emphasis | Triggers italic/bold | Escape as `\*` |
| `#` not at start of line | Usually safe; in code → code block |  |

### Math

If the file contains math expressions (`$x^2$`, `$$\sum$$`), verify the delimiters are balanced. Obsidian supports MathJax — single `$...$` for inline, `$$...$$` for block.

---

## Step 5 — Content-Aware Structure Fixes

When linting, notice when content is written as prose but would render better in a structured element. Apply these upgrades **only if the improvement is clear and the content directly supports it** — do not restructure speculatively.

### Prose → List

If a sentence lists 3+ items separated by commas or semicolons and is hard to scan, convert to a bullet list.

**Before:**
```
The node stores data, a left pointer, a right pointer, and a height field.
```
**After:**
```
The node stores:
- data
- left pointer
- right pointer
- height field
```

### Prose → Table

If a paragraph compares two or more entities across the same set of attributes, convert to a table.

**Before:**
```
BFS uses a queue while DFS uses a stack. BFS finds shortest paths in unweighted graphs; DFS does not. BFS visits level by level; DFS visits depth-first.
```
**After:**
| | BFS | DFS |
|--|-----|-----|
| Data Structure | Queue | Stack |
| Shortest Path (unweighted) | Yes | No |
| Traversal Order | Level by level | Depth-first |

### Inline Code for Technical Terms

Wrap the following in backticks when they appear in prose (not in a code block):
- Variable names, field names: `data`, `left`, `height`
- Method/function names: `insert()`, `rotateLeft()`
- Type names and generics: `Node<T>`, `Map<K, V>`
- File names and paths: `Main.java`, `/usr/bin`
- Shell commands: `git commit`, `npm install`

Do **not** wrap algorithm names (`Dijkstra's`, `BFS`), concept names (`stack`, `queue`), or informal references in backticks.

---

## Step 6 — Notion Import Artifacts (Checklist)

When linting a file that was imported from Notion, check for all of these:

- [ ] `plain text` language tags on code fences → replace with `text`
- [ ] Missing spaces inside code blocks (Notion strips indentation) → restore based on context
- [ ] Hyperlinks on dot-notation: `[obj.field](http://obj.field/)` → `obj.field`
- [ ] Garbled heading or bullet text (transposed chars, missing chars) → fix spelling
- [ ] Unclosed code fences → add closing ` ``` ` after last line of that block
- [ ] `<T>` and other generics in headings/prose → wrap in backticks
- [ ] Duplicate section headings (e.g., two `### Push`) → rename the second one correctly
- [ ] Stray single characters on their own line (artifact of copy-paste) → remove
- [ ] Empty heading lines (`## ` with no text) → remove

---

## What NOT to Do

- Do not rewrite content, add explanations, or expand notes.
- Do not change technical accuracy — if a number or formula looks wrong, flag it as a comment rather than silently correcting it.
- Do not add structure (new headings, new sections) unless a heading is clearly missing.
- Do not change code logic inside code blocks — only fix the fence language tag or restore stripped whitespace.
- Do not remove content unless it is clearly a formatting artifact (stray characters, broken links, empty headings).
