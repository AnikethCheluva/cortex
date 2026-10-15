// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AgentTab } from '@/components/AgentTab';
import { AGENT_CHATS_KEY, readAgentChats } from './agent-chats';
import { AGENT_PINS_KEY } from './agent-pins';
import type { VaultData } from './types';
vi.mock('./markdown', () => ({ Markdown: ({body}: {body: string}) => <p>{body}</p> }));
const title = 'A very long Markdown document title with enough words to be truncated';
const data = { wiki: [{slug:'page', title, body:'Source text', summary:'A source'}], tasks:[] } as unknown as VaultData;
beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  Element.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  localStorage.clear();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('migrates the previous conversation without discarding it', () => {
  localStorage.setItem('cortex:agent-chat', JSON.stringify([{id:'old', role:'user', text:'Previous question'}]));
  const store = readAgentChats(localStorage);
  expect(store.activeId).toBe('default');
  expect(store.chats[0].messages[0].text).toBe('Previous question');
});
it('puts named attachments inside the composer and removes their context', async () => {
  localStorage.setItem(AGENT_PINS_KEY, JSON.stringify(['page']));
  const openWiki = vi.fn();
  render(<AgentTab data={data} openWiki={openWiki} />);
  const attachment = await screen.findByRole('button', {name:`Open ${title}`});
  expect(attachment.closest('form')).toBe(screen.getByRole('textbox', {name:'Message Codex'}).closest('form'));
  fireEvent.click(attachment);
  expect(openWiki).toHaveBeenCalledWith('page');
  fireEvent.click(screen.getByRole('button', {name:`Remove ${title}`}));
  expect(screen.queryByRole('list', {name:'Attached wiki pages'})).toBeNull();
  expect(JSON.parse(localStorage.getItem(AGENT_PINS_KEY)!)).toEqual([]);
});
it('keeps late replies in their original chat and restores its attachments', async () => {
  localStorage.setItem(AGENT_PINS_KEY, JSON.stringify(['page']));
  let complete!: (response: Response) => void;
  const fetcher = vi.fn((_url: string, _options: RequestInit) => new Promise<Response>(resolve => { complete = resolve; }));
  vi.stubGlobal('fetch', fetcher);
  const view = render(<AgentTab data={data} openWiki={vi.fn()} />);
  fireEvent.change(screen.getByRole('textbox'), {target:{value:'Explain these notes'}});
  fireEvent.click(screen.getByRole('button', {name:'Send message'}));
  const sent = JSON.parse(fetcher.mock.calls[0][1].body as string);
  fireEvent.click(screen.getByRole('button', {name:'New chat', exact:true}));
  expect(screen.queryByRole('list', {name:'Attached wiki pages'})).toBeNull();
  await act(async () => complete(new Response(JSON.stringify({response:'Answer for first chat'}))));
  expect(screen.queryByText('Answer for first chat')).toBeNull();
  fireEvent.click(within(screen.getByRole('navigation', {name:'Saved chats'})).getByRole('button', {name:'Explain these notes'}));
  await screen.findByText('Answer for first chat');
  expect(screen.getByRole('button', {name:`Open ${title}`})).toBeTruthy();
  const saved = JSON.parse(localStorage.getItem(AGENT_CHATS_KEY)!);
  expect(saved.activeId).toBe(sent.conversationId);
  expect(saved.chats).toHaveLength(2);
  view.unmount();
  render(<AgentTab data={data} openWiki={vi.fn()} />);
  await screen.findByText('Answer for first chat');
});

it('places the phone Chats control in the shared header and opens history', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  render(<><div id="workspace-phone-actions" data-testid="header-actions" /><AgentTab data={data} openWiki={vi.fn()} /></>);
  const chats = await within(screen.getByTestId('header-actions')).findByRole('button', { name: 'Chats' });
  fireEvent.click(chats);
  expect(chats.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByLabelText('Chat history').classList.contains('is-open')).toBe(true);
});

it('searches wiki context from the composer and includes selected pages in the request', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({response:'Grounded answer'})));
  vi.stubGlobal('fetch', fetcher);
  render(<AgentTab data={data} openWiki={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', {name:'Add wiki context'}));
  fireEvent.change(screen.getByRole('searchbox', {name:'Search wiki pages'}), {target:{value:'no match'}});
  expect(screen.getByText('No matching wiki pages.')).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox', {name:'Search wiki pages'}), {target:{value:'Markdown'}});
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: /A very long Markdown/}));
  fireEvent.click(screen.getByRole('button', {name:'Done', exact:true}));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button', {name:`Open ${title}`})).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', {name:'Message Codex'}), {target:{value:'Summarize this'}});
  fireEvent.click(screen.getByRole('button', {name:'Send message'}));
  await screen.findByText('Grounded answer');
  const request = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(JSON.parse(request.context).pinnedWikiPages[0].text).toBe('Source text');
});
