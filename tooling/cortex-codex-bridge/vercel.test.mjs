import { it } from 'node:test';
import assert from 'node:assert/strict';
import { publishConnection, tunnelAddress } from './vercel.mjs';

const config = { vercelProject: 'test-project', token: 'private-test-token' };
it('ignores the Cloudflare API address in errors and finds the actual tunnel', () => {
  assert.equal(tunnelAddress('error at https://api.trycloudflare.com'), null);
  assert.equal(tunnelAddress('https://api.trycloudflare.com then https://real-live-tunnel.trycloudflare.com'), 'https://real-live-tunnel.trycloudflare.com');
});
it('updates production credentials and waits for a ready deployment', async () => {
  let saved, polls = 0;
  const calls = [];
  const api = async (endpoint, options) => {
    calls.push([endpoint, options]);
    if (endpoint.startsWith('/v9/projects')) return { name: 'cortex', targets: { production: { id: 'old' } } };
    if (endpoint.includes('/env?')) return { envs: [] };
    if (endpoint === '/v13/deployments') return { id: 'new' };
    return { readyState: ++polls === 1 ? 'BUILDING' : 'READY', url: 'cortex.vercel.app' };
  };
  await publishConnection(config, 'https://real-live-tunnel.trycloudflare.com', { api, save: async v => saved = v, wait: async () => {} });
  assert.equal(polls, 2);
  assert.equal(saved.deploymentId, 'new');
  assert.ok(saved.connectedAt);
  assert.equal(calls[1][1].body[1].type, 'sensitive');
  assert.equal(calls[1][1].body[0].target[0], 'production');
});
it('resumes a pending deployment after a network failure instead of repeatedly rebuilding', async () => {
  const pending = { url: 'https://real-live-tunnel.trycloudflare.com', deploymentId: 'pending' };
  const api = async endpoint => {
    if (endpoint.startsWith('/v9/projects')) return { name: 'cortex' };
    if (endpoint.includes('/env?')) return {};
    assert.equal(endpoint, '/v13/deployments/pending');
    return { readyState: 'READY' };
  };
  assert.equal((await publishConnection(config, pending.url, { api, load: async () => pending })).deploymentId, 'pending');
});
it('does not mark a failed deployment connected', async () => {
  let saved;
  const api = async endpoint => endpoint.startsWith('/v9/projects') ? { name: 'cortex' }
    : endpoint.includes('/env?') ? {} : { readyState: 'ERROR' };
  await assert.rejects(publishConnection(config, 'https://live-tunnel.trycloudflare.com', {
    api, load: async () => ({url:'https://live-tunnel.trycloudflare.com',deploymentId:'bad'}), save: async v => saved = v,
  }), /deployment failed/);
  assert.equal(saved.deploymentId, undefined);
});
