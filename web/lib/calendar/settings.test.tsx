// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CalendarConnectionSettings } from '@/components/CalendarConnectionSettings';
const api = vi.hoisted(() => ({ connections: vi.fn(), prepareConnection: vi.fn(), signIn: vi.fn(), providerConfigured: vi.fn() }));
vi.mock('@/lib/calendar', () => ({ ...api, PROVIDER_LABEL: { google: 'Google', microsoft: 'Outlook' } }));
beforeEach(() => {
  vi.stubGlobal('React', React);
  api.connections.mockReset().mockResolvedValue({google: true, microsoft: true});
  api.prepareConnection.mockReset().mockResolvedValue(undefined);
  api.signIn.mockReset().mockResolvedValue(undefined);
  api.providerConfigured.mockReset().mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it.each([['Google', 'google'], ['Outlook', 'microsoft']])('reconnects the selected %s calendar', async (label, provider) => {
  render(<CalendarConnectionSettings />);
  const button = screen.getByRole('button', {name: `Reconnect ${label} calendar`});
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
  fireEvent.click(button);
  await screen.findByText(`${label} calendar reconnected.`);
  expect(api.signIn).toHaveBeenCalledWith(provider);
  expect(api.signIn).toHaveBeenCalledTimes(1);
});
it('reports a cancelled reconnect and lets the user retry', async () => {
  api.signIn.mockRejectedValueOnce(new Error('Sign-in cancelled'));
  render(<CalendarConnectionSettings />);
  const button = screen.getByRole('button', {name:'Reconnect Google calendar'});
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
  fireEvent.click(button);
  expect((await screen.findByRole('alert')).textContent).toBe('Sign-in cancelled');
  expect(button.hasAttribute('disabled')).toBe(false);
  fireEvent.click(button);
  await screen.findByText('Google calendar reconnected.');
});
