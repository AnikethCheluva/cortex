"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useMobile } from "@/lib/useMobile";
import type { VaultData } from "@/lib/types";
import { readAgentPins, setAgentPins, useAgentPins } from "@/lib/agent-pins";
import { Markdown } from "@/lib/markdown";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { AGENT_CHATS_KEY, newAgentChat, readAgentChats, updateChatMessages, type AgentMessage as Message, type AgentChatStore } from "@/lib/agent-chats";

export function AgentTab({ data, openWiki }: { data: VaultData; openWiki: (slug: string) => void }) {
  const { pins, remove, toggle } = useAgentPins();
  const pages = useMemo(() => pins.map((slug) => data.wiki.find((page) => page.slug === slug)).filter(Boolean), [pins, data.wiki]);
  const [store, setStore] = useState<AgentChatStore>({ activeId: "", chats: [] });
  const storeRef = useRef(store);
  const mounted = useRef(true);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState("");
  const active = store.chats.find(chat => chat.id === store.activeId);
  const messages = active?.messages || [];
  const [historyOpen, setHistoryOpen] = useState(false);
  const mobile = useMobile();
  const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHeaderHost(mobile ? document.getElementById("workspace-phone-actions") : null); }, [mobile]);
  const [input, setInput] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [contextQuery, setContextQuery] = useState("");
  const contextResults = useMemo(() => {
    const query = contextQuery.trim().toLowerCase();
    return data.wiki.filter(page => !query || `${page.title} ${page.summary || ""}`.toLowerCase().includes(query)).slice(0, 50);
  }, [contextQuery, data.wiki]);
  const [pendingId, setPendingId] = useState("");
  const pending = useRef("");
  const sending = Boolean(pendingId) && pendingId === store.activeId;
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const field = inputRef.current;
    if (field) { field.style.height = "24px"; field.style.height = `${Math.min(120, Math.max(24, field.scrollHeight))}px`; }
  }, [input]);
  function commit(next: AgentChatStore) {
    storeRef.current = next;
    setStore(next);
    try { localStorage.setItem(AGENT_CHATS_KEY, JSON.stringify(next)); setStorageError(""); }
    catch { setStorageError("This browser couldn’t save chat history. Keep this tab open to retain the conversation."); }
  }
  useEffect(() => {
    mounted.current = true;
    const restored = readAgentChats(localStorage);
    // Wiki pins may have changed while the Agent page was closed.
    restored.chats = restored.chats.map(chat => chat.id === restored.activeId ? { ...chat, pins: readAgentPins() } : chat);
    commit(restored);
    setLoaded(true);
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const current = storeRef.current;
    commit({ ...current, chats: current.chats.map(chat => chat.id === current.activeId ? { ...chat, pins } : chat) });
  }, [pins, loaded]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [active?.id, active?.messages, sending]);

  function selectChat(id: string) {
    const chat = storeRef.current.chats.find(item => item.id === id);
    if (!chat) return;
    commit({ ...storeRef.current, activeId: id });
    setAgentPins(chat.pins);
    setInput(""); setError(""); setHistoryOpen(false);
  }
  function startChat() {
    if (active && !active.messages.length) { setHistoryOpen(false); inputRef.current?.focus(); return; }
    const chat = newAgentChat();
    commit({ activeId: chat.id, chats: [chat, ...storeRef.current.chats] });
    setAgentPins([]);
    setInput(""); setError(""); setHistoryOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }
  function save(id: string, next: Message[]) {
    let current = storeRef.current;
    // A response can finish after opening a wiki page or mounting Agent again.
    if (!mounted.current) {
      try { current = readAgentChats(localStorage); } catch { /* Keep in-memory history. */ }
    }
    commit(updateChatMessages(current, id, next));
  }

  function useStarter(prompt: string) {
    setInput(prompt);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt || pending.current || !active) return;
    const chatId = active.id;
    const user: Message = { id: crypto.randomUUID(), role: "user", text: prompt };
    const next = [...messages, user];
    save(chatId, next);
    setInput("");
    pending.current = chatId;
    setPendingId(chatId);
    setError("");
    const pageExcerpt = Math.min(5000, Math.max(1200, Math.floor(22_000 / Math.max(1, pages.length))));
    const context = JSON.stringify({
      pinnedWikiPages: pages.map((page) => ({
        title: page!.title,
        path: `wiki/pages/${page!.slug}.md`,
        summary: page!.summary,
        text: page!.body.slice(0, pageExcerpt),
      })),
      openTasks: data.tasks.filter((task) => task.status !== "done").slice(0, 20).map((task) => ({
        title: task.title,
        priority: task.priority,
        due: task.due_date,
        project: task.project,
        estimate_minutes: task.estimate_minutes,
      })),
    });
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, context, conversationId: chatId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not reach Codex.");
      save(chatId, [...next, { id: crypto.randomUUID(), role: "assistant", text: String(body.response || "") }]);
    } catch (failure) {
      if (storeRef.current.activeId === chatId) setError((failure as Error).message);
    } finally {
      pending.current = "";
      setPendingId("");
    }
  }

  return (
    <section className="agent-workspace">
      <div className="page-heading agent-heading">
        <div><h1>Agent</h1><p>Ask questions grounded in the pages you pin from your wiki.</p></div>
        {mobile && headerHost ? createPortal(
          <button type="button" className="agent-header-chats" aria-label="Chats" title="Chats" aria-expanded={historyOpen} aria-controls="agent-history" onClick={() => setHistoryOpen(!historyOpen)}><Icon name="list" size={20} /></button>, headerHost
        ) : <button type="button" className="btn agent-history-toggle" aria-expanded={historyOpen} aria-controls="agent-history" onClick={() => setHistoryOpen(!historyOpen)}><Icon name="list" size={16} /> Chats</button>}
      </div>
      <div className="agent-layout">
        <aside id="agent-history" className={`agent-history ${historyOpen ? "is-open" : ""}`} aria-label="Chat history">
          <div className="agent-history-heading"><span className="eyebrow">Chats</span><button type="button" aria-label="New chat" title="New chat" disabled={!loaded} onClick={startChat}><Icon name="plus" size={17} /></button></div>
          <nav aria-label="Saved chats">
            {[...store.chats].sort((a, b) => b.updatedAt - a.updatedAt).map(chat => <button type="button" className="agent-history-item" key={chat.id} aria-current={chat.id === store.activeId ? "page" : undefined} title={chat.title} onClick={() => selectChat(chat.id)}><span>{chat.title}</span>{pendingId === chat.id && <span className="agent-chat-pending" aria-label="Waiting for response">···</span>}</button>)}
          </nav>
        </aside>
        <div className="agent-chat">
          <div className="agent-messages" aria-live="polite">
            {messages.length === 0 && (
              <div className="agent-empty">
                <span className="agent-empty-icon"><Icon name="agent" size={25} /></span>
                <h2>Think with your wiki</h2>
                <p>{pages.length ? "Ask Codex to connect ideas, summarize evidence, or turn your notes into a plan." : "You can ask about open tasks now, or pin wiki pages to ground a deeper conversation."}</p>
                <div className="agent-starters">
                  {(pages.length
                    ? ["Summarize the key ideas in these pages", "Compare the pinned pages", "What should I explore next?"]
                    : ["What should I focus on today?", "Help me plan my open tasks", "Summarize my current priorities"]
                  ).map((prompt) => <button type="button" key={prompt} onClick={() => useStarter(prompt)}>{prompt}<Icon name="arrow" size={13} /></button>)}
                </div>
              </div>
            )}
            {messages.map((message) => (
              <article className={`agent-message ${message.role}`} key={message.id}>
                <span>{message.role === "user" ? "You" : "Codex"}</span>
                {message.role === "assistant" ? <Markdown body={message.text} onNavigate={openWiki} /> : <p>{message.text}</p>}
              </article>
            ))}
            {sending && <div className="agent-thinking"><i /><i /><i /> Codex is thinking</div>}
            {error && <div className="agent-error" role="alert"><Icon name="agent" size={16} /><div><b>Codex couldn’t answer</b><span>{error}</span></div><button type="button" onClick={() => setError("")} aria-label="Dismiss error"><Icon name="close" size={14} /></button></div>}
            <div ref={end} />
          </div>
          {storageError && <p className="agent-storage-error" role="alert">{storageError}</p>}
          <form className="agent-composer" onSubmit={submit}>
            {pages.length > 0 && <ul className="agent-attachments" aria-label="Attached wiki pages">
              {pages.map(page => <li className="agent-attachment" key={page!.slug}>
                <button type="button" className="agent-attachment-open" title={page!.title} aria-label={`Open ${page!.title}`} onClick={() => openWiki(page!.slug)}><Icon name="docs" size={16} /><span>{page!.title}</span><small>MD</small></button>
                <button type="button" className="agent-attachment-remove" aria-label={`Remove ${page!.title}`} onClick={() => remove(page!.slug)}><Icon name="close" size={12} /></button>
              </li>)}
            </ul>}
            <div className="agent-composer-row">
            <button type="button" className="agent-context-add" aria-label="Add wiki context" title="Add wiki context" onClick={() => { setContextQuery(""); setContextOpen(true); }}><Icon name="plus" size={20} /></button>
            <textarea ref={inputRef} aria-label="Message Codex" value={input} onChange={(event) => setInput(event.target.value)} placeholder={pages.length ? "Ask about your pinned pages…" : "Ask about your workspace…"} rows={1} onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
            }} />
            <button className="agent-send" aria-label="Send message" title="Send message" disabled={!loaded || Boolean(pendingId) || !input.trim()}><Icon name="arrow" size={20} /></button>
            </div>
          </form>
        </div>
      </div>
      {contextOpen && <Dialog label="Add wiki context" className="agent-context-picker" onClose={() => setContextOpen(false)}>
        <div className="agent-context-heading"><h2>Add wiki context</h2><button type="button" className="icon-button" aria-label="Close context picker" onClick={() => setContextOpen(false)}><Icon name="close" size={18} /></button></div>
        <input autoFocus type="search" aria-label="Search wiki pages" placeholder="Search wiki pages…" value={contextQuery} onChange={event => setContextQuery(event.target.value)} />
        <p className="muted">{pins.length} of 12 pages attached</p>
        <div className="agent-context-results">
          {contextResults.map(page => <button key={page.slug} type="button" aria-pressed={pins.includes(page.slug)} disabled={pins.length >= 12 && !pins.includes(page.slug)} onClick={() => toggle(page.slug)}><Icon name="docs" size={18} /><span><b>{page.title}</b><small>{page.summary}</small></span><span aria-hidden="true">{pins.includes(page.slug) ? "✓" : "+"}</span></button>)}
          {!contextResults.length && <p className="muted">No matching wiki pages.</p>}
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setContextOpen(false)}>Done</button>
      </Dialog>}
    </section>
  );
}
