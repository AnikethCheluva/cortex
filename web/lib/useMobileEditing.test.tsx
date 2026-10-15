// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useMobileEditing } from './useMobileEditing';
function Harness({mobile = true}) {
  const state = useMobileEditing(mobile);
  return <><textarea aria-label="Message" /><button>Done</button><output>{JSON.stringify(state)}</output></>;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('hides navigation while editing, tracks the keyboard viewport, and restores on blur', async () => {
  vi.stubGlobal('React', React);
  const viewport = Object.assign(new EventTarget(), {height:852});
  vi.stubGlobal('visualViewport', viewport);
  render(<Harness />);
  act(() => screen.getByRole('textbox').focus());
  expect(screen.getByRole('status').textContent).toContain('"editing":true');
  act(() => { viewport.height = 410; viewport.dispatchEvent(new Event('resize')); });
  expect(screen.getByRole('status').textContent).toContain('"height":410');
  act(() => screen.getByRole('button').focus());
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('"editing":false'));
});
it('leaves desktop navigation alone', () => {
  vi.stubGlobal('React', React);
  render(<Harness mobile={false} />);
  act(() => screen.getByRole('textbox').focus());
  expect(screen.getByRole('status').textContent).toContain('"editing":false');
});
