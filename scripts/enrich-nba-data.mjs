import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enrichPlayer } from './nba-player-directory.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const path = resolve(here, '../data/nba-2025-26.json');
const payload = JSON.parse(await readFile(path, 'utf8'));
payload.players = payload.players.map(enrichPlayer);
payload.directoryVersion = 2;
await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Enriched ${payload.players.length} NBA players.`);
