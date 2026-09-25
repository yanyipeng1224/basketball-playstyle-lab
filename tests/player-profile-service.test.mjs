import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerProfileService } from '../src/player-profile/service.js';

function localRepository(initial = null) {
  let value = initial;
  return {
    read: () => value,
    save(profile) {
      value = {
        localId: value?.localId ?? '10000000-0000-4000-8000-000000000001',
        data: profile,
        sync: { status: 'local', syncedUserId: null, syncedAt: null, lastErrorCode: null }
      };
      return value;
    },
    markSyncState(status, details = {}) {
      value = {
        ...value,
        sync: {
          ...value.sync,
          status,
          syncedUserId: details.syncedUserId ?? value.sync.syncedUserId,
          syncedAt: details.syncedAt ?? value.sync.syncedAt,
          lastErrorCode: details.lastErrorCode ?? null
        }
      };
      return value;
    },
    current: () => value
  };
}

function cloudRepository(initial = null) {
  let value = initial;
  let insertCount = 0;
  let upsertCount = 0;
  return {
    readCurrent: async () => value,
    async upsertCurrent(userId, data, metadata = {}) {
      upsertCount += 1;
      value = { userId, data, sourceLocalId: metadata.sourceLocalId ?? value?.sourceLocalId ?? null };
      return value;
    },
    async insertIfAbsent(userId, data, metadata = {}) {
      insertCount += 1;
      if (value) return { status: 'conflict', record: value };
      value = { userId, data, sourceLocalId: metadata.sourceLocalId ?? null };
      return { status: 'inserted', record: value };
    },
    findLegacyCandidates: async () => [],
    counts: () => ({ insertCount, upsertCount }),
    current: () => value
  };
}

const auth = userId => ({ getCurrentUser: async () => userId ? { id: userId } : null });

function guestEnvelope(overrides = {}) {
  return {
    localId: '10000000-0000-4000-8000-000000000001',
    data: { heightCm: 180 },
    sync: { status: 'local', syncedUserId: null, syncedAt: null, lastErrorCode: null },
    ...overrides
  };
}

test('signed-out saves stay local', async () => {
  const local = localRepository();
  const cloud = cloudRepository();
  const service = createPlayerProfileService({ localRepository: local, cloudRepository: cloud, authAdapter: auth(null) });
  const result = await service.saveCurrent({ heightCm: 180 });
  assert.equal(result.status, 'saved_guest');
  assert.equal(local.current().data.heightCm, 180);
  assert.deepEqual(cloud.counts(), { insertCount: 0, upsertCount: 0 });
});

test('signed-in regular saves upsert one cloud profile', async () => {
  const cloud = cloudRepository();
  const service = createPlayerProfileService({ localRepository: localRepository(), cloudRepository: cloud, authAdapter: auth('user-a') });
  await service.saveCurrent({ heightCm: 180 });
  await service.saveCurrent({ heightCm: 181 });
  assert.deepEqual(cloud.counts(), { insertCount: 0, upsertCount: 2 });
  assert.equal(cloud.current().data.heightCm, 181);
});

test('guest sync is insert-only and marks local data only after confirmation', async () => {
  const local = localRepository(guestEnvelope());
  const cloud = cloudRepository();
  const service = createPlayerProfileService({
    localRepository: local,
    cloudRepository: cloud,
    authAdapter: auth('user-a'),
    now: () => '2026-09-25T03:00:00.000Z'
  });
  const result = await service.syncGuestToCurrentUser();
  assert.equal(result.status, 'synced');
  assert.deepEqual(cloud.counts(), { insertCount: 1, upsertCount: 0 });
  assert.equal(local.current().sync.status, 'synced');
  assert.equal(local.current().sync.syncedAt, '2026-09-25T03:00:00.000Z');
});

test('guest sync never overwrites an existing cloud profile', async () => {
  const local = localRepository(guestEnvelope());
  const cloud = cloudRepository({ userId: 'user-a', data: { heightCm: 190 }, sourceLocalId: null });
  const service = createPlayerProfileService({ localRepository: local, cloudRepository: cloud, authAdapter: auth('user-a') });
  const result = await service.syncGuestToCurrentUser();
  assert.equal(result.status, 'conflict');
  assert.equal(cloud.current().data.heightCm, 190);
  assert.deepEqual(cloud.counts(), { insertCount: 0, upsertCount: 0 });
});

test('retrying a confirmed guest sync does not insert again', async () => {
  const localId = '10000000-0000-4000-8000-000000000001';
  const local = localRepository(guestEnvelope({
    sync: { status: 'error', syncedUserId: 'user-a', syncedAt: null, lastErrorCode: 'network' }
  }));
  const cloud = cloudRepository({ userId: 'user-a', data: { heightCm: 180 }, sourceLocalId: localId });
  const service = createPlayerProfileService({ localRepository: local, cloudRepository: cloud, authAdapter: auth('user-a') });
  const result = await service.syncGuestToCurrentUser();
  assert.equal(result.status, 'already_synced');
  assert.deepEqual(cloud.counts(), { insertCount: 0, upsertCount: 0 });
  assert.equal(local.current().sync.status, 'synced');
});

test('locally edited data remains a conflict even when its local id matches cloud', async () => {
  const localId = '10000000-0000-4000-8000-000000000001';
  const local = localRepository(guestEnvelope({
    data: { heightCm: 181 },
    sync: { status: 'pending', syncedUserId: 'user-a', syncedAt: 'earlier', lastErrorCode: null }
  }));
  const cloud = cloudRepository({ userId: 'user-a', data: { heightCm: 180 }, sourceLocalId: localId });
  const service = createPlayerProfileService({ localRepository: local, cloudRepository: cloud, authAdapter: auth('user-a') });
  const result = await service.loadCurrent();
  assert.equal(result.status, 'conflict');
  assert.equal(result.reason, 'cloud_guest_conflict');
});

test('a guest linked to another account requires explicit conflict handling', async () => {
  const local = localRepository(guestEnvelope({
    sync: { status: 'synced', syncedUserId: 'user-a', syncedAt: 'earlier', lastErrorCode: null }
  }));
  const cloud = cloudRepository();
  const service = createPlayerProfileService({ localRepository: local, cloudRepository: cloud, authAdapter: auth('user-b') });
  const result = await service.syncGuestToCurrentUser();
  assert.equal(result.reason, 'cross_account_guest');
  assert.deepEqual(cloud.counts(), { insertCount: 0, upsertCount: 0 });
});

test('cloud replacement requires an explicit confirmation flag', async () => {
  const local = localRepository(guestEnvelope());
  const cloud = cloudRepository({ userId: 'user-a', data: { heightCm: 190 }, sourceLocalId: null });
  const service = createPlayerProfileService({ localRepository: local, cloudRepository: cloud, authAdapter: auth('user-a') });
  await assert.rejects(service.replaceCloudWithGuest(), error => error.code === 'cloud_conflict');
  assert.equal(cloud.current().data.heightCm, 190);
  const result = await service.replaceCloudWithGuest({ confirmed: true });
  assert.equal(result.status, 'replaced');
  assert.equal(cloud.current().data.heightCm, 180);
});

test('failed guest sync records an error but retains local profile data', async () => {
  const local = localRepository(guestEnvelope());
  const expected = Object.assign(new Error('network failed'), { code: 'cloud_write_failed' });
  const cloud = cloudRepository();
  cloud.insertIfAbsent = async () => { throw expected; };
  const service = createPlayerProfileService({ localRepository: local, cloudRepository: cloud, authAdapter: auth('user-a') });
  await assert.rejects(service.syncGuestToCurrentUser(), error => error === expected);
  assert.equal(local.current().sync.status, 'error');
  assert.equal(local.current().data.heightCm, 180);
});
