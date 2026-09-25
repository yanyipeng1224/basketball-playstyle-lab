import { validatePlayerProfile } from './domain.js';
import {
  assertAuthAdapter,
  assertCloudProfileRepository,
  assertLocalProfileRepository,
  PlayerProfileError,
  PROFILE_ERROR_CODES
} from './contracts.js';

export function createPlayerProfileService({
  localRepository,
  cloudRepository,
  authAdapter,
  legacyMigrator = null,
  now = () => new Date().toISOString()
}) {
  assertLocalProfileRepository(localRepository);
  assertCloudProfileRepository(cloudRepository);
  assertAuthAdapter(authAdapter);

  async function currentUser() {
    return authAdapter.getCurrentUser();
  }

  function validProfile(input) {
    const validation = validatePlayerProfile(input);
    if (!validation.valid) {
      throw new PlayerProfileError(
        PROFILE_ERROR_CODES.INVALID_PROFILE,
        `球员档案包含无效字段：${validation.errors.join(',')}`
      );
    }
    return validation.profile;
  }

  async function loadCurrent() {
    const user = await currentUser();
    const guest = localRepository.read();
    if (!user) {
      return { status: guest ? 'guest' : 'empty', source: 'guest', guest, profile: guest?.data ?? null };
    }

    const cloud = await cloudRepository.readCurrent(user.id);
    if (!cloud) {
      if (!guest) {
        if (legacyMigrator?.migrateForUser) {
          const migration = await legacyMigrator.migrateForUser(user.id);
          if (migration.record) {
            return {
              status: 'cloud',
              source: migration.status === 'migrated' ? 'legacy_migration' : 'cloud',
              user,
              cloud: migration.record,
              guest: null,
              profile: migration.record.data,
              migration
            };
          }
          return { status: 'empty', source: 'cloud', user, cloud: null, guest: null, profile: null, migration };
        }
        return { status: 'empty', source: 'cloud', user, cloud: null, guest: null, profile: null };
      }
      if (guest.sync.syncedUserId && guest.sync.syncedUserId !== user.id) {
        return { status: 'conflict', reason: 'cross_account_guest', user, cloud: null, guest };
      }
      return { status: 'guest_available', user, cloud: null, guest, profile: guest.data };
    }

    if (!guest || (
      guest.sync.status === 'synced'
      && guest.sync.syncedUserId === user.id
      && cloud.sourceLocalId === guest.localId
    )) {
      return { status: 'cloud', source: 'cloud', user, cloud, guest, profile: cloud.data };
    }

    return {
      status: 'conflict',
      reason: guest.sync.syncedUserId && guest.sync.syncedUserId !== user.id
        ? 'cross_account_guest'
        : 'cloud_guest_conflict',
      user,
      cloud,
      guest
    };
  }

  async function saveCurrent(input) {
    const profile = validProfile(input);
    const user = await currentUser();
    if (!user) {
      const guest = localRepository.save(profile);
      return { status: 'saved_guest', profile: guest.data, guest };
    }
    const cloud = await cloudRepository.upsertCurrent(user.id, profile);
    return { status: 'saved_cloud', profile: cloud.data, cloud };
  }

  async function syncGuestToCurrentUser() {
    const user = await currentUser();
    if (!user) throw new PlayerProfileError(PROFILE_ERROR_CODES.NOT_AUTHENTICATED, '请先登录。');
    const guest = localRepository.read();
    if (!guest) return { status: 'no_guest' };
    if (guest.sync.syncedUserId && guest.sync.syncedUserId !== user.id) {
      return { status: 'conflict', reason: 'cross_account_guest', guest };
    }

    const existing = await cloudRepository.readCurrent(user.id);
    if (existing) {
      if (existing.sourceLocalId === guest.localId) {
        localRepository.markSyncState('synced', {
          syncedUserId: user.id,
          syncedAt: guest.sync.syncedAt ?? now()
        });
        return { status: 'already_synced', cloud: existing };
      }
      return { status: 'conflict', reason: 'cloud_guest_conflict', cloud: existing, guest };
    }

    localRepository.markSyncState('pending', { syncedUserId: user.id });
    try {
      const result = await cloudRepository.insertIfAbsent(user.id, guest.data, {
        origin: 'guest_sync',
        sourceLocalId: guest.localId
      });
      const confirmed = result.record ?? await cloudRepository.readCurrent(user.id);
      if (!confirmed || confirmed.sourceLocalId !== guest.localId) {
        localRepository.markSyncState('error', {
          syncedUserId: user.id,
          lastErrorCode: PROFILE_ERROR_CODES.CLOUD_CONFLICT
        });
        return { status: 'conflict', reason: 'cloud_guest_conflict', cloud: confirmed, guest };
      }
      localRepository.markSyncState('synced', {
        syncedUserId: user.id,
        syncedAt: now()
      });
      return { status: result.status === 'inserted' ? 'synced' : 'already_synced', cloud: confirmed };
    } catch (error) {
      localRepository.markSyncState('error', {
        syncedUserId: user.id,
        lastErrorCode: error.code ?? PROFILE_ERROR_CODES.CLOUD_WRITE_FAILED
      });
      throw error;
    }
  }

  async function replaceCloudWithGuest({ confirmed = false } = {}) {
    if (!confirmed) throw new PlayerProfileError(PROFILE_ERROR_CODES.CLOUD_CONFLICT, '需要明确确认覆盖。');
    const user = await currentUser();
    if (!user) throw new PlayerProfileError(PROFILE_ERROR_CODES.NOT_AUTHENTICATED, '请先登录。');
    const guest = localRepository.read();
    if (!guest) return { status: 'no_guest' };
    const cloud = await cloudRepository.upsertCurrent(user.id, validProfile(guest.data), {
      origin: 'guest_sync',
      sourceLocalId: guest.localId
    });
    localRepository.markSyncState('synced', {
      syncedUserId: user.id,
      syncedAt: now()
    });
    return { status: 'replaced', cloud };
  }

  return { loadCurrent, saveCurrent, syncGuestToCurrentUser, replaceCloudWithGuest };
}
