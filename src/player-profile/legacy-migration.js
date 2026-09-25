import { profileFromExistingForm, validatePlayerProfile } from './domain.js';

export const LEGACY_PROFILE_MIGRATION_VERSION = 1;

const REQUIRED_BASE_FIELDS = ['height', 'weight', 'frequency'];
const LEGACY_SKILL_FIELDS = [
  'shooting',
  'finishing',
  'handling',
  'passing',
  'defense',
  'rebounding',
  'speed',
  'strength',
  'stamina'
];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isReliableLegacyProfile(value) {
  if (!isObject(value)) return false;
  if (!REQUIRED_BASE_FIELDS.every(field => value[field] !== null && value[field] !== undefined && value[field] !== '')) {
    return false;
  }
  return LEGACY_SKILL_FIELDS.filter(field => value[field] !== null && value[field] !== undefined && value[field] !== '').length >= 3;
}

function newest(records) {
  return [...records].sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''))[0] ?? null;
}

export function selectLegacyProfileCandidate(records = []) {
  const manual = records.filter(record =>
    record?.title === '球员档案与本地训练计划'
    && isReliableLegacyProfile(record.payload)
  );
  const analysis = records.filter(record =>
    record?.title === '打法分析'
    && isReliableLegacyProfile(record.payload?.player)
  );
  const selected = newest(manual) ?? newest(analysis);
  if (!selected) return null;
  const source = selected.title === '球员档案与本地训练计划'
    ? selected.payload
    : selected.payload.player;
  const baseline = isObject(selected.payload?.baseline) ? selected.payload.baseline : null;
  const profile = profileFromExistingForm(source, baseline);
  const validation = validatePlayerProfile(profile);
  return validation.valid ? { record: selected, profile: validation.profile } : null;
}

export function createLegacyProfileMigrator({
  cloudRepository,
  now = () => new Date().toISOString()
}) {
  if (!cloudRepository?.readCurrent || !cloudRepository?.findLegacyCandidates || !cloudRepository?.insertIfAbsent) {
    throw new TypeError('cloudRepository with legacy migration methods is required');
  }

  async function migrateForUser(userId) {
    const existing = await cloudRepository.readCurrent(userId);
    if (existing) return { status: 'skipped_existing', record: existing };

    const candidates = await cloudRepository.findLegacyCandidates(userId);
    const selected = selectLegacyProfileCandidate(candidates);
    if (!selected) return { status: 'no_candidate', record: null };

    const result = await cloudRepository.insertIfAbsent(userId, selected.profile, {
      origin: 'legacy_app_record',
      legacyAppRecordId: selected.record.id,
      legacyMigrationVersion: LEGACY_PROFILE_MIGRATION_VERSION,
      legacyMigratedAt: now()
    });
    if (result.status === 'inserted') {
      return { status: 'migrated', record: result.record, sourceRecord: selected.record };
    }
    return { status: 'skipped_concurrent', record: result.record, sourceRecord: selected.record };
  }

  return { migrateForUser };
}
