export const PROFILE_ERROR_CODES = Object.freeze({
  INVALID_PROFILE: 'invalid_profile',
  NOT_AUTHENTICATED: 'not_authenticated',
  CLOUD_CONFLICT: 'cloud_conflict',
  CROSS_ACCOUNT_GUEST: 'cross_account_guest',
  STORAGE_READ_FAILED: 'storage_read_failed',
  STORAGE_WRITE_FAILED: 'storage_write_failed',
  CLOUD_READ_FAILED: 'cloud_read_failed',
  CLOUD_WRITE_FAILED: 'cloud_write_failed'
});

export class PlayerProfileError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'PlayerProfileError';
    this.code = code;
  }
}

export function assertMethods(value, label, methods) {
  if (!value || typeof value !== 'object') throw new TypeError(`${label} is required`);
  methods.forEach(method => {
    if (typeof value[method] !== 'function') {
      throw new TypeError(`${label}.${method} must be a function`);
    }
  });
  return value;
}

export function assertLocalProfileRepository(repository) {
  return assertMethods(repository, 'localProfileRepository', ['read', 'save', 'markSyncState']);
}

export function assertCloudProfileRepository(repository) {
  return assertMethods(repository, 'cloudProfileRepository', [
    'readCurrent',
    'upsertCurrent',
    'insertIfAbsent',
    'findLegacyCandidates'
  ]);
}

export function assertAuthAdapter(adapter) {
  return assertMethods(adapter, 'authAdapter', ['getCurrentUser']);
}

export function assertAiProvider(provider) {
  return assertMethods(provider, 'aiProvider', ['invoke']);
}
