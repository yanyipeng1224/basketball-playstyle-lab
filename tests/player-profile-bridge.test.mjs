import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlayerProfileBridge,
  profileToExistingForm
} from '../src/player-profile/bridge.js';
import { GUEST_PROFILE_STORAGE_KEY } from '../src/player-profile/local-repository.js';

function storage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    value: key => values.get(key)
  };
}

test('static-page bridge saves the existing form as a guest without Supabase', async () => {
  const localStorage = storage();
  const bridge = createPlayerProfileBridge({
    supabase: null,
    storage: localStorage,
    invokeExistingAi: async () => ({}),
    now: () => '2026-09-25T05:00:00.000Z',
    randomUUID: () => '10000000-0000-4000-8000-000000000020'
  });
  const result = await bridge.saveFromExistingForm({
    height: 180,
    weight: 75,
    frequency: 4,
    shooting: 7,
    handling: 8
  }, { roleKey: 'combo' });
  assert.equal(result.status, 'saved_guest');
  assert.equal(result.profile.skills.ballHandling, 8);
  assert.equal(JSON.parse(localStorage.value(GUEST_PROFILE_STORAGE_KEY)).localId, '10000000-0000-4000-8000-000000000020');
});

test('bridge delegates profile AI requests without changing their body or response', async () => {
  const calls = [];
  const response = { report: { summary: 'unchanged' } };
  const bridge = createPlayerProfileBridge({
    supabase: null,
    storage: storage(),
    invokeExistingAi: async (type, data) => { calls.push({ type, data }); return response; },
    randomUUID: () => '10000000-0000-4000-8000-000000000021'
  });
  const body = { height: 180, baseline: { role: '双能卫' } };
  assert.equal(await bridge.invokeAi('profile', body), response);
  assert.deepEqual(calls, [{ type: 'profile', data: body }]);
});

test('canonical profile maps back to only the existing form fields', () => {
  assert.deepEqual(profileToExistingForm({
    heightCm: 181,
    weightKg: 76,
    trainingFrequency: 3,
    currentGoal: null,
    skills: { shooting: 7, ballHandling: 8 }
  }), {
    height: 181,
    weight: 76,
    frequency: 3,
    shooting: 7,
    finishing: null,
    handling: 8,
    passing: null,
    defense: null,
    rebounding: null,
    speed: null,
    strength: null,
    stamina: null,
    goal: null
  });
});
