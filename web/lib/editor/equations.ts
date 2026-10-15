import { type EditorState, type Selection, TextSelection } from "@milkdown/kit/prose/state";

/** Keep equations as native Milkdown nodes so Markdown saves retain the LaTeX. */
export function equationTransaction(state: EditorState, latex: string, display: boolean, selection: Selection = state.selection) {
  const node = display
    ? state.schema.nodes.code_block.create({ language: "latex" }, state.schema.text(latex))
    : state.schema.nodes.math_inline.create({ value: latex });
  const tr = state.tr.setSelection(selection).replaceSelectionWith(node, false);
  // Leave the caret after the inserted equation so writing can continue.
  return tr.setSelection(TextSelection.near(tr.doc.resolve(tr.selection.to), 1));
}
