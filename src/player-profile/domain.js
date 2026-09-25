export const PLAYER_PROFILE_SCHEMA_VERSION = 1;

export const PROFILE_SKILLS = Object.freeze([
  'shooting',
  'finishing',
  'ballHandling',
  'passing',
  'defense',
  'rebounding',
  'speed',
  'strength',
  'stamina'
]);

const TEXT_LIMITS = Object.freeze({
  nickname: 40,
  ageRange: 32,
  position: 40,
  currentGoal: 300,
  playstyleType: 64,
  playstyleName: 80,
  playstyleEnglishName: 80,
  preferredRole: 80
});

const DOMINANT_HANDS = new Set(['left', 'right', 'both']);

function nullableText(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  return Number(value);
}

function normalizedStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(nullableText)
    .filter(Boolean)
    .slice(0, 10);
}

function skillValue(input, skills, canonicalName) {
  if (canonicalName === 'ballHandling') {
    return nullableNumber(
      skills.ballHandling ?? skills.handling ?? input.ballHandling ?? input.handling
    );
  }
  return nullableNumber(skills[canonicalName] ?? input[canonicalName]);
}

export function normalizePlayerProfile(input = {}) {
  const skills = input.skills && typeof input.skills === 'object' ? input.skills : {};
  const playstyle = input.playstyle && typeof input.playstyle === 'object' ? input.playstyle : {};

  return {
    schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION,
    nickname: nullableText(input.nickname),
    ageRange: nullableText(input.ageRange ?? input.age_range),
    heightCm: nullableNumber(input.heightCm ?? input.height_cm ?? input.height),
    weightKg: nullableNumber(input.weightKg ?? input.weight_kg ?? input.weight),
    position: nullableText(input.position),
    dominantHand: nullableText(input.dominantHand ?? input.dominant_hand),
    trainingFrequency: nullableNumber(
      input.trainingFrequency ?? input.training_frequency ?? input.frequency
    ),
    currentGoal: nullableText(input.currentGoal ?? input.current_goal ?? input.goal),
    skills: Object.fromEntries(
      PROFILE_SKILLS.map(skill => [skill, skillValue(input, skills, skill)])
    ),
    playstyle: {
      type: nullableText(playstyle.type ?? input.playstyleType ?? input.playstyle_type),
      name: nullableText(playstyle.name ?? input.playstyleName ?? input.playstyle_name),
      englishName: nullableText(
        playstyle.englishName
          ?? input.playstyleEnglishName
          ?? input.playstyle_english_name
      ),
      strengths: normalizedStringArray(playstyle.strengths ?? input.strengths),
      weaknesses: normalizedStringArray(playstyle.weaknesses ?? input.weaknesses),
      preferredRole: nullableText(
        playstyle.preferredRole ?? input.preferredRole ?? input.preferred_role
      )
    }
  };
}

export function validatePlayerProfile(input) {
  const profile = normalizePlayerProfile(input);
  const errors = [];
  const warnings = [];

  const validateText = (field, value, limit) => {
    if (value !== null && value.length > limit) errors.push(`${field}:too_long`);
  };

  validateText('nickname', profile.nickname, TEXT_LIMITS.nickname);
  validateText('ageRange', profile.ageRange, TEXT_LIMITS.ageRange);
  validateText('position', profile.position, TEXT_LIMITS.position);
  validateText('currentGoal', profile.currentGoal, TEXT_LIMITS.currentGoal);
  validateText('playstyle.type', profile.playstyle.type, TEXT_LIMITS.playstyleType);
  validateText('playstyle.name', profile.playstyle.name, TEXT_LIMITS.playstyleName);
  validateText(
    'playstyle.englishName',
    profile.playstyle.englishName,
    TEXT_LIMITS.playstyleEnglishName
  );
  validateText(
    'playstyle.preferredRole',
    profile.playstyle.preferredRole,
    TEXT_LIMITS.preferredRole
  );

  const validateNumber = (field, value, min, max, integer = false) => {
    if (value === null) return;
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      errors.push(`${field}:invalid`);
    }
  };

  validateNumber('heightCm', profile.heightCm, 100, 250);
  validateNumber('weightKg', profile.weightKg, 20, 250);
  validateNumber('trainingFrequency', profile.trainingFrequency, 0, 14, true);
  PROFILE_SKILLS.forEach(skill => validateNumber(`skills.${skill}`, profile.skills[skill], 1, 10, true));

  if (profile.dominantHand !== null && !DOMINANT_HANDS.has(profile.dominantHand)) {
    errors.push('dominantHand:invalid');
  }

  if (profile.heightCm !== null && (profile.heightCm < 140 || profile.heightCm > 230)) {
    warnings.push('heightCm:outside_recommended_range');
  }
  if (profile.weightKg !== null && (profile.weightKg < 35 || profile.weightKg > 180)) {
    warnings.push('weightKg:outside_recommended_range');
  }

  return { valid: errors.length === 0, errors, warnings, profile };
}

export function profileFromExistingForm(formData, baseline = null) {
  const playstyle = baseline && typeof baseline === 'object'
    ? {
        type: baseline.roleKey ?? null,
        name: baseline.role ?? null,
        strengths: Array.isArray(baseline.strengths)
          ? baseline.strengths.map(item => Array.isArray(item) ? item[0] : item)
          : [],
        weaknesses: Array.isArray(baseline.priorities)
          ? baseline.priorities.map(item => Array.isArray(item) ? item[0] : item)
          : []
      }
    : {};
  return normalizePlayerProfile({ ...formData, playstyle });
}
