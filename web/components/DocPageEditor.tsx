"use client";

import { useEffect, useRef, useState } from "react";
import { Crepe } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import { callCommand } from "@milkdown/kit/utils";
import { NodeSelection, type Selection } from "@milkdown/kit/prose/state";
import { undoCommand, redoCommand } from "@milkdown/kit/plugin/history";
import {
  toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand,
  turnIntoTextCommand, wrapInHeadingCommand, wrapInBulletListCommand,
  wrapInOrderedListCommand, wrapInBlockquoteCommand, createCodeBlockCommand,
  insertHrCommand,
} from "@milkdown/kit/preset/commonmark";
import { toggleStrikethroughCommand, insertTableCommand } from "@milkdown/kit/preset/gfm";
import katex from "katex";
import { equationTransaction } from "@/lib/editor/equations";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/classic-dark.css";
import "katex/dist/katex.min.css";

// Commands have different payload types; callCommand validates them in Milkdown.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cmd = { key: any };
type Tool = { label: string; title: string; cmd: Cmd; cls?: string };

export default function DocPageEditor({ initialMarkdown, onChange }: {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [ready, setReady] = useState(false);
  const [editorError, setEditorError] = useState("");
  const [textStyle, setTextStyle] = useState("paragraph");
  const [words, setWords] = useState(0);
  const [equation, setEquation] = useState<{ latex: string; display: boolean; editing: boolean } | null>(null);
  const selectionRef = useRef<Selection | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const equationButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let mounted = true;
    let initialized = false;
    let lastMarkdown = initialMarkdown;
    const crepe = new Crepe({
      root: el,
      defaultValue: initialMarkdown || "",
      features: { [Crepe.Feature.Latex]: true, [Crepe.Feature.ImageBlock]: true },
      featureConfigs: {
        [Crepe.Feature.CodeMirror]: {
          previewOnlyByDefault: true,
          previewToggleText: (previewOnly) => previewOnly ? "Edit equation" : "Done",
        },
      },
    });
    crepe.on((listener) => {
      const update = () => {
        if (!mounted || !initialized) return;
        crepe.editor.action((ctx) => {
          const { state } = ctx.get(editorViewCtx);
          const node = state.selection.$from.parent;
          setTextStyle(node.type.name === "heading" ? String(node.attrs.level) : "paragraph");
          const text = state.doc.textBetween(0, state.doc.content.size, " ").trim();
          setWords(text ? text.split(/\s+/).length : 0);
        });
      };
      listener.markdownUpdated((_ctx, markdown) => {
        if (initialized && mounted && markdown !== lastMarkdown) {
          lastMarkdown = markdown;
          onChangeRef.current(markdown);
        }
      });
      listener.selectionUpdated(update);
      listener.updated(update);
    });
    crepe.create().then(() => {
      if (!mounted) { void crepe.destroy(); return; }
      crepeRef.current = crepe;
      // Parsing can normalize whitespace. Opening a document must not autosave
      // that normalization before the user has actually changed its contents.
      lastMarkdown = crepe.getMarkdown();
      initialized = true;
      setReady(true);
      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.dom.setAttribute("aria-label", "Document content");
        view.dom.setAttribute("role", "textbox");
        view.dom.setAttribute("aria-multiline", "true");
        const text = view.state.doc.textBetween(0, view.state.doc.content.size, " ").trim();
        setWords(text ? text.split(/\s+/).length : 0);
      });
    }).catch(() => { if (mounted) setEditorError("The editor could not load. Reload this page to try again."); });
    return () => {
      mounted = false;
      crepeRef.current = null;
      if (initialized) void crepe.destroy();
    };
    // The parent remounts this editor when the document changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (equation && !dialogRef.current?.open) {
      dialogRef.current?.showModal();
      dialogRef.current?.querySelector("textarea")?.focus();
    }
  }, [equation]);

  function run(command: Cmd, payload?: unknown) {
    const crepe = crepeRef.current;
    if (!crepe) return;
    crepe.editor.action(callCommand(command.key, payload));
    crepe.editor.action((ctx) => ctx.get(editorViewCtx).focus());
  }
  function openEquation() {
    crepeRef.current?.editor.action((ctx) => {
      const { state } = ctx.get(editorViewCtx);
      const selection = state.selection;
      const selected = selection instanceof NodeSelection ? selection.node : null;
      const parent = selection.$from.parent;
      if (selected?.type.name === "math_inline") {
        selectionRef.current = selection;
        setEquation({ latex: selected.attrs.value, display: false, editing: true });
      } else if (selected?.type.name === "code_block" && selected.attrs.language?.toLowerCase() === "latex") {
        selectionRef.current = selection;
        setEquation({ latex: selected.textContent, display: true, editing: true });
      } else if (parent.type.name === "code_block" && parent.attrs.language?.toLowerCase() === "latex") {
        selectionRef.current = NodeSelection.create(state.doc, selection.$from.before());
        setEquation({ latex: parent.textContent, display: true, editing: true });
      } else {
        selectionRef.current = selection;
        setEquation({ latex: state.doc.textBetween(selection.from, selection.to, " "), display: false, editing: false });
      }
    });
  }
  function closeEquation() {
    dialogRef.current?.close();
    setEquation(null);
    equationButtonRef.current?.focus();
  }
  let preview = "", equationError = "";
  if (equation?.latex.trim()) {
    try {
      preview = katex.renderToString(equation.latex, { displayMode: equation.display, throwOnError: true, trust: false });
    } catch (error) {
      equationError = (error as Error).message.replace(/^KaTeX parse error:\s*/, "");
    }
  }
  function insertEquation() {
    if (!equation || !equation.latex.trim() || equationError) return;
    crepeRef.current?.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const tr = equationTransaction(view.state, equation.latex.trim(), equation.display, selectionRef.current ?? view.state.selection);
      view.dispatch(tr.scrollIntoView());
    });
    closeEquation();
    crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx).focus());
  }

  const groups: Tool[][] = [
    [{ label: "↶", title: "Undo", cmd: undoCommand }, { label: "↷", title: "Redo", cmd: redoCommand }],
    [{ label: "B", title: "Bold", cmd: toggleStrongCommand, cls: "dtb-b" },
      { label: "I", title: "Italic", cmd: toggleEmphasisCommand, cls: "dtb-i" },
      { label: "S", title: "Strikethrough", cmd: toggleStrikethroughCommand, cls: "dtb-s" },
      { label: "‹›", title: "Inline code", cmd: toggleInlineCodeCommand, cls: "dtb-c" }],
    [{ label: "• List", title: "Bullet list", cmd: wrapInBulletListCommand },
      { label: "1. List", title: "Numbered list", cmd: wrapInOrderedListCommand },
      { label: "❝", title: "Blockquote", cmd: wrapInBlockquoteCommand }],
    [{ label: "Code", title: "Code block", cmd: createCodeBlockCommand },
      { label: "Table", title: "Insert table", cmd: insertTableCommand },
      { label: "―", title: "Divider", cmd: insertHrCommand }],
  ];
  return (
    <div className="docpage-wrap">
      <div className="docpage-toolbar" role="toolbar" aria-label="Document formatting">
        <label className="doc-style-picker">
          <span className="sr-only">Text style</span>
          <select aria-label="Text style" value={textStyle} disabled={!ready} onChange={(event) => {
            const value = event.target.value;
            run(value === "paragraph" ? turnIntoTextCommand : wrapInHeadingCommand, value === "paragraph" ? undefined : Number(value));
          }}>
            <option value="paragraph">Normal text</option><option value="1">Heading 1</option>
            <option value="2">Heading 2</option><option value="3">Heading 3</option>
          </select>
        </label>
        <div className="doc-format-tools">{groups.map((group, i) => (
          <span className="dtb-group" key={i}>
            {group.map((tool) => <button key={tool.title} type="button" className={`dtb ${tool.cls ?? ""}`}
              title={tool.title} aria-label={tool.title} disabled={!ready}
              onMouseDown={(event) => event.preventDefault()} onClick={() => run(tool.cmd)}>{tool.label}</button>)}
          </span>
        ))}</div>
        <button ref={equationButtonRef} type="button" className="dtb doc-equation-button" disabled={!ready}
          onMouseDown={(event) => event.preventDefault()} onClick={openEquation}>
          <span aria-hidden="true">∑</span> Equation
        </button>
      </div>
      {editorError && <div role="alert" className="banner">{editorError}</div>}
      <div className="docpage-scroll">
        <div className="docpage" ref={rootRef} />
      </div>
      <div className="docpage-status"><span>{words} {words === 1 ? "word" : "words"}</span><span>LaTeX: $inline$ or $$display$$</span></div>
      {equation && <dialog ref={dialogRef} className="equation-dialog" aria-labelledby="equation-title" onCancel={(event) => { event.preventDefault(); closeEquation(); }}>
        <form onSubmit={(event) => { event.preventDefault(); insertEquation(); }}>
          <div className="equation-heading"><h2 id="equation-title">{equation.editing ? "Edit equation" : "Insert equation"}</h2>
            <button type="button" className="dtb" aria-label="Close equation editor" onClick={closeEquation}>×</button></div>
          <fieldset className="equation-modes"><legend className="sr-only">Equation placement</legend>
            <label><input type="radio" name="equation-mode" checked={!equation.display} onChange={() => setEquation({ ...equation, display: false })} /> Inline</label>
            <label><input type="radio" name="equation-mode" checked={equation.display} onChange={() => setEquation({ ...equation, display: true })} /> Display</label>
          </fieldset>
          <label className="equation-label" htmlFor="equation-source">LaTeX</label>
          <textarea id="equation-source" value={equation.latex} autoFocus spellCheck={false} placeholder={String.raw`e^{i\pi} + 1 = 0`}
            aria-describedby={equationError ? "equation-error" : "equation-help"} aria-invalid={!!equationError}
            onChange={(event) => setEquation({ ...equation, latex: event.target.value })}
            onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); insertEquation(); } }} />
          <p id="equation-help" className="equation-help">Write LaTeX without dollar signs. Inline sits within a sentence; display gets its own line.</p>
          <div className="equation-preview" aria-label="Equation preview">
            {equationError ? <p id="equation-error" role="status">{equationError}</p> : preview ? <div dangerouslySetInnerHTML={{ __html: preview }} /> : <span>Your equation preview</span>}
          </div>
          <div className="equation-actions"><button type="button" className="btn" onClick={closeEquation}>Cancel</button>
            <button type="submit" className="btn primary" disabled={!equation.latex.trim() || !!equationError}>{equation.editing ? "Update equation" : "Insert equation"}</button></div>
        </form>
      </dialog>}
    </div>
  );
}
