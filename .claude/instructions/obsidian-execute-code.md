# Embedding Executable Code Plots in Obsidian Notes

Plugin: **obsidian-execute-code** by twibiral  
GitHub: https://github.com/twibiral/obsidian-execute-code

---

## Core Syntax

Code blocks use standard markdown fences with the language tag:

````markdown
```python
print("hello")
```
````

---

## Block Attributes

Add attributes in `{}` after the language tag:

| Attribute | Effect |
|-----------|--------|
| `{pre}` | Runs before every subsequent block in the note (use for shared imports/setup) |
| `{post}` | Runs after all other blocks |
| `{label='name'}` | Names this block so others can import it |
| `{import='name'}` | Imports a labeled block's environment |
| `{ignore}` | Skips execution |

---

## Matplotlib Plots — How They Work

- Plots render **inline** when `plt.show()` is called.
- **Plots disappear on note reload** (known limitation, GitHub issue #413).
- **Fix:** always call `plt.savefig()` before `plt.show()`, then embed the saved PNG with `![[filename.png]]`.

### Pattern for persistent plots

````markdown
```python {pre}
import matplotlib.pyplot as plt
import os

_fig_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "figs")
os.makedirs(_fig_dir, exist_ok=True)

plt.rcParams.update({'axes.spines.top': False, 'axes.spines.right': False})
```

```python
fig, ax = plt.subplots()
ax.bar(['A', 'B', 'C'], [1, 3, 2])
ax.set_title('My Chart')
plt.tight_layout()
plt.savefig(os.path.join(_fig_dir, 'my_chart.png'), bbox_inches='tight')
plt.show()
```

![[figs/my_chart.png]]
````

The `![[figs/my_chart.png]]` line shows the saved PNG even without re-running — it persists across reloads.

---

## Notebook Mode

When enabled in plugin settings, **all blocks in a note share the same Python environment** (variables, imports persist across blocks). This is on by default for Python.

- When Notebook Mode is on, "Embed Plots" must also be on (plugin enforces this).
- With Notebook Mode, the `{pre}` block pattern is the cleanest way to share setup across all plot blocks.

---

## Recommended Structure for a Note with Multiple Plots

```
1. One {pre} block at the top of the section with:
   - All imports (matplotlib, numpy, etc.)
   - Figure output directory setup
   - Shared style / color constants

2. For each data visualization:
   - A ```python``` block with the plot code
   - plt.savefig(...) before plt.show()
   - An ![[figs/name.png]] embed immediately after

3. Images go in a subfolder of the note (e.g. Note_figs/)
   - Obsidian resolves ![[filename.png]] vault-wide, so any location works
   - Subfolders avoid clutter: ![[Note_figs/chart.png]]
```

---

## Plugin Settings to Check

- **Python path**: must point to a Python with matplotlib installed
- **Notebook Mode**: on (recommended for multi-block notes)
- **Embed Plots**: on (required when Notebook Mode is on)

---

## Known Limitations

- Plots disappear on reload → use `savefig` + image embed (see above)
- `os.path.abspath(__file__)` gives the note's path, useful for relative figure directories
- Each note runs in its own REPL when Notebook Mode is off; shared across blocks when on
