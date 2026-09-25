import { normalizePlayerProfile, validatePlayerProfile } from './domain.js';
import {
  PlayerProfileError,
  PROFILE_ERROR_CODES
} from './contracts.js';

export const GUEST_PROFILE_STORAGE_KEY = 'full-court-player-profile-v2';

const SYNC_STATES = new Set(['local', 'pending', 'synced', 'error']);

function defaultRandomUuid() {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('crypto.randomUUID is unavailable');
  }
  return globalThis.crypto.randomUUID();
}

function normalizeEnvelope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('guest profile is not an object');
  }
  if (typeof value.localId !== 'string' || !value.localId) {
    throw new Error('guest profile localId is missing');
  }
  if (value.schemaVersion !== 1) {
    throw new Error('guest profile schema version is unsupported');
  }
  const status = value.sync?.status;
  if (!SYNC_STATES.has(status)) throw new Error('guest profile sync state is invalid');

  const validation = validatePlayerProfile(value.data);
  if (!validation.valid) throw new Error(`guest profile is invalid: ${validation.errors.join(',')}`);

  return {
    localId: value.localId,
    schemaVersion: 1,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    sync: {
      status,
      syncedUserId: value.sync?.syncedUserId ?? null,
      syncedAt: value.sync?.syncedAt ?? null,
      lastErrorCode: value.sync?.lastErrorCode ?? null
    },
    data: validation.profile
  };
}

export function createLocalPlayerProfileRepository({
  storage,
  now = () => new Date().toISOString(),
  randomUUID = defaultRandomUuid
}) {
  if (!storage?.getItem || !storage?.setItem) throw new TypeError('storage is required');

  function read() {
    let raw;
    try {
      raw = storage.getItem(GUEST_PROFILE_STORAGE_KEY);
    } catch (error) {
      throw new PlayerProfileError(
        PROFILE_ERROR_CODES.STORAGE_READ_FAILED,
        '无法读取本地球员档案。',
        { cause: error }
      );
    }
    if (raw === null) return null;
    try {
      return normalizeEnvelope(JSON.parse(raw));
    } catch (error) {
      throw new PlayerProfileError(
        PROFILE_ERROR_CODES.STORAGE_READ_FAILED,
        '本地球员档案格式无效，原数据已保留。',
        { cause: error }
      );
    }
  }

  function write(envelope) {
    try {
      storage.setItem(GUEST_PROFILE_STORAGE_KEY, JSON.stringify(envelope));
      return envelope;
    } catch (error) {
      throw new PlayerProfileError(
        PROFILE_ERROR_CODES.STORAGE_WRITE_FAILED,
        '无法保存本地球员档案。',
        { cause: error }
      );
    }
  }

  function save(input) {
    const current = read();
    const validation = validatePlayerProfile(input);
    if (!validation.valid) {
      throw new PlayerProfileError(
        PROFILE_ERROR_CODES.INVALID_PROFILE,
        `球员档案包含无效字段：${validation.errors.join(',')}`
      );
    }
    const timestamp = now();
    const wasSynced = current?.sync.status === 'synced';
    return write({
      localId: current?.localId ?? randomUUID(),
      schemaVersion: 1,
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp,
      sync: {
        status: wasSynced ? 'pending' : 'local',
        syncedUserId: current?.sync.syncedUserId ?? null,
        syncedAt: wasSynced ? current.sync.syncedAt : null,
        lastErrorCode: null
      },
      data: normalizePlayerProfile(validation.profile)
    });
  }

  function markSyncState(status, details = {}) {
    if (!SYNC_STATES.has(status)) throw new TypeError(`Unsupported sync state: ${status}`);
    const current = read();
    if (!current) return null;
    return write({
      ...current,
      sync: {
        status,
        syncedUserId: details.syncedUserId ?? current.sync.syncedUserId ?? null,
        syncedAt: details.syncedAt ?? current.sync.syncedAt ?? null,
        lastErrorCode: details.lastErrorCode ?? null
      }
    });
  }

  return { read, save, markSyncState };
}
