import { describe, expect, it } from "vitest";
import { Schema } from "@milkdown/kit/prose/model";
import { EditorState, NodeSelection, TextSelection } from "@milkdown/kit/prose/state";
import { history, undo } from "@milkdown/kit/prose/history";
import { equationTransaction } from "./equations";

const schema = new Schema({ nodes: {
  doc: { content: "block+" },
  paragraph: { content: "inline*", group: "block" },
  code_block: { content: "text*", group: "block", code: true, attrs: { language: { default: "" } } },
  math_inline: { inline: true, group: "inline", atom: true, attrs: { value: { default: "" } } },
  text: { group: "inline" },
} });
function stateAt(pos: number) {
  const doc = schema.node("doc", null, schema.node("paragraph", null, schema.text("Before after")));
  return EditorState.create({ schema, doc, selection: TextSelection.create(doc, pos), plugins: [history()] });
}
describe("document equations", () => {
  it("inserts inline LaTeX at the saved caret without replacing surrounding writing", () => {
    const state = stateAt(8);
    const next = state.apply(equationTransaction(state, String.raw`\frac{a}{b}`, false));
    expect(next.doc.firstChild!.child(0).text).toBe("Before ");
    expect(next.doc.firstChild!.child(1).attrs.value).toBe(String.raw`\frac{a}{b}`);
    expect(next.doc.firstChild!.child(2).text).toBe("after");
    expect(next.selection.from).toBe(9);
  });
  it("splits a paragraph for display math and can undo the whole insertion", () => {
    const state = stateAt(8);
    let next = state.apply(equationTransaction(state, String.raw`\sum_{i=1}^{n} i`, true));
    expect(next.doc.childCount).toBe(3);
    expect(next.doc.child(0).textContent).toBe("Before ");
    expect(next.doc.child(1).type.name).toBe("code_block");
    expect(next.doc.child(1).attrs.language).toBe("latex");
    expect(next.doc.child(2).textContent).toBe("after");
    undo(next, tr => { next = next.apply(tr); });
    expect(next.doc.eq(state.doc)).toBe(true);
  });
  it("updates a selected equation instead of duplicating it", () => {
    let state = stateAt(8);
    state = state.apply(equationTransaction(state, "x^2", false));
    const selection = NodeSelection.create(state.doc, 8);
    const next = state.apply(equationTransaction(state, "x^3", false, selection));
    expect(next.doc.firstChild!.childCount).toBe(3);
    expect(next.doc.firstChild!.child(1).attrs.value).toBe("x^3");
  });
  it("can change an inline equation to display math without losing adjacent text", () => {
    let state = stateAt(8);
    state = state.apply(equationTransaction(state, "x^2", false));
    const next = state.apply(equationTransaction(state, "x^3", true, NodeSelection.create(state.doc, 8)));
    expect(next.doc.childCount).toBe(3);
    expect(next.doc.child(1).textContent).toBe("x^3");
    expect(next.doc.child(0).textContent + next.doc.child(2).textContent).toBe("Before after");
  });
});
