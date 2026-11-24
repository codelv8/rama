import { BUILDINGS, TROOPS, HEROES, QUESTS, WORLD_NODES, RESOURCE_IDS } from './content.js';

export const SAVE_VERSION = 1;
export const MAX_OFFLINE_MS = 2 * 60 * 60 * 1000;
export const MAX_ARMY = 250;
const MAX_EVENTS = 40;
const MAX_LEVEL = 6;
const buildingById = Object.assign(Object.create(null), Object.fromEntries(BUILDINGS.map((item) => [item.id, item])));
const troopById = Object.assign(Object.create(null), Object.fromEntries(TROOPS.map((item) => [item.id, item])));
const heroById = Object.assign(Object.create(null), Object.fromEntries(HEROES.map((item) => [item.id, item])));
const nodeById = Object.assign(Object.create(null), Object.fromEntries(WORLD_NODES.map((item) => [item.id, item])));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const integer = (value, fallback = 0) => Math.floor(finite(value, fallback));
const safeTime = (value) => Math.max(0, finite(value, Date.now()));
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (message) => ({ ok: false, message });
const success = (message, details = {}) => ({ ok: true, message, ...details });
const resourceBag = (value = 0) => Object.fromEntries(RESOURCE_IDS.map((id) => [id, value]));

/** A mutable game state. All public actions return { ok, message }; tick returns state. */
export function createGame(now = Date.now()) {
  const time = safeTime(now);
  return {
    version: SAVE_VERSION,
    cityName: 'อโยธยา',
    createdAt: time,
    lastTick: time,
    resources: { wood: 700, stone: 620, bronze: 350, rice: 1100 },
    buildings: Object.fromEntries(BUILDINGS.map(({ id }) => [id, id === 'palace' ? 2 : 1])),
    queues: { building: null, training: null, expedition: null },
    army: { guardian: 8, archer: 6, vanara: 0 },
    hero: { id: 'rama', level: 1, xp: 0, points: 3, attack: 0, defense: 0, fortune: 0 },
    quests: { claimed: [] },
    completedNodes: [],
    stats: { upgrades: 0, trained: 0, expeditions: 0, victories: 0, collected: 0 },
    events: [],
    eventSerial: 0,
    campaignWon: false,
  };
}

export function getCapacity(state) {
  return 2000 + state.buildings.palace * 1000 + state.buildings.market * 500;
}

/** Resource production per minute, including the market bonus. */
export function getRates(state) {
  const market = 1 + (state.buildings.market - 1) * 0.08;
  return {
    wood: Math.round(42 * state.buildings.sawmill * market),
    stone: Math.round(34 * state.buildings.quarry * market),
    bronze: Math.round(22 * state.buildings.foundry * market),
    rice: Math.round(66 * state.buildings.farm * market),
  };
}

export function getUpgradeCost(state, buildingId) {
  const building = buildingById[buildingId];
  if (!building || state.buildings[buildingId] >= building.maxLevel) return null;
  const factor = 1.55 ** (state.buildings[buildingId] - 1);
  return Object.fromEntries(RESOURCE_IDS.map((id) => [id, Math.ceil((building.baseCost[id] || 0) * factor)]));
}

/** Duration in seconds for the next upgrade. */
export function getUpgradeDuration(state, buildingId) {
  const building = buildingById[buildingId];
  return building ? Math.min(45, building.duration + (state.buildings[buildingId] - 1) * 4) : 0;
}

export function getTrainingCost(state, troopId, count = 1) {
  const troop = troopById[troopId];
  if (!troop || !Number.isInteger(count) || count < 1 || count > MAX_ARMY) return null;
  return Object.fromEntries(RESOURCE_IDS.map((id) => [id, (troop.baseCost[id] || 0) * count]));
}

export function getTrainingDuration(state, troopId, count = 1) {
  const troop = troopById[troopId];
  if (!troop || !Number.isInteger(count) || count < 1) return 0;
  return Math.ceil(troop.trainingSeconds * count / (1 + (state.buildings.barracks - 1) * 0.1));
}

export function getArmySize(state, army = state.army) {
  return TROOPS.reduce((total, troop) => total + (army[troop.id] || 0), 0);
}

/** Selection changes the leader only; level, XP, allocated points, and stats are shared. */
export function getActiveHero(state) {
  const id = state?.hero?.id;
  const hero = typeof id === 'string' ? heroById[id] : null;
  return hero?.available ? hero : heroById.rama;
}

export function getHeroBonuses(state) {
  return { ...getActiveHero(state).bonuses };
}

/** Passive points use the same combat/loot units as allocated hero stat points. */
export function getEffectiveHeroStats(state) {
  const bonuses = getHeroBonuses(state);
  return Object.fromEntries(['attack', 'defense', 'fortune'].map((stat) => [stat, finite(state?.hero?.[stat]) + bonuses[stat]]));
}

export function selectHero(state, heroId, now = Date.now()) {
  const hero = typeof heroId === 'string' ? heroById[heroId] : null;
  if (!hero) return fail('ไม่พบวีรชนนี้');
  if (!hero.available) return fail('วีรชนนี้เป็นสมุดภาพตำนาน ยังเลือกนำทัพไม่ได้');
  if (state.queues.expedition) return fail('กองทัพกำลังเดินทาง รอให้กลับเมืองก่อนเปลี่ยนวีรชน');
  if (state.hero.id === heroId) return success(`${hero.name}เป็นวีรชนประจำนครอยู่แล้ว`, { heroId, changed: false });
  state.hero.id = heroId;
  const at = Math.max(state.lastTick, safeTime(now));
  addEvent(state, 'hero', 'เปลี่ยนวีรชนประจำนคร', `${hero.name}พร้อมนำทัพ โดยคงระดับและความสามารถที่พัฒนาร่วมกัน`, at, { heroId });
  return success(`เลือก${hero.name}เป็นวีรชนประจำนครแล้ว`, { heroId, changed: true });
}

export function getArmyPower(state, army = state.army) {
  if (getArmySize(state, army) === 0) return 0;
  const soldiers = TROOPS.reduce((total, troop) => total + (army[troop.id] || 0) * troop.attack, 0);
  const stats = getEffectiveHeroStats(state);
  return Math.round(soldiers * (1 + stats.attack * 0.045) + 45 + state.hero.level * 8 + state.buildings.shrine * 5);
}

export function canAfford(state, cost) {
  return plain(cost) && RESOURCE_IDS.every((id) => state.resources[id] >= (cost[id] || 0));
}

function spend(state, cost) {
  for (const id of RESOURCE_IDS) state.resources[id] -= cost[id] || 0;
}

function grant(state, reward) {
  const capacity = getCapacity(state);
  for (const id of RESOURCE_IDS) state.resources[id] = Math.min(capacity, state.resources[id] + (reward[id] || 0));
}

function addEvent(state, kind, title, message, at, details = {}) {
  state.eventSerial += 1;
  state.events.unshift({ id: `event-${state.eventSerial}`, kind, title, message, at, ...details });
  state.events = state.events.slice(0, MAX_EVENTS);
}

function gainXp(state, amount, at) {
  state.hero.xp += amount;
  while (state.hero.level < 20 && state.hero.xp >= state.hero.level * 100) {
    state.hero.xp -= state.hero.level * 100;
    state.hero.level += 1;
    state.hero.points += 2;
    addEvent(state, 'hero', 'วีรชนเลื่อนระดับ', `${getActiveHero(state).name}ถึงระดับ ${state.hero.level} ได้รับแต้มความสามารถ 2 แต้ม`, at, { heroId: getActiveHero(state).id });
  }
  if (state.hero.level === 20) state.hero.xp = Math.min(state.hero.xp, 1999);
}

export function upgradeBuilding(state, buildingId, now = Date.now()) {
  const building = buildingById[buildingId];
  if (!building) return fail('ไม่พบสิ่งก่อสร้างนี้');
  if (state.queues.building) return fail('ช่างกำลังทำงานอยู่ รอให้งานก่อสร้างปัจจุบันเสร็จก่อน');
  const cost = getUpgradeCost(state, buildingId);
  if (!cost) return fail('สิ่งก่อสร้างนี้ถึงระดับสูงสุดแล้ว');
  const targetLevel = state.buildings[buildingId] + 1;
  if (buildingId !== 'palace' && targetLevel > state.buildings.palace + 1) return fail(`ต้องพัฒนาพระราชวังถึงระดับ ${targetLevel - 1} ก่อน`);
  if (!canAfford(state, cost)) return fail('ทรัพยากรยังไม่พอ รอผลผลิตหรือรับรางวัลภารกิจ');
  const startedAt = Math.max(state.lastTick, safeTime(now));
  const duration = getUpgradeDuration(state, buildingId);
  spend(state, cost);
  state.queues.building = { buildingId, targetLevel, startedAt, endsAt: startedAt + duration * 1000 };
  return success(`เริ่มอัปเกรด${building.name}เป็นระดับ ${targetLevel}`, { duration, cost });
}

export function trainTroops(state, troopId, count, now = Date.now()) {
  const troop = troopById[troopId];
  if (!troop) return fail('ไม่พบหน่วยทหารนี้');
  if (!Number.isInteger(count) || count < 1 || count > 50) return fail('เลือกจำนวนทหาร 1–50 นาย');
  if (state.queues.training) return fail('มีทหารกำลังฝึกอยู่ รอให้การฝึกปัจจุบันเสร็จก่อน');
  if (state.buildings.barracks < troop.unlockBarracks) return fail(`ต้องมีค่ายทหารระดับ ${troop.unlockBarracks} ก่อน`);
  const deployed = state.queues.expedition ? getArmySize(state, state.queues.expedition.troops) : 0;
  if (getArmySize(state) + deployed + count > MAX_ARMY) return fail(`กองทัพรองรับทหารได้สูงสุด ${MAX_ARMY} นาย`);
  const cost = getTrainingCost(state, troopId, count);
  if (!canAfford(state, cost)) return fail('ทรัพยากรไม่เพียงพอสำหรับการฝึกจำนวนนี้');
  const duration = getTrainingDuration(state, troopId, count);
  const startedAt = Math.max(state.lastTick, safeTime(now));
  spend(state, cost);
  state.queues.training = { troopId, count, startedAt, endsAt: startedAt + duration * 1000 };
  return success(`เริ่มฝึก${troop.name} ${count} นาย`, { duration, cost });
}

function selectTroops(state, count) {
  const selected = Object.fromEntries(TROOPS.map(({ id }) => [id, 0]));
  let remaining = count;
  while (remaining > 0) {
    let picked = false;
    for (const troop of TROOPS) {
      if (remaining > 0 && selected[troop.id] < state.army[troop.id]) {
        selected[troop.id] += 1;
        remaining -= 1;
        picked = true;
      }
    }
    if (!picked) break;
  }
  return selected;
}

function getLossCount(count, power, threat, defense, victory) {
  const fraction = victory
    ? clamp((threat / Math.max(1, power)) * 0.2 - defense * 0.0075, 0.04, 0.28)
    : clamp(0.7 - defense * 0.01, 0.45, 0.7);
  return Math.min(victory ? Math.max(0, count - 1) : count, Math.ceil(count * fraction));
}

export function getExpeditionPreview(state, nodeId, troopCount = getArmySize(state)) {
  const node = nodeById[nodeId];
  if (!node) return { available: false, unlocked: false, reason: 'ไม่พบพื้นที่นี้' };
  const nodeIndex = WORLD_NODES.findIndex(({ id }) => id === nodeId);
  const previous = nodeIndex > 0 ? WORLD_NODES[nodeIndex - 1] : null;
  const unlocked = (!previous || state.completedNodes.includes(previous.id)) && state.buildings.palace >= node.minPalace;
  const validCount = Number.isInteger(troopCount) && troopCount > 0 && troopCount <= getArmySize(state);
  const troops = selectTroops(state, validCount ? troopCount : 0);
  const power = getArmyPower(state, troops);
  const willWin = power >= node.threat;
  const heroId = getActiveHero(state).id;
  const heroStats = getEffectiveHeroStats(state);
  const defense = heroStats.defense + state.buildings.wall + state.buildings.shrine;
  const cost = { ...resourceBag(), rice: validCount ? troopCount * 8 : 0 };
  let reason = '';
  if (previous && !state.completedNodes.includes(previous.id)) reason = `ต้องพิชิต${previous.name}ก่อน`;
  else if (state.buildings.palace < node.minPalace) reason = `ต้องมีพระราชวังระดับ ${node.minPalace}`;
  else if (state.queues.expedition) reason = 'กองทัพกำลังเดินทางอยู่';
  else if (!validCount) reason = 'เลือกจำนวนทหารที่มีอยู่ 1 นายขึ้นไป';
  else if (!canAfford(state, cost)) reason = 'ข้าวไม่พอสำหรับเสบียงเดินทัพ';
  const reward = Object.fromEntries(RESOURCE_IDS.map((id) => [id, Math.round((node.reward[id] || 0) * (1 + heroStats.fortune * 0.035))]));
  return { available: !reason, unlocked, reason, heroId, defense, fortune: heroStats.fortune, troops, count: validCount ? troopCount : 0, power, threat: node.threat, willWin, estimatedLosses: validCount ? getLossCount(troopCount, power, node.threat, defense, willWin) : 0, duration: node.duration, cost, rewards: reward, completed: state.completedNodes.includes(nodeId) };
}

export function sendExpedition(state, nodeId, troopCount, now = Date.now()) {
  const preview = getExpeditionPreview(state, nodeId, troopCount);
  if (!preview.available) return fail(preview.reason);
  const startedAt = Math.max(state.lastTick, safeTime(now));
  spend(state, preview.cost);
  for (const troop of TROOPS) state.army[troop.id] -= preview.troops[troop.id];
  state.queues.expedition = {
    nodeId, heroId: preview.heroId, troops: preview.troops, power: preview.power,
    defense: preview.defense,
    fortune: preview.fortune,
    startedAt, endsAt: startedAt + preview.duration * 1000,
  };
  state.stats.expeditions += 1;
  return success(`ส่งกองทัพ ${troopCount} นายไปยัง${nodeById[nodeId].name}`, { duration: preview.duration, preview });
}

export function getQuestProgress(state, questId) {
  const index = QUESTS.findIndex(({ id }) => id === questId);
  if (index < 0) return { current: 0, target: 1, complete: false, claimed: false, unlocked: false, ratio: 0 };
  const quest = QUESTS[index];
  let current;
  if (quest.metric === 'palace') current = state.buildings.palace;
  else if (quest.metric === 'completedNodes') current = state.completedNodes.length;
  else if (quest.metric === 'lanka') current = state.completedNodes.includes('lanka') ? 1 : 0;
  else current = state.stats[quest.metric] || 0;
  const claimed = state.quests.claimed.includes(questId);
  const unlocked = index === 0 || state.quests.claimed.includes(QUESTS[index - 1].id);
  return { current: Math.min(current, quest.target), target: quest.target, complete: current >= quest.target, claimed, unlocked, ratio: Math.min(1, current / quest.target) };
}

export function claimQuest(state, questId, now = Date.now()) {
  const quest = QUESTS.find(({ id }) => id === questId);
  if (!quest) return fail('ไม่พบภารกิจนี้');
  const progress = getQuestProgress(state, questId);
  if (progress.claimed) return fail('รับรางวัลภารกิจนี้แล้ว');
  if (!progress.unlocked) return fail('รับรางวัลภารกิจก่อนหน้าให้เรียบร้อยก่อน');
  if (!progress.complete) return fail('ยังทำภารกิจนี้ไม่สำเร็จ');
  grant(state, quest.reward);
  state.quests.claimed.push(questId);
  const at = Math.max(state.lastTick, safeTime(now));
  gainXp(state, quest.xp, at);
  addEvent(state, 'quest', `ภารกิจสำเร็จ · ${quest.title}`, `รับรางวัลและประสบการณ์ ${quest.xp} แต้ม`, at, { rewards: quest.reward });
  return success(`รับรางวัล “${quest.title}” แล้ว`, { rewards: quest.reward });
}

export function allocateHeroPoint(state, stat) {
  if (!['attack', 'defense', 'fortune'].includes(stat)) return fail('ไม่พบความสามารถนี้');
  if (state.hero.points < 1) return fail('ไม่มีแต้มความสามารถเหลือ');
  if (state.hero[stat] >= 30) return fail('ความสามารถนี้ถึงระดับสูงสุดแล้ว');
  state.hero[stat] += 1;
  state.hero.points -= 1;
  return success('เพิ่มความสามารถวีรชนแล้ว');
}

function produce(state, milliseconds) {
  if (milliseconds <= 0) return;
  const rates = getRates(state);
  const capacity = getCapacity(state);
  for (const id of RESOURCE_IDS) {
    const amount = Math.min(capacity - state.resources[id], rates[id] * milliseconds / 60000);
    state.resources[id] += amount;
    state.stats.collected += amount;
  }
}

function resolveBuilding(state, at) {
  const queue = state.queues.building;
  state.buildings[queue.buildingId] = queue.targetLevel;
  state.stats.upgrades += 1;
  state.queues.building = null;
  addEvent(state, 'building', 'ก่อสร้างสำเร็จ', `${buildingById[queue.buildingId].name}ถึงระดับ ${queue.targetLevel} แล้ว`, at, { buildingId: queue.buildingId });
}

function resolveTraining(state, at) {
  const queue = state.queues.training;
  state.army[queue.troopId] += queue.count;
  state.stats.trained += queue.count;
  state.queues.training = null;
  gainXp(state, queue.count * 2, at);
  addEvent(state, 'training', 'กองทัพพร้อมประจำการ', `${troopById[queue.troopId].name} ${queue.count} นายฝึกสำเร็จ`, at, { count: queue.count, troopId: queue.troopId });
}

function resolveExpedition(state, at) {
  const queue = state.queues.expedition;
  const node = nodeById[queue.nodeId];
  const count = getArmySize(state, queue.troops);
  const victory = queue.power >= node.threat;
  const losses = getLossCount(count, queue.power, node.threat, queue.defense, victory);
  let remainingLosses = losses;
  const survivors = { ...queue.troops };
  // Round-robin losses make the total exact and never create negative units.
  while (remainingLosses > 0) {
    for (const troop of TROOPS) {
      if (remainingLosses > 0 && survivors[troop.id] > 0) {
        survivors[troop.id] -= 1;
        remainingLosses -= 1;
      }
    }
  }
  for (const troop of TROOPS) state.army[troop.id] += survivors[troop.id];
  const rewards = victory
    ? Object.fromEntries(RESOURCE_IDS.map((id) => [id, Math.round((node.reward[id] || 0) * (1 + queue.fortune * 0.035))]))
    : resourceBag();
  if (victory) {
    grant(state, rewards);
    state.stats.victories += 1;
    if (!state.completedNodes.includes(node.id)) state.completedNodes.push(node.id);
    gainXp(state, node.xp, at);
    if (node.id === 'lanka') state.campaignWon = true;
  } else gainXp(state, 10, at);
  state.queues.expedition = null;
  addEvent(state, victory ? 'victory' : 'defeat', victory ? `ชัยชนะที่${node.name}` : `ถอยทัพจาก${node.name}`, `ทหารกลับเมือง ${count - losses} นาย · สูญเสีย ${losses} นาย`, at, { nodeId: node.id, heroId: queue.heroId || getActiveHero(state).id, victory, losses, survivors: count - losses, rewards, power: queue.power, threat: node.threat });
  if (victory && node.id === 'lanka') addEvent(state, 'campaign', 'จบแคมเปญ · ตำนานบทใหม่', 'อโยธยาคืนความสงบสู่หิมพานต์ คุณยังพัฒนาเมืองและออกสำรวจต่อได้', at);
}

/** Advance chronologically, integrating rates before and after completed upgrades.
 * Offline production is capped at two hours. Resource queues are always resolved once.
 */
export function tick(state, now = Date.now()) {
  const time = safeTime(now);
  if (time <= state.lastTick) return state;
  const end = state.lastTick + Math.min(time - state.lastTick, MAX_OFFLINE_MS);
  let cursor = state.lastTick;
  while (true) {
    const pending = Object.entries(state.queues)
      .filter(([, queue]) => queue && queue.endsAt <= end)
      .sort((a, b) => a[1].endsAt - b[1].endsAt);
    if (!pending.length) break;
    const [kind, queue] = pending[0];
    const at = Math.max(cursor, queue.endsAt);
    produce(state, at - cursor);
    cursor = at;
    if (kind === 'building') resolveBuilding(state, at);
    else if (kind === 'training') resolveTraining(state, at);
    else resolveExpedition(state, at);
  }
  produce(state, end - cursor);
  state.lastTick = time;
  return state;
}

/** JSON saves deliberately contain gameplay only, with no credentials or network data. */
export function serializeGame(state) {
  return JSON.stringify(state);
}

function cleanArmy(value, limit = MAX_ARMY) {
  const result = {};
  let remaining = limit;
  for (const { id } of TROOPS) {
    const count = clamp(integer(value?.[id]), 0, remaining);
    result[id] = count;
    remaining -= count;
  }
  return result;
}

function cleanTiming(queue, now, maxDuration) {
  if (!plain(queue) || !Number.isFinite(queue.startedAt) || !Number.isFinite(queue.endsAt)) return null;
  if (queue.startedAt < 0 || queue.startedAt > now || queue.endsAt < queue.startedAt) return null;
  if (queue.endsAt - queue.startedAt > maxDuration * 1000 + 1) return null;
  return { startedAt: queue.startedAt, endsAt: queue.endsAt };
}

/** Reject malformed structures and bound all numbers before applying offline progress.
 * This is local save integrity, not an anti-cheat or a multiplayer trust boundary.
 */
export function loadGame(raw, now = Date.now()) {
  const time = safeTime(now);
  const state = createGame(time);
  let value;
  try {
    if (typeof raw === 'string' && raw.length > 1_000_000) return state;
    value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch { return state; }
  if (!plain(value) || value.version !== SAVE_VERSION || !plain(value.resources) || !plain(value.buildings)) return state;
  state.cityName = typeof value.cityName === 'string' ? value.cityName.replace(/[<>\u0000-\u001f]/g, '').slice(0, 28).trim() || 'อโยธยา' : 'อโยธยา';
  state.createdAt = clamp(finite(value.createdAt, time), 0, time);
  state.lastTick = clamp(finite(value.lastTick, time), Math.max(0, time - 30 * 86400000), time);
  for (const { id } of BUILDINGS) state.buildings[id] = clamp(integer(value.buildings[id], id === 'palace' ? 2 : 1), 1, MAX_LEVEL);
  const capacity = getCapacity(state);
  for (const id of RESOURCE_IDS) state.resources[id] = clamp(finite(value.resources[id]), 0, capacity);
  state.army = cleanArmy(value.army);
  if (plain(value.hero)) {
    if (typeof value.hero.id === 'string' && heroById[value.hero.id]?.available) state.hero.id = value.hero.id;
    state.hero.level = clamp(integer(value.hero.level, 1), 1, 20);
    state.hero.xp = clamp(integer(value.hero.xp), 0, state.hero.level * 100 - 1);
    let available = 3 + (state.hero.level - 1) * 2;
    for (const stat of ['attack', 'defense', 'fortune']) {
      state.hero[stat] = clamp(integer(value.hero[stat]), 0, Math.min(30, available));
      available -= state.hero[stat];
    }
    state.hero.points = clamp(integer(value.hero.points), 0, available);
  }
  state.quests.claimed = Array.isArray(value.quests?.claimed) ? QUESTS.filter(({ id }) => value.quests.claimed.includes(id)).map(({ id }) => id) : [];
  state.completedNodes = Array.isArray(value.completedNodes) ? WORLD_NODES.filter(({ id }) => value.completedNodes.includes(id)).map(({ id }) => id) : [];
  state.campaignWon = state.completedNodes.includes('lanka');
  for (const key of Object.keys(state.stats)) state.stats[key] = clamp(finite(value.stats?.[key]), 0, 1_000_000_000);
  state.eventSerial = clamp(integer(value.eventSerial), 0, 1_000_000_000);
  if (Array.isArray(value.events)) {
    const kinds = ['hero', 'building', 'training', 'quest', 'victory', 'defeat', 'campaign'];
    state.events = value.events.filter((event) => plain(event) && kinds.includes(event.kind) && typeof event.title === 'string' && typeof event.message === 'string')
      .slice(0, MAX_EVENTS).map((event, i) => ({
        id: `saved-event-${i}`, kind: event.kind, title: event.title.slice(0, 120), message: event.message.slice(0, 300), at: clamp(finite(event.at, time), 0, time),
        ...(nodeById[event.nodeId] ? { nodeId: event.nodeId } : {}),
        ...(typeof event.heroId === 'string' && heroById[event.heroId]?.available ? { heroId: event.heroId } : {}),
        ...(typeof event.victory === 'boolean' ? { victory: event.victory } : {}),
        ...(Number.isFinite(event.losses) ? { losses: clamp(integer(event.losses), 0, MAX_ARMY) } : {}),
        ...(Number.isFinite(event.survivors) ? { survivors: clamp(integer(event.survivors), 0, MAX_ARMY) } : {}),
        ...(plain(event.rewards) ? { rewards: Object.fromEntries(RESOURCE_IDS.map((id) => [id, clamp(integer(event.rewards[id]), 0, 10000)])) } : {}),
      }));
  }
  const buildingQueue = value.queues?.building;
  const buildingTime = cleanTiming(buildingQueue, time, 45);
  if (buildingTime && buildingById[buildingQueue.buildingId] && Number.isInteger(buildingQueue.targetLevel) && buildingQueue.targetLevel === state.buildings[buildingQueue.buildingId] + 1 && buildingQueue.targetLevel <= MAX_LEVEL) {
    state.queues.building = { buildingId: buildingQueue.buildingId, targetLevel: buildingQueue.targetLevel, ...buildingTime };
  }
  const expeditionQueue = value.queues?.expedition;
  const expeditionTime = cleanTiming(expeditionQueue, time, 60);
  if (expeditionTime && nodeById[expeditionQueue.nodeId]) {
    const troops = cleanArmy(expeditionQueue.troops, MAX_ARMY - getArmySize(state));
    if (getArmySize(state, troops) > 0) {
      const heroId = typeof expeditionQueue.heroId === 'string' && heroById[expeditionQueue.heroId]?.available
        ? expeditionQueue.heroId : getActiveHero(state).id;
      // A saved dispatch owns its leader until return. Old v1 queues inherit Rama.
      state.hero.id = heroId;
      const heroStats = getEffectiveHeroStats(state);
      state.queues.expedition = {
        nodeId: expeditionQueue.nodeId, heroId, troops, ...expeditionTime,
        power: clamp(finite(expeditionQueue.power), 1, getArmyPower(state, troops)),
        defense: clamp(finite(expeditionQueue.defense), 0, heroStats.defense + state.buildings.wall + state.buildings.shrine),
        fortune: clamp(finite(expeditionQueue.fortune), 0, heroStats.fortune),
      };
    }
  }
  const trainingQueue = value.queues?.training;
  const trainingTime = cleanTiming(trainingQueue, time, 350);
  const deployed = state.queues.expedition ? getArmySize(state, state.queues.expedition.troops) : 0;
  if (trainingTime && troopById[trainingQueue.troopId] && Number.isInteger(trainingQueue.count) && trainingQueue.count > 0 && trainingQueue.count <= 50 && getArmySize(state) + deployed + trainingQueue.count <= MAX_ARMY) {
    state.queues.training = { troopId: trainingQueue.troopId, count: trainingQueue.count, ...trainingTime };
  }
  return tick(state, time);
}
