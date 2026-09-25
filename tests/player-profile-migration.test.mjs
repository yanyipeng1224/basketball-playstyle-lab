import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLegacyProfileMigrator,
  selectLegacyProfileCandidate
} from '../src/player-profile/legacy-migration.js';
import { createPlayerProfileService } from '../src/player-profile/service.js';

function formValues(overrides = {}) {
  return {
    height: 180,
    weight: 75,
    frequency: 4,
    shooting: 7,
    finishing: 6,
    handling: 8,
    passing: 6,
    defense: 6,
    rebounding: 5,
    speed: 7,
    strength: 6,
    stamina: 7,
    ...overrides
  };
}

test('latest explicit saved profile wins over a newer AI analysis candidate', () => {
  const candidate = selectLegacyProfileCandidate([
    {
      id: 'analysis-newer',
      title: '打法分析',
      created_at: '2026-09-25T03:00:00.000Z',
      payload: { player: formValues({ height: 190 }), baseline: { role: '双能卫' }, report: { summary: 'AI text' } }
    },
    {
      id: 'manual-newest',
      title: '球员档案与本地训练计划',
      created_at: '2026-09-25T02:00:00.000Z',
      payload: { ...formValues({ height: 181 }), baseline: { roleKey: 'creator' } }
    },
    {
      id: 'manual-older',
      title: '球员档案与本地训练计划',
      created_at: '2026-09-25T01:00:00.000Z',
      payload: formValues({ height: 179 })
    }
  ]);

  assert.equal(candidate.record.id, 'manual-newest');
  assert.equal(candidate.profile.heightCm, 181);
  assert.equal(candidate.profile.playstyle.type, 'creator');
});

test('legacy migration leaves unavailable fields null and ignores AI prose', () => {
  const candidate = selectLegacyProfileCandidate([{
    id: 'analysis',
    title: '打法分析',
    created_at: '2026-09-25T01:00:00.000Z',
    payload: {
      player: formValues(),
      baseline: { role: '双能卫' },
      report: { summary: '他可能是一名右手后卫，昵称应该是小明。' }
    }
  }]);
  assert.equal(candidate.profile.nickname, null);
  assert.equal(candidate.profile.dominantHand, null);
  assert.equal(candidate.profile.position, null);
  assert.equal(candidate.profile.playstyle.name, '双能卫');
});

test('unreliable legacy payload is not migrated', () => {
  assert.equal(selectLegacyProfileCandidate([{
    id: 'bad',
    title: '球员档案与本地训练计划',
    created_at: '2026-09-25T01:00:00.000Z',
    payload: { height: 180 }
  }]), null);
});

test('existing new profile prevents any legacy candidate query or write', async () => {
  let queries = 0;
  let inserts = 0;
  const existing = { userId: 'user-a', data: { heightCm: 185 } };
  const migrator = createLegacyProfileMigrator({
    cloudRepository: {
      readCurrent: async () => existing,
      findLegacyCandidates: async () => { queries += 1; return []; },
      insertIfAbsent: async () => { inserts += 1; }
    }
  });
  const result = await migrator.migrateForUser('user-a');
  assert.equal(result.status, 'skipped_existing');
  assert.equal(queries, 0);
  assert.equal(inserts, 0);
});

test('lazy migration is insert-only and records its source version', async () => {
  let metadata;
  let insertCount = 0;
  const record = {
    id: '10000000-0000-4000-8000-000000000010',
    title: '球员档案与本地训练计划',
    created_at: '2026-09-25T01:00:00.000Z',
    payload: formValues()
  };
  const cloudRepository = {
    readCurrent: async () => null,
    findLegacyCandidates: async () => [record],
    async insertIfAbsent(userId, profile, nextMetadata) {
      insertCount += 1;
      metadata = nextMetadata;
      return { status: 'inserted', record: { userId, data: profile, sourceLocalId: null } };
    }
  };
  const migrator = createLegacyProfileMigrator({
    cloudRepository,
    now: () => '2026-09-25T04:00:00.000Z'
  });
  const result = await migrator.migrateForUser('user-a');
  assert.equal(result.status, 'migrated');
  assert.equal(insertCount, 1);
  assert.deepEqual(metadata, {
    origin: 'legacy_app_record',
    legacyAppRecordId: record.id,
    legacyMigrationVersion: 1,
    legacyMigratedAt: '2026-09-25T04:00:00.000Z'
  });
});

test('a concurrent new profile wins without being overwritten', async () => {
  const winner = { userId: 'user-a', data: { heightCm: 188 }, sourceLocalId: null };
  const migrator = createLegacyProfileMigrator({
    cloudRepository: {
      readCurrent: async () => null,
      findLegacyCandidates: async () => [{
        id: '10000000-0000-4000-8000-000000000011',
        title: '球员档案与本地训练计划',
        created_at: '2026-09-25T01:00:00.000Z',
        payload: formValues()
      }],
      insertIfAbsent: async () => ({ status: 'conflict', record: winner })
    }
  });
  const result = await migrator.migrateForUser('user-a');
  assert.equal(result.status, 'skipped_concurrent');
  assert.equal(result.record, winner);
});

test('service only attempts lazy migration after cloud and guest are both absent', async () => {
  let migrationCalls = 0;
  const migrated = { userId: 'user-a', data: { heightCm: 180 }, sourceLocalId: null };
  const service = createPlayerProfileService({
    localRepository: { read: () => null, save() {}, markSyncState() {} },
    cloudRepository: {
      readCurrent: async () => null,
      upsertCurrent() {},
      insertIfAbsent() {},
      findLegacyCandidates() {}
    },
    authAdapter: { getCurrentUser: async () => ({ id: 'user-a' }) },
    legacyMigrator: {
      async migrateForUser() { migrationCalls += 1; return { status: 'migrated', record: migrated }; }
    }
  });
  const result = await service.loadCurrent();
  assert.equal(migrationCalls, 1);
  assert.equal(result.source, 'legacy_migration');
  assert.equal(result.profile.heightCm, 180);
});
