// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
beforeEach(() => { vi.resetModules(); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('opens Google immediately after preloading and reports blocked popups', async () => {
  const requestAccessToken = vi.fn();
  const clients: any[] = [];
  vi.stubGlobal('google', { accounts: { oauth2: { initTokenClient: (options: any) => { clients.push(options); return {requestAccessToken}; } } } });
  const auth = await import('./google');
  await auth.googlePrepareSignIn();
  const result = auth.googleSignIn();
  expect(requestAccessToken).toHaveBeenCalledWith({prompt:'consent'});
  clients.at(-1).error_callback({type:'popup_failed_to_open'});
  await expect(result).rejects.toThrow('blocked');
  const retry = auth.googleSignIn();
  clients.at(-1).callback({access_token:'test-token', expires_in:3600});
  await retry;
  expect(auth.googleConnected()).toBe(true);
});
it('does not leave a closed popup or missing callback pending forever', async () => {
  vi.useFakeTimers();
  const clients: any[] = [];
  vi.stubGlobal('google', { accounts: { oauth2: { initTokenClient: (options: any) => { clients.push(options); return {requestAccessToken:vi.fn()}; } } } });
  const auth = await import('./google');
  await auth.googlePrepareSignIn();
  const closed = auth.googleSignIn();
  clients.at(-1).error_callback({type:'popup_closed'});
  await expect(closed).rejects.toThrow('closed');
  const timeout = expect(auth.googleSignIn()).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(90000);
  await timeout;
});
