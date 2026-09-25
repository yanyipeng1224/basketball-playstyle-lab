import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('repository schema confirms the legacy profile source columns and UUID id', async () => {
  const sql = await readFile(new URL('supabase/migrations/202609240001_basketball_features.sql', root), 'utf8');
  assert.match(sql, /create table if not exists public\.app_records\s*\([\s\S]*?id uuid primary key/);
  assert.match(sql, /kind text not null check \(kind in \('profile'/);
  assert.match(sql, /payload jsonb not null default '\{\}'::jsonb/);
  assert.match(sql, /created_at timestamptz not null default now\(\)/);
});

test('player profile migration keeps broad database safety ranges and no global local-id uniqueness', async () => {
  const sql = await readFile(new URL('supabase/migrations/202609250001_player_profiles.sql', root), 'utf8');
  assert.match(sql, /height_cm between 100 and 250/);
  assert.match(sql, /weight_kg between 20 and 250/);
  assert.match(sql, /legacy_app_record_id uuid\s+references public\.app_records\(id\)/);
  assert.match(sql, /source_local_id uuid,/);
  assert.doesNotMatch(sql, /unique\s*\(\s*source_local_id\s*\)/i);
});

test('player profile migration enables owner RLS and does not grant delete', async () => {
  const sql = await readFile(new URL('supabase/migrations/202609250001_player_profiles.sql', root), 'utf8');
  assert.match(sql, /alter table public\.player_profiles enable row level security/);
  assert.match(sql, /grant select, insert, update on table public\.player_profiles to authenticated/);
  assert.doesNotMatch(sql, /grant[^;]*delete[^;]*player_profiles/i);
  assert.match(sql, /for select[\s\S]*?using \(user_id = \(select auth\.uid\(\)\)\)/);
  assert.match(sql, /for insert[\s\S]*?with check \(user_id = \(select auth\.uid\(\)\)\)/);
  assert.match(sql, /for update[\s\S]*?with check \(user_id = \(select auth\.uid\(\)\)\)/);
  assert.doesNotMatch(sql, /for delete/i);
});

test('static UI imports the bridge while direct player_profiles access stays outside index.html', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /import \{ createPlayerProfileBridge \} from '\.\/src\/player-profile\/bridge\.js'/);
  assert.doesNotMatch(html, /\.from\(['"]player_profiles['"]\)/);
  assert.match(html, /playerProfileBridge\.saveFromExistingForm/);
});

test('legacy guest keys remain present and unchanged', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /const shotStorageKey = 'full-court-shots-v1'/);
  assert.match(html, /const trainingStorageKey = 'full-court-training-v1'/);
});
