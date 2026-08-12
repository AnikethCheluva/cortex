# Embedding Charts in Obsidian Notes (Charts View Plugin)

Plugin: **obsidian-chartsview-plugin** by caronchen  
GitHub: https://github.com/caronchen/obsidian-chartsview-plugin  
Underlying library: Ant Design Charts

---

## Core Syntax

All charts use a ` ```chartsview ` code fence with YAML inside:

````markdown
```chartsview
type: Column
data:
  - x: "A"
    y: 10
  - x: "B"
    y: 20
options:
  xField: "x"
  yField: "y"
```
````

Three top-level keys:
- `type` — chart type (see below)
- `data` — inline YAML list, or a CSV filename, or a dataviewjs query
- `options` — Ant Design Charts configuration

---

## Supported Chart Types

| Type | Description |
|------|-------------|
| `Column` | Vertical bar chart |
| `Bar` | Horizontal bar chart |
| `Line` | Line chart |
| `Pie` | Pie chart |
| `Scatter` | Scatter plot |
| `Radar` | Radar/spider chart |
| `DualAxes` | Two Y-axes |
| `Treemap` | Hierarchical rectangles |
| `WordCloud` | Word frequency cloud |
| `Mix` | Combined chart types |

---

## Options Reference

### Field Mappings
```yaml
options:
  xField: "fieldName"       # x-axis field key
  yField: "fieldName"       # y-axis numeric field key
  seriesField: "fieldName"  # groups data into series (controls color + grouping)
```

### Grouping & Stacking
```yaml
options:
  isGroup: true    # side-by-side grouped bars (use with seriesField)
  isStack: true    # stacked bars (use with seriesField)
  isPercent: true  # percentage stacked bars
```

### Colors
```yaml
# Array — colors assigned to series values in order of first appearance
color: ["#2563eb", "#94a3b8", "#dc2626"]

# Function — for conditional coloring
color: |
  function({type}) {
    if (type === 'ViPRA') return '#2563eb';
    return '#94a3b8';
  }
```

### Labels, Axes, Legend
```yaml
options:
  label:
    position: "top"        # show value labels above bars (or "middle", "right")
  legend:
    position: "bottom"     # legend placement
  xAxis:
    label:
      autoRotate: true     # rotate long x-axis labels
      autoHide: false
  meta:
    fieldName:
      alias: "Axis Label"  # human-readable axis label
```

---

## Data Sources

### Inline YAML (most common)
```yaml
data:
  - category: "A"
    value: 100
  - category: "B"
    value: 200
```

### CSV File
```yaml
data: myfile.csv
```
File must be in the plugin's configured data directory.

### DataviewJS Query
```yaml
data: |
  dataviewjs:
  return dv.pages("#tag").map(p => ({name: p.file.name, count: p.score})).array();
```

---

## Common Patterns

### Highlight one bar with seriesField color trick

Add a `type` field to each data point, set to `"ViPRA"` for the target and `"Baseline"` for others. Use `seriesField: "type"` and a two-color array. Colors map to series values in first-appearance order.

```yaml
type: Column
data:
  - model: "OpenVLA"
    score: 38.6
    type: "Baseline"
  - model: "LAPA"
    score: 53.1
    type: "Baseline"
  - model: "ViPRA-AR"
    score: 69.8
    type: "ViPRA"
options:
  xField: "model"
  yField: "score"
  seriesField: "type"
  color: ["#94a3b8", "#2563eb"]   # Baseline=gray (appears first), ViPRA=blue
  label:
    position: "top"
  meta:
    score:
      alias: "Success Rate (%)"
```

### Grouped bars (multiple metrics per x-value)

Repeat each x-value once per metric, add a `metric` field, set `seriesField: "metric"` and `isGroup: true`.

```yaml
type: Column
data:
  - model: "Scratch-AR"
    value: 52.1
    metric: "Task Success"
  - model: "ViPRA-AR"
    value: 69.8
    metric: "Task Success"
  - model: "Scratch-AR"
    value: 65.6
    metric: "Grasp Rate"
  - model: "ViPRA-AR"
    value: 76.1
    metric: "Grasp Rate"
options:
  xField: "model"
  yField: "value"
  seriesField: "metric"
  isGroup: true
  color: ["#2563eb", "#93c5fd"]
  label:
    position: "top"
```

### Horizontal bar chart

Use `type: Bar` and swap xField/yField (x is the numeric value, y is the category).

```yaml
type: Bar
data:
  - dataset: "SSv2 (human)"
    count: 198000
options:
  xField: "count"
  yField: "dataset"
  label:
    position: "right"
```

---

## Key Differences vs Execute Code / matplotlib

- **No Python required** — pure YAML, always renders, no re-running needed
- **Persistent by default** — charts render from YAML every time the note opens (no savefig workaround needed)
- **No annotations/arrows** — can't draw custom annotation arrows like matplotlib; use text notes instead
- **Colors via seriesField** — to color individual bars differently, add a categorical field and use `seriesField` + `color` array
- **No shared setup block** — each chartsview block is fully self-contained
