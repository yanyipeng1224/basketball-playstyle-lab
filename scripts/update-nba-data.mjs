import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enrichPlayer } from './nba-player-directory.mjs';

const sourceUrl = 'https://boxscorelab.com/downloads/2025-26-player-season-totals.csv';
const here = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(here, '../data/nba-2025-26.json');
const inputPath = process.argv[2];

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (quoted && char === '"' && csv[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[i + 1] === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const normalize = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const fields = {
  season: ['season'],
  name: ['player_name', 'player', 'name', 'athlete'],
  team: ['team_abbreviation', 'team_abbr', 'team', 'team_name', 'tm'],
  games: ['games', 'games_played', 'gp', 'g'],
  points: ['points', 'pts', 'total_points'],
  rebounds: ['rebounds', 'reb', 'trb', 'total_rebounds'],
  assists: ['assists', 'ast', 'total_assists'],
  steals: ['steals', 'stl', 'total_steals'],
  blocks: ['blocks', 'blk', 'total_blocks'],
  turnovers: ['turnovers', 'tov', 'total_turnovers'],
  fgPct: ['fg_pct', 'fg_percent', 'field_goal_pct', 'field_goal_percentage'],
  fgMade: ['fgm', 'field_goals_made'],
  fgAttempted: ['fga', 'field_goals_attempted'],
  threePct: ['fg3_pct', 'three_point_pct', 'three_pct', 'three_point_percentage', '3p_pct'],
  threeMade: ['fg3m', 'three_pointers_made', '3pm'],
  threeAttempted: ['fg3a', 'three_pointers_attempted', '3pa'],
  tsPct: ['true_shooting_pct', 'ts_pct', 'ts_percent', 'true_shooting_percentage'],
  ftAttempted: ['fta', 'free_throws_attempted'],
};
function find(row, aliases) {
  for (const alias of aliases) {
    const key = normalize(alias);
    if (row[key] !== undefined && row[key] !== '') return row[key];
  }
  return '';
}
function number(value) {
  const parsed = Number(String(value || '').replace(/,/g, '').replace('%', ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

let csv;
if (inputPath) {
  csv = await readFile(resolve(inputPath), 'utf8');
} else {
  try {
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    csv = await response.text();
  } catch (error) {
    throw new Error(`Could not download BoxScore Lab CSV (${error.message}). Download ${sourceUrl} and rerun this script with the CSV file path.`, { cause: error });
  }
}
const rows = parseCsv(csv.replace(/^\uFEFF/, ''));
const headers = (rows.shift() || []).map(normalize);
const headerSet = new Set(headers);
const has = (aliases) => aliases.some((alias) => headerSet.has(normalize(alias)));
const required = ['season', 'name', 'team', 'games', 'points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers'];
const missing = required.filter((field) => !has(fields[field]));
if (!has(fields.fgPct) && !(has(fields.fgMade) && has(fields.fgAttempted))) missing.push('FG%');
if (!has(fields.threePct) && !(has(fields.threeMade) && has(fields.threeAttempted))) missing.push('3P%');
if (!has(fields.tsPct) && !(has(fields.fgAttempted) && has(fields.ftAttempted))) missing.push('TS%');
if (missing.length) throw new Error(`Unrecognized BoxScore Lab columns for: ${missing.join(', ')}. CSV headers: ${headers.join(', ')}`);
const seasonIndex = headers.indexOf('season');
if (rows.some((values) => String(values[seasonIndex] || '').trim() !== '2025-26')) {
  throw new Error('CSV contains rows outside the 2025-26 season.');
}
const players = rows.map((values) => {
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  const games = number(find(row, fields.games));
  const name = find(row, fields.name);
  if (!name || !games) return null;
  const total = (aliases) => number(find(row, aliases));
  const rate = (aliases) => {
    let value = total(aliases);
    if (value > 1) value /= 100;
    return Math.max(0, Math.min(1, value));
  };
  const fgAttempts = total(fields.fgAttempted);
  const threeAttempts = total(fields.threeAttempted);
  let fg = rate(fields.fgPct);
  let three = rate(fields.threePct);
  let ts = rate(fields.tsPct);
  if (!fg && fgAttempts) fg = total(fields.fgMade) / fgAttempts;
  if (!three && threeAttempts) three = total(fields.threeMade) / threeAttempts;
  if (!ts && fgAttempts) {
    const shootingPossessions = fgAttempts + .44 * total(fields.ftAttempted);
    if (shootingPossessions) ts = total(fields.points) / (2 * shootingPossessions);
  }
  return {
    name: String(name),
    team: String(find(row, fields.team) || '—'),
    games,
    ppg: total(fields.points) / games,
    rpg: total(fields.rebounds) / games,
    apg: total(fields.assists) / games,
    spg: total(fields.steals) / games,
    bpg: total(fields.blocks) / games,
    tov: total(fields.turnovers) / games,
    fg,
    three,
    ts: Math.max(0, Math.min(1, ts)),
  };
}).filter(Boolean).map(enrichPlayer).sort((a, b) => b.ppg - a.ppg);

if (players.length < 300) throw new Error(`Expected a full-season dataset; received only ${players.length} players.`);
if (['ppg', 'rpg', 'apg', 'spg', 'bpg', 'tov', 'fg', 'three', 'ts'].some((field) => !players.some((player) => player[field] > 0))) {
  throw new Error('CSV contains an unmapped or empty statistics column.');
}
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({
  season: '2025-26',
  source: 'BoxScore Lab',
  dataThrough: '2026-09-21',
  license: 'CC BY 4.0',
  sourceUrl: 'https://boxscorelab.com/downloads/',
  directoryVersion: 2,
  players,
}, null, 2)}\n`);
console.log(`Wrote ${players.length} players to ${outputPath}`);
