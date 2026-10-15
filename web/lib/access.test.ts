import { afterEach, expect, it, vi } from 'vitest';
import { hasSession, sessionCookie } from './auth';
import { readAuthorized, apiAuthorized } from './apiauth';
afterEach(() => vi.unstubAllEnvs());
it('protects reads and writes, allowing only a session or explicit API token', () => {
  vi.stubEnv('APP_PASSWORD', 'test-only-password');
  vi.stubEnv('AUTH_SECRET', 'test-only-session-secret');
  vi.stubEnv('API_TOKEN', 'test-only-api-token');
  const anonymous = new Request('http://localhost/api/tasks');
  expect(hasSession(anonymous)).toBe(false);
  expect(readAuthorized(anonymous)).toBe(false);
  expect(apiAuthorized(anonymous)).toBe(false);
  const signedIn = new Request(anonymous, { headers: { cookie: sessionCookie().split(';')[0] } });
  expect(hasSession(signedIn)).toBe(true);
  expect(readAuthorized(signedIn)).toBe(true);
  expect(readAuthorized(new Request(anonymous, { headers: { authorization: 'Bearer test-only-api-token' } }))).toBe(true);
});
it('rejects an origin that merely starts with the configured origin', () => {
  vi.stubEnv('APP_PASSWORD', ''); vi.stubEnv('ALLOWED_EMAILS', '');
  vi.stubEnv('APP_ORIGIN', 'https://cortex.example.com'); vi.stubEnv('API_TOKEN', 'test-only-api-token');
  expect(apiAuthorized(new Request('https://cortex.example.com/api/tasks', { headers: { origin: 'https://cortex.example.com.evil.example' } }))).toBe(false);
});
