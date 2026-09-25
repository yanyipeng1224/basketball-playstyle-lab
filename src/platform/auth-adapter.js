export function createAuthAdapter({ supabase }) {
  if (!supabase?.auth?.getSession) throw new TypeError('supabase auth client is required');

  async function getCurrentUser() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data?.session?.user ?? null;
  }

  return { getCurrentUser };
}
