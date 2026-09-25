import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthAdapter } from '../src/platform/auth-adapter.js';
import { createAiProvider } from '../src/platform/ai-provider.js';

test('auth adapter reads the current user without changing auth behavior', async () => {
  let calls = 0;
  const expectedUser = { id: 'user-a', email: 'player@example.com' };
  const adapter = createAuthAdapter({
    supabase: {
      auth: {
        async getSession() {
          calls += 1;
          return { data: { session: { user: expectedUser } }, error: null };
        }
      }
    }
  });

  assert.equal(await adapter.getCurrentUser(), expectedUser);
  assert.equal(calls, 1);
});

test('auth adapter returns null for the existing signed-out session shape', async () => {
  const adapter = createAuthAdapter({
    supabase: { auth: { getSession: async () => ({ data: { session: null }, error: null }) } }
  });
  assert.equal(await adapter.getCurrentUser(), null);
});

test('auth adapter preserves the existing Supabase session error', async () => {
  const expected = new Error('session failed');
  const adapter = createAuthAdapter({
    supabase: { auth: { getSession: async () => ({ data: null, error: expected }) } }
  });
  await assert.rejects(adapter.getCurrentUser(), error => error === expected);
});

test('AI provider forwards the current type, body and return value unchanged', async () => {
  const calls = [];
  const response = { report: { summary: '保持当前返回结构' }, remaining: 29 };
  const provider = createAiProvider({
    async invokeExisting(type, data) {
      calls.push({ type, data });
      return response;
    }
  });
  const body = { height: 180, baseline: { role: '双能卫' } };

  assert.equal(await provider.invoke('profile', body), response);
  assert.deepEqual(calls, [{ type: 'profile', data: body }]);
});

test('AI provider preserves existing rejection behavior', async () => {
  const expected = new Error('existing AI error');
  const provider = createAiProvider({ invokeExisting: async () => { throw expected; } });
  await assert.rejects(provider.invoke('profile', {}), error => error === expected);
});
