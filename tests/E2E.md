# Browser smoke coverage

Run the real browser integration check after the engine tests and production build:

```sh
npm ci
npx playwright install --with-deps chromium
node scripts/smoke.mjs
```

Recommended package script: `"test:e2e": "node scripts/smoke.mjs"`.

The script starts its own Vite process on `127.0.0.1:4178` with `--strictPort` and
stops it when the run ends. Use `RAMA_SMOKE_PORT` to choose another unused port.
`CHROMIUM_PATH` may point to an existing Chromium executable; otherwise Playwright
uses its installed Chromium. Software WebGL is enabled for headless CI.

## What a passing result proves

- The real Three.js scene renders at desktop **1440 × 1000** and mobile
  **390 × 844**, has draw calls and triangles, and exposes all nine map markers.
  The accessible non-WebGL fallback deliberately **fails** this particular test.
- Selecting the sawmill marker opens its modal. The upgrade spends resources,
  waits for its timer, completes, and restores focus when dismissed with Escape.
- The training UI creates three guardians and three archers after their timers.
- A hero point is spent through the ability button and increases the chosen stat.
- Selecting the grove on the world map sends troops, shows a travel marker, and
  returns survivors, loot, a completed destination, and a victory report.
- Construction, recruitment and victory quests can be claimed in sequence.
- Reloading preserves buildings, army, hero, completed destinations and rewards.
- Day/night controls affect both the interface and the 3D scene.
- Mobile touch opens building and expedition dialogs without horizontal overflow
  or dialog boundaries extending outside the viewport.
- No uncaught page errors, console errors, failed same-origin asset requests or
  HTTP error responses occurred during the flow.

All gameplay actions use real browser clicks, taps and input events. The script
does not import the game engine, mutate `window.rama`, edit localStorage, or inject
test resources. The public `window.rama.getSnapshot()` and `getDiagnostics()`
interfaces are used only to read outcomes. Mobile receives the desktop context's
normal browser storage snapshot.

Playwright's browser clock advances construction, training and expedition time.
The application still processes its own interval and persistence logic. This
keeps the smoke run short without replacing the game simulation.

## Evidence and limitations

`test-results/` is ignored by Git. Each run writes `smoke-report.json` with step
results, viewport sizes, render diagnostics and error details. It also captures
desktop city, world, heroes, night, mobile city and mobile dialog screenshots.
Failures after browser startup additionally capture `failure.png`.

A syntax check, an engine test pass, or a successful production build does **not**
mean this browser smoke passed. If Chromium or local sockets are unavailable, the
script exits nonzero and records the actual failure. Run it in a supported local
environment or CI before claiming browser verification.

This run validates Chromium with software rendering. It does not establish
physical phone GPU performance, Safari/iOS compatibility, long-session memory
behavior, or visual fidelity to a reference video. Screenshots are review
artifacts, not pixel-diff assertions.
