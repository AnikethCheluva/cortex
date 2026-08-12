"use client";

// Google-Docs-style editor for the Docs tab: a persistent formatting TOOLBAR at
// the top (wired to Milkdown commands) + a blank, letter-sized "sheet of paper"
// page (same dark palette, no ruled lines). Separate from the daily NoteEditor,
// which keeps its notebook ruling.
import { useEffect, useRef } from "react";
import { Crepe } from "@milkdown/crepe";
import { callCommand } from "@milkdown/kit/utils";
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  turnIntoTextCommand,
  wrapInHeadingCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  wrapInBlockquoteCommand,
  createCodeBlockCommand,
  insertHrCommand,
} from "@milkdown/kit/preset/commonmark";
import { toggleStrikethroughCommand, insertTableCommand } from "@milkdown/kit/preset/gfm";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cmd = { key: any };
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/classic-dark.css";
import "katex/dist/katex.min.css";

export default function DocPageEditor({
  initialMarkdown,
  onChange,
}: {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let ready = false;
    let destroyed = false;
    const crepe = new Crepe({
      root: el,
      defaultValue: initialMarkdown || "",
      features: { [Crepe.Feature.Latex]: true, [Crepe.Feature.ImageBlock]: true },
    });
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        if (ready && !destroyed) onChangeRef.current(markdown);
      });
    });
    crepe.create().then(() => {
      if (destroyed) return;
      ready = true;
      crepeRef.current = crepe;
    });
    return () => {
      destroyed = true;
      crepeRef.current = null;
      void crepe.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Run a Milkdown command from a toolbar button.
  function run(c: Cmd, payload?: unknown) {
    const crepe = crepeRef.current;
    if (!crepe) return;
    crepe.editor.action(callCommand(c.key, payload));
  }

  // label · tooltip · command · optional payload · optional style class
  const groups: { label: string; title: string; cmd: Cmd; arg?: unknown; cls?: string }[][] = [
    [
      { label: "H1", title: "Heading 1", cmd: wrapInHeadingCommand, arg: 1 },
      { label: "H2", title: "Heading 2", cmd: wrapInHeadingCommand, arg: 2 },
      { label: "H3", title: "Heading 3", cmd: wrapInHeadingCommand, arg: 3 },
      { label: "¶", title: "Paragraph", cmd: turnIntoTextCommand },
    ],
    [
      { label: "B", title: "Bold (⌘B)", cmd: toggleStrongCommand, cls: "dtb-b" },
      { label: "I", title: "Italic (⌘I)", cmd: toggleEmphasisCommand, cls: "dtb-i" },
      { label: "S", title: "Strikethrough", cmd: toggleStrikethroughCommand, cls: "dtb-s" },
      { label: "‹›", title: "Inline code", cmd: toggleInlineCodeCommand, cls: "dtb-c" },
    ],
    [
      { label: "• List", title: "Bullet list", cmd: wrapInBulletListCommand },
      { label: "1. List", title: "Numbered list", cmd: wrapInOrderedListCommand },
      { label: "❝ Quote", title: "Blockquote", cmd: wrapInBlockquoteCommand },
    ],
    [
      { label: "Code", title: "Code block", cmd: createCodeBlockCommand },
      { label: "Table", title: "Insert table", cmd: insertTableCommand },
      { label: "―", title: "Divider", cmd: insertHrCommand },
    ],
  ];

  return (
    <div className="docpage-wrap">
      <div className="docpage-toolbar" role="toolbar" aria-label="Formatting">
        {groups.map((group, gi) => (
          <span className="dtb-group" key={gi}>
            {group.map((b) => (
              <button
                key={b.title}
                type="button"
                className={`dtb ${b.cls ?? ""}`}
                title={b.title}
                // keep the editor's selection — don't let the button steal focus
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => run(b.cmd, b.arg)}
              >
                {b.label}
              </button>
            ))}
          </span>
        ))}
      </div>

      <div className="docpage-scroll">
        <div className="docpage" ref={rootRef} />
      </div>
    </div>
  );
}
