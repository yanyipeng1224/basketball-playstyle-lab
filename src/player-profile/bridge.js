import { profileFromExistingForm } from './domain.js';
import { createLocalPlayerProfileRepository } from './local-repository.js';
import { createSupabasePlayerProfileRepository } from './supabase-repository.js';
import { createPlayerProfileService } from './service.js';
import { createLegacyProfileMigrator } from './legacy-migration.js';
import { createAuthAdapter } from '../platform/auth-adapter.js';
import { createAiProvider } from '../platform/ai-provider.js';

function offlineCloudRepository() {
  return {
    readCurrent: async () => null,
    upsertCurrent: async () => { throw new Error('账号服务还没有配置好。'); },
    insertIfAbsent: async () => { throw new Error('账号服务还没有配置好。'); },
    findLegacyCandidates: async () => []
  };
}

export function profileToExistingForm(profile) {
  if (!profile) return {};
  return {
    height: profile.heightCm,
    weight: profile.weightKg,
    frequency: profile.trainingFrequency,
    shooting: profile.skills?.shooting ?? null,
    finishing: profile.skills?.finishing ?? null,
    handling: profile.skills?.ballHandling ?? null,
    passing: profile.skills?.passing ?? null,
    defense: profile.skills?.defense ?? null,
    rebounding: profile.skills?.rebounding ?? null,
    speed: profile.skills?.speed ?? null,
    strength: profile.skills?.strength ?? null,
    stamina: profile.skills?.stamina ?? null,
    goal: profile.currentGoal
  };
}

export function createPlayerProfileBridge({
  supabase,
  storage,
  invokeExistingAi,
  now = () => new Date().toISOString(),
  randomUUID
}) {
  const localRepository = createLocalPlayerProfileRepository({ storage, now, ...(randomUUID ? { randomUUID } : {}) });
  const cloudRepository = supabase
    ? createSupabasePlayerProfileRepository({ supabase })
    : offlineCloudRepository();
  const authAdapter = supabase
    ? createAuthAdapter({ supabase })
    : { getCurrentUser: async () => null };
  const legacyMigrator = supabase ? createLegacyProfileMigrator({ cloudRepository, now }) : null;
  const service = createPlayerProfileService({
    localRepository,
    cloudRepository,
    authAdapter,
    legacyMigrator,
    now
  });
  const aiProvider = createAiProvider({ invokeExisting: invokeExistingAi });

  return {
    loadCurrent: () => service.loadCurrent(),
    saveFromExistingForm(formData, baseline) {
      return service.saveCurrent(profileFromExistingForm(formData, baseline));
    },
    syncGuestToCurrentUser: () => service.syncGuestToCurrentUser(),
    replaceCloudWithGuest: () => service.replaceCloudWithGuest({ confirmed: true }),
    invokeAi: (type, data) => aiProvider.invoke(type, data),
    profileToExistingForm
  };
}
