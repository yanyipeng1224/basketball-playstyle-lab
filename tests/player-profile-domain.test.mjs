import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePlayerProfile,
  profileFromExistingForm,
  validatePlayerProfile
} from '../src/player-profile/domain.js';
import {
  assertAiProvider,
  assertAuthAdapter,
  PlayerProfileError,
  PROFILE_ERROR_CODES
} from '../src/player-profile/contracts.js';

test('player profile uses null consistently for missing user fields', () => {
  const profile = normalizePlayerProfile({});
  assert.equal(profile.nickname, null);
  assert.equal(profile.dominantHand, null);
  assert.equal(profile.heightCm, null);
  assert.equal(profile.playstyle.englishName, null);
  assert.deepEqual(profile.playstyle.strengths, []);
});

test('legacy form aliases map to the canonical profile without guessing', () => {
  const profile = profileFromExistingForm({
    height: '180',
    weight: '75',
    frequency: '4',
    handling: '8',
    shooting: '7',
    goal: '提高弱手终结'
  }, {
    roleKey: 'combo',
    strengths: [['handling', 8]],
    priorities: [['rebounding', 4]]
  });

  assert.equal(profile.heightCm, 180);
  assert.equal(profile.skills.ballHandling, 8);
  assert.equal(profile.currentGoal, '提高弱手终结');
  assert.equal(profile.nickname, null);
  assert.equal(profile.playstyle.type, 'combo');
  assert.deepEqual(profile.playstyle.strengths, ['handling']);
  assert.deepEqual(profile.playstyle.weaknesses, ['rebounding']);
});

test('database safety ranges are errors while narrower human ranges are warnings', () => {
  const warning = validatePlayerProfile({ heightCm: 120, weightKg: 25 });
  assert.equal(warning.valid, true);
  assert.deepEqual(warning.warnings.sort(), [
    'heightCm:outside_recommended_range',
    'weightKg:outside_recommended_range'
  ]);

  const invalid = validatePlayerProfile({ heightCm: 99, weightKg: 251 });
  assert.equal(invalid.valid, false);
  assert.deepEqual(invalid.errors.sort(), ['heightCm:invalid', 'weightKg:invalid']);
});

test('dominant hand accepts null but not an unknown sentinel', () => {
  assert.equal(validatePlayerProfile({ dominantHand: null }).valid, true);
  assert.deepEqual(validatePlayerProfile({ dominantHand: 'unknown' }).errors, ['dominantHand:invalid']);
});

test('platform contracts stay intentionally small', () => {
  assert.doesNotThrow(() => assertAuthAdapter({ getCurrentUser() {} }));
  assert.doesNotThrow(() => assertAiProvider({ invoke() {} }));
  assert.throws(() => assertAuthAdapter({}), /getCurrentUser/);
  const error = new PlayerProfileError(PROFILE_ERROR_CODES.CLOUD_CONFLICT, 'conflict');
  assert.equal(error.code, 'cloud_conflict');
});
