"use client";

// Persistent documents — a Google-Docs-style section. Each document is a real
// wiki SOURCE (sources/notes/<slug>.md), so the next ingest compiles it into the
// wiki. Home = a grid of document cards; opening one = a full editor (title +
// the Crepe rich editor) that autosaves back to the repo.
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { NoteDocMeta } from "@/lib/types";
import { listNotes, getNote, createNote, saveNote, deleteNote } from "@/lib/clientapi";

// The Docs page editor (top toolbar + blank letter-sized page). Crepe is
// DOM-bound → browser-only.
const DocPageEditor = dynamic(() => import("./DocPageEditor"), {
  ssr: false,
  loading: () => <div className="docpage-wrap" />,
});

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function NotesTab() {
  const [notes, setNotes] = useState<NoteDocMeta[] | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { notes } = await listNotes();
      setNotes(notes);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onNew() {
    setBusy(true);
    setErr("");
    try {
      const doc = await createNote("Untitled document");
      await refresh();
      setOpenSlug(doc.slug);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(slug: string) {
    try {
      await deleteNote(slug);
      setOpenSlug(null);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (openSlug) {
    return (
      <DocEditor
        slug={openSlug}
        onBack={() => {
          setOpenSlug(null);
          refresh();
        }}
        onDelete={() => onDelete(openSlug)}
      />
    );
  }

  return (
    <div className="docs">
      <div className="docs-head">
        <div>
          <h2 className="section" style={{ margin: 0 }}>
            Documents
          </h2>
          <div className="muted docs-sub">
            Long-form notes — each is saved as a wiki source and compiled into your wiki on the next
            ingest.
          </div>
        </div>
        <button className="btn btn-primary" onClick={onNew} disabled={busy}>
          + New document
        </button>
      </div>

      {err && <div className="banner">{err}</div>}

      {notes === null ? (
        <div className="muted" style={{ padding: "24px 0" }}>
          Loading documents…
        </div>
      ) : notes.length === 0 ? (
        <div className="empty">
          No documents yet — click <b>New document</b> to write your first one.
        </div>
      ) : (
        <div className="docs-grid">
          {notes.map((n) => (
            <button key={n.slug} className="doc-card" onClick={() => setOpenSlug(n.slug)}>
              <div className="doc-card-title">{n.title || "Untitled document"}</div>
              <div className="doc-card-preview">{n.preview || "Empty document"}</div>
              <div className="doc-card-meta">Edited {fmtDate(n.updated)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DocEditor({
  slug,
  onBack,
  onDelete,
}: {
  slug: string;
  onBack: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState("");
  const [initialBody, setInitialBody] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [savedTitle, setSavedTitle] = useState("");
  const [savedBody, setSavedBody] = useState("");
  const [state, setState] = useState("");
  const [err, setErr] = useState("");
  const loaded = initialBody !== null;
  const dirty = loaded && (title !== savedTitle || body !== savedBody);
  const savingRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // latest values, so the debounced/blur save always sees current state
  const latest = useRef({ title, body, dirty });
  latest.current = { title, body, dirty };

  useEffect(() => {
    let cancelled = false;
    getNote(slug)
      .then((d) => {
        if (cancelled) return;
        setTitle(d.title);
        setSavedTitle(d.title);
        setInitialBody(d.body);
        setBody(d.body);
        setSavedBody(d.body);
      })
      .catch((e) => !cancelled && setErr((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const save = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setState("Saving…");
    setErr("");
    const { title: t, body: b } = latest.current;
    try {
      await saveNote(slug, { title: t.trim() || "Untitled document", body: b });
      setSavedTitle(t);
      setSavedBody(b);
      setState("Saved");
      setTimeout(() => setState((s) => (s === "Saved" ? "" : s)), 1500);
    } catch (e) {
      setErr((e as Error).message);
      setState("");
    } finally {
      savingRef.current = false;
    }
  }, [slug]);

  // debounced autosave whenever the document is dirty
  useEffect(() => {
    if (!dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 900);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [title, body, dirty, save]);

  async function handleBack() {
    if (latest.current.dirty) await save();
    onBack();
  }

  return (
    <div className="doc-editor">
      <div className="doc-bar">
        <button className="inline-link" onClick={handleBack}>
          ← All documents
        </button>
        <span className="save-state">
          {err ? "" : state || (dirty ? "unsaved changes" : loaded ? "saved" : "")}
        </span>
        <span className="spacer" />
        <button className="btn small" onClick={() => save()} disabled={!dirty}>
          Save
        </button>
        <button
          className="btn small doc-del"
          onClick={() => {
            if (confirm("Delete this document? This can't be undone.")) onDelete();
          }}
        >
          Delete
        </button>
      </div>

      {err && <div className="banner">{err}</div>}

      <input
        className="doc-title-input"
        value={title}
        placeholder="Untitled document"
        onChange={(e) => setTitle(e.target.value)}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
      <div className="doc-source-hint">Wiki source · sources/notes/{slug}.md</div>

      {initialBody === null ? (
        <div className="docpage-wrap" />
      ) : (
        <DocPageEditor key={slug} initialMarkdown={initialBody} onChange={setBody} />
      )}
    </div>
  );
}
