import { it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CodexAppServer } from './app-server.mjs';

it('keeps chat threads separate, resumes their own history, and preserves the legacy thread', async () => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'cortex-threads-'));
  let count = 0;
  const calls = [];
  function client() {
    const app = new CodexAppServer({ stateDir });
    app.start = async () => {};
    app.call = async (method, params) => {
      calls.push({ method, ...params });
      if (method === 'thread/start') return { thread: { id: `thread-${++count}` } };
      if (method === 'thread/resume') return { thread: { id: params.threadId } };
      if (method === 'turn/start') {
        const turn = app.activeTurn;
        app.activeTurn = null;
        clearTimeout(turn.timer);
        turn.resolve('READY');
        return { turn: { id: 'turn' } };
      }
    };
    return app;
  }
  try {
    const app = client();
    for (const conversationId of ['default', 'chat-a', 'chat-b', 'chat-a']) await app.prompt({ prompt: 'hello', conversationId });
    assert.deepEqual(calls.filter(c => c.method === 'turn/start').map(c => c.threadId), ['thread-1', 'thread-2', 'thread-3', 'thread-2']);
    const restarted = client();
    await restarted.prompt({ prompt: 'again', conversationId: 'chat-b' });
    assert.equal(calls.at(-1).threadId, 'thread-3');
    await restarted.prompt({ prompt: 'legacy' });
    assert.equal(calls.at(-1).threadId, 'thread-1');
    await assert.rejects(restarted.prompt({ prompt: 'bad', conversationId: '../escape' }), /Invalid conversation/);
  } finally { await rm(stateDir, { recursive: true, force: true }); }
});
