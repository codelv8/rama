import '@fontsource/noto-sans-thai/400.css';
import '@fontsource/noto-sans-thai/500.css';
import '@fontsource/noto-sans-thai/600.css';
import '@fontsource/noto-sans-thai/700.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import './style.css';
import { BUILDINGS, TROOPS, HEROES, QUESTS, WORLD_NODES, RESOURCE_IDS, RESOURCE_NAMES } from './game/content.js';
import {
  createGame, loadGame, serializeGame, tick, getRates, getCapacity, getUpgradeCost,
  getUpgradeDuration, upgradeBuilding, getArmySize, getArmyPower, getTrainingCost,
  getTrainingDuration, trainTroops, getExpeditionPreview, sendExpedition,
  getQuestProgress, claimQuest, allocateHeroPoint, canAfford,
} from './game/engine.js';
import { createVillage } from './render/village.js';
import { createWorldMap } from './render/world-map.js';
import { icon } from './ui/icons.js';
import { createAudio } from './ui/audio.js';

const SAVE_KEY = 'rama.kingdom.v1';
const SETTINGS_KEY = 'rama.preferences.v1';
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
const number = (value) => Math.floor(Number(value) || 0).toLocaleString('en-US');
const portrait = (id = 'rama', extra = '') => `<div class="portrait portrait-${id} ${extra}" role="img" aria-label="${id === 'rama' ? 'พระราม' : id === 'hanuman' ? 'หนุมาน' : 'ทศกัณฐ์'}"></div>`;
const item = (array, id) => array.find((entry) => entry.id === id);
const readStorage = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const storedSave = readStorage(SAVE_KEY);
let state = loadGame(storedSave, Date.now());
let preferences;
try { preferences = JSON.parse(readStorage(SETTINGS_KEY)) || {}; } catch { preferences = {}; }
if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) preferences = {};
let activeTab = 'city';
let modal = null;
let lastFocus = null;
let lastEvent = state.eventSerial;
let lastSave = 0;
let saveFailed = false;
let night = Boolean(preferences.night);
let modalCount = 1;
let pendingRestore = null;
const audio = createAudio();
audio.setEnabled(Boolean(preferences.sound), false);
let village;
let world;

const navItems = [
  ['city', 'city', 'เมืองของฉัน'], ['world', 'map', 'แผนที่โลก'],
  ['army', 'swords', 'กองทัพ'], ['heroes', 'crown', 'วีรชน'], ['quests', 'scroll', 'ภารกิจ'],
];

$('#app').innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="./" aria-label="RAMA อาณาจักรหิมพานต์">${icon('city', 'brand-symbol')}<span><b>RAMA<span class="brand-dot">.</span></b><small>อาณาจักรหิมพานต์</small></span></a>
      <nav class="main-nav" aria-label="เมนูเกม">${navItems.map(([id, glyph, label]) => `<button class="nav-item ${id === 'city' ? 'active' : ''}" data-tab="${id}" aria-current="${id === 'city' ? 'page' : 'false'}">${icon(glyph)}<span>${label}</span>${id === 'quests' ? '<i class="quest-dot" hidden></i>' : ''}</button>`).join('')}</nav>
      <div class="header-actions">
        <button class="icon-button sound-button" data-action="sound" aria-label="${audio.enabled ? 'ปิดเสียง' : 'เปิดเสียง'}" title="${audio.enabled ? 'ปิดเสียง' : 'เปิดเสียง'}">${icon(audio.enabled ? 'volume' : 'mute')}</button>
        <button class="icon-button" data-action="help" aria-label="วิธีเล่น" title="วิธีเล่น">${icon('help')}</button>
        <span class="header-divider"></span>
        <button class="player-button" data-action="settings" aria-label="ตั้งค่าอาณาจักร">${portrait('rama')}<span><b>ผู้ครองนคร</b><small>อาณาจักรของคุณ</small></span>${icon('down')}</button>
      </div>
    </header>
    <section class="resource-bar" aria-label="ทรัพยากรอาณาจักร">
      <div class="kingdom-badge"><span class="kingdom-seal">${icon('crown')}</span><div><b class="city-name">${esc(state.cityName)}</b><span>อาณาจักรระดับ <strong data-palace-level>${state.buildings.palace}</strong></span></div></div>
      <div class="resource-grid">${RESOURCE_IDS.map((id) => `<div class="resource-card resource-${id}" title="${RESOURCE_NAMES[id]}"><span class="resource-illustration">${icon(id)}</span><div class="resource-main"><span class="resource-label">${RESOURCE_NAMES[id]}</span><strong data-resource="${id}">${number(state.resources[id])}</strong></div><span class="resource-rate" data-rate="${id}"></span><div class="resource-track"><i data-resource-fill="${id}"></i></div></div>`).join('')}</div>
      <button class="chapter-badge" data-tab="quests"><span class="chapter-orbit">${icon('sun')}</span><div><small>THE FIRST CHAPTER</small><b>รุ่งอรุณแห่งอโยธยา</b></div>${icon('chevron')}</button>
    </section>
    <main class="game-stage" id="game-stage">
      <div class="scene-grain" aria-hidden="true"></div>
      <div id="village" class="map-layer"><div class="loading-scene"><span class="loading-emblem">${icon('city')}</span><b>กำลังเปิดประตูสู่อโยธยา</b><span>เรื่องราวของคุณกำลังเริ่มต้น</span></div></div>
      <div id="world-map" class="map-layer" hidden></div>
      <div class="stage-title"><div class="eyebrow"><i></i><span id="view-eyebrow">YOUR KINGDOM</span></div><h1 id="view-title">${esc(state.cityName)}</h1><p id="view-description">จากเมืองเล็ก ๆ สู่ตำนานบทใหม่</p></div>
      <div class="scene-weather"><button class="weather-button" data-action="night" aria-label="${night ? 'เปลี่ยนเป็นกลางวัน' : 'เปลี่ยนเป็นกลางคืน'}">${icon(night ? 'moon' : 'sun')}<span>${night ? 'ราตรีสงบ' : 'เช้าอันสงบ'}</span></button><span class="weather-divider"></span><span class="live-status"><i></i>เมืองกำลังเติบโต</span></div>
      <aside class="quest-hud" id="quest-hud" aria-label="ภารกิจแนะนำ"></aside>
      <aside class="activity-hud" id="activity-hud" aria-label="กิจกรรมในอาณาจักร"></aside>
      <section id="screen-panel" class="screen-panel" hidden></section>
      <div class="map-bottom"><span class="map-hint">${icon('target')}<span id="map-hint-text">แตะอาคารเพื่อจัดการ · ลากเพื่อหมุนมุมมอง</span></span><div class="map-controls"><button class="icon-button" data-action="zoom-out" aria-label="ย่อแผนที่">${icon('minus')}</button><button class="icon-button" data-action="recenter" aria-label="กลับมุมมองเริ่มต้น">${icon('target')}</button><button class="icon-button" data-action="zoom-in" aria-label="ขยายแผนที่">${icon('plus')}</button></div></div>
    </main>
    <section class="building-dock" id="building-dock" aria-label="สิ่งก่อสร้างในเมือง"></section>
    <footer class="statusbar"><span class="save-state">${icon('check')}<span id="save-status">บันทึกความคืบหน้าอัตโนมัติ</span></span><span class="footer-motto">ทุกอาณาจักรที่ยิ่งใหญ่ เริ่มจากก้าวเล็ก ๆ</span><button data-action="reports">${icon('scroll')}บันทึกอาณาจักร <span id="report-count">0</span></button></footer>
  </div>
  <dialog class="game-dialog" id="game-dialog" aria-labelledby="modal-title"><div id="modal-content"></div></dialog>
  <input type="file" id="restore-file" accept="application/json,.json" hidden>
  <div class="toast-stack" id="toasts" role="status" aria-live="polite" aria-atomic="false"></div>
`;

function countdown(endsAt) {
  const seconds = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
function duration(seconds) { return seconds < 60 ? `${seconds} วินาที` : `${Math.floor(seconds / 60)} นาที ${seconds % 60 ? `${seconds % 60} วินาที` : ''}`; }
function progress(queue) { return Math.max(0, Math.min(100, (Date.now() - queue.startedAt) / (queue.endsAt - queue.startedAt) * 100)); }
function costs(cost, rewards = false) {
  if (!cost) return '';
  return `<div class="cost-grid">${RESOURCE_IDS.filter((id) => cost[id] > 0).map((id) => `<span class="cost-item ${!rewards && state.resources[id] < cost[id] ? 'unaffordable' : ''}" title="${RESOURCE_NAMES[id]}"><span class="mini-resource ${id}">${icon(id)}</span><b>${rewards ? '+' : ''}${number(cost[id])}</b><small>${RESOURCE_NAMES[id]}</small></span>`).join('')}</div>`;
}
function queueCard(kind, queue) {
  const data = kind === 'building' ? item(BUILDINGS, queue.buildingId) : kind === 'training' ? item(TROOPS, queue.troopId) : item(WORLD_NODES, queue.nodeId);
  const glyph = kind === 'building' ? 'hammer' : kind === 'training' ? 'swords' : 'flag';
  const label = kind === 'building' ? `อัปเกรด${data.name}` : kind === 'training' ? `ฝึก${data.name} ${queue.count} นาย` : `เดินทัพ · ${data.name}`;
  return `<div class="queue-card"><span class="queue-icon">${icon(glyph)}</span><div><b>${label}</b><small>${kind === 'building' ? `ระดับ ${queue.targetLevel}` : kind === 'training' ? 'กำลังเตรียมความพร้อม' : 'กองทัพกำลังเดินทาง'}</small><div class="progress-track"><i data-progress-start="${queue.startedAt}" data-progress-end="${queue.endsAt}" style="width:${progress(queue)}%"></i></div></div><span class="queue-timer" data-countdown="${queue.endsAt}">${countdown(queue.endsAt)}</span></div>`;
}
function renderHud() {
  const quest = QUESTS.find(({ id }) => !state.quests.claimed.includes(id));
  const qp = quest ? getQuestProgress(state, quest.id) : null;
  $('#quest-hud').innerHTML = quest ? `
    <div class="hud-eyebrow">${icon('scroll')} เส้นทางแห่งตำนาน <span>${state.quests.claimed.length + 1}/${QUESTS.length}</span></div>
    <div class="quest-symbol">${icon(qp.complete ? 'gift' : 'flag')}</div><h2>${quest.title}</h2><p>${quest.description}</p>
    <div class="quest-meter"><span>${qp.complete ? 'ภารกิจสำเร็จแล้ว' : 'ความคืบหน้า'}</span><b>${qp.current}/${qp.target}</b></div>
    <div class="progress-track"><i style="width:${qp.ratio * 100}%"></i></div>
    <div class="quest-reward"><span>รางวัล</span><b>${icon('sparkles')} ${quest.xp} XP</b></div>
    <button class="button ${qp.complete ? 'primary' : 'soft'} full" data-action="${qp.complete ? 'claim' : 'quest-guide'}" data-id="${quest.id}">${qp.complete ? 'รับรางวัลภารกิจ' : 'ไปทำภารกิจ'}${icon('arrow')}</button>
    <button class="text-button all-quests" data-tab="quests">ดูภารกิจทั้งหมด ${icon('chevron')}</button>` : `<div class="quest-symbol">${icon('trophy')}</div><h2>ตำนานของคุณ</h2><p>ทุกภารกิจสำเร็จแล้ว อาณาจักรยังคงเติบโตต่อไป</p><button class="button soft full" data-tab="world">ออกสำรวจต่อ ${icon('arrow')}</button>`;
  const queues = Object.entries(state.queues).filter(([, q]) => q);
  $('#activity-hud').innerHTML = `
    <div class="hud-eyebrow">${icon('clock')} ความเคลื่อนไหว <span>${queues.length}</span></div>
    ${queues.length ? queues.map(([kind, queue]) => queueCard(kind, queue)).join('') : `<div class="peaceful-state"><span>${icon('hammer')}</span><b>ช่างก่อสร้างพร้อมแล้ว</b><p>เลือกอาคารเพื่อพัฒนาเมือง</p></div>`}
    <div class="hud-divider"></div><button class="army-summary" data-tab="army"><span class="army-summary-icon">${icon('shield')}</span><div><b>กองทัพของคุณ</b><span><strong>${getArmySize(state)}</strong> นายพร้อมประจำการ</span></div>${icon('chevron')}</button>
    <button class="hero-mini" data-action="hero" data-id="rama">${portrait('rama')}<div><small>วีรชนประจำนคร</small><b>พระราม <span>Lv. ${state.hero.level}</span></b></div>${state.hero.points > 0 ? `<i class="points-badge">+${state.hero.points}</i>` : icon('chevron')}</button>`;
  $('#building-dock').innerHTML = `<div class="dock-label"><span class="eyebrow">BUILD YOUR LEGACY</span><b>พัฒนาอาณาจักร</b><span>${BUILDINGS.length} สิ่งก่อสร้าง</span></div><div class="building-list">${BUILDINGS.map((building) => `<button class="building-card ${state.queues.building?.buildingId === building.id ? 'constructing' : ''}" data-action="building" data-id="${building.id}"><span class="building-icon building-${building.id}">${icon(building.icon)}</span><span class="building-card-name">${building.name}</span><span class="level-tag">${state.queues.building?.buildingId === building.id ? `${icon('hammer')} กำลังสร้าง` : `ระดับ ${state.buildings[building.id]}`}</span></button>`).join('')}</div>`;
  $('#report-count').textContent = state.events.length;
  const hasReward = QUESTS.some((q) => { const p = getQuestProgress(state, q.id); return p.complete && p.unlocked && !p.claimed; });
  document.querySelector('.quest-dot').hidden = !hasReward;
}
function updateNumbers() {
  const rates = getRates(state);
  const cap = getCapacity(state);
  for (const id of RESOURCE_IDS) {
    $(`[data-resource="${id}"]`).textContent = number(state.resources[id]);
    $(`[data-rate="${id}"]`).innerHTML = `+${rates[id]}<small>/นาที</small>`;
    $(`[data-resource-fill="${id}"]`).style.width = `${state.resources[id] / cap * 100}%`;
  }
  document.querySelectorAll('[data-palace-level]').forEach((el) => { el.textContent = state.buildings.palace; });
  document.querySelectorAll('[data-countdown]').forEach((el) => { el.textContent = countdown(Number(el.dataset.countdown)); });
  document.querySelectorAll('[data-progress-start]').forEach((el) => { el.style.width = `${progress({ startedAt: Number(el.dataset.progressStart), endsAt: Number(el.dataset.progressEnd) })}%`; });
}
function refresh(all = true) {
  updateNumbers();
  if (all) {
    renderHud();
    if (!['city', 'world'].includes(activeTab)) renderScreen();
  }
  village?.setState(state);
  world?.setState(state);
  if (activeTab === 'world') $('#view-description').textContent = `${state.completedNodes.length} / ${WORLD_NODES.length} ดินแดนที่พิชิต · ตำนานรอให้คุณค้นพบ`;
}
function changeTab(tab) {
  if (!navItems.some(([id]) => id === tab)) return;
  activeTab = tab;
  document.querySelectorAll('.nav-item').forEach((button) => { button.classList.toggle('active', button.dataset.tab === tab); button.setAttribute('aria-current', button.dataset.tab === tab ? 'page' : 'false'); });
  const isMap = tab === 'city' || tab === 'world';
  $('#village').hidden = tab !== 'city';
  $('#world-map').hidden = tab !== 'world';
  $('#screen-panel').hidden = isMap;
  $('#quest-hud').hidden = !isMap;
  $('#activity-hud').hidden = !isMap;
  $('.stage-title').hidden = !isMap;
  $('.scene-weather').hidden = !isMap;
  $('.map-bottom').hidden = !isMap;
  $('#building-dock').hidden = tab !== 'city';
  $('#game-stage').classList.toggle('content-mode', !isMap);
  $('#view-eyebrow').textContent = tab === 'world' ? 'EXPLORE HIMMAPAN' : 'YOUR KINGDOM';
  $('#view-title').textContent = tab === 'world' ? 'ดินแดนหิมพานต์' : state.cityName;
  $('#view-description').textContent = tab === 'world' ? `${state.completedNodes.length} / ${WORLD_NODES.length} ดินแดนที่พิชิต · ตำนานรอให้คุณค้นพบ` : 'จากเมืองเล็ก ๆ สู่ตำนานบทใหม่';
  $('#map-hint-text').textContent = tab === 'world' ? 'เลือกจุดหมายเพื่อออกสำรวจ · ลากเพื่อเลื่อนแผนที่' : 'แตะอาคารเพื่อจัดการ · ลากเพื่อหมุนมุมมอง';
  village?.setMode(tab === 'city' ? 'city' : 'world');
  if (tab === 'city') requestAnimationFrame(() => village?.resize());
  if (tab === 'world') world?.setState(state);
  if (!isMap) renderScreen();
  audio.play();
}
function screenHeader(kicker, title, description, aside = '') {
  return `<div class="screen-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${description}</p></div>${aside}</div>`;
}
function renderScreen() {
  const panel = $('#screen-panel');
  if (activeTab === 'army') {
    const queue = state.queues.training;
    panel.innerHTML = `${screenHeader('THE ROYAL ARMY', 'กองทัพแห่งอโยธยา', 'รวบรวมผู้กล้า ฝึกฝนกองทัพ แล้วออกไปเขียนตำนานของคุณ', `<div class="power-pill">${icon('swords')}<div><small>พลังรบทั้งหมด</small><b>${number(getArmyPower(state))}</b></div></div>`)}
      <div class="army-info-strip"><span>${icon('users')} พร้อมประจำการ <b>${getArmySize(state)} นาย</b></span><span>${icon('city')} ค่ายทหาร <b>ระดับ ${state.buildings.barracks}</b></span><button class="text-button" data-action="building" data-id="barracks">อัปเกรดค่าย ${icon('arrow')}</button></div>
      ${queue ? `<div class="wide-queue">${queueCard('training', queue)}</div>` : ''}
      <div class="troop-grid">${TROOPS.map((troop, index) => { const locked = state.buildings.barracks < troop.unlockBarracks; return `<article class="troop-card"><div class="troop-art troop-art-${index}"><div class="troop-watermark">${icon(troop.icon)}</div><span class="unit-type">${troop.title}</span><span class="unit-count">${number(state.army[troop.id])}<small>นาย</small></span><div class="unit-symbol">${icon(troop.icon)}</div></div><div class="troop-body"><div class="card-title-row"><h2>${troop.name}</h2><span class="tag">${locked ? `ค่ายระดับ ${troop.unlockBarracks}` : 'พร้อมฝึก'}</span></div><p>${troop.description}</p><div class="unit-stats"><span>${icon('swords')} โจมตี <b>${troop.attack}</b></span><span>${icon('shield')} ป้องกัน <b>${troop.defense}</b></span></div>${costs(troop.baseCost)}<button class="button ${locked ? 'soft' : 'primary'} full" data-action="${locked ? 'building' : 'train'}" data-id="${locked ? 'barracks' : troop.id}">${icon(locked ? 'lock' : 'plus')}${locked ? 'พัฒนาค่ายเพื่อปลดล็อก' : 'ฝึกทหาร'}</button></div></article>`; }).join('')}</div>
      <div class="section-callout"><span>${icon('map')} กองทัพพร้อมแล้ว? เลือกจุดหมายแรกบนแผนที่หิมพานต์</span><button class="button soft" data-tab="world">ออกสำรวจ ${icon('arrow')}</button></div>`;
  } else if (activeTab === 'heroes') {
    panel.innerHTML = `${screenHeader('HEROES OF THE LEGEND', 'วีรชนแห่งตำนาน', 'พลังแห่งศรัทธา ความกล้าหาญ และผู้นำที่คุณเลือกจะเป็น')}
      <div class="hero-grid">${HEROES.map((hero, index) => `<article class="hero-card ${index === 0 ? 'hero-active' : ''}"><div class="hero-art">${portrait(hero.id)}<span class="hero-faction">${hero.faction}</span>${hero.available ? `<span class="active-hero"><i></i> วีรชนประจำนคร</span>` : '<span class="legend-tag">สมุดภาพตำนาน</span>'}</div><div class="hero-card-info"><div><small>${hero.title}</small><h2>${hero.name}</h2></div>${hero.available ? `<span class="hero-level">Lv. ${state.hero.level}</span>` : icon('sparkles')}</div><p>${hero.description}</p><button class="button ${hero.available ? 'primary' : 'soft'} full" data-action="hero" data-id="${hero.id}">${hero.available ? `พัฒนาวีรชน${state.hero.points > 0 ? ` · ${state.hero.points} แต้ม` : ''}` : 'อ่านเรื่องราว'}${icon('arrow')}</button></article>`).join('')}</div>`;
  } else if (activeTab === 'quests') {
    panel.innerHTML = `${screenHeader('WRITE YOUR OWN LEGEND', 'เส้นทางแห่งตำนาน', 'ทุกภารกิจคืออีกก้าวของอาณาจักร รับรางวัลแล้วออกเดินทางต่อ', `<div class="quest-total">${icon('trophy')}<b>${state.quests.claimed.length}<span> / ${QUESTS.length}</span></b><small>ภารกิจสำเร็จ</small></div>`)}
      <div class="quest-list">${QUESTS.map((quest, index) => { const p = getQuestProgress(state, quest.id); return `<article class="quest-row ${p.claimed ? 'claimed' : ''} ${!p.unlocked ? 'locked' : ''}"><span class="quest-index">${p.claimed ? icon('check') : String(index + 1).padStart(2, '0')}</span><div class="quest-row-content"><div><span class="eyebrow">CHAPTER ${String(index + 1).padStart(2, '0')}</span><h2>${quest.title}</h2><p>${quest.description}</p></div><div class="quest-row-progress"><div class="progress-track"><i style="width:${p.ratio * 100}%"></i></div><small>${p.current} / ${p.target}</small></div></div><div class="quest-row-reward"><span>${icon('sparkles')} ${quest.xp} XP</span>${costs(quest.reward, true)}</div><button class="button ${p.complete && p.unlocked && !p.claimed ? 'primary' : 'soft'}" data-action="${p.complete ? 'claim' : 'quest-guide'}" data-id="${quest.id}" ${p.claimed || !p.unlocked ? 'disabled' : ''}>${p.claimed ? 'รับรางวัลแล้ว' : !p.unlocked ? `${icon('lock')} ยังไม่ปลดล็อก` : p.complete ? 'รับรางวัล' : `ไปทำภารกิจ ${icon('arrow')}`}</button></article>`; }).join('')}</div>`;
  }
}

function openModal(type, id, options = {}) {
  if (!$('#game-dialog').open) lastFocus = document.activeElement;
  modal = { type, id };
  if (!options.keepCount) modalCount = type === 'train' ? 3 : type === 'expedition' ? getArmySize(state) : 1;
  if (type === 'building') village?.setSelected(id);
  if (type === 'expedition') world?.setSelected(id);
  renderModal();
  if (!$('#game-dialog').open) $('#game-dialog').showModal();
  audio.play();
}
function closeModal() {
  $('#game-dialog').close();
  modal = null;
  pendingRestore = null;
  village?.setSelected(null);
  world?.setSelected(null);
  lastFocus?.focus?.({ preventScroll: true });
}
function modalHeading(eyebrow, title, subtitle = '') {
  return `<button class="icon-button modal-close" data-action="close" aria-label="ปิดหน้าต่าง">${icon('close')}</button><div class="modal-heading"><span class="eyebrow">${eyebrow}</span><h2 id="modal-title">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>`;
}
function renderModal() {
  if (!modal) return;
  const { type, id } = modal;
  let html = '';
  if (type === 'building') {
    const building = item(BUILDINGS, id);
    const level = state.buildings[id];
    const cost = getUpgradeCost(state, id);
    const queue = state.queues.building;
    const maxed = !cost;
    const palaceLocked = id !== 'palace' && level + 1 > state.buildings.palace + 1;
    const rates = getRates(state);
    const nextState = { ...state, buildings: { ...state.buildings, [id]: level + 1 } };
    const benefit = building.resource ? ['ผลผลิตต่อนาที', `+${rates[building.resource]}`, `+${getRates(nextState)[building.resource]}`] : id === 'palace' || id === 'market' ? ['ความจุคลังต่อทรัพยากร', number(getCapacity(state)), number(getCapacity(nextState))] : id === 'barracks' ? ['ความเร็วในการฝึก', `${Math.round((1 + (level - 1) * 0.1) * 100)}%`, `${Math.round((1 + level * 0.1) * 100)}%`] : ['ระดับการสนับสนุนกองทัพ', level, level + 1];
    html = `<div class="building-modal-art building-${id}"><div class="large-line-art">${icon(building.icon)}</div><span class="floating-level">ระดับ ${level}</span></div>${modalHeading('GROW YOUR KINGDOM', building.name, building.subtitle)}<div class="modal-body"><p>${building.description}</p><div class="upgrade-comparison"><span>${benefit[0]}</span><div><b>${benefit[1]}</b>${icon('arrow')}<strong>${maxed ? 'สูงสุด' : benefit[2]}</strong></div></div>${queue?.buildingId === id ? queueCard('building', queue) : maxed ? '<div class="notice success">สิ่งก่อสร้างนี้ถึงระดับสูงสุดแล้ว</div>' : `<h3 class="small-heading">ทรัพยากรที่ต้องใช้</h3>${costs(cost)}<div class="duration-line">${icon('clock')} ระยะเวลาก่อสร้าง <b>${duration(getUpgradeDuration(state, id))}</b></div><button class="button primary full large" data-action="upgrade" data-id="${id}" ${queue || !canAfford(state, cost) || palaceLocked ? 'disabled' : ''}>${icon('hammer')} อัปเกรดเป็นระดับ ${level + 1}</button>${queue ? '<p class="action-note">ช่างกำลังก่อสร้างอาคารอื่นอยู่</p>' : palaceLocked ? `<p class="action-note">ต้องมีพระราชวังระดับ ${level} ก่อน</p>` : !canAfford(state, cost) ? '<p class="action-note">ทรัพยากรยังไม่พอ เมืองกำลังผลิตเพิ่มให้คุณ</p>' : ''}`}${id === 'barracks' ? '<button class="text-button full" data-action="go-army">ไปจัดการกองทัพ →</button>' : ''}</div>`;
  } else if (type === 'train') {
    const troop = item(TROOPS, id);
    const cost = getTrainingCost(state, id, modalCount);
    const locked = state.buildings.barracks < troop.unlockBarracks;
    html = `${modalHeading('PREPARE YOUR ARMY', `ฝึก${troop.name}`, troop.description)}<div class="modal-body"><div class="training-emblem">${icon(troop.icon)}<div><span>พร้อมประจำการ</span><b>${state.army[id]} นาย</b></div><div><span>พลังโจมตีต่อนาย</span><b>${troop.attack}</b></div></div><label class="field-label" for="troop-count">จำนวนทหารที่ต้องการฝึก</label><div class="stepper"><button data-action="count-less" aria-label="ลดจำนวน">${icon('minus')}</button><input id="troop-count" type="number" min="1" max="50" value="${modalCount}" inputmode="numeric"><span>นาย</span><button data-action="count-more" aria-label="เพิ่มจำนวน">${icon('plus')}</button></div><div class="quick-counts">${[1, 3, 6, 10, 20].map((n) => `<button data-action="set-count" data-count="${n}" class="${n === modalCount ? 'selected' : ''}">${n} นาย</button>`).join('')}</div><div id="training-cost">${costs(cost)}</div><div class="duration-line">${icon('clock')} ระยะเวลาฝึก <b id="training-duration">${duration(getTrainingDuration(state, id, modalCount))}</b></div>${state.queues.training ? queueCard('training', state.queues.training) : ''}<button class="button primary full large" id="train-confirm" data-action="train-confirm" data-id="${id}" ${locked || state.queues.training || !canAfford(state, cost) ? 'disabled' : ''}>${icon('swords')} เริ่มฝึก ${modalCount} นาย</button><p class="action-note" id="training-note">${locked ? `ต้องมีค่ายทหารระดับ ${troop.unlockBarracks}` : state.queues.training ? 'รอให้การฝึกปัจจุบันเสร็จก่อน' : !canAfford(state, cost) ? 'ทรัพยากรยังไม่พอสำหรับจำนวนนี้' : 'ทหารจะเข้าประจำการเมื่อการฝึกทั้งชุดเสร็จสิ้น'}</p></div>`;
  } else if (type === 'expedition') {
    const node = item(WORLD_NODES, id);
    const preview = getExpeditionPreview(state, id, modalCount);
    html = `<div class="expedition-banner"><span>${icon(node.kind === 'forest' ? 'trees' : node.kind === 'mountain' ? 'mountain' : 'city')}</span><div><small>HIMMAPAN EXPEDITION</small><b>ดินแดนที่ ${WORLD_NODES.indexOf(node) + 1}</b></div><span class="tag ${preview.completed ? 'completed-tag' : ''}">${preview.completed ? 'พิชิตแล้ว' : `พลังศัตรู ${node.threat}`}</span></div>${modalHeading('AN ADVENTURE AWAITS', node.name, node.subtitle)}<div class="modal-body"><p>${node.description}</p><label class="field-label" for="expedition-count">กองทัพที่จะส่งไป <b>พร้อม ${getArmySize(state)} นาย</b></label><div class="stepper"><button data-action="count-less" aria-label="ลดจำนวน">${icon('minus')}</button><input id="expedition-count" type="number" min="1" max="${Math.max(1, getArmySize(state))}" value="${modalCount}" inputmode="numeric"><span>นาย</span><button data-action="count-more" aria-label="เพิ่มจำนวน">${icon('plus')}</button></div><input class="troop-range" id="expedition-range" aria-label="เลือกจำนวนกองทัพ" type="range" min="1" max="${Math.max(1, getArmySize(state))}" value="${Math.max(1, modalCount)}"><div id="expedition-preview">${expeditionDetails(preview, node)}</div><button class="button primary full large" id="expedition-confirm" data-action="expedition-confirm" data-id="${id}" ${!preview.available ? 'disabled' : ''}>${icon('flag')} ส่งกองทัพออกเดินทาง</button><p class="action-note" id="expedition-note">${preview.reason || 'ทหารที่รอดชีวิตจะกลับพร้อมทรัพยากรเมื่อจบการเดินทาง'}</p></div>`;
  } else if (type === 'hero') {
    const hero = item(HEROES, id);
    html = `<div class="hero-modal-art">${portrait(id)}</div>${modalHeading(hero.faction.toUpperCase(), hero.name, hero.title)}<div class="modal-body">${hero.available ? `<div class="hero-xp"><span>ระดับ ${state.hero.level}</span><span>${state.hero.xp} / ${state.hero.level * 100} XP</span></div><div class="progress-track"><i style="width:${state.hero.xp / (state.hero.level * 100) * 100}%"></i></div><div class="points-heading"><h3>ความสามารถวีรชน</h3><span>${state.hero.points} แต้มคงเหลือ</span></div>${[['attack', 'swords', 'พลังโจมตี', '+4.5% พลังทหารต่อแต้ม'], ['defense', 'shield', 'การป้องกัน', 'ลดการสูญเสียกองทัพ'], ['fortune', 'sparkles', 'โชคลาภ', '+3.5% ทรัพยากรต่อแต้ม']].map(([stat, glyph, label, desc]) => `<div class="hero-stat"><span class="stat-icon">${icon(glyph)}</span><div><b>${label}</b><small>${desc}</small></div><strong>${state.hero[stat]}</strong><button class="icon-button" data-action="allocate" data-id="${stat}" aria-label="เพิ่ม${label}" ${state.hero.points < 1 || state.hero[stat] >= 30 ? 'disabled' : ''}>${icon('plus')}</button></div>`).join('')}<p class="action-note">รับประสบการณ์จากการฝึกทหาร ภารกิจ และชัยชนะ</p>` : `<p>${id === 'hanuman' ? 'วานรเผือกผู้เปี่ยมด้วยความกล้าหาญและไหวพริบ ทหารเอกคู่พระรามในวรรณคดีรามเกียรติ์ ผู้ก้าวผ่านอุปสรรคเพื่อภารกิจที่ยิ่งใหญ่กว่า' : 'เจ้าผู้ครองนครลงกา ผู้มีฤทธิ์และอำนาจอันยิ่งใหญ่ ในแคมเปญนี้ นครลงกาคือจุดหมายสุดท้ายของเส้นทางผู้พิทักษ์'}</p><div class="notice">วีรชนนี้เป็นสมุดภาพตำนานในเวอร์ชันปัจจุบัน วีรชนที่พัฒนาความสามารถได้คือพระราม</div>`}</div>`;
  } else if (type === 'reports') {
    html = `${modalHeading('KINGDOM CHRONICLES', 'บันทึกอาณาจักร', 'ทุกก้าวเล็ก ๆ ของเมืองและกองทัพของคุณ')}<div class="modal-body reports-body">${state.events.length ? state.events.map((event) => `<article class="report-entry"><span class="report-symbol ${event.kind}">${icon(event.kind === 'victory' || event.kind === 'campaign' ? 'trophy' : event.kind === 'building' ? 'hammer' : event.kind === 'training' ? 'swords' : event.kind === 'defeat' ? 'shield' : 'sparkles')}</span><div><small>${new Date(event.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</small><h3>${esc(event.title)}</h3><p>${esc(event.message)}</p>${event.rewards ? costs(event.rewards, true) : ''}</div></article>`).join('') : `<div class="empty-state">${icon('scroll')}<h3>หน้าแรกของตำนานยังว่างอยู่</h3><p>เริ่มพัฒนาเมืองหรือออกสำรวจ แล้วเรื่องราวจะปรากฏที่นี่</p><button class="button primary" data-action="start-building">เริ่มพัฒนาเมือง ${icon('arrow')}</button></div>`}</div>`;
  } else if (type === 'settings') {
    html = `${modalHeading('YOUR LITTLE KINGDOM', 'ตั้งค่าอาณาจักร', 'ให้เมืองแห่งนี้เป็นเรื่องราวในแบบของคุณ')}<div class="modal-body"><label class="field-label" for="city-name-input">ชื่ออาณาจักร</label><div class="name-field"><input id="city-name-input" maxlength="28" value="${esc(state.cityName)}" autocomplete="off"><button class="button primary" data-action="rename">บันทึก</button></div><div class="settings-row"><div>${icon('volume')}<span><b>เสียงตอบรับ</b><small>เสียงเมื่อเลือกและทำภารกิจสำเร็จ</small></span></div><button class="toggle ${audio.enabled ? 'on' : ''}" data-action="sound" aria-label="เปิดปิดเสียง" aria-pressed="${audio.enabled}"><i></i></button></div><div class="settings-row"><div>${icon('moon')}<span><b>บรรยากาศยามค่ำ</b><small>เปลี่ยนแสงและบรรยากาศของเมือง</small></span></div><button class="toggle ${night ? 'on' : ''}" data-action="night" aria-label="เปิดปิดโหมดกลางคืน" aria-pressed="${night}"><i></i></button></div><div class="save-notice">${icon('save')}<div><b>${saveFailed ? 'เบราว์เซอร์ไม่อนุญาตให้บันทึก' : 'บันทึกบนอุปกรณ์นี้อัตโนมัติ'}</b><p>เมืองผลิตทรัพยากรระหว่างที่คุณไม่อยู่ได้สูงสุด 2 ชั่วโมง การล้างข้อมูลเบราว์เซอร์จะลบเกมที่บันทึกไว้</p></div></div><button class="button soft full" data-action="export">${icon('download')} สำรองความคืบหน้าเป็นไฟล์</button><div class="settings-divider"></div><button class="text-button danger" data-action="reset-prompt">${icon('reset')} เริ่มอาณาจักรใหม่</button><p class="version-note">RAMA v1.0 · เกมผู้เล่นคนเดียว</p></div>`;
  } else if (type === 'restore') {
    html = `${modalHeading('CONTINUE YOUR STORY', 'กู้คืนอาณาจักรจากไฟล์?', 'ตรวจสอบอาณาจักรก่อนแทนที่เกมที่บันทึกไว้บนอุปกรณ์นี้')}<div class="modal-body"><div class="restore-summary"><b>${esc(pendingRestore.cityName)}</b><p>พระราชวังระดับ ${pendingRestore.buildings.palace} · ทหาร ${getArmySize(pendingRestore)} นาย · พิชิต ${pendingRestore.completedNodes.length} ดินแดน</p></div><p>ความคืบหน้าปัจจุบันจะถูกแทนที่ด้วยเกมจากไฟล์สำรอง กรุณาสำรองเกมปัจจุบันก่อนหากต้องการเก็บไว้</p><div class="button-row"><button class="button soft" data-action="settings">กลับไปก่อน</button><button class="button primary" data-action="restore-confirm">ยืนยันกู้คืน</button></div></div>`;
  } else if (type === 'reset') {
    html = `${modalHeading('A NEW BEGINNING', 'เริ่มอาณาจักรใหม่?', 'ความคืบหน้าบนอุปกรณ์นี้จะถูกแทนที่ด้วยเมืองเริ่มต้น')}<div class="modal-body"><p>สิ่งก่อสร้าง กองทัพ ภารกิจ และบันทึกการเดินทางจะเริ่มใหม่ทั้งหมด คุณสามารถสำรองไฟล์ก่อนเริ่มใหม่ได้</p><div class="button-row"><button class="button soft" data-action="settings">กลับไปก่อน</button><button class="button danger-button" data-action="reset-confirm">ยืนยันเริ่มใหม่</button></div></div>`;
  } else if (type === 'victory') {
    html = `${modalHeading('A LEGEND IS BORN', 'คุณได้เขียนตำนานบทใหม่', 'นครลงกาได้รับการพิชิต แผ่นดินหิมพานต์กลับมาสงบอีกครั้ง')}<div class="modal-body victory-body"><div class="victory-medal">${icon('trophy')}</div><h3>ผู้พิทักษ์แห่งหิมพานต์</h3><p>${esc(state.cityName)} เดินทางมาถึงชัยชนะสุดท้ายแล้ว เมืองของคุณยังเติบโตได้ และคุณสามารถกลับไปสำรวจทุกดินแดนได้อีก</p><div class="victory-stats"><span><b>${state.stats.upgrades}</b>ครั้งที่พัฒนาเมือง</span><span><b>${state.stats.victories}</b>ชัยชนะ</span><span><b>${state.hero.level}</b>ระดับวีรชน</span></div><button class="button primary full" data-action="close">กลับสู่อาณาจักร ${icon('arrow')}</button></div>`;
  } else {
    html = `${modalHeading('WELCOME TO RAMA', 'อาณาจักรของคุณเริ่มต้นที่นี่', 'สร้างเมือง รวบรวมผู้กล้า และออกเดินทางสู่ดินแดนหิมพานต์')}<div class="modal-body"><div class="help-steps">${[['city', 'พัฒนาเมือง', 'แตะอาคารบนแผนที่หรือแถบด้านล่างเพื่ออัปเกรด เมืองจะผลิตทรัพยากรให้อัตโนมัติ'], ['swords', 'เตรียมกองทัพ', 'ไปที่กองทัพเพื่อฝึกทหาร พัฒนาค่ายระดับ 2 เพื่อปลดล็อกวานรศึก'], ['map', 'ออกผจญภัย', 'เลือกพื้นที่บนแผนที่โลก ดูพลังรบและความเสี่ยง แล้วส่งทหารออกเดินทาง'], ['gift', 'รับรางวัลและเติบโต', 'รับรางวัลจากภารกิจ ใช้แต้มวีรชนเพิ่มพลัง และพิชิตนครลงกาเพื่อจบแคมเปญ']].map(([glyph, title, description], index) => `<div class="help-step"><span>${icon(glyph)}</span><div><small>0${index + 1}</small><h3>${title}</h3><p>${description}</p></div></div>`).join('')}</div><div class="notice">เล่นได้ทั้งมือถือและคอมพิวเตอร์ · เกมบันทึกบนอุปกรณ์นี้โดยอัตโนมัติ</div><button class="button primary full large" data-action="start-building">เริ่มสร้างตำนาน ${icon('arrow')}</button></div>`;
  }
  $('#modal-content').innerHTML = html;
  $('#game-dialog').className = `game-dialog modal-${type}`;
  if (type === 'settings') {
    const restore = document.createElement('button');
    restore.className = 'button soft full';
    restore.dataset.action = 'restore-pick';
    restore.innerHTML = `${icon('save')} กู้คืนความคืบหน้าจากไฟล์`;
    $('[data-action="export"]').after(restore);
  }
}
function expeditionDetails(preview, node) {
  return `<div class="battle-comparison"><div><small>พลังทัพของคุณ</small><b class="${preview.willWin ? 'positive' : 'negative'}">${number(preview.power)}</b></div><span>VS</span><div><small>พลังฝ่ายตรงข้าม</small><b>${node.threat}</b></div></div><div class="battle-outcome ${preview.willWin ? 'likely-win' : 'likely-loss'}">${icon(preview.willWin ? 'shield' : 'help')}<span>${preview.willWin ? 'กองทัพพร้อมสำหรับชัยชนะ' : 'พลังรบยังไม่พอ ควรเสริมกำลังก่อน'}<small>คาดว่าสูญเสีย ${preview.estimatedLosses} นาย · เสบียง ${preview.cost.rice} ข้าว</small></span></div><h3 class="small-heading">ทรัพยากรเมื่อชนะ</h3>${costs(preview.rewards, true)}<div class="duration-line">${icon('clock')} เดินทางและกลับเมือง <b>${duration(node.duration)}</b></div>`;
}
function updateCount(value) {
  const limit = modal?.type === 'train' ? 50 : Math.max(1, getArmySize(state));
  modalCount = Math.max(1, Math.min(limit, Math.floor(Number(value)) || 1));
  if (modal?.type === 'train') {
    const input = $('#troop-count');
    if (input) input.value = modalCount;
    const cost = getTrainingCost(state, modal.id, modalCount);
    $('#training-cost').innerHTML = costs(cost);
    $('#training-duration').textContent = duration(getTrainingDuration(state, modal.id, modalCount));
    const locked = state.buildings.barracks < item(TROOPS, modal.id).unlockBarracks;
    $('#train-confirm').disabled = Boolean(locked || state.queues.training || !canAfford(state, cost));
    $('#train-confirm').innerHTML = `${icon('swords')} เริ่มฝึก ${modalCount} นาย`;
    $('#training-note').textContent = state.queues.training ? 'รอให้การฝึกปัจจุบันเสร็จก่อน' : !canAfford(state, cost) ? 'ทรัพยากรยังไม่พอสำหรับจำนวนนี้' : 'ทหารจะเข้าประจำการเมื่อการฝึกทั้งชุดเสร็จสิ้น';
    document.querySelectorAll('[data-action="set-count"]').forEach((button) => button.classList.toggle('selected', Number(button.dataset.count) === modalCount));
  } else if (modal?.type === 'expedition') {
    $('#expedition-count').value = modalCount;
    $('#expedition-range').value = modalCount;
    const preview = getExpeditionPreview(state, modal.id, modalCount);
    $('#expedition-preview').innerHTML = expeditionDetails(preview, item(WORLD_NODES, modal.id));
    $('#expedition-confirm').disabled = !preview.available;
    $('#expedition-note').textContent = preview.reason || 'ทหารที่รอดชีวิตจะกลับพร้อมทรัพยากรเมื่อจบการเดินทาง';
  }
}
function toast(message, type = 'success') {
  const element = document.createElement('div');
  element.className = `toast toast-${type}`;
  element.innerHTML = `<span>${icon(type === 'error' ? 'help' : type === 'info' ? 'sparkles' : 'check')}</span><p>${esc(message)}</p><button aria-label="ปิดการแจ้งเตือน">${icon('close')}</button>`;
  element.querySelector('button').onclick = () => element.remove();
  $('#toasts').append(element);
  while ($('#toasts').children.length > 3) $('#toasts').firstElementChild.remove();
  setTimeout(() => element.remove(), 6000);
}
function save() {
  try {
    localStorage.setItem(SAVE_KEY, serializeGame(state));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ night, sound: audio.enabled }));
    saveFailed = false;
    $('#save-status').textContent = 'บันทึกความคืบหน้าแล้ว';
  } catch {
    if (!saveFailed) toast('เบราว์เซอร์นี้ไม่อนุญาตให้บันทึก เปิดตั้งค่าเพื่อสำรองความคืบหน้าเป็นไฟล์', 'info');
    saveFailed = true;
    $('#save-status').textContent = 'ยังบันทึกไม่ได้ · สำรองไฟล์ในตั้งค่า';
  }
  lastSave = Date.now();
}
function perform(action, { close = false } = {}) {
  advanceGame();
  const result = action();
  toast(result.message, result.ok ? 'success' : 'error');
  audio.play(result.ok ? 'success' : 'error');
  if (result.ok) {
    if (close) closeModal();
    refresh();
    save();
    if (modal) renderModal();
    lastEvent = state.eventSerial;
  }
}
function advanceGame() {
  const before = state.eventSerial;
  const wasWon = state.campaignWon;
  tick(state);
  const changed = state.eventSerial !== before;
  if (changed) {
    refresh();
    const newEvents = state.events.filter((event) => Number(event.id.replace('event-', '')) > before);
    for (const event of newEvents.slice(0, 2).reverse()) toast(event.message, event.kind === 'defeat' ? 'error' : 'success');
    lastEvent = state.eventSerial;
    audio.play('success');
    if (modal) renderModal();
    if (!wasWon && state.campaignWon) openModal('victory');
    save();
  }
  return changed;
}
function questGuide(id) {
  if ($('#game-dialog').open) closeModal();
  if (id === 'foundation') { changeTab('city'); openModal('building', 'sawmill'); }
  else if (id === 'recruit') { changeTab('army'); openModal('train', 'guardian'); updateCount(6); }
  else if (id === 'growth') { changeTab('city'); openModal('building', 'palace'); }
  else { changeTab('world'); const node = WORLD_NODES.find((n) => !state.completedNodes.includes(n.id)); if (node) openModal('expedition', node.id); }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button, [data-tab]');
  if (!button || button.disabled) return;
  if (button.dataset.tab) { changeTab(button.dataset.tab); return; }
  const { action, id } = button.dataset;
  if (!action) return;
  if (action === 'close') closeModal();
  else if (['building', 'hero', 'train', 'expedition'].includes(action)) openModal(action, id);
  else if (['settings', 'help', 'reports'].includes(action)) openModal(action);
  else if (action === 'upgrade') perform(() => upgradeBuilding(state, id));
  else if (action === 'train-confirm') perform(() => trainTroops(state, id, modalCount), { close: true });
  else if (action === 'expedition-confirm') perform(() => sendExpedition(state, id, modalCount), { close: true });
  else if (action === 'allocate') perform(() => allocateHeroPoint(state, id));
  else if (action === 'claim') perform(() => claimQuest(state, id));
  else if (action === 'quest-guide') questGuide(id);
  else if (action === 'count-less') updateCount(modalCount - 1);
  else if (action === 'count-more') updateCount(modalCount + 1);
  else if (action === 'set-count') updateCount(button.dataset.count);
  else if (action === 'sound') {
    audio.setEnabled(!audio.enabled);
    $('.sound-button').innerHTML = icon(audio.enabled ? 'volume' : 'mute');
    $('.sound-button').setAttribute('aria-label', audio.enabled ? 'ปิดเสียง' : 'เปิดเสียง');
    $('.sound-button').title = audio.enabled ? 'ปิดเสียง' : 'เปิดเสียง';
    save();
    if (modal?.type === 'settings') renderModal();
  } else if (action === 'night') {
    night = !night;
    village?.setNight(night);
    document.body.classList.toggle('night-mode', night);
    $('.weather-button').innerHTML = `${icon(night ? 'moon' : 'sun')}<span>${night ? 'ราตรีสงบ' : 'เช้าอันสงบ'}</span>`;
    $('.weather-button').setAttribute('aria-label', night ? 'เปลี่ยนเป็นกลางวัน' : 'เปลี่ยนเป็นกลางคืน');
    save();
    if (modal?.type === 'settings') renderModal();
  } else if (action === 'zoom-in') (activeTab === 'world' ? world : village)?.zoom(activeTab === 'world' ? 1 : 0.15);
  else if (action === 'zoom-out') (activeTab === 'world' ? world : village)?.zoom(activeTab === 'world' ? -1 : -0.15);
  else if (action === 'recenter') (activeTab === 'world' ? world : village)?.resetCamera();
  else if (action === 'go-army') { closeModal(); changeTab('army'); }
  else if (action === 'start-building') { closeModal(); changeTab('city'); openModal('building', 'sawmill'); }
  else if (action === 'rename') {
    const name = $('#city-name-input').value.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 28);
    if (!name) { toast('กรุณาตั้งชื่ออาณาจักร', 'error'); return; }
    state.cityName = name;
    $('.city-name').textContent = name;
    if (activeTab === 'city') $('#view-title').textContent = name;
    world?.setState(state);
    save();
    toast('บันทึกชื่ออาณาจักรแล้ว');
  } else if (action === 'export') {
    save();
    const url = URL.createObjectURL(new Blob([serializeGame(state)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `rama-save-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('ดาวน์โหลดไฟล์สำรองแล้ว');
  } else if (action === 'restore-pick') $('#restore-file').click();
  else if (action === 'restore-confirm' && pendingRestore) {
    state = pendingRestore;
    lastEvent = state.eventSerial;
    closeModal();
    $('.city-name').textContent = state.cityName;
    changeTab('city');
    refresh();
    save();
    toast('กู้คืนอาณาจักรจากไฟล์สำรองแล้ว');
  } else if (action === 'reset-prompt') openModal('reset');
  else if (action === 'reset-confirm') {
    state = createGame();
    lastEvent = 0;
    closeModal();
    $('.city-name').textContent = state.cityName;
    changeTab('city');
    refresh();
    save();
    toast('เริ่มต้นอาณาจักรใหม่แล้ว');
  }
});
document.addEventListener('input', (event) => {
  if (['troop-count', 'expedition-count', 'expedition-range'].includes(event.target.id)) updateCount(event.target.value);
});
$('#restore-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (file.size > 1_000_000) { toast('ไฟล์สำรองใหญ่เกิน 1 MB', 'error'); return; }
  try {
    const data = JSON.parse(await file.text());
    const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!plainObject(data) || data.version !== 1 || !['resources', 'buildings', 'army', 'hero', 'queues', 'quests', 'stats'].every((key) => plainObject(data[key])) || !Number.isFinite(data.lastTick) || !RESOURCE_IDS.every((key) => Number.isFinite(data.resources[key])) || !BUILDINGS.every(({ id }) => Number.isFinite(data.buildings[id])) || !TROOPS.every(({ id }) => Number.isFinite(data.army[id]))) throw new Error('Invalid backup');
    pendingRestore = loadGame(data);
    openModal('restore');
  } catch { toast('ไฟล์นี้ไม่ใช่ไฟล์สำรอง RAMA ที่รองรับ', 'error'); }
});
$('#game-dialog').addEventListener('click', (event) => { if (event.target === $('#game-dialog')) { const rect = $('#game-dialog').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeModal(); } });
$('#game-dialog').addEventListener('cancel', (event) => { event.preventDefault(); closeModal(); });
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else { advanceGame(); refresh(); if (modal) renderModal(); } });

refresh();
document.body.classList.toggle('night-mode', night);
requestAnimationFrame(() => {
  $('#village').innerHTML = '';
  village = createVillage($('#village'), { onSelect: (id) => openModal('building', id) });
  village.setState(state);
  village.setNight(night);
  world = createWorldMap($('#world-map'), { onSelect: (id) => openModal('expedition', id) });
  world.setState(state);
  if (!storedSave) setTimeout(() => toast('ยินดีต้อนรับสู่อโยธยา! เริ่มจากอัปเกรดโรงเลื่อยเพื่อรับรางวัลภารกิจแรก', 'info'), 1400);
  else if (state.events.length) setTimeout(() => toast('ยินดีต้อนรับกลับ เมืองของคุณเติบโตต่อระหว่างที่คุณไม่อยู่', 'info'), 1200);
});
setInterval(() => {
  if (document.hidden) return;
  const changed = advanceGame();
  if (!changed) refresh(false);
  if (!changed && modal?.type === 'building') {
    const upgrade = $('#game-dialog [data-action="upgrade"]');
    if (upgrade) {
      const cost = getUpgradeCost(state, modal.id);
      const locked = modal.id !== 'palace' && state.buildings[modal.id] + 1 > state.buildings.palace + 1;
      upgrade.disabled = Boolean(state.queues.building || !canAfford(state, cost) || locked);
      const grid = $('#game-dialog .cost-grid');
      if (grid) grid.outerHTML = costs(cost);
    }
  } else if (!changed && (modal?.type === 'train' || modal?.type === 'expedition') && !['troop-count', 'expedition-count', 'expedition-range'].includes(document.activeElement?.id)) updateCount(modalCount);
  if (Date.now() - lastSave > 5000) save();
}, 500);

// A read-only snapshot makes diagnostics possible without exposing a gameplay cheat API.
window.rama = Object.freeze({ getSnapshot: () => JSON.parse(serializeGame(state)), getDiagnostics: () => village?.getDiagnostics(), version: '1.0.0' });
