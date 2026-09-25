import { normalizePlayerProfile, validatePlayerProfile } from './domain.js';
import {
  PlayerProfileError,
  PROFILE_ERROR_CODES
} from './contracts.js';

function rowFromProfile(userId, input, metadata = {}) {
  const validation = validatePlayerProfile(input);
  if (!validation.valid) {
    throw new PlayerProfileError(
      PROFILE_ERROR_CODES.INVALID_PROFILE,
      `球员档案包含无效字段：${validation.errors.join(',')}`
    );
  }
  const profile = validation.profile;
  return {
    user_id: userId,
    nickname: profile.nickname,
    age_range: profile.ageRange,
    height_cm: profile.heightCm,
    weight_kg: profile.weightKg,
    position: profile.position,
    dominant_hand: profile.dominantHand,
    training_frequency: profile.trainingFrequency,
    current_goal: profile.currentGoal,
    shooting: profile.skills.shooting,
    finishing: profile.skills.finishing,
    ball_handling: profile.skills.ballHandling,
    passing: profile.skills.passing,
    defense: profile.skills.defense,
    rebounding: profile.skills.rebounding,
    speed: profile.skills.speed,
    strength: profile.skills.strength,
    stamina: profile.skills.stamina,
    playstyle_type: profile.playstyle.type,
    playstyle_name: profile.playstyle.name,
    playstyle_english_name: profile.playstyle.englishName,
    strengths: profile.playstyle.strengths,
    weaknesses: profile.playstyle.weaknesses,
    preferred_role: profile.playstyle.preferredRole,
    schema_version: profile.schemaVersion,
    ...(metadata.origin ? { origin: metadata.origin } : {}),
    ...(metadata.sourceLocalId ? { source_local_id: metadata.sourceLocalId } : {}),
    ...(metadata.legacyAppRecordId
      ? { legacy_app_record_id: metadata.legacyAppRecordId }
      : {}),
    ...(Number.isInteger(metadata.legacyMigrationVersion)
      ? { legacy_migration_version: metadata.legacyMigrationVersion }
      : {}),
    ...(metadata.legacyMigratedAt
      ? { legacy_migrated_at: metadata.legacyMigratedAt }
      : {})
  };
}

export function profileRecordFromRow(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    data: normalizePlayerProfile(row),
    origin: row.origin ?? 'v2',
    sourceLocalId: row.source_local_id ?? null,
    legacyAppRecordId: row.legacy_app_record_id ?? null,
    legacyMigrationVersion: row.legacy_migration_version ?? 0,
    legacyMigratedAt: row.legacy_migrated_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null
  };
}

function cloudError(code, message, cause) {
  return new PlayerProfileError(code, message, { cause });
}

export function createSupabasePlayerProfileRepository({ supabase }) {
  if (!supabase?.from) throw new TypeError('supabase client is required');

  async function readCurrent(userId) {
    const { data, error } = await supabase
      .from('player_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw cloudError(PROFILE_ERROR_CODES.CLOUD_READ_FAILED, '无法读取云端球员档案。', error);
    return profileRecordFromRow(data);
  }

  async function upsertCurrent(userId, profile, metadata = {}) {
    const row = rowFromProfile(userId, profile, metadata);
    const { data, error } = await supabase
      .from('player_profiles')
      .upsert(row, { onConflict: 'user_id', ignoreDuplicates: false, defaultToNull: false })
      .select('*')
      .single();
    if (error) throw cloudError(PROFILE_ERROR_CODES.CLOUD_WRITE_FAILED, '无法保存云端球员档案。', error);
    return profileRecordFromRow(data);
  }

  async function insertIfAbsent(userId, profile, metadata = {}) {
    const row = rowFromProfile(userId, profile, metadata);
    const { data, error } = await supabase
      .from('player_profiles')
      .insert(row)
      .select('*')
      .single();
    if (error?.code === '23505') {
      return { status: 'conflict', record: await readCurrent(userId) };
    }
    if (error) throw cloudError(PROFILE_ERROR_CODES.CLOUD_WRITE_FAILED, '无法创建云端球员档案。', error);
    return { status: 'inserted', record: profileRecordFromRow(data) };
  }

  async function findLegacyCandidates(userId, limit = 100) {
    const { data, error } = await supabase
      .from('app_records')
      .select('id,title,payload,created_at')
      .eq('user_id', userId)
      .eq('kind', 'profile')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw cloudError(PROFILE_ERROR_CODES.CLOUD_READ_FAILED, '无法读取旧球员档案。', error);
    return data ?? [];
  }

  return { readCurrent, upsertCurrent, insertIfAbsent, findLegacyCandidates };
}

export { rowFromProfile };
