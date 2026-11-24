import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, tick, getRates, getCapacity, getUpgradeCost, upgradeBuilding,
  getTrainingCost, trainTroops, sendExpedition, getExpeditionPreview,
  getArmySize, getArmyPower, claimQuest, getQuestProgress, allocateHeroPoint,
  loadGame, serializeGame, MAX_OFFLINE_MS, MAX_ARMY,
} from '../src/game/engine.js';
import { RESOURCE_IDS, WORLD_NODES } from '../src/game/content.js';

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
