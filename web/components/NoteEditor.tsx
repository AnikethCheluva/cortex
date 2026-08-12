"use client";

// Notion-style daily-note editor built on Milkdown's Crepe. Crepe is
// markdown-NATIVE (ProseMirror + remark), so it round-trips the vault's .md
// losslessly — including $…$ / $$…$$ math (Latex feature → KaTeX) and images,
// which BlockNote's lossy markdown converter couldn't preserve. Same contract
// as the previous editor: seed with the day's written markdown, and hand the
// markdown back to the parent on every edit (parent debounces → localStorage +
// the GitHub commit).
//
// Must be loaded with next/dynamic({ ssr: false }) — Crepe is DOM-bound and
// cannot render on the server.
import { useEffect, useRef } from "react";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
// classic-dark = minimal theme (no card "frame" — frame-dark drew a box-in-a-box
// against our own note surface). Colors are overridden to the notebook palette
// in globals.css (.milkdown-host .milkdown { --crepe-color-* }).
import "@milkdown/crepe/theme/classic-dark.css";
import "katex/dist/katex.min.css"; // math glyphs for the Latex feature

export default function NoteEditor({
  initialMarkdown,
  onChange,
}: {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Keep the latest onChange without re-creating the editor when the parent
  // re-renders with a new callback identity.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let ready = false; // true only after create() → ignores the initial seed
    let destroyed = false;

    const crepe = new Crepe({
      root: el,
      defaultValue: initialMarkdown || "",
      features: {
        [Crepe.Feature.Latex]: true, // $…$ / $$…$$ via KaTeX
        [Crepe.Feature.ImageBlock]: true, // image blocks (paste a URL; upload TBD)
      },
    });

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        if (ready && !destroyed) onChangeRef.current(markdown);
      });
    });

    crepe.create().then(() => {
      if (!destroyed) ready = true;
    });

    return () => {
      destroyed = true;
      void crepe.destroy();
    };
    // Parent keys us by day stem, so initialMarkdown is fixed for the mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="note-surface milkdown-host" ref={rootRef} />;
}
