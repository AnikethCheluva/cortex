export type AgentMessage = { id: string; role: "user" | "assistant"; text: string };
export type AgentChat = { id: string; title: string; messages: AgentMessage[]; pins: string[]; updatedAt: number };
export type AgentChatStore = { activeId: string; chats: AgentChat[] };
export const AGENT_CHATS_KEY = "cortex:agent-chats:v1";

export function newAgentChat(): AgentChat {
  return { id: crypto.randomUUID(), title: "New chat", messages: [], pins: [], updatedAt: Date.now() };
}
function validMessages(value: unknown): AgentMessage[] {
  return Array.isArray(value) ? value.filter((m) => m && typeof m.id === "string" && typeof m.text === "string" && ["user", "assistant"].includes(m.role)) : [];
}
export function readAgentChats(storage: Pick<Storage, "getItem">): AgentChatStore {
  try {
    const value = JSON.parse(storage.getItem(AGENT_CHATS_KEY) || "null");
    if (Array.isArray(value?.chats)) {
      const chats: AgentChat[] = value.chats.filter((c: AgentChat) => c && typeof c.id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(c.id)).map((c: AgentChat) => ({
        id: c.id, title: typeof c.title === "string" ? c.title : "New chat", messages: validMessages(c.messages),
        pins: Array.isArray(c.pins) ? c.pins.filter(p => typeof p === "string") : [], updatedAt: Number(c.updatedAt) || 0,
      }));
      if (chats.length) return { chats, activeId: chats.some(c => c.id === value.activeId) ? value.activeId : chats[0].id };
    }
  } catch { /* Preserve the old conversation if the new store is unavailable. */ }
  const chat = newAgentChat();
  try {
    chat.messages = validMessages(JSON.parse(storage.getItem("cortex:agent-chat") || "[]"));
    if (chat.messages.length) {
      chat.id = "default"; // Continue the companion's original Cortex conversation.
      chat.title = chat.messages.find(m => m.role === "user")?.text.slice(0, 80) || "Previous chat";
    }
  } catch { /* Start with an empty chat. */ }
  return { activeId: chat.id, chats: [chat] };
}
export function updateChatMessages(store: AgentChatStore, id: string, messages: AgentMessage[]): AgentChatStore {
  return { ...store, chats: store.chats.map(chat => chat.id === id ? {
    ...chat, messages, title: messages.find(m => m.role === "user")?.text.replace(/\s+/g, " ").slice(0, 80) || "New chat", updatedAt: Date.now(),
  } : chat) };
}
