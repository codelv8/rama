import { WORLD_NODES } from '../game/content.js';

let instanceCount = 0;

const LOCATIONS = [
  [456, 198], [723, 186], [927, 323], [725, 485],
  [464, 518], [1021, 510], [1008, 166], [581, 357],
];
const HOME = { x: 292, y: 377 };
const escapeText = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/** An original, keyboard/touch accessible illustrated expedition map. */
export function createWorldMap(container, { onSelect = () => {} } = {}) {
  const uid = `rama-world-${++instanceCount}`;
  let state = null;
  let selectedId = null;
  let destroyed = false;
  const initialCamera = () => (container.clientWidth || window.innerWidth) < 600 ? { scale: .9, offset: { x: 140, y: 25 } } : { scale: 1, offset: { x: 0, y: 0 } };
  let { scale, offset } = initialCamera();
  let routeSignature = '';
  let drag = null;
  let suppressClick = false;
  let pointerDistance = null;
  const pointers = new Map();
  const listeners = [];
  const positions = new Map(WORLD_NODES.map((node, index) => [String(node.id), LOCATIONS[index % LOCATIONS.length]]));
  const host = document.createElement('div');
  host.className = 'world-map';
  host.innerHTML = `
    <style>
      .world-map{width:100%;height:100%;min-height:360px;position:relative;overflow:hidden;background:#e9e4d3;border-radius:inherit;isolation:isolate}
      .world-map:after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 100px 25px #e9e4d34d;border-radius:inherit}
      .world-map svg.world-canvas{width:100%;height:100%;display:block;touch-action:none;cursor:grab;outline:none;user-select:none;-webkit-user-select:none}
      .world-map svg.world-canvas:focus-visible{outline:3px solid #a77936;outline-offset:-4px}
      .world-map svg.world-canvas.world-dragging{cursor:grabbing}
      .world-map .world-node{cursor:pointer;outline:none}
      .world-map .world-node .world-node-art{transform-box:fill-box;transform-origin:center bottom;transition:transform .25s ease}
      .world-map .world-node:hover .world-node-art,.world-map .world-node:focus-visible .world-node-art{transform:translateY(-4px)}
      .world-map .world-node .world-selection{opacity:0;transition:opacity .2s}
      .world-map .world-node.is-selected .world-selection,.world-map .world-node:focus-visible .world-selection{opacity:1}
      .world-map .world-node .world-label-bg{fill:#fcf7e8;stroke:#cfc5a6;transition:fill .2s,stroke .2s}
      .world-map .world-node.is-locked .world-node-art{opacity:.65;filter:saturate(.6)}
      .world-map .world-node .world-locked{opacity:0}
      .world-map .world-node.is-locked .world-locked{opacity:1}
      .world-map .world-node.is-selected .world-label-bg{fill:#244c40;stroke:#bca76a}
      .world-map .world-node.is-selected .world-label-text{fill:#fff8e7}
      .world-map .world-node:hover .world-label-bg{stroke:#7b8d67}
      .world-map .world-label-text{font-family:inherit;font-size:13px;font-weight:650;fill:#3a4d38}
      .world-map .world-complete{opacity:0;transition:opacity .2s}
      .world-map .world-node.is-complete .world-complete{opacity:1}
      .world-map .world-route{stroke-dasharray:7 7;animation:world-march 1.4s linear infinite}
      .world-map .world-water-glint{animation:world-glint 6s ease-in-out infinite alternate}
      .world-map .world-hint{position:absolute;bottom:19px;left:50%;transform:translateX(-50%);padding:7px 13px;background:#f8f3e5cf;border:1px solid #d8d0b8;border-radius:30px;white-space:nowrap;color:#69705a;backdrop-filter:blur(8px);font-size:11px;pointer-events:none;z-index:1;letter-spacing:.025em}
      @keyframes world-march{to{stroke-dashoffset:-28}}
      @keyframes world-glint{from{opacity:.25}to{opacity:.65}}
      @media(prefers-reduced-motion:reduce){.world-map .world-route,.world-map .world-water-glint{animation:none}.world-map .world-node .world-node-art{transition:none}}
      @media(max-width:600px){.world-map{min-height:400px}.world-map .world-hint{font-size:10px;bottom:12px}}
    </style>
    <svg class="world-canvas" viewBox="0 0 1200 660" preserveAspectRatio="xMidYMid slice" tabindex="0" role="group" aria-label="แผนที่หิมพานต์ เลือกจุดหมายเพื่อส่งกองทัพ ลากเพื่อเลื่อนแผนที่ ใช้ปุ่มบวกและลบเพื่อซูม">
      <title>แผนที่อาณาจักรหิมพานต์</title>
      <desc>อโยธยาอยู่ทางตะวันตก ค่ายและโบราณสถานกระจายอยู่ท่ามกลางป่า แม่น้ำ และขุนเขา</desc>
      <defs>
        <radialGradient id="${uid}-land"><stop stop-color="#dce5b8"/><stop offset=".7" stop-color="#d7dfaf"/><stop offset="1" stop-color="#e9e3cb"/></radialGradient>
        <linearGradient id="${uid}-water" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#91c6ba"/><stop offset=".5" stop-color="#70afa9"/><stop offset="1" stop-color="#91bdb0"/></linearGradient>
        <linearGradient id="${uid}-hill" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#a6be85"/><stop offset="1" stop-color="#778f69"/></linearGradient>
        <linearGradient id="${uid}-roof" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c17a4d"/><stop offset="1" stop-color="#89583c"/></linearGradient>
        <pattern id="${uid}-grid" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="#a8ad81" stroke-width=".6" opacity=".15"/></pattern>
        <filter id="${uid}-shadow" x="-40%" y="-40%" width="180%" height="200%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#536340" flood-opacity=".2"/></filter>
        <symbol id="${uid}-tree" viewBox="0 0 38 53"><ellipse cx="21" cy="49" rx="15" ry="4" fill="#657b50" opacity=".13"/><path d="M18 46V25l5-5M18 35l-6-8" fill="none" stroke="#826b45" stroke-width="3" stroke-linecap="round"/><path d="M18 3C5 3 1 13 6 21 0 33 9 40 20 37 32 40 39 30 32 22 37 11 29 1 18 3Z" fill="#719975"/><path d="M18 5C8 5 6 14 11 19 6 27 12 33 20 32 29 33 33 25 28 20 32 11 26 4 18 5Z" fill="#88aa7b"/><path d="M13 9c-4 4-5 9-1 11" stroke="#bad29a" stroke-width="2" opacity=".55" fill="none"/></symbol>
        <symbol id="${uid}-pine" viewBox="0 0 30 50"><ellipse cx="16" cy="47" rx="13" ry="3" fill="#657b50" opacity=".15"/><path d="M15 34v12" stroke="#7f6749" stroke-width="3"/><path d="m15 2 9 16h-5l9 13h-6l7 10H1l7-10H3l9-13H7Z" fill="#587c67"/><path d="m15 2 0 39H1l7-10H3l9-13H7Z" fill="#71947a"/></symbol>
        <symbol id="${uid}-mountain" viewBox="0 0 120 100"><ellipse cx="60" cy="91" rx="53" ry="8" fill="#748568" opacity=".14"/><path d="M5 86 23 58 36 55 51 20 66 7 82 31 89 58 113 86Z" fill="#9ba48a"/><path d="m66 7-7 37 10 8 8 36H5l18-30 13-3L51 20Z" fill="#b2b69b"/><path d="m66 7 16 24-13-5-10 18-8-24Z" fill="#d0ceae"/><path d="m36 55 8 2 7-12-4 39M82 31l-4 25 10 3" fill="none" stroke="#818e78" stroke-width="2" opacity=".5"/><path d="M8 83c13-5 18 3 29-2 18-7 29 7 41 1 15-6 21 0 33 4" fill="none" stroke="#95ab77" stroke-width="9" stroke-linecap="round"/></symbol>
        <symbol id="${uid}-temple" viewBox="0 0 100 100"><ellipse cx="51" cy="87" rx="46" ry="12" fill="#4f6744" opacity=".18"/><path d="m10 77 39-19 42 21-40 19Z" fill="#c4b48a"/><path d="m10 77 41 17v4L10 82Z" fill="#a1916c"/><path d="m51 94 40-15v5L51 98Z" fill="#b2a37b"/><path d="M24 44 53 31l25 16v32L51 90 24 77Z" fill="#e6d5a9"/><path d="m51 58 27-11v32L51 90Z" fill="#c9b98e"/><path d="m35 64 10 4v15l-10-4ZM60 64l9-4v16l-9 4Z" fill="#5d6951"/><path d="m12 47 38-33 39 34-37 17Z" fill="url(#${uid}-roof)"/><path d="m50 14 2 51 37-17Z" fill="#955f40"/><path d="m12 47 40 18 37-17M20 43l32 14 28-12" fill="none" stroke="#dfb06c" stroke-width="3" stroke-linejoin="round"/><path d="M50 15V4m-37 43-4-9m80 10 4-10" stroke="#c5a05b" stroke-width="3" stroke-linecap="round"/><path d="m50 7-3-5 3-2 3 2Z" fill="#d8b668"/><path d="m25 44 25-23 26 24-25 11Z" fill="none" stroke="#d3a263" stroke-width="1.5"/></symbol>
        <symbol id="${uid}-ruin" viewBox="0 0 100 100"><ellipse cx="50" cy="86" rx="44" ry="11" fill="#4f6744" opacity=".15"/><path d="m8 78 43-19 39 19-40 18Z" fill="#bcb89a"/><path d="m16 71 9-5V37l10-5v41l-10 5ZM67 35l11-5v41l-11 6Z" fill="#a5ad95"/><path d="m25 37 10-5 7 4-10 5ZM67 35l11-5 8 5-10 5Z" fill="#d2d0ae"/><path d="M35 36V25l32-14 9 5v19l-9 5V27L45 37v41l-10-5Z" fill="#c3c5a6"/><path d="m67 11 9 5v19l-9 5V27L45 37v41l-10-5V36Z" fill="#acb59b"/><path d="m44 40 15-7v43l-15 7Z" fill="#d6d1aa"/><path d="m20 71 8-4m42-7 7-2M42 39l11-4m-16-9 14-6" stroke="#6f9071" stroke-width="4" stroke-linecap="round"/><path d="M68 15c-2 8 0 12 7 15m-43 6c8 9-5 12-2 21" fill="none" stroke="#709274" stroke-width="3"/></symbol>
        <symbol id="${uid}-fort" viewBox="0 0 100 100"><ellipse cx="50" cy="86" rx="47" ry="11" fill="#4f6744" opacity=".18"/><path d="m8 59 44-20 40 20v25L50 98 8 78Z" fill="#aa987a"/><path d="m50 77 42-18v25L50 98Z" fill="#887e66"/><path d="m8 59 42 18 42-18-40-20Z" fill="#cbb993"/><path d="M15 60V43l11-5v17m11 9V48l11-5v17m17 2V45l11-5v17M83 57V43l9 4v15" fill="#b8aa88" stroke="#837d66" stroke-width="1"/><path d="M42 90V77c0-8 13-6 13 0v15Z" fill="#51584a"/><path d="m27 45 24-28 25 28-24 11Z" fill="#6b6c56"/><path d="m27 45 25 11 24-11M51 18V5" fill="none" stroke="#bea56f" stroke-width="3"/><path d="m52 6 15 5-15 5Z" fill="#954e3f"/></symbol>
        <symbol id="${uid}-tent" viewBox="0 0 100 100"><ellipse cx="50" cy="83" rx="42" ry="10" fill="#4f6744" opacity=".16"/><path d="m12 75 35-37 43 33-39 20Z" fill="#d4bf87"/><path d="m47 38 4 53 39-20Z" fill="#b39c67"/><path d="m31 83 16-45 4 53Z" fill="#7d7750"/><path d="M47 39V26m-35 49-4 6m82-10 5 8" stroke="#8b7552" stroke-width="3" stroke-linecap="round"/><path d="m48 27 15 4-15 5Z" fill="#ac624c"/><path d="M25 68 39 52m22 0 14 12" stroke="#ebe0b4" stroke-width="2" opacity=".8"/><path d="m74 83 5-4 9 4-5 5Z" fill="#a9774f"/><path d="m78 81 3-10 3 10Z" fill="#d69d54"/></symbol>
      </defs>
      <rect width="1200" height="660" fill="#e9e4d3"/>
      <g class="world-viewport">
        <rect x="-650" y="-450" width="2500" height="1600" fill="url(#${uid}-land)"/>
        <rect x="-650" y="-450" width="2500" height="1600" fill="url(#${uid}-grid)"/>
        <path d="M-80 126C81 200 152 59 318 109S439 120 476 54 693-8 787 73 1012 30 1289 118L1324-250H-100Z" fill="#bdcea3" opacity=".45"/>
        <path d="M-80 565C87 480 163 631 327 588S477 571 596 627 836 536 974 569 1118 622 1302 531L1400 1100H-160Z" fill="#b5c79b" opacity=".4"/>
        <path d="M-35 227C94 165 225 179 295 218S339 283 292 299 161 256 83 292-7 324-35 309Z" fill="#c0d29f"/>
        <path d="M515 270c53-68 171-59 200-11s43 57 108 41 77 48 28 82-117-18-178 1-113 4-130-25-55-29-28-88Z" fill="#c9d6a6"/>
        <path d="M1082-60C977 41 1001 93 901 123S858 207 892 251 816 310 852 371 829 430 780 440 740 505 785 538 680 596 713 710" fill="none" stroke="#c6d2a9" stroke-width="61" stroke-linecap="round"/>
        <path d="M1082-60C977 41 1001 93 901 123S858 207 892 251 816 310 852 371 829 430 780 440 740 505 785 538 680 596 713 710" fill="none" stroke="#d4cd9e" stroke-width="43" stroke-linecap="round"/>
        <path d="M1082-60C977 41 1001 93 901 123S858 207 892 251 816 310 852 371 829 430 780 440 740 505 785 538 680 596 713 710" fill="none" stroke="url(#${uid}-water)" stroke-width="31" stroke-linecap="round"/>
        <path class="world-water-glint" d="M1079-60C974 41 998 93 898 123S855 207 889 251 813 310 849 371 826 430 777 440 737 505 782 538 677 596 710 710" fill="none" stroke="#e0efcf" stroke-width="2" stroke-dasharray="18 13 4 25"/>
        <path d="M-40 444C65 431 88 484 171 463S237 444 302 468 363 477 388 441" fill="none" stroke="#c1d2a5" stroke-width="34"/>
        <path d="M-40 444C65 431 88 484 171 463S237 444 302 468 363 477 388 441" fill="none" stroke="#94bfb0" stroke-width="16"/>
        <g fill="none" stroke="#c1b990" stroke-width="7" stroke-linecap="round" opacity=".55">
          <path d="M292 377C320 296 394 310 456 198S615 182 723 186"/>
          <path d="M292 377C395 390 427 483 464 518S601 474 725 485 882 461 1021 510"/>
          <path d="M723 186C785 243 848 271 927 323"/>
        </g>
        <g fill="none" stroke="#e9ddba" stroke-width="3" stroke-linecap="round" stroke-dasharray="3 9" opacity=".9">
          <path d="M292 377C320 296 394 310 456 198S615 182 723 186"/>
          <path d="M292 377C395 390 427 483 464 518S601 474 725 485 882 461 1021 510"/>
          <path d="M723 186C785 243 848 271 927 323"/>
        </g>
        <g transform="translate(854 263) rotate(-28)"><path d="M-25-14h50v28h-50Z" fill="#b7a57b" stroke="#8b8968" stroke-width="2"/><path d="M-23-10h46m-46 20h46M-16-13v26M-6-13v26M4-13v26M14-13v26" stroke="#ded0a7" stroke-width="2"/></g>
        ${mountains(uid)}
        ${woodlands(uid)}
        <g opacity=".38" fill="#7c8760" font-family="Georgia,serif" font-style="italic" font-size="18" letter-spacing="4"><text x="186" y="152" transform="rotate(-13 186 152)">HIMMAPAN</text><text x="930" y="440" transform="rotate(-10 930 440)">EASTERN REALM</text></g>
        <g transform="translate(${HOME.x} ${HOME.y})" aria-label="เมืองอโยธยาของคุณ">
          <ellipse cy="17" rx="75" ry="30" fill="#d3c698" opacity=".7"/>
          <ellipse cy="17" rx="75" ry="30" fill="none" stroke="#a39c6e" stroke-width="1.5" stroke-dasharray="2 5"/>
          <use href="#${uid}-temple" x="-64" y="-69" width="63" height="63" opacity=".95"/>
          <use href="#${uid}-temple" x="1" y="-61" width="63" height="63" opacity=".95"/>
          <use href="#${uid}-temple" x="-58" y="-100" width="116" height="116"/>
          <rect x="-61" y="29" width="122" height="29" rx="14.5" fill="#234e40" stroke="#d4b77c" stroke-width="1.5"/>
          <circle cx="-42" cy="43.5" r="5" fill="#b6d28c"/>
          <text x="4" y="48" text-anchor="middle" fill="#fbf4de" font-family="inherit" font-size="13" font-weight="700">อโยธยาของคุณ</text>
        </g>
        <g class="world-expedition-layer" pointer-events="none"></g>
        <g class="world-node-layer">${WORLD_NODES.map((node, index) => renderNode(node, index, uid, positions)).join('')}</g>
      </g>
      <g transform="translate(1136 72)" pointer-events="none" opacity=".65" aria-hidden="true">
        <circle r="29" fill="#f5efdb" fill-opacity=".8" stroke="#aaa580"/><circle r="23" fill="none" stroke="#c3bb97" stroke-dasharray="1 5"/>
        <path d="M0-21 5 0 0 17-5 0Z" fill="#79917b"/><path d="m0-21 5 21H0Z" fill="#3e6555"/><path d="M-16 0 0-4 17 0 0 4Z" fill="#c1af7d"/><circle r="3" fill="#f5ead0"/>
        <text y="-36" text-anchor="middle" fill="#5b6b53" font-family="Georgia,serif" font-size="12">N</text>
      </g>
    </svg>
    <div class="world-hint">ลากเพื่อสำรวจ · เลือกจุดหมายเพื่อออกทัพ</div>`;
  container.append(host);

  const svg = host.querySelector('.world-canvas');
  const viewport = host.querySelector('.world-viewport');
  const routeLayer = host.querySelector('.world-expedition-layer');
  const nodeElements = new Map([...host.querySelectorAll('.world-node')].map((element) => [element.dataset.nodeId, element]));
  const listen = (target, event, handler, options) => {
    target.addEventListener(event, handler, options);
    listeners.push(() => target.removeEventListener(event, handler, options));
  };
  const svgPoint = (clientX, clientY) => {
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  };
  const drawCamera = () => {
    offset.x = Math.max(-700 * scale, Math.min(700 * scale, offset.x));
    offset.y = Math.max(-450 * scale, Math.min(450 * scale, offset.y));
    viewport.setAttribute('transform', `translate(${600 + offset.x} ${330 + offset.y}) scale(${scale}) translate(-600 -330)`);
  };
  const changeScale = (nextScale, anchor = { x: 600, y: 330 }) => {
    const next = Math.max(0.65, Math.min(2.6, nextScale));
    const ratio = next / scale;
    offset.x = anchor.x - 600 - (anchor.x - 600 - offset.x) * ratio;
    offset.y = anchor.y - 330 - (anchor.y - 330 - offset.y) * ratio;
    scale = next;
    drawCamera();
  };

  listen(svg, 'click', (event) => {
    if (suppressClick) { suppressClick = false; return; }
    const node = event.target.closest('.world-node');
    if (node) onSelect(node.dataset.nodeId);
  });
  listen(svg, 'keydown', (event) => {
    const node = event.target.closest('.world-node');
    if (node && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onSelect(node.dataset.nodeId);
      return;
    }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); changeScale(scale * 1.2); }
    else if (event.key === '-') { event.preventDefault(); changeScale(scale / 1.2); }
    else if (event.key === 'Home') { event.preventDefault(); ({ scale, offset } = initialCamera()); drawCamera(); }
    else if (!node && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      offset.x += event.key === 'ArrowLeft' ? 45 : event.key === 'ArrowRight' ? -45 : 0;
      offset.y += event.key === 'ArrowUp' ? 45 : event.key === 'ArrowDown' ? -45 : 0;
      drawCamera();
    }
  });
  listen(svg, 'pointerdown', (event) => {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    const point = svgPoint(event.clientX, event.clientY);
    pointers.set(event.pointerId, point);
    suppressClick = false;
    if (pointers.size === 1) drag = { point, offset: { ...offset }, moved: false, nodeId: event.target.closest('.world-node')?.dataset.nodeId };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pointerDistance = Math.hypot(a.x - b.x, a.y - b.y);
      if (drag) drag.moved = true;
    }
    svg.setPointerCapture(event.pointerId);
  });
  listen(svg, 'pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    const point = svgPoint(event.clientX, event.clientY);
    pointers.set(event.pointerId, point);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pointerDistance && distance) changeScale(scale * distance / pointerDistance, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      pointerDistance = distance;
      suppressClick = true;
      return;
    }
    if (!drag) return;
    const dx = point.x - drag.point.x;
    const dy = point.y - drag.point.y;
    if (Math.hypot(dx, dy) > 7) drag.moved = true;
    if (drag.moved) {
      offset = { x: drag.offset.x + dx, y: drag.offset.y + dy };
      svg.classList.add('world-dragging');
      drawCamera();
    }
  });
  const finishPointer = (event) => {
    const tappedNode = event.type === 'pointerup' && pointers.size === 1 && drag && !drag.moved ? drag.nodeId : null;
    if (drag?.moved) suppressClick = true;
    pointers.delete(event.pointerId);
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    pointerDistance = null;
    if (pointers.size === 1) drag = { point: [...pointers.values()][0], offset: { ...offset }, moved: true };
    else drag = null;
    svg.classList.remove('world-dragging');
    if (tappedNode) { suppressClick = true; onSelect(tappedNode); }
  };
  listen(svg, 'pointerup', finishPointer);
  listen(svg, 'pointercancel', finishPointer);
  listen(svg, 'wheel', (event) => {
    event.preventDefault();
    changeScale(scale * (event.deltaY < 0 ? 1.1 : 1 / 1.1), svgPoint(event.clientX, event.clientY));
  }, { passive: false });
  drawCamera();

  function refreshRoute() {
    const expedition = state?.queues?.expedition;
    const destination = expedition ? positions.get(String(expedition.nodeId)) : null;
    const signature = destination ? `${expedition.nodeId}:${expedition.startedAt}:${expedition.endsAt}` : '';
    if (signature !== routeSignature) {
      routeSignature = signature;
      if (!destination) { routeLayer.innerHTML = ''; return; }
      const [x, y] = destination;
      const control = { x: (HOME.x + x) / 2 + 34, y: (HOME.y + y) / 2 - 82 };
      routeLayer.innerHTML = `<path d="M${HOME.x} ${HOME.y}Q${control.x} ${control.y} ${x} ${y}" fill="none" stroke="#fff4d8" stroke-width="7" opacity=".75"/><path class="world-route" d="M${HOME.x} ${HOME.y}Q${control.x} ${control.y} ${x} ${y}" fill="none" stroke="#9f5345" stroke-width="2.5"/><g class="world-march-marker"><circle r="14" fill="#7d4038" stroke="#f6e2ac" stroke-width="2.5"/><path d="m-5-7 11 13m-11 0L6-7M-6 4l3 3M3 7l3-3" fill="none" stroke="#f8eacc" stroke-width="2" stroke-linecap="round"/></g>`;
    }
    if (!destination || !expedition) return;
    const [x, y] = destination;
    const cx = (HOME.x + x) / 2 + 34;
    const cy = (HOME.y + y) / 2 - 82;
    const now = Number(state.lastTick) || Date.now();
    const duration = Math.max(1, Number(expedition.endsAt) - Number(expedition.startedAt));
    const t = Math.max(0, Math.min(1, (now - Number(expedition.startedAt)) / duration));
    const markerX = (1 - t) ** 2 * HOME.x + 2 * (1 - t) * t * cx + t ** 2 * x;
    const markerY = (1 - t) ** 2 * HOME.y + 2 * (1 - t) * t * cy + t ** 2 * y;
    routeLayer.querySelector('.world-march-marker')?.setAttribute('transform', `translate(${markerX} ${markerY})`);
  }

  return {
    setState(nextState) {
      if (destroyed) return;
      state = nextState;
      const completed = new Set((state?.completedNodes || []).map(String));
      for (const [id, element] of nodeElements) {
        element.classList.toggle('is-complete', completed.has(id));
        const index = WORLD_NODES.findIndex((node) => String(node.id) === id);
        const node = WORLD_NODES[index];
        const previous = WORLD_NODES[index - 1];
        const unlocked = (!previous || completed.has(String(previous.id))) && Number(state?.buildings?.palace ?? 1) >= (node.minPalace ?? 1);
        element.classList.toggle('is-locked', !unlocked);
        element.setAttribute('aria-label', `${node.name} ${completed.has(id) ? 'พิชิตแล้ว' : !unlocked ? 'ยังไม่ปลดล็อก ดูเงื่อนไข' : 'เลือกเพื่อส่งกองทัพ'}`);
      }
      refreshRoute();
    },
    setSelected(id) {
      selectedId = id == null ? null : String(id);
      for (const [nodeId, node] of nodeElements) {
        const selected = nodeId === selectedId;
        node.classList.toggle('is-selected', selected);
        node.setAttribute('aria-pressed', String(selected));
      }
    },
    zoom(delta) { if (!destroyed) changeScale(scale * (Number(delta) > 0 ? 1.2 : 1 / 1.2)); },
    resetCamera() { ({ scale, offset } = initialCamera()); if (!destroyed) drawCamera(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      listeners.forEach((remove) => remove());
      pointers.clear();
      host.remove();
    },
  };
}

function renderNode(node, index, uid, positions) {
  const [x, y] = positions.get(String(node.id));
  const kind = ({ forest: 'tent', river: 'temple', camp: 'fort', mountain: 'ruin', fortress: 'fort', citadel: 'temple' })[node.kind] || ['tent', 'ruin', 'temple', 'fort'][index % 4];
  const level = node.level ?? index + 1;
  const label = node.name ?? node.title ?? `จุดหมาย ${index + 1}`;
  const labelWidth = Math.max(115, Math.min(190, label.length * 7 + 28));
  return `<g class="world-node" data-node-id="${escapeText(node.id)}" transform="translate(${x} ${y})" role="button" tabindex="0" aria-label="${escapeText(label)} ระดับ ${escapeText(level)} เลือกเพื่อส่งกองทัพ" aria-pressed="false">
    <title>${escapeText(label)}</title>
    <ellipse class="world-selection" cy="10" rx="57" ry="25" fill="#f4e6a2" fill-opacity=".6" stroke="#a0813c" stroke-width="2" stroke-dasharray="4 5"/>
    <ellipse cy="12" rx="49" ry="21" fill="#bfc898" opacity=".55"/>
    <g class="world-node-art"><use href="#${uid}-${kind}" x="-46" y="-72" width="92" height="92"/></g>
    <circle cx="27" cy="-48" r="12" fill="#fbf4e4" stroke="#ab8962" stroke-width="1.5"/>
    <text x="27" y="-44" text-anchor="middle" font-family="inherit" font-size="11" font-weight="700" fill="#826141">${escapeText(level)}</text>
    <rect class="world-label-bg" x="${-labelWidth / 2}" y="28" width="${labelWidth}" height="29" rx="14.5"/>
    <text class="world-label-text" x="0" y="47" text-anchor="middle">${escapeText(label)}</text>
    <g class="world-locked" transform="translate(-31 -42)"><circle r="10" fill="#8d9179" stroke="#f6e9c1" stroke-width="2"/><path d="M-3-1v-3a3 3 0 0 1 6 0v3m-7 0h8v7h-8Z" fill="none" stroke="#fff8df" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>
    <g class="world-complete" transform="translate(-31 -42)"><circle r="10" fill="#496f4c" stroke="#f6e9c1" stroke-width="2"/><path d="m-4 0 3 3 6-6" fill="none" stroke="#fff8df" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>
  </g>`;
}

function mountains(uid) {
  const groups = [[75, 92, 1.15], [137, 61, .95], [181, 102, .8], [561, 56, .8], [604, 30, 1.2], [675, 52, .9], [1112, 187, 1.2], [1168, 234, .9], [87, 557, .9], [129, 601, 1.2], [947, 596, .85], [1017, 613, 1.15]];
  return `<g>${groups.map(([x, y, scale]) => `<use href="#${uid}-mountain" x="${x - 60 * scale}" y="${y - 80 * scale}" width="${120 * scale}" height="${100 * scale}"/>`).join('')}</g>`;
}

function woodlands(uid) {
  const clusters = [[125, 245, 21], [574, 271, 16], [1122, 346, 21], [229, 540, 18], [612, 564, 12], [948, 85, 12], [450, 67, 11], [374, 401, 7], [1003, 595, 11], [33, 359, 14], [1089, 64, 10]];
  const trees = [];
  let seed = 44;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (const [cx, cy, count] of clusters) {
    for (let i = 0; i < count; i += 1) {
      const x = cx + (random() - .5) * 110;
      const y = cy + (random() - .5) * 65;
      const size = .55 + random() * .47;
      trees.push({ x, y, size, pine: random() > .7 });
    }
  }
  trees.sort((a, b) => a.y - b.y);
  return `<g aria-hidden="true">${trees.map(({ x, y, size, pine }) => `<use href="#${uid}-${pine ? 'pine' : 'tree'}" x="${(x - 19 * size).toFixed(1)}" y="${(y - 44 * size).toFixed(1)}" width="${(38 * size).toFixed(1)}" height="${(53 * size).toFixed(1)}"/>`).join('')}</g>`;
}
