import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

// Browser integration smoke test. Gameplay changes happen only through the UI.
// window.rama supplies read-only assertions; no engine functions or saves are edited.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'test-results');
const port = Number(process.env.RAMA_SMOKE_PORT || 4178);
assert(Number.isInteger(port) && port >= 1024 && port <= 65535, 'RAMA_SMOKE_PORT must be an integer from 1024 to 65535.');
const origin = `http://127.0.0.1:${port}`;
const newHeroIds = ['lakshman', 'sita', 'sugriva', 'angada', 'jambavan', 'nilaphat', 'vibhishana', 'garuda', 'suphannamatcha', 'macchanu'];
const requiredScreenshots = ['desktop-city.png', 'desktop-heroes.png', 'desktop-world.png', 'desktop-night.png', 'mobile-city.png', 'mobile-building-dialog.png', 'mobile-expedition-dialog.png', 'mobile-hero-dialog.png'];
const report = { status: 'running', target: 'production-preview', timing: 'real-time', startedAt: new Date().toISOString(), viewports: { desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } }, steps: [], navigations: [], queueWaits: [], screenshots: [], captureAttempts: [], errors: [] };
let browser;
let server;
let desktop;
let mobile;
let serverOutput = '';
let serverError;
let shuttingDown = false;
const pageObservations = new Map();

function observeErrors(page, device) {
  const observation = { device, recent: [], pending: new Map() };
  pageObservations.set(page, observation);
  const remember = (event) => {
    observation.recent.push({ at: new Date().toISOString(), ...event });
    if (observation.recent.length > 35) observation.recent.shift();
  };
  page.on('request', (request) => {
    if (request.url().startsWith(origin)) observation.pending.set(request, { path: new URL(request.url()).pathname, type: request.resourceType(), startedAt: Date.now() });
  });
  const requestEnded = (request, failed = false) => {
    const pending = observation.pending.get(request);
    if (pending) remember({ event: failed ? 'requestfailed' : 'requestfinished', path: pending.path, type: pending.type, durationMs: Date.now() - pending.startedAt });
    observation.pending.delete(request);
  };
  page.on('requestfinished', (request) => requestEnded(request));
  page.on('domcontentloaded', () => remember({ event: 'domcontentloaded' }));
  page.on('load', () => remember({ event: 'load' }));
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) remember({ event: 'navigation', url: frame.url() }); });
  page.on('crash', () => {
    remember({ event: 'crash' });
    report.errors.push({ device, type: 'pagecrash', message: 'Chromium page crashed.' });
  });
  page.on('close', () => remember({ event: 'close' }));
  page.on('pageerror', (error) => report.errors.push({ device, type: 'pageerror', message: error.message }));
  page.on('console', (message) => {
    if (message.type() === 'error') report.errors.push({ device, type: 'console', message: message.text() });
  });
  page.on('response', (response) => {
    if (response.url().startsWith(origin) && response.status() >= 400) report.errors.push({ device, type: 'http', status: response.status(), url: response.url() });
  });
  page.on('requestfailed', (request) => {
    requestEnded(request, true);
    const message = request.failure()?.errorText || 'Request failed';
    if (request.url().startsWith(origin) && !message.includes('ERR_ABORTED')) report.errors.push({ device, type: 'request', message, url: request.url() });
  });
}

async function step(name, operation) {
  const startedAt = Date.now();
  try {
    await operation();
    report.steps.push({ name, status: 'passed', durationMs: Date.now() - startedAt });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.steps.push({ name, status: 'failed', durationMs: Date.now() - startedAt, message: error.message });
    throw error;
  }
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (serverError) throw serverError;
    if (server.exitCode !== null) throw new Error(`Vite preview exited with code ${server.exitCode}:\n${serverOutput}`);
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* Wait for this process's production preview to finish starting. */ }
    await delay(150);
  }
  throw new Error(`Vite preview did not become ready at ${origin}:\n${serverOutput}`);
}

const snapshot = (page) => page.evaluate(() => window.rama.getSnapshot());

function assertSharedHeroProgress(after, before) {
  for (const key of ['level', 'xp', 'points', 'attack', 'defense', 'fortune']) {
    assert.equal(after[key], before[key], `Selecting another hero must preserve shared ${key}.`);
  }
}

async function readArmyPower(page) {
  await page.locator('.main-nav [data-tab="army"]').click();
  const value = Number((await page.locator('.power-pill b').textContent()).replace(/[^\d.-]/g, ''));
  assert(Number.isFinite(value) && value > 0, 'The army screen must show a positive numeric power.');
  return value;
}

async function inspectHeroRoster(page) {
  const ids = await page.locator('#screen-panel .hero-card[data-hero-id]').evaluateAll((cards) => cards.map((card) => card.dataset.heroId));
  assert.deepEqual([...ids].sort(), ['rama', 'hanuman', 'thotsakan', ...newHeroIds].sort(), 'The all-heroes view must contain the original three and all ten new characters.');
  const portraits = await page.evaluate((heroIds) => heroIds.map((id) => {
    const portrait = document.querySelector(`.hero-card[data-hero-id="${id}"] .portrait[data-hero-portrait="${id}"]`);
    const image = portrait?.querySelector('image');
    const href = image?.getAttribute('href');
    return { id, url: href ? new URL(href, document.baseURI).href : null, crop: portrait?.querySelector('svg')?.getAttribute('viewBox') ?? null };
  }), newHeroIds);
  for (const portrait of portraits) {
    assert(portrait.url, `${portrait.id} is missing its portrait image.`);
    assert.equal(new URL(portrait.url).origin, origin, `${portrait.id} must load artwork from this site, not an external host.`);
    assert(portrait.crop, `${portrait.id} is missing its atlas crop.`);
  }
  const atlasUrls = [...new Set(portraits.map((portrait) => portrait.url))];
  assert.equal(atlasUrls.length, 2, 'The ten new portraits must use the two locally bundled expansion atlases.');
  assert.equal(new Set(portraits.map((portrait) => `${portrait.url}#${portrait.crop}`)).size, 10, 'Each added character must have a distinct portrait crop.');
  const atlases = await page.evaluate(async (urls) => Promise.all(urls.map(async (url) => {
    const image = new Image();
    image.src = url;
    let timer;
    try {
      await Promise.race([image.decode(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Portrait atlas did not decode: ${url}`)), 10_000); })]);
      return { path: new URL(url).pathname, width: image.naturalWidth, height: image.naturalHeight };
    } finally { clearTimeout(timer); }
  })), atlasUrls);
  for (const atlas of atlases) assert(atlas.width > 0 && atlas.height > 0, `Portrait atlas is not a decoded image: ${atlas.path}`);
  report.heroRoster = { total: ids.length, added: newHeroIds, uniquePortraitCrops: 10, atlases };
}

async function ready(page) {
  await page.waitForFunction(() => Boolean(window.rama?.getDiagnostics()), null, { timeout: 30_000 });
  const diagnostics = await page.evaluate(() => window.rama.getDiagnostics());
  assert.equal(diagnostics.webgl, true, 'The smoke run requires working WebGL; the accessible fallback is not a 3D pass.');
  await page.waitForFunction(() => window.rama.getDiagnostics().drawCalls > 0 && window.rama.getDiagnostics().triangles > 0, null, { timeout: 15_000 });
  assert.equal(await page.locator('.village-marker').count(), 9, 'All nine city buildings need interactive map markers.');
  assert.equal(await page.locator('.rama-scene-fallback').count(), 0, 'The city unexpectedly entered its non-WebGL fallback.');
  await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 15_000 });
}

async function navigate(page, reload = false) {
  const navigation = { device: pageObservations.get(page)?.device, kind: reload ? 'reload' : 'initial', phase: 'domcontentloaded', startedAt: new Date().toISOString() };
  const startedAt = Date.now();
  try {
    const options = { waitUntil: 'domcontentloaded', timeout: 45_000 };
    const response = reload ? await page.reload(options) : await page.goto(origin, options);
    navigation.httpStatus = response?.status() ?? null;
    navigation.phase = 'application-ready';
    // Navigation completion alone is insufficient. Retain every real WebGL,
    // rendered-geometry, nine-marker, fallback and font readiness assertion.
    await ready(page);
    navigation.phase = 'ready';
  } catch (error) {
    navigation.error = error.message;
    throw error;
  } finally {
    navigation.durationMs = Date.now() - startedAt;
    report.navigations.push(navigation);
  }
}

async function clearToasts(page) {
  // Native dialogs make the rest of the document inert. Never force a click
  // through that accessibility boundary merely to tidy a screenshot.
  if (await page.locator('#game-dialog').evaluate((element) => element.open)) return;
  const closeButtons = page.locator('#toasts button');
  while (await closeButtons.count()) await closeButtons.first().click();
}

async function capture(page, filename) {
  // Screenshots are required evidence, but a transient compositor timeout must
  // not prevent us from exercising the remaining gameplay. Retry once, retain
  // the exact attempt outcomes, and enforce completeness in a separate final gate.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const startedAt = Date.now();
    try {
      await page.bringToFront();
      await clearToasts(page);
      await page.screenshot({ path: join(output, filename), fullPage: false, timeout: 15_000 });
      report.captureAttempts.push({ filename, attempt, status: 'passed', durationMs: Date.now() - startedAt });
      report.screenshots.push(filename);
      return true;
    } catch (error) {
      report.captureAttempts.push({ filename, attempt, status: 'failed', durationMs: Date.now() - startedAt, message: error.message });
      console.warn(`CAPTURE ${filename} attempt ${attempt} failed: ${error.message.split('\n')[0]}`);
    }
  }
  return false;
}

async function waitForQueue(page, queueName) {
  const before = await snapshot(page);
  const queue = before.queues[queueName];
  assert(queue, `${queueName} queue was not created by the UI.`);
  const remaining = await page.evaluate((endsAt) => Math.max(0, endsAt - Date.now()), queue.endsAt);
  assert(remaining <= 50_000, `The smoke action unexpectedly needs ${remaining}ms; its real-time wait must stay bounded.`);
  const startedAt = Date.now();
  // Use the application's actual clock, interval and rendering lifecycle.
  // No Date, timer or requestAnimationFrame implementation is replaced.
  await page.waitForFunction((name) => window.rama.getSnapshot().queues[name] === null, queueName, { polling: 250, timeout: Math.ceil(remaining) + 10_000 });
  report.queueWaits.push({ queue: queueName, expectedRemainingMs: Math.ceil(remaining), elapsedMs: Date.now() - startedAt });
}

async function closeDialog(page) {
  await page.locator('#game-dialog [data-action="close"]').click();
  await page.waitForFunction(() => !document.querySelector('#game-dialog').open);
}

async function claimQuest(page, id) {
  await page.locator(`.main-nav [data-tab="quests"]`).click();
  const button = page.locator(`#screen-panel [data-action="claim"][data-id="${id}"]`);
  assert(await button.isEnabled(), `${id} should be claimable after completing its real prerequisite actions.`);
  const before = await snapshot(page);
  await button.click();
  const after = await snapshot(page);
  assert(after.quests.claimed.includes(id), `${id} was not recorded as claimed.`);
  assert(after.resources.wood > before.resources.wood, 'Claiming a quest must grant its resource reward.');
  assert.equal(after.quests.claimed.length, before.quests.claimed.length + 1, 'A claim should add exactly one completion.');
}

async function train(page, id, count) {
  await page.locator('.main-nav [data-tab="army"]').click();
  const before = await snapshot(page);
  await page.locator(`#screen-panel [data-action="train"][data-id="${id}"]`).click();
  await page.locator('#troop-count').fill(String(count));
  await page.locator('#train-confirm').click();
  const queued = await snapshot(page);
  assert.equal(queued.queues.training?.count, count);
  assert.equal(queued.army[id], before.army[id], 'Soldiers must not be granted before training finishes.');
  assert(queued.resources.rice < before.resources.rice, 'Training should consume resources.');
  await waitForQueue(page, 'training');
  assert.equal((await snapshot(page)).army[id], before.army[id] + count, 'Trained soldiers were not added after the timer.');
}

async function assertFitsViewport(page, selector) {
  const bounds = await page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: window.innerWidth, height: window.innerHeight, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
  });
  assert(bounds.left >= -1 && bounds.right <= bounds.width + 1, `${selector} extends beyond the horizontal viewport: ${JSON.stringify(bounds)}`);
  assert(bounds.top >= -1 && bounds.bottom <= bounds.height + 1, `${selector} extends beyond the vertical viewport: ${JSON.stringify(bounds)}`);
  assert(bounds.scrollWidth <= bounds.clientWidth + 2, `${selector} has unintended horizontal overflow: ${JSON.stringify(bounds)}`);
}

async function shutdown() {
  shuttingDown = true;
  if (browser) await browser.close().catch(() => {});
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    const stopped = await Promise.race([new Promise((resolve) => server.once('exit', () => resolve(true))), delay(5000).then(() => false)]);
    if (!stopped) server.kill('SIGKILL');
  }
}

try {
  await mkdir(output, { recursive: true });
  await step('Serve the production build with isolated Vite preview', async () => {
    await access(join(root, 'dist/index.html')).catch(() => { throw new Error('Production build is missing. Run npm run build before npm run test:e2e.'); });
    server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1' } });
    const log = (chunk) => { serverOutput = (serverOutput + chunk.toString()).slice(-20_000); };
    server.stdout.on('data', log);
    server.stderr.on('data', log);
    server.on('error', (error) => { serverError = error; });
    await waitForServer();
  });

  await step('Render the real 3D city on desktop', async () => {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    browser.on('disconnected', () => { if (!shuttingDown) report.errors.push({ type: 'browserdisconnected', at: new Date().toISOString(), message: 'Chromium disconnected before test shutdown.' }); });
    const context = await browser.newContext({ viewport: report.viewports.desktop, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    desktop = await context.newPage();
    desktop.setDefaultTimeout(15_000);
    observeErrors(desktop, 'desktop');
    await navigate(desktop);
    report.desktopDiagnostics = await desktop.evaluate(() => window.rama.getDiagnostics());
    await capture(desktop, 'desktop-city.png');
    // Font loading, the initial resize and screenshot have settled. Reduced
    // motion must now leave the unchanged WebGL city idle on the real clock.
    const beforeIdle = await desktop.evaluate(() => window.rama.getDiagnostics());
    assert.equal(beforeIdle.reducedMotion, true, 'This context must exercise the reduced-motion renderer.');
    assert(Number.isInteger(beforeIdle.renderedFrames) && beforeIdle.renderedFrames > 0, 'A rendered frame count is required for the idle regression check.');
    const idleStartedAt = Date.now();
    await delay(400);
    const afterIdle = await desktop.evaluate(() => window.rama.getDiagnostics());
    report.reducedMotionRendering = { idle: { before: beforeIdle.renderedFrames, after: afterIdle.renderedFrames, elapsedMs: Date.now() - idleStartedAt } };
    assert.equal(afterIdle.renderedFrames, beforeIdle.renderedFrames, 'An unchanged city must not keep drawing WebGL frames with reduced motion enabled.');
  });

  await step('Upgrade the sawmill by selecting its city marker', async () => {
    const before = await snapshot(desktop);
    await desktop.locator('.village-marker[data-building="sawmill"]').click();
    assert.equal(await desktop.locator('#modal-title').textContent(), 'โรงเลื่อย');
    await desktop.locator('[data-action="upgrade"][data-id="sawmill"]').click();
    const queued = await snapshot(desktop);
    assert.equal(queued.queues.building?.buildingId, 'sawmill');
    assert.equal(queued.buildings.sawmill, before.buildings.sawmill, 'The upgrade must wait for its construction timer.');
    assert(queued.resources.wood < before.resources.wood, 'An upgrade should consume resources.');
    await waitForQueue(desktop, 'building');
    assert.equal((await snapshot(desktop)).buildings.sawmill, before.buildings.sawmill + 1);
    await desktop.keyboard.press('Escape');
    assert.equal(await desktop.locator('#game-dialog').evaluate((element) => element.open), false);
    assert(await desktop.locator('.village-marker[data-building="sawmill"]').evaluate((element) => document.activeElement === element), 'Closing the dialog should restore keyboard focus to its trigger.');
  });

  await step('Claim the construction quest through the missions screen', () => claimQuest(desktop, 'foundation'));
  await step('Train three guardians using the amount input and training timer', () => train(desktop, 'guardian', 3));
  await step('Train three archers to complete the recruitment mission', () => train(desktop, 'archer', 3));
  await step('Claim the recruitment quest', () => claimQuest(desktop, 'recruit'));

  await step('Inspect all thirteen hero portraits and allocate a shared ability point', async () => {
    await desktop.locator('.main-nav [data-tab="heroes"]').click();
    await inspectHeroRoster(desktop);
    await capture(desktop, 'desktop-heroes.png');
    const before = await snapshot(desktop);
    await desktop.locator('.hero-card[data-hero-id="rama"] [data-action="hero"]').click();
    await desktop.locator('[data-action="allocate"][data-id="attack"]').click();
    const after = await snapshot(desktop);
    assert.equal(after.hero.attack, before.hero.attack + 1);
    assert.equal(after.hero.points, before.hero.points - 1);
    await closeDialog(desktop);
  });

  await step('Select Garuda without resetting progress and apply his army bonus', async () => {
    const baselinePower = await readArmyPower(desktop);
    const before = await snapshot(desktop);
    assert.equal(before.hero.id, 'rama');
    await desktop.locator('.main-nav [data-tab="heroes"]').click();
    await desktop.locator('.hero-card[data-hero-id="garuda"] [data-action="hero"]').click();
    const select = desktop.locator('[data-action="select-hero"][data-id="garuda"]');
    assert(await select.isEnabled(), 'Garuda should be selectable when no expedition is active.');
    await select.click();
    const after = await snapshot(desktop);
    assert.equal(after.hero.id, 'garuda');
    assertSharedHeroProgress(after.hero, before.hero);
    assert.deepEqual(after.army, before.army, 'Selecting a hero must not silently add or remove troops.');
    if (await desktop.locator('#game-dialog').evaluate((dialog) => dialog.open)) await closeDialog(desktop);
    await desktop.locator('.main-nav [data-tab="city"]').click();
    assert(await desktop.locator('.player-button[data-active-hero="garuda"]').isVisible(), 'The player header must reflect the selected hero.');
    assert(await desktop.locator('.hero-mini[data-id="garuda"]').isVisible(), 'The city HUD must reflect the selected hero.');
    const selectedPower = await readArmyPower(desktop);
    assert(selectedPower > baselinePower, 'Garuda must raise displayed army power with the same troops and allocated points.');
    report.heroSelection = { selected: 'garuda', baselinePower, selectedPower, sharedProgressPreserved: true };
  });

  await step('Send the army to the grove and resolve a real expedition', async () => {
    await desktop.locator('.main-nav [data-tab="world"]').click();
    assert.equal(await desktop.locator('.world-node').count(), 6);
    await capture(desktop, 'desktop-world.png');
    const before = await snapshot(desktop);
    await desktop.locator('.world-node[data-node-id="grove"]').click();
    assert.equal(await desktop.locator('#modal-title').textContent(), 'ป่าหิมพานต์');
    assert(await desktop.locator('#expedition-confirm').isEnabled());
    await desktop.locator('#expedition-confirm').click();
    const queued = await snapshot(desktop);
    assert.equal(queued.queues.expedition?.nodeId, 'grove');
    assert.equal(queued.queues.expedition?.heroId, 'garuda', 'The expedition must retain the hero who led its departure.');
    assert(Object.values(queued.army).reduce((sum, count) => sum + count, 0) < Object.values(before.army).reduce((sum, count) => sum + count, 0), 'Deployed troops must leave the available army.');
    await desktop.waitForSelector('.world-march-marker');
    await desktop.locator('.main-nav [data-tab="heroes"]').click();
    await desktop.locator('.hero-card[data-hero-id="lakshman"] [data-action="hero"]').click();
    assert(await desktop.locator('[data-action="select-hero"][data-id="lakshman"]').isDisabled(), 'Hero switching must be blocked while the army is travelling.');
    assert(await desktop.locator('.hero-travel-lock').isVisible(), 'The blocked selection needs an explanation.');
    assert.equal((await snapshot(desktop)).hero.id, 'garuda', 'Opening another hero during travel must not change the commander.');
    await closeDialog(desktop);
    await desktop.locator('.main-nav [data-tab="world"]').click();
    await waitForQueue(desktop, 'expedition');
    const after = await snapshot(desktop);
    assert(after.completedNodes.includes('grove'), 'Winning the grove must complete the destination.');
    assert.equal(after.stats.victories, before.stats.victories + 1);
    assert(Object.values(after.army).reduce((sum, count) => sum + count, 0) > 0, 'Survivors must return after a victory.');
    assert(after.resources.wood > queued.resources.wood, 'A victorious expedition must return loot.');
    assert(after.events.some((event) => event.kind === 'victory'), 'The result needs a persistent battle report.');
  });

  await step('Claim the victory quest and inspect the report', async () => {
    await claimQuest(desktop, 'first-victory');
    await desktop.locator('.statusbar [data-action="reports"]').click();
    assert((await desktop.locator('.report-entry.victory, .report-entry .report-symbol.victory').count()) > 0, 'The report dialog must show the expedition victory.');
    await closeDialog(desktop);
  });

  await step('Reload preserves buildings, troops, hero and claimed missions', async () => {
    const before = await snapshot(desktop);
    await navigate(desktop, true);
    const after = await snapshot(desktop);
    for (const key of ['buildings', 'army', 'hero', 'completedNodes', 'quests']) assert.deepEqual(after[key], before[key], `Reload did not preserve ${key}.`);
    assert.equal(after.hero.id, 'garuda', 'Reload must preserve the newly selected commander.');
    report.persistedProgress = { buildings: after.buildings, army: after.army, hero: after.hero, completedNodes: after.completedNodes, claimedQuests: after.quests.claimed };
  });

  await step('Export a real backup, restore it after renaming, and reject malformed JSON', async () => {
    const coreFields = ['buildings', 'army', 'hero', 'completedNodes', 'quests', 'campaignWon'];
    const before = await snapshot(desktop);
    await desktop.locator('.player-button[data-action="settings"]').click();
    const downloadPending = desktop.waitForEvent('download');
    await desktop.locator('[data-action="export"]').click();
    const download = await downloadPending;
    assert.match(download.suggestedFilename(), /^rama-save-\d{4}-\d{2}-\d{2}\.json$/);
    const backupPath = join(output, 'exported-backup.json');
    await download.saveAs(backupPath);
    assert.equal(await download.failure(), null, 'The backup download must complete.');
    const backup = JSON.parse(await readFile(backupPath, 'utf8'));
    assert.equal(backup.version, 1);
    assert.equal(backup.cityName, before.cityName);
    for (const key of coreFields) assert.deepEqual(backup[key], before[key], `The exported backup lost ${key}.`);

    const renamedCity = 'นครทดสอบไฟล์สำรอง';
    await desktop.locator('#city-name-input').fill(renamedCity);
    await desktop.locator('[data-action="rename"]').click();
    assert.equal((await snapshot(desktop)).cityName, renamedCity, 'The rename must happen through the settings UI.');
    await desktop.locator('#restore-file').setInputFiles(backupPath);
    await desktop.locator('[data-action="restore-confirm"]').waitFor({ state: 'visible' });
    assert.equal(await desktop.locator('.restore-summary b').textContent(), backup.cityName, 'The confirmation must identify the uploaded kingdom.');
    assert.equal((await snapshot(desktop)).cityName, renamedCity, 'Selecting a backup must not restore it before confirmation.');
    await desktop.locator('[data-action="restore-confirm"]').click();
    const restored = await snapshot(desktop);
    assert.equal(restored.cityName, backup.cityName);
    for (const key of coreFields) assert.deepEqual(restored[key], backup[key], `Restoring the downloaded backup lost ${key}.`);
    assert.equal(await desktop.locator('.city-name').textContent(), backup.cityName, 'The visible city name must refresh after restore.');

    await desktop.locator('.player-button[data-action="settings"]').click();
    const beforeInvalid = await snapshot(desktop);
    await desktop.locator('#restore-file').setInputFiles({ name: 'invalid-rama-backup.json', mimeType: 'application/json', buffer: Buffer.from('{"version":') });
    await desktop.getByText('ไฟล์นี้ไม่ใช่ไฟล์สำรอง RAMA ที่รองรับ', { exact: true }).waitFor({ state: 'visible' });
    const afterInvalid = await snapshot(desktop);
    assert.equal(afterInvalid.cityName, beforeInvalid.cityName, 'Malformed JSON must not replace the current city.');
    for (const key of coreFields) assert.deepEqual(afterInvalid[key], beforeInvalid[key], `Malformed JSON unexpectedly changed ${key}.`);
    assert.equal(await desktop.locator('[data-action="restore-confirm"]').count(), 0, 'Malformed JSON must never reach the restore confirmation.');
    await closeDialog(desktop);
    report.backupRoundTrip = { filename: download.suggestedFilename(), restoredCity: restored.cityName, malformedJsonRejected: true };
  });

  await step('Day and night update both the interface and the 3D scene', async () => {
    const beforeNight = await desktop.evaluate(() => window.rama.getDiagnostics().renderedFrames);
    await desktop.locator('.weather-button').click();
    assert(await desktop.locator('body').evaluate((element) => element.classList.contains('night-mode')));
    assert.equal(await desktop.evaluate(() => window.rama.getDiagnostics().night), true);
    await desktop.waitForFunction((before) => {
      const diagnostics = window.rama.getDiagnostics();
      return diagnostics.night && diagnostics.renderedFrames > before;
    }, beforeNight, { timeout: 15_000 });
    const nightFrames = await desktop.evaluate(() => window.rama.getDiagnostics().renderedFrames);
    await capture(desktop, 'desktop-night.png');
    const beforeDay = await desktop.evaluate(() => window.rama.getDiagnostics().renderedFrames);
    await desktop.locator('.weather-button').click();
    assert.equal(await desktop.evaluate(() => window.rama.getDiagnostics().night), false);
    await desktop.waitForFunction((before) => {
      const diagnostics = window.rama.getDiagnostics();
      return !diagnostics.night && diagnostics.renderedFrames > before;
    }, beforeDay, { timeout: 15_000 });
    report.reducedMotionRendering.dayNight = { beforeNight, nightFrames, beforeDay, dayFrames: await desktop.evaluate(() => window.rama.getDiagnostics().renderedFrames) };
  });

  await step('Render the saved city at 390 × 844 with touch controls', async () => {
    const storageState = await desktop.context().storageState();
    const context = await browser.newContext({ viewport: report.viewports.mobile, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'reduce', storageState });
    mobile = await context.newPage();
    mobile.setDefaultTimeout(15_000);
    observeErrors(mobile, 'mobile');
    await navigate(mobile);
    report.mobileDiagnostics = await mobile.evaluate(() => window.rama.getDiagnostics());
    assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'The mobile page must not scroll horizontally.');
    await capture(mobile, 'mobile-city.png');
  });

  await step('Mobile building and expedition dialogs fit the viewport', async () => {
    await mobile.locator('.building-card[data-id="sawmill"]').tap();
    await assertFitsViewport(mobile, '#game-dialog');
    await capture(mobile, 'mobile-building-dialog.png');
    await closeDialog(mobile);
    await mobile.locator('.main-nav [data-tab="world"]').tap();
    await mobile.locator('[data-action="recenter"]').tap();
    await mobile.locator('.world-node[data-node-id="grove"]').tap();
    await assertFitsViewport(mobile, '#game-dialog');
    await capture(mobile, 'mobile-expedition-dialog.png');
    await closeDialog(mobile);
  });

  await step('Select another hero by touch without losing progress or overflowing the modal', async () => {
    const before = await snapshot(mobile);
    assert.equal(before.hero.id, 'garuda', 'The mobile saved game should retain the desktop commander.');
    await mobile.locator('.main-nav [data-tab="heroes"]').tap();
    assert.equal(await mobile.locator('#screen-panel .hero-card[data-hero-id]').count(), 13);
    await mobile.locator('.hero-card[data-hero-id="sita"] [data-action="hero"]').tap();
    await assertFitsViewport(mobile, '#game-dialog');
    await capture(mobile, 'mobile-hero-dialog.png');
    const select = mobile.locator('[data-action="select-hero"][data-id="sita"]');
    assert(await select.isEnabled());
    await select.tap();
    const after = await snapshot(mobile);
    assert.equal(after.hero.id, 'sita');
    assertSharedHeroProgress(after.hero, before.hero);
    if (await mobile.locator('#game-dialog').evaluate((dialog) => dialog.open)) {
      await assertFitsViewport(mobile, '#game-dialog');
      await closeDialog(mobile);
    }
    assert.equal(await mobile.locator('#game-dialog').evaluate((dialog) => dialog.open), false);
    assert(await mobile.locator('.player-button[data-active-hero="sita"]').isVisible());
    assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'The mobile hero screen must not scroll horizontally.');
    report.mobileHeroSelection = { selected: 'sita', sharedProgressPreserved: true, modalFits: true };
  });

  await step('No uncaught page errors or failed application assets', async () => {
    assert.deepEqual(report.errors, [], JSON.stringify(report.errors, null, 2));
  });

  await step(`All ${requiredScreenshots.length} required screenshots were captured successfully`, async () => {
    const missing = requiredScreenshots.filter((filename) => !report.screenshots.includes(filename));
    assert.deepEqual(missing, [], `Required visual evidence is missing: ${missing.join(', ')}. See captureAttempts for compositor errors.`);
  });

  report.status = 'passed';
  console.log(`\nRAMA browser smoke passed (${report.steps.length} steps). Evidence: test-results/smoke-report.json`);
} catch (error) {
  report.status = 'failed';
  report.failure = { message: error.message, stack: error.stack, browserConnected: browser?.isConnected() ?? false, serverOutput };
  report.failure.pages = [...pageObservations].map(([page, observation]) => ({ device: observation.device, closed: page.isClosed(), url: page.url(), recent: observation.recent, pending: [...observation.pending.values()].map(({ startedAt, ...request }) => ({ ...request, ageMs: Date.now() - startedAt })) }));
  const page = mobile && !mobile.isClosed() ? mobile : desktop && !desktop.isClosed() ? desktop : null;
  if (page) {
    await page.screenshot({ path: join(output, 'failure.png'), fullPage: false, timeout: 15_000 }).catch(() => {});
    let diagnosticTimer;
    const runtime = await Promise.race([
      page.evaluate(() => ({ readyState: document.readyState, hasRama: Boolean(window.rama), appChildren: document.querySelector('#app')?.childElementCount ?? 0, renderer: window.rama?.getDiagnostics() ?? null })).catch(() => null),
      new Promise((resolve) => { diagnosticTimer = setTimeout(() => resolve(null), 3000); }),
    ]);
    clearTimeout(diagnosticTimer);
    report.failure.runtime = runtime;
    report.failure.diagnostics = runtime?.renderer ?? null;
  }
  console.error(`\nRAMA browser smoke failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'smoke-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await shutdown();
}
