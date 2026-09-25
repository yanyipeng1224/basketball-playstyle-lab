import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLocalPlayerProfileRepository,
  GUEST_PROFILE_STORAGE_KEY
} from '../src/player-profile/local-repository.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const calls = [];
  return {
    calls,
    getItem(key) { calls.push(['get', key]); return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { calls.push(['set', key]); values.set(key, value); },
    raw(key) { return values.get(key); }
  };
}

test('guest profile keeps a stable local id and original creation time', () => {
  const storage = memoryStorage();
  const times = ['2026-09-25T01:00:00.000Z', '2026-09-25T02:00:00.000Z'];
  const repository = createLocalPlayerProfileRepository({
    storage,
    now: () => times.shift(),
    randomUUID: () => '10000000-0000-4000-8000-000000000001'
  });

  const first = repository.save({ heightCm: 180 });
  const second = repository.save({ heightCm: 181 });
  assert.equal(second.localId, first.localId);
  assert.equal(second.createdAt, first.createdAt);
  assert.notEqual(second.updatedAt, first.updatedAt);
  assert.equal(repository.read().data.heightCm, 181);
});

test('editing a synced guest profile marks it pending without losing its account link', () => {
  const storage = memoryStorage();
  const repository = createLocalPlayerProfileRepository({
    storage,
    now: () => '2026-09-25T01:00:00.000Z',
    randomUUID: () => '10000000-0000-4000-8000-000000000002'
  });
  repository.save({ heightCm: 180 });
  repository.markSyncState('synced', {
    syncedUserId: 'user-a',
    syncedAt: '2026-09-25T01:05:00.000Z'
  });

  const updated = repository.save({ heightCm: 182 });
  assert.equal(updated.sync.status, 'pending');
  assert.equal(updated.sync.syncedUserId, 'user-a');
  assert.equal(updated.sync.syncedAt, '2026-09-25T01:05:00.000Z');
});

test('invalid stored JSON is reported and never overwritten by save', () => {
  const storage = memoryStorage({ [GUEST_PROFILE_STORAGE_KEY]: '{broken-json' });
  const repository = createLocalPlayerProfileRepository({
    storage,
    randomUUID: () => '10000000-0000-4000-8000-000000000003'
  });

  assert.throws(() => repository.save({ heightCm: 180 }), error => {
    assert.equal(error.code, 'storage_read_failed');
    return true;
  });
  assert.equal(storage.raw(GUEST_PROFILE_STORAGE_KEY), '{broken-json');
});

test('guest profile repository never touches legacy guest keys', () => {
  const storage = memoryStorage();
  const repository = createLocalPlayerProfileRepository({
    storage,
    randomUUID: () => '10000000-0000-4000-8000-000000000004'
  });
  repository.save({ weightKg: 70 });
  repository.read();

  const touchedKeys = new Set(storage.calls.map(([, key]) => key));
  assert.deepEqual([...touchedKeys], [GUEST_PROFILE_STORAGE_KEY]);
  assert.equal(touchedKeys.has('full-court-shots-v1'), false);
  assert.equal(touchedKeys.has('full-court-training-v1'), false);
});

test('failed local writes leave the previously stored profile intact', () => {
  const initial = JSON.stringify({
    localId: '10000000-0000-4000-8000-000000000005',
    schemaVersion: 1,
    createdAt: '2026-09-25T01:00:00.000Z',
    updatedAt: '2026-09-25T01:00:00.000Z',
    sync: { status: 'local', syncedUserId: null, syncedAt: null, lastErrorCode: null },
    data: { heightCm: 180 }
  });
  const values = new Map([[GUEST_PROFILE_STORAGE_KEY, initial]]);
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem() { throw new Error('quota exceeded'); }
  };
  const repository = createLocalPlayerProfileRepository({ storage });

  assert.throws(() => repository.save({ heightCm: 181 }), error => {
    assert.equal(error.code, 'storage_write_failed');
    return true;
  });
  assert.equal(values.get(GUEST_PROFILE_STORAGE_KEY), initial);
});
