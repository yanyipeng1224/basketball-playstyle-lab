import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const shotsSource = html.slice(html.indexOf('    function shotZone('), html.indexOf('    function parseCsv('));
const trainingSource = html.slice(html.indexOf('    function renderTrainingLogs('), html.indexOf('    let posePromise'));

test('pose analysis loads its program, wasm, and model from this website', () => {
  assert.match(html, /import\('\.\/assets\/mediapipe\/vision_bundle\.mjs'\)/);
  assert.match(html, /forVisionTasks\('\.\/assets\/mediapipe\/wasm'\)/);
  assert.match(html, /modelAssetPath:'\.\/assets\/mediapipe\/pose_landmarker_lite\.task'/);
  assert.doesNotMatch(html, /storage\.googleapis\.com\/mediapipe-models/);
  assert.doesNotMatch(html, /cdn\.jsdelivr\.net\/npm\/@mediapipe/);
});

test('the first visit uses a three-step profile flow before the workspace', () => {
  assert.match(html, /id="profile-wizard"/);
  assert.match(html, /data-step="1"/);
  assert.match(html, /data-step="2"/);
  assert.match(html, /data-step="3"/);
  assert.match(html, /full-court-onboarding-v2/);
  assert.match(html, /id="dashboard-home"/);
});

test('NBA UI supports a versioned bilingual player directory and local image fallback', () => {
  const data = JSON.parse(readFileSync(new URL('../data/nba-2025-26.json', import.meta.url), 'utf8'));
  assert.equal(data.directoryVersion, 2);
  assert.equal(data.players.length, 582);
  assert.ok(data.players.every(player => typeof player.nameZh === 'string' && typeof player.playerId === 'string' && player.image === './assets/nba-players/default-player.svg'));
  assert.equal(new Set(data.players.map(player => player.playerId)).size, data.players.length);
  assert.match(html, /full-court-nba-2025-26-v3/);
  assert.match(html, /nba-detail-dialog/);
  assert.match(html, /nameZh\|\|player\.name/);
  assert.ok(readFileSync(new URL('../assets/nba-players/default-player.svg', import.meta.url), 'utf8').includes('<svg'));
});

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function setup({ session = null, getSession, insert, remove } = {}) {
  const elements = new Map();
  const stored = [];
  const removed = [];
  const inserts = [];
  const aiCalls = [];
  const reports = [];
  function element(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        id, innerHTML: '', textContent: '', disabled: false, resetCount: 0,
        classList: { add() {}, remove() {} },
        listeners: {},
        addEventListener(name, handler) { this.listeners[name] = handler; },
        setAttribute(name, value) { this[name] = value; },
        reset() { this.resetCount += 1; },
        querySelector() { return element(`${id}-submit`); },
        createSVGPoint() { return { matrixTransform() { return { x: 500, y: 523 }; } }; },
        getScreenCTM() { return { inverse() { return {}; } }; },
      });
    }
    return elements.get(id);
  }
  const context = vm.createContext({
    console, Date, Math, Map, Set, URL, Blob,
    document: { getElementById: element, createElement: () => ({ click() {} }) },
    FormData: class { constructor(form) { this.form = form; } entries() { return Object.entries(this.form.values); } },
    supabaseReady: true,
    supabase: {
      auth: { getSession: getSession || (async () => ({ data: { session } })) },
      from(table) {
        return {
          insert(payload) {
            inserts.push({ table, payload });
            return { select: () => ({ single: () => insert ? insert(table, payload) : Promise.resolve({ data: { id: `cloud-${inserts.length}` }, error: null }) }) };
          },
          delete: () => ({ eq: () => remove ? remove() : Promise.resolve({ error: null }) }),
        };
      },
    },
    storeLocalRecord: (key, record) => stored.push({ key, record: { ...record }, userId: null }),
    removeLocalRecords: (key, ids) => removed.push({ key, ids }),
    storePendingRecord: (key, record, userId) => stored.push({ key, record: { ...record }, userId }),
    removePendingRecord: (key, record) => removed.push({ key, ids: [record.id] }),
    escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
    valuesFromForm: () => ({ shooting: 7 }),
    analyze: () => ({ roleKey: 'combo' }),
    roles: { combo: { name: '双能卫' } },
    invokeAi: async (type, input) => { aiCalls.push({ type, input }); return { report: { summary: '下周增加左手终结', advice: ['左手终结每次 30 球'] } }; },
    saveReport: async () => true,
    renderSimpleReport: (root, report) => reports.push({ root: root.id, report }),
  });
  vm.runInContext(`let shotAttempts = []; let trainingLogs = []; let shotChoiceMade = true; let accountLoadGeneration = 0;
    const shotStorageKey = 'shots'; const trainingStorageKey = 'training';
    ${shotsSource}\n${trainingSource}
    globalThis.features = {
      setShots: value => { shotAttempts = value; }, getShots: () => shotAttempts,
      setTraining: value => { trainingLogs = value; }, getTraining: () => trainingLogs,
      setChoice: value => { shotChoiceMade = value; },
      renderShots, renderTrainingLogs, shotZone,
    };`, context);
  function fire(id, type = 'click', values) {
    const target = element(id);
    if (values) target.values = values;
    const event = { currentTarget: target, clientX: 500, clientY: 523, preventDefault() {} };
    const result = target.listeners[type](event);
    // Real DOM Event.currentTarget is cleared after dispatch, before promises resume.
    event.currentTarget = null;
    return result;
  }
  return { ...context.features, element, stored, removed, inserts, aiCalls, reports, fire };
}

const trainingInput = { title: '左手终结', duration: '60', effort: '3', note: '最后一组更稳定' };

test('shot totals, percentage, and zone heat use the actual recorded results', () => {
  const app = setup();
  app.setShots(Array.from({ length: 6 }, (_, i) => ({ id: `local-${i}`, x: .5, y: .844, zone: '篮下', made: i < 4 })));
  app.renderShots();
  assert.equal(Number(app.element('shot-total').textContent), 6);
  assert.equal(Number(app.element('shot-makes').textContent), 4);
  assert.equal(app.element('shot-percent').textContent, '67%');
  assert.match(app.element('shot-zones').innerHTML, /4\/6 命中/);
  assert.match(app.element('shot-zones').innerHTML, /shot-zone-hot/);
  assert.equal(app.shotZone(.5, .844), '篮下');
  assert.equal(app.shotZone(.1, .8), '底角三分');
  assert.equal(app.shotZone(.5, .2), '三分');
});

test('a region with no made shots is not labeled hot', () => {
  const app = setup();
  app.setShots(Array.from({ length: 5 }, (_, i) => ({ id: `local-${i}`, x: .5, y: .844, made: false })));
  app.renderShots();
  assert.doesNotMatch(app.element('shot-zones').innerHTML, /shot-zone-hot/);
});

test('changing the result while a shot is saving does not change that shot', async () => {
  const pendingSession = deferred();
  const app = setup({ getSession: () => pendingSession.promise });
  const saving = app.fire('shot-court');
  app.setChoice(false);
  pendingSession.resolve({ data: { session: { user: { id: 'user-1' } } } });
  await saving;
  assert.equal(app.inserts[0].payload.made, true);
});

test('failed cloud undo restores the shot and does not silently discard it', async () => {
  const app = setup({ remove: async () => ({ error: { message: 'offline' } }) });
  app.setShots([{ id: 'cloud-1', x: .5, y: .844, made: true }]);
  await app.fire('shot-undo');
  assert.equal(app.getShots().length, 1);
  assert.match(app.element('shot-save-note').textContent, /撤销未能同步/);
});

test('undo removes the newest local shot and recalculates its percentage', async () => {
  const app = setup();
  app.setShots([
    { id: 'local-2000', x: .5, y: .844, made: false },
    { id: 'local-1000', x: .5, y: .844, made: true },
  ]);
  app.renderShots();
  await app.fire('shot-undo');
  assert.equal(app.getShots()[0].id, 'local-1000');
  assert.equal(app.removed[0].ids[0], 'local-2000');
  assert.equal(app.element('shot-percent').textContent, '100%');
});

test('a thrown deletion error also restores the shot', async () => {
  const app = setup({ remove: async () => { throw new Error('connection lost'); } });
  app.setShots([{ id: 'cloud-1', x: .5, y: .844, made: true }]);
  await app.fire('shot-undo');
  assert.equal(app.getShots().length, 1);
  assert.equal(app.element('shot-undo').disabled, false);
});

test('a failed shot write is queued for its originating account', async () => {
  const app = setup({ session: { user: { id: 'user-a' } }, insert: async () => { throw new Error('offline'); } });
  await app.fire('shot-court');
  assert.equal(app.stored.length, 1);
  assert.equal(app.stored[0].userId, 'user-a');
  assert.equal(app.getShots().length, 1);
});

test('training save survives the end of DOM event dispatch and resets the form', async () => {
  const app = setup();
  await app.fire('training-form', 'submit', trainingInput);
  assert.equal(app.getTraining().length, 1);
  assert.equal(app.stored[0].record.title, '左手终结');
  assert.equal(app.element('training-form').resetCount, 1);
});

test('a failed training write is queued for its originating account', async () => {
  const app = setup({ session: { user: { id: 'user-a' } }, insert: async () => { throw new Error('offline'); } });
  await app.fire('training-form', 'submit', trainingInput);
  assert.equal(app.stored[0].userId, 'user-a');
  assert.equal(app.getTraining().length, 1);
  assert.equal(app.element('training-form-submit').disabled, false);
});

test('repeated training submission while a save is pending creates one record', async () => {
  const pendingSession = deferred();
  const app = setup({ getSession: () => pendingSession.promise });
  const saving = app.fire('training-form', 'submit', trainingInput);
  await app.fire('training-form', 'submit', trainingInput);
  pendingSession.resolve({ data: { session: null } });
  await saving;
  assert.equal(app.getTraining().length, 1);
  assert.equal(app.stored.length, 1);
});

test('whitespace-only training titles never enter local or cloud records', async () => {
  const app = setup();
  await app.fire('training-form', 'submit', { ...trainingInput, title: '   ' });
  assert.equal(app.getTraining().length, 0);
  assert.equal(app.stored.length, 0);
  assert.equal(app.inserts.length, 0);
});

test('reloaded training logs feed the latest records into the next-week adjustment', async () => {
  const app = setup();
  app.setTraining(Array.from({ length: 15 }, (_, i) => ({ id: `local-${1000 + i}`, title: `训练 ${i}`, duration: 60, effort: 3, completed_on: '2026-09-24' })));
  app.renderTrainingLogs();
  await app.fire('adjust-plan');
  assert.equal(app.aiCalls[0].type, 'adjust');
  assert.equal(app.aiCalls[0].input.logs.length, 12);
  assert.equal(app.aiCalls[0].input.logs[0].title, '训练 14');
  assert.match(app.reports.at(-1).report.summary, /左手终结/);
});

test('an empty training history does not spend an AI request', async () => {
  const app = setup();
  await app.fire('adjust-plan');
  assert.equal(app.aiCalls.length, 0);
  assert.match(app.reports[0].report.summary, /至少一条/);
});
