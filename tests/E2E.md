# Browser smoke coverage

Run the real browser integration check after the engine tests and production build:

```sh
npm ci
npm run build
npx playwright install --with-deps chromium
node scripts/smoke.mjs
```

Recommended package script: `"test:e2e": "node scripts/smoke.mjs"`.

The script requires a current production build in `dist/`. It starts its own
**Vite preview** process on `127.0.0.1:4178` with `--strictPort` and stops it when
the run ends. It tests built assets without the development server or HMR.
Use `RAMA_SMOKE_PORT` to choose another unused port.
`CHROMIUM_PATH` may point to an existing Chromium executable; otherwise Playwright
uses its installed Chromium. Software WebGL is enabled for headless CI.

Initial loads and the persistence reload wait for `DOMContentLoaded` with an
explicit 45-second navigation timeout, then require the actual application to be
ready: working WebGL, rendered geometry, nine interactive markers, no fallback,
and loaded fonts. The smoke does not use `networkidle` as a readiness proxy.

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
- Exporting downloads a valid backup. After renaming the city through settings,
  uploading that actual downloaded file previews the saved kingdom and restores
  its name and progress only after confirmation. Malformed JSON shows an error
  and leaves the current city and progression unchanged.
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

The smoke run uses real browser time throughout. It waits for the application's
actual construction, training and expedition timers: approximately **70 seconds**
in total (12 for construction, 15 and 18 for training, 25 for the expedition).
No fake clock, Date override, timer
replacement or animation-frame replacement is installed. Each queue is polled
for completion with a timeout based on its recorded end time plus 10 seconds;
unexpected smoke actions longer than 50 seconds are rejected. The report records
expected remaining time and observed elapsed time for each queue.

Screenshots capture the exact desktop/mobile viewport. A capture has a bounded
15-second timeout and one retry, with every outcome recorded. If both attempts
fail, gameplay validation continues so a compositor problem does not hide later
functional defects. A separate final gate still requires **all seven screenshots**
to have succeeded; missing visual evidence can never yield a passing run.
Screenshots do not cancel CSS animations on top of the context's existing
reduced-motion preference.

## Evidence and limitations

`test-results/` is ignored by Git. Each run writes `smoke-report.json` with step
results, navigation phases, queue timings, screenshot attempts, viewport sizes,
render diagnostics and error details. On failure it retains recent request and
navigation lifecycle events, pending asset requests, page-crash/browser-disconnect
events, and a bounded runtime probe to distinguish a navigation stall from an
application initialization failure. It also captures
desktop city, world, heroes, night, mobile city and mobile dialog screenshots.
The backup round trip also retains the real downloaded `exported-backup.json`.
Failures after browser startup additionally capture `failure.png`.

A syntax check, an engine test pass, or a successful production build does **not**
mean this browser smoke passed. If Chromium or local sockets are unavailable, the
script exits nonzero and records the actual failure. Run it in a supported local
environment or CI before claiming browser verification.

This run validates Chromium with software rendering. It does not establish
physical phone GPU performance, Safari/iOS compatibility, long-session memory
behavior, or visual fidelity to a reference video. Screenshots are review
artifacts, not pixel-diff assertions.
