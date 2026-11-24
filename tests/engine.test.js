import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, tick, getRates, getCapacity, getUpgradeCost, upgradeBuilding,
  getTrainingCost, trainTroops, sendExpedition, getExpeditionPreview,
  getArmySize, getArmyPower, claimQuest, getQuestProgress, allocateHeroPoint,
  getActiveHero, getHeroBonuses, getEffectiveHeroStats, selectHero,
  loadGame, serializeGame, MAX_OFFLINE_MS, MAX_ARMY,
} from '../src/game/engine.js';
import { HEROES, RESOURCE_IDS, WORLD_NODES } from '../src/game/content.js';

const START = 1_800_000_000_000;
const clone = (value) => JSON.parse(JSON.stringify(value));
const approx = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} should equal ${expected}`);

test('new game is immediately playable and economic rates have documented units', () => {
  const state = createGame(START);
  assert.equal(getArmySize(state), 14);
  assert.equal(state.buildings.palace, 2);
  const before = clone(state.resources);
  const rates = getRates(state);
  tick(state, START + 60000);
  for (const id of RESOURCE_IDS) approx(state.resources[id], before[id] + rates[id]);
  assert.ok(getArmyPower(state) > WORLD_NODES[0].threat);
});

test('construction charges once, enforces a single queue, and integrates changed production at completion time', () => {
  const state = createGame(START);
  const cost = getUpgradeCost(state, 'sawmill');
  const before = state.resources.wood;
  assert.equal(upgradeBuilding(state, 'sawmill', START).ok, true);
  assert.equal(state.resources.wood, before - cost.wood);
  const snapshot = serializeGame(state);
  assert.equal(upgradeBuilding(state, 'farm', START).ok, false);
  assert.equal(serializeGame(state), snapshot, 'failed action must not mutate state');
  tick(state, START + 60000);
  assert.equal(state.buildings.sawmill, 2);
  // The first 12 seconds produce 42/min, then the remaining 48 produce 84/min.
  approx(state.resources.wood, before - cost.wood + 42 * 12 / 60 + 84 * 48 / 60);
  assert.equal(state.stats.upgrades, 1);
  assert.equal(state.queues.building, null);
  tick(state, START + 60000);
  assert.equal(state.stats.upgrades, 1, 'same timestamp cannot apply completion twice');
});

test('resources cannot become negative through invalid, locked, or unaffordable actions', () => {
  const state = createGame(START);
  state.resources = { wood: 0, stone: 0, bronze: 0, rice: 0 };
  const snapshot = serializeGame(state);
  assert.equal(upgradeBuilding(state, 'palace', START).ok, false);
  assert.equal(trainTroops(state, 'guardian', 10, START).ok, false);
  assert.equal(sendExpedition(state, 'grove', 14, START).ok, false);
  assert.equal(serializeGame(state), snapshot);
  for (const count of [-1, 0, 0.5, NaN, Infinity, 1000000, '2']) {
    assert.equal(trainTroops(state, 'guardian', count, START).ok, false);
    assert.equal(sendExpedition(state, 'grove', count, START).ok, false);
  }
  assert.equal(serializeGame(state), snapshot);
});

test('unknown and prototype-like IDs are rejected safely', () => {
  const state = createGame(START);
  for (const id of ['unknown', '__proto__', 'constructor', 'toString']) {
    assert.equal(upgradeBuilding(state, id, START).ok, false);
    assert.equal(trainTroops(state, id, 1, START).ok, false);
    assert.equal(sendExpedition(state, id, 1, START).ok, false);
    assert.equal(getUpgradeCost(state, id), null);
  }
});

test('training is paid, locked by barracks level, and applied exactly once', () => {
  const state = createGame(START);
  assert.equal(trainTroops(state, 'vanara', 1, START).ok, false);
  const cost = getTrainingCost(state, 'guardian', 6);
  const before = clone(state.resources);
  assert.equal(trainTroops(state, 'guardian', 6, START).ok, true);
  for (const id of RESOURCE_IDS) assert.equal(state.resources[id], before[id] - cost[id]);
  assert.equal(trainTroops(state, 'archer', 1, START).ok, false);
  tick(state, START + 29999);
  assert.equal(state.army.guardian, 8);
  tick(state, START + 30000);
  assert.equal(state.army.guardian, 14);
  assert.equal(state.stats.trained, 6);
  tick(state, START + 60000);
  assert.equal(state.army.guardian, 14);
});

test('expedition reserves units, resolves predictable combat, and opens the next location', () => {
  const state = createGame(START);
  const preview = getExpeditionPreview(state, 'grove', 14);
  assert.equal(preview.willWin, true);
  assert.equal(getExpeditionPreview(state, 'river', 14).unlocked, false);
  assert.equal(sendExpedition(state, 'grove', 14, START).ok, true);
  assert.equal(getArmySize(state), 0);
  assert.equal(sendExpedition(state, 'grove', 1, START).ok, false);
  tick(state, START + 25000);
  assert.equal(getArmySize(state), 14 - preview.estimatedLosses);
  assert.equal(state.stats.victories, 1);
  assert.deepEqual(state.completedNodes, ['grove']);
  assert.equal(state.queues.expedition, null);
  assert.equal(getExpeditionPreview(state, 'river').unlocked, true);
  assert.equal(state.events[0].victory, true);
  assert.deepEqual(state.events[0].rewards, preview.rewards);
});

test('defeat returns only survivors, gives no loot, and does not unlock the next node', () => {
  const state = createGame(START);
  const preview = getExpeditionPreview(state, 'grove', 1);
  assert.equal(preview.willWin, false);
  const expectedRice = state.resources.rice - preview.cost.rice + getRates(state).rice * 25 / 60;
  assert.equal(sendExpedition(state, 'grove', 1, START).ok, true);
  tick(state, START + 25000);
  assert.equal(state.stats.victories, 0);
  assert.equal(state.completedNodes.length, 0);
  assert.equal(getArmySize(state), 13);
  approx(state.resources.rice, expectedRice);
  assert.equal(state.events[0].kind, 'defeat');
});

test('quests enforce sequence and cannot award their reward twice', () => {
  const state = createGame(START);
  assert.equal(claimQuest(state, 'foundation', START).ok, false);
  state.stats.trained = 6;
  assert.equal(getQuestProgress(state, 'recruit').complete, true);
  assert.equal(claimQuest(state, 'recruit', START).ok, false, 'previous quest must be claimed');
  upgradeBuilding(state, 'sawmill', START);
  tick(state, START + 12000);
  assert.equal(claimQuest(state, 'foundation', START + 12000).ok, true);
  const snapshot = serializeGame(state);
  assert.equal(claimQuest(state, 'foundation', START + 12000).ok, false);
  assert.equal(serializeGame(state), snapshot);
  assert.equal(claimQuest(state, 'recruit', START + 12000).ok, true);
});

test('hero allocations are bounded and change combat prediction', () => {
  const state = createGame(START);
  const initialPower = getArmyPower(state);
  assert.equal(allocateHeroPoint(state, 'attack').ok, true);
  assert.ok(getArmyPower(state) > initialPower);
  assert.equal(allocateHeroPoint(state, 'defense').ok, true);
  assert.equal(allocateHeroPoint(state, 'fortune').ok, true);
  const snapshot = serializeGame(state);
  assert.equal(allocateHeroPoint(state, 'attack').ok, false);
  assert.equal(allocateHeroPoint(state, '__proto__').ok, false);
  assert.equal(serializeGame(state), snapshot);
});

test('offline progress is capped, bounded by storage capacity, and cannot replay after reload', () => {
  const state = createGame(START);
  const before = clone(state.resources);
  const rates = getRates(state);
  tick(state, START + 10 * 86400000);
  for (const id of RESOURCE_IDS) approx(state.resources[id], Math.min(getCapacity(state), before[id] + rates[id] * MAX_OFFLINE_MS / 60000));
  assert.equal(state.lastTick, START + 10 * 86400000);
  const saved = serializeGame(state);
  const restored = loadGame(saved, state.lastTick);
  assert.deepEqual(restored.resources, state.resources);
  const again = loadGame(serializeGame(restored), state.lastTick);
  assert.deepEqual(again.resources, state.resources);
});

test('all concurrent queues finish chronologically across a save/reload', () => {
  const state = createGame(START);
  upgradeBuilding(state, 'sawmill', START);
  trainTroops(state, 'guardian', 6, START);
  sendExpedition(state, 'grove', 14, START);
  const restored = loadGame(serializeGame(state), START + 60000);
  const continuous = tick(clone(state), START + 60000);
  assert.deepEqual(restored.resources, continuous.resources);
  assert.deepEqual(restored.army, continuous.army);
  assert.deepEqual(restored.buildings, continuous.buildings);
  assert.deepEqual(restored.completedNodes, continuous.completedNodes);
  assert.deepEqual(restored.stats, continuous.stats);
  assert.deepEqual(restored.queues, { building: null, training: null, expedition: null });
  const timestamps = restored.events.map(({ at }) => at);
  assert.deepEqual(timestamps, [...timestamps].sort((a, b) => b - a));
});

test('a backwards clock gives no production and cannot finish a queue early', () => {
  const state = createGame(START);
  upgradeBuilding(state, 'farm', START);
  const snapshot = serializeGame(state);
  tick(state, START - 60000);
  assert.equal(serializeGame(state), snapshot);
});

test('malformed and exaggerated saves cannot create NaN, negative resources, or unbounded armies', () => {
  for (const raw of [null, undefined, '', '{', '[]', '{"version":100}', false]) {
    assert.deepEqual(loadGame(raw, START), createGame(START));
  }
  const malicious = createGame(START);
  malicious.resources = { wood: -400, stone: Infinity, bronze: NaN, rice: 1e20 };
  malicious.buildings.palace = 1000000;
  malicious.army = { guardian: 1e20, archer: -1, vanara: 1e20 };
  malicious.hero = { level: 1e20, xp: -1, points: 1e20, attack: 1e20, defense: 1e20, fortune: 1e20 };
  malicious.queues = { building: { buildingId: '__proto__', targetLevel: 2, startedAt: START, endsAt: START }, training: { troopId: 'guardian', count: -9, startedAt: START, endsAt: START }, expedition: { nodeId: 'grove', troops: {}, startedAt: START, endsAt: START } };
  const restored = loadGame(malicious, START);
  for (const id of RESOURCE_IDS) {
    assert.ok(Number.isFinite(restored.resources[id]));
    assert.ok(restored.resources[id] >= 0 && restored.resources[id] <= getCapacity(restored));
  }
  assert.ok(getArmySize(restored) <= MAX_ARMY);
  assert.ok(restored.hero.attack + restored.hero.defense + restored.hero.fortune + restored.hero.points <= 3 + (restored.hero.level - 1) * 2);
  assert.deepEqual(restored.queues, { building: null, training: null, expedition: null });
  tick(restored, START + 86400000);
  for (const value of Object.values(restored.resources)) assert.ok(Number.isFinite(value) && value >= 0);
});

test('capacity includes deployed units, so training cannot overflow the returning army', () => {
  const state = createGame(START);
  state.army = { guardian: MAX_ARMY - 3, archer: 0, vanara: 0 };
  state.resources = { wood: 4500, stone: 4500, bronze: 4500, rice: 4500 };
  sendExpedition(state, 'grove', 200, START);
  assert.equal(trainTroops(state, 'guardian', 4, START).ok, false);
  assert.equal(trainTroops(state, 'guardian', 3, START).ok, true);
  tick(state, START + 60000);
  assert.ok(getArmySize(state) <= MAX_ARMY);
});

test('winning the final campaign node records a victory and allows continued play', () => {
  const state = createGame(START);
  state.completedNodes = WORLD_NODES.slice(0, -1).map(({ id }) => id);
  state.buildings.palace = 3;
  state.army = { guardian: 100, archer: 0, vanara: 0 };
  assert.equal(sendExpedition(state, 'lanka', 100, START).ok, true);
  tick(state, START + 60000);
  assert.equal(state.campaignWon, true);
  assert.ok(state.completedNodes.includes('lanka'));
  assert.equal(state.events[0].kind, 'campaign');
  assert.equal(getExpeditionPreview(state, 'grove').available, true);
});

const EXPANSION_HERO_IDS = ['lakshman', 'sita', 'sugriva', 'angada', 'jambavan', 'nilaphat', 'vibhishana', 'garuda', 'suphannamatcha', 'macchanu'];

test('the roster adds exactly ten selectable heroes with complete, distinct portrait cells', () => {
  assert.equal(HEROES.length, 13);
  assert.deepEqual(HEROES.slice(0, 3).map(({ id }) => id), ['rama', 'hanuman', 'thotsakan']);
  assert.deepEqual(HEROES.slice(3).map(({ id }) => id), EXPANSION_HERO_IDS);
  assert.equal(HEROES.filter(({ available }) => available).length, 11);
  const cells = new Set();
  for (const hero of HEROES.slice(3)) {
    assert.equal(hero.available, true);
    assert.equal(Object.values(hero.bonuses).reduce((total, value) => total + value, 0), 4, `${hero.id} passive budget`);
    assert.ok(hero.role && hero.lore && hero.ability.name && hero.ability.description);
    const { src, columns, rows, column, row } = hero.portrait;
    assert.ok(column >= 0 && column < columns && row >= 0 && row < rows);
    cells.add(`${src}:${column}:${row}`);
    const state = createGame(START);
    assert.equal(selectHero(state, hero.id, START).ok, true);
    assert.equal(getActiveHero(state).id, hero.id);
  }
  assert.equal(cells.size, 10, 'each new hero must have a separate atlas cell');
});

test('changing heroes shares progress and never duplicates points, resources, or selection rewards', () => {
  const state = createGame(START);
  state.hero = { id: 'rama', level: 3, xp: 67, points: 3, attack: 2, defense: 1, fortune: 1 };
  const { id, ...progress } = state.hero;
  const resources = clone(state.resources);
  const army = clone(state.army);
  for (const heroId of [...EXPANSION_HERO_IDS, ...EXPANSION_HERO_IDS, 'rama']) {
    assert.equal(selectHero(state, heroId, START).ok, true);
    const { id: selected, ...currentProgress } = state.hero;
    assert.equal(selected, heroId);
    assert.deepEqual(currentProgress, progress);
    assert.deepEqual(state.resources, resources);
    assert.deepEqual(state.army, army);
    const snapshot = serializeGame(state);
    assert.deepEqual(selectHero(state, heroId, START), { ok: true, message: `${getActiveHero(state).name}เป็นวีรชนประจำนครอยู่แล้ว`, heroId, changed: false });
    assert.equal(serializeGame(state), snapshot, 'reselecting the current hero is a no-op');
  }
});

test('hero selection rejects unknown, non-string, lore-only, and travelling choices without mutation', () => {
  const state = createGame(START);
  const initial = serializeGame(state);
  for (const id of ['unknown', '__proto__', 'constructor', 'toString', 'hanuman', 'thotsakan', null, 1, {}, ['garuda']]) {
    assert.equal(selectHero(state, id, START).ok, false);
    assert.equal(serializeGame(state), initial);
  }
  selectHero(state, 'garuda', START);
  sendExpedition(state, 'grove', 14, START);
  const travelling = serializeGame(state);
  assert.equal(selectHero(state, 'sita', START).ok, false);
  assert.equal(selectHero(state, 'garuda', START).ok, false);
  assert.equal(serializeGame(state), travelling);
  tick(state, START + 25000);
  assert.equal(selectHero(state, 'sita', START + 25000).ok, true);
});

test('hero passives change real attack, casualties, and loot while Rama keeps the original baseline', () => {
  const state = createGame(START);
  assert.deepEqual(getHeroBonuses(state), { attack: 0, defense: 0, fortune: 0 });
  assert.equal(getArmyPower(state), 262);
  const baseline = getExpeditionPreview(state, 'grove', 14);
  selectHero(state, 'garuda', START);
  assert.equal(getArmyPower(state), 299);
  assert.equal(getExpeditionPreview(state, 'grove', 14).duration, baseline.duration);
  allocateHeroPoint(state, 'attack');
  assert.deepEqual(getEffectiveHeroStats(state), { attack: 5, defense: 0, fortune: 0 });
  assert.equal(state.hero.attack, 1, 'passives must not be stored as allocated points');
  const defender = createGame(START);
  selectHero(defender, 'jambavan', START);
  assert.ok(getExpeditionPreview(defender, 'grove', 14).estimatedLosses < baseline.estimatedLosses);
  const collector = createGame(START);
  selectHero(collector, 'suphannamatcha', START);
  const rewardPreview = getExpeditionPreview(collector, 'grove', 14);
  for (const resource of RESOURCE_IDS) assert.equal(rewardPreview.rewards[resource], Math.round(baseline.rewards[resource] * 114 / 100));
  sendExpedition(collector, 'grove', 14, START);
  tick(collector, START + 25000);
  const report = collector.events.find(({ kind }) => kind === 'victory');
  assert.deepEqual(report.rewards, rewardPreview.rewards);
  assert.equal(report.heroId, 'suphannamatcha');
});

test('version-one saves retain shared progress, validate hero IDs, and load legacy Rama expeditions', () => {
  const legacy = createGame(START);
  allocateHeroPoint(legacy, 'attack');
  sendExpedition(legacy, 'grove', 14, START);
  delete legacy.queues.expedition.heroId;
  const expected = tick(clone(legacy), START + 25000);
  const restored = loadGame(serializeGame(legacy), START + 25000);
  assert.equal(restored.version, 1);
  assert.equal(getActiveHero(restored).id, 'rama');
  assert.deepEqual(restored.hero, expected.hero);
  assert.deepEqual(restored.army, expected.army);
  assert.deepEqual(restored.resources, expected.resources);
  for (const id of ['hanuman', 'thotsakan', '__proto__', 'not-a-hero', null, ['garuda']]) {
    const raw = createGame(START);
    raw.hero.id = id;
    assert.equal(loadGame(raw, START).hero.id, 'rama');
  }
  const noId = createGame(START);
  delete noId.hero.id;
  assert.equal(loadGame(noId, START).hero.id, 'rama');
  for (const heroId of EXPANSION_HERO_IDS) {
    const state = createGame(START);
    allocateHeroPoint(state, 'fortune');
    selectHero(state, heroId, START);
    assert.deepEqual(loadGame(serializeGame(state), START).hero, state.hero);
  }
});

test('every new hero preserves the predicted expedition result through a reload', () => {
  for (const heroId of EXPANSION_HERO_IDS) {
    const state = createGame(START);
    selectHero(state, heroId, START);
    const preview = getExpeditionPreview(state, 'grove', 14);
    sendExpedition(state, 'grove', 14, START);
    assert.equal(state.queues.expedition.heroId, heroId);
    const saved = serializeGame(state);
    const midJourney = loadGame(saved, START + 10000);
    assert.deepEqual(midJourney.queues.expedition, state.queues.expedition, `${heroId} dispatch snapshot`);
    const restored = loadGame(serializeGame(midJourney), START + 25000);
    const continuous = tick(state, START + 25000);
    const report = restored.events.find(({ kind }) => kind === 'victory');
    assert.equal(restored.hero.id, heroId);
    assert.equal(report.heroId, heroId);
    assert.equal(report.power, preview.power);
    assert.equal(report.losses, preview.estimatedLosses);
    assert.deepEqual(report.rewards, preview.rewards);
    assert.deepEqual(restored.army, continuous.army);
    for (const resource of RESOURCE_IDS) approx(restored.resources[resource], continuous.resources[resource]);
  }
});

test('dispatch bonuses stay frozen while shared points, level, and buildings improve during travel', () => {
  const state = createGame(START);
  selectHero(state, 'lakshman', START);
  state.hero.xp = 99;
  const preview = getExpeditionPreview(state, 'grove', 14);
  sendExpedition(state, 'grove', 14, START);
  const dispatch = clone(state.queues.expedition);
  for (const stat of ['attack', 'defense', 'fortune']) allocateHeroPoint(state, stat);
  upgradeBuilding(state, 'shrine', START);
  trainTroops(state, 'guardian', 1, START);
  tick(state, START + 8000);
  assert.equal(state.hero.level, 2);
  const levelEvent = state.events.find(({ title }) => title === 'วีรชนเลื่อนระดับ');
  assert.match(levelEvent.message, /พระลักษมณ์/);
  assert.equal(levelEvent.heroId, 'lakshman');
  const restored = loadGame(serializeGame(state), START + 8000);
  assert.deepEqual(restored.queues.expedition, dispatch);
  tick(restored, START + 25000);
  const report = restored.events.find(({ kind }) => kind === 'victory');
  assert.equal(report.power, preview.power);
  assert.equal(report.losses, preview.estimatedLosses);
  assert.deepEqual(report.rewards, preview.rewards);
  assert.equal(restored.buildings.shrine, 2);
  assert.equal(restored.hero.id, 'lakshman');
  assert.equal(restored.hero.attack, 1);
  assert.equal(restored.hero.defense, 1);
  assert.equal(restored.hero.fortune, 1);
});
