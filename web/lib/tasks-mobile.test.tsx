// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TasksTab } from '@/components/TasksTab';
vi.mock('./markdown', () => ({ Markdown: () => null }));
beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('matchMedia', () => ({matches:true, addEventListener() {}, removeEventListener() {}}));
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('opens New task from the shared phone header and keeps secondary controls in options', async () => {
  const openCalendar = vi.fn();
  const workspace = {tasks:[], pending:new Set(), save:vi.fn(), add:vi.fn(), remove:vi.fn()} as unknown as React.ComponentProps<typeof TasksTab>['workspace'];
  render(<><div id="workspace-phone-actions" data-testid="header" /><TasksTab workspace={workspace} openWiki={vi.fn()} openCalendar={openCalendar} onAgentTimebox={vi.fn()} /></>);
  fireEvent.click(within(screen.getByTestId('header')).getByRole('button', {name:'New task'}));
  expect(screen.getByRole('dialog', {name:'New task'})).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('dialog'), {key:'Escape'});
});
it('filters, searches, and opens the calendar through the compact controls', () => {
  const openCalendar = vi.fn();
  const workspace = {tasks:[], pending:new Set(), save:vi.fn(), add:vi.fn(), remove:vi.fn()} as unknown as React.ComponentProps<typeof TasksTab>['workspace'];
  render(<TasksTab workspace={workspace} openWiki={vi.fn()} openCalendar={openCalendar} onAgentTimebox={vi.fn()} />);
  fireEvent.change(screen.getByRole('combobox', {name:'Filter tasks'}), {target:{value:'overdue'}});
  expect(screen.getByText('No overdue tasks')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', {name:'Search tasks'}));
  expect(screen.getByRole('textbox', {name:'Search tasks'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button', {name:'Task options'}));
  fireEvent.change(screen.getByRole('combobox', {name:'Sort tasks'}), {target:{value:'priority'}});
  fireEvent.click(screen.getByRole('button', {name:'Open calendar'}));
  expect(openCalendar).toHaveBeenCalledOnce();
  expect(screen.queryByRole('dialog')).toBeNull();
});
