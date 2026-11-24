import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Original, procedural Thai-inspired miniature. No remote models or textures. */
const LOTS = {
  palace: { x: -0.5, z: -1.8, y: 6.6, name: 'พระราชวัง', icon: '♜' },
  sawmill: { x: -8.1, z: -1.6, y: 3, name: 'โรงเลื่อย', icon: '◈' },
  quarry: { x: -7.1, z: -6.9, y: 2.9, name: 'เหมืองหิน', icon: '◆' },
  foundry: { x: 5.8, z: -5.3, y: 3.6, name: 'โรงหลอม', icon: '♨' },
  farm: { x: -6, z: 4.9, y: 2.6, name: 'นาข้าว', icon: '✣' },
  barracks: { x: 5.4, z: 0.2, y: 3.3, name: 'ค่ายทหาร', icon: '⚑' },
  market: { x: 3.9, z: 5, y: 2.6, name: 'ตลาด', icon: '⌂' },
  shrine: { x: 0.1, z: -7.3, y: 4.6, name: 'เทวสถาน', icon: '✦' },
  wall: { x: -0.4, z: 8, y: 3.2, name: 'ประตูเมือง', icon: '♜' },
};

const PALETTE = {
  grass: '#899b6c', grassLight: '#a5b47c', soil: '#d7c49e', sand: '#e4d2ae',
  cliff: '#c8b38e', cliffDark: '#b6a081', cream: '#f2e5c5', creamDark: '#d6c59f',
  red: '#a95039', redLight: '#c66a43', redDark: '#813e32', teal: '#326654',
  leaf: '#4a7958', leafLight: '#6f9465', leafDeep: '#355f48', wood: '#79573d',
  woodLight: '#a27951', gold: '#dcb66a', goldDark: '#ad8444', water: '#6aacab',
  rock: '#a6aaa0', dark: '#403d32', white: '#faf1d9', brick: '#b16c52',
};

const STYLE_ID = 'rama-village-styles';
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .rama-scene-canvas{display:block;width:100%;height:100%;outline:none;touch-action:none}
    .rama-scene-labels{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:3}
    .village-marker{position:absolute;left:0;top:0;transform:translate(-50%,-50%);display:flex;align-items:center;gap:6px;border:1px solid #d6c9ad;background:#fffaf0e8;box-shadow:0 3px 10px #55452b17;color:#4f5140;border-radius:7px;padding:4px 7px 4px 4px;font-family:inherit;font-size:11px;font-weight:500;line-height:1.2;cursor:pointer;white-space:nowrap;pointer-events:auto;transition:background .18s,box-shadow .18s,opacity .18s;backdrop-filter:blur(8px);min-height:28px}
    .village-marker::after{content:'';position:absolute;left:50%;bottom:-5px;width:7px;height:7px;background:inherit;border-right:1px solid #d6c9ad;border-bottom:1px solid #d6c9ad;transform:translateX(-50%) rotate(45deg)}
    .village-marker:hover,.village-marker.is-selected{background:#fffbf0;box-shadow:0 4px 15px #493e352e;z-index:200!important;border-color:#b68a47;color:#70592f}
    .village-marker:focus-visible{outline:3px solid #a87942;outline-offset:3px}
    .village-marker .marker-level{display:grid;place-items:center;width:19px;height:19px;border-radius:4px;background:#345c4b;color:#fff5dd;font-size:10px;font-weight:700}
    .village-marker.is-building .marker-level{background:#b88a42;animation:rama-building-pulse 1.6s ease-in-out infinite}
    .village-marker.is-selected .marker-name{font-weight:700}
    .village-marker .marker-timer{font-size:10px;color:#986d2f;margin-left:1px;font-variant-numeric:tabular-nums}
    .rama-scene-fallback{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;gap:18px;padding:35px;color:#565d45;text-align:center;background:radial-gradient(ellipse,#e4ead3,#f3efdf)}
    .rama-scene-fallback p{font-size:13px;max-width:34ch;margin:0 auto}
    .rama-scene-fallback-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:540px;margin:0 auto;width:100%}
    .rama-scene-fallback-grid button{padding:16px 5px;background:#fffaf0;border:1px solid #c9c4a9;border-radius:10px;color:#415d43;font:inherit;font-size:12px;cursor:pointer}
    .rama-scene-fallback-grid button strong{display:block;font-size:25px;margin-bottom:7px;color:#a87b38}
    @keyframes rama-building-pulse{50%{background:#d7ab5d}}
    @media(max-width:600px){.village-marker{padding:3px;gap:4px;min-height:26px;font-size:9px}.village-marker .marker-level{width:17px;height:17px;font-size:9px}.village-marker .marker-name{display:none;max-width:54px;overflow:hidden;text-overflow:ellipsis}.village-marker.is-selected .marker-name{display:inline}.village-marker .marker-timer{font-size:8px}.village-marker .marker-timer:empty{display:none}}
    @media(prefers-reduced-motion:reduce){.village-marker.is-building .marker-level{animation:none}}
  `;
  document.head.appendChild(style);
}

function seededRandom(seed = 314159) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

export function createVillage(container, { onSelect = () => {}, onReady = () => {} } = {}) {
  ensureStyles();
  container.style.position ||= 'relative';
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const rnd = seededRandom();
  const materials = new Map();
  const geometryCache = new Map();
  const retiredGeometries = new Set();
  const interactables = [];
  const labels = new Map();
  const buildingGroups = new Map();
  const movers = [];
  const smoke = [];
  const lanterns = [];
  let destroyed = false;
  let mode = 'city';
  let state = null;
  let selected = null;
  let night = false;
  let frameId = 0;
  let lastFrame = 0;
  let renderer;
  let fallback = null;

  const mat = (color, extra = {}) => {
    const key = JSON.stringify([color, extra]);
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, ...extra }));
    return materials.get(key);
  };
  const paletteMat = {};
  Object.entries(PALETTE).forEach(([key, color]) => { paletteMat[key] = mat(color); });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
  const unitSphere = new THREE.IcosahedronGeometry(1, 1);
  const unitRock = new THREE.DodecahedronGeometry(1, 0);
  const unitCone = new THREE.ConeGeometry(1, 1, 7);

  const scene = new THREE.Scene();
  const world = new THREE.Group();
  scene.add(world);
  const camera = new THREE.OrthographicCamera(-20, 20, 13, -13, 0.1, 180);
  camera.position.set(31, 29, 35);
  camera.lookAt(0, 0.6, 0);

  const ambient = new THREE.HemisphereLight('#fff3d9', '#8d9676', 2.15);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight('#fff1d3', 3.5);
  sun.position.set(-15, 25, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 21;
  sun.shadow.camera.bottom = -21;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 5;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#bed8d2', 0.75);
  fill.position.set(12, 11, -20);
  scene.add(fill);

  const mesh = (geometry, material, parent = world, shadow = true) => {
    const item = new THREE.Mesh(geometry, typeof material === 'string' ? (paletteMat[material] || mat(material)) : material);
    item.castShadow = shadow;
    item.receiveShadow = true;
    parent.add(item);
    return item;
  };
  const box = (w, h, d, x, y, z, material, parent = world, shadow = true) => {
    const item = mesh(unitBox, material, parent, shadow);
    item.scale.set(w, h, d);
    item.position.set(x, y, z);
    return item;
  };
  const cylinder = (radius, height, x, y, z, material, parent = world, topRadius = radius) => {
    const geometry = topRadius === radius ? unitCylinder : new THREE.CylinderGeometry(topRadius / radius, 1, 1, 10);
    const item = mesh(geometry, material, parent);
    item.scale.set(radius, height, radius);
    item.position.set(x, y, z);
    return item;
  };
  const blob = (x, y, z, sx, sy, sz, material, parent = world, rock = false) => {
    const item = mesh(rock ? unitRock : unitSphere, material, parent);
    item.position.set(x, y, z);
    item.scale.set(sx, sy, sz);
    item.rotation.set(rnd() * 0.7, rnd() * 6.28, rnd() * 0.4);
    return item;
  };
  const cone = (r, h, x, y, z, material, parent = world) => {
    const item = mesh(unitCone, material, parent);
    item.scale.set(r, h, r);
    item.position.set(x, y, z);
    return item;
  };
  const line = (points, material, parent = world, width = 0.04) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 4), width, 4, false), material, parent);
  };

  // Carved island with pale stone strata, raised garden and a soft ground shadow.
  const outline = [
    [-12,-7],[-10.5,-9.3],[-7,-10.1],[-3.5,-10.5],[0,-10.2],[4.4,-10.1],
    [7.7,-8.8],[10.4,-7],[12,-3.7],[12.3,0.2],[11.3,4.1],[9.4,7.5],
    [5.8,9.5],[2.1,10.2],[-2.5,10.1],[-6.7,9.1],[-10.5,6.6],[-12.4,2.9],[-13,-1.6],
  ];
  function groundShape(points, scale = 1) {
    const shape = new THREE.Shape();
    points.forEach(([x, z], i) => i ? shape.lineTo(x * scale, -z * scale) : shape.moveTo(x * scale, -z * scale));
    shape.closePath();
    return shape;
  }
  function islandLayer(scale, depth, y, material, bevel) {
    const geometry = new THREE.ExtrudeGeometry(groundShape(outline, scale), { depth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: bevel, bevelThickness: bevel, curveSegments: 4 });
    geometry.rotateX(-Math.PI / 2);
    const item = mesh(geometry, material);
    item.position.y = y;
    return item;
  }
  islandLayer(0.981, 0.7, -1.45, 'cliffDark', 0.14);
  islandLayer(1, 0.85, -0.9, 'cliff', 0.16);
  // Top surface is y=.15; paths (.17) and water (.18) must sit above it.
  islandLayer(0.992, 0.08, -0.01, 'grass', 0.08);
  const shadowPlane = mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.15 }), scene, false);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -1.65;
  // A ring of thin exposed strata keeps the island light and tactile.
  for (let i = 0; i < 23; i++) {
    const angle = i / 23 * Math.PI * 2;
    const item = blob(Math.cos(angle) * 12, -0.8, Math.sin(angle) * 9.2, 0.7 + rnd() * 0.6, 0.31, 0.5, i % 3 ? 'cliff' : 'soil', world, true);
    item.castShadow = false;
  }

  const flatShape = (shape, y, color, parent = world) => {
    const geometry = new THREE.ShapeGeometry(shape, 18);
    geometry.rotateX(-Math.PI / 2);
    const item = mesh(geometry, color, parent, false);
    item.position.y = y;
    return item;
  };
  const ribbon = (points, width, y, color, parent = world) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], 0, p[1])));
    const samples = curve.getPoints(45);
    const left = [], right = [];
    samples.forEach((p, i) => {
      const t = curve.getTangent(i / 45);
      left.push([p.x - t.z * width / 2, p.z + t.x * width / 2]);
      right.unshift([p.x + t.z * width / 2, p.z - t.x * width / 2]);
    });
    return flatShape(groundShape([...left, ...right]), y, color, parent);
  };
  ribbon([[9.1,-9],[8.9,-5.5],[9.8,-2],[9.3,1],[8.6,3.8],[7.3,6.5],[4.8,9.3]], 2.05, 0.16, '#b8be91');
  const waterMat = mat(PALETTE.water, { roughness: 0.29, metalness: 0.12 });
  ribbon([[9.1,-9],[8.9,-5.5],[9.8,-2],[9.3,1],[8.6,3.8],[7.3,6.5],[4.8,9.3]], 1.5, 0.18, waterMat);
  for (let i = 0; i < 15; i++) {
    const z = -7.5 + i * 1.02;
    const x = z < 1 ? 9.3 + Math.sin(z * 0.5) * 0.25 : 9.4 - z * 0.32;
    const wake = box(0.23 + rnd() * 0.4, 0.009, 0.027, x + (rnd() - 0.5) * 0.75, 0.205, z, mat('#c7e1ce', { transparent: true, opacity: 0.55 }), world, false);
    wake.rotation.y = -0.25;
  }
  // Main road and garden paths. Deliberately asymmetric like a lived-in town.
  ribbon([[-0.4,9],[-0.5,6.5],[-0.6,4],[-0.5,1.2],[-0.5,-4.4],[-0.2,-7.4]], 1.28, 0.17, 'sand');
  ribbon([[-9,-1.3],[-5.4,-0.1],[-1,1.3],[3,1.8],[6,2.8],[9.7,4]], 1.05, 0.175, 'sand');
  ribbon([[-6,5.3],[-3.9,4.9],[-1.1,4.8],[3.8,5]], 0.85, 0.17, 'sand');
  ribbon([[-7.2,-6.6],[-4.7,-6],[-2.3,-5.6],[1.1,-5.5],[6,-5.4]], 0.85, 0.17, 'sand');

  // Sunlit greens at the edges break up the flat ground.
  for (const [x,z,s] of [[-10,5.1,1.7],[-10.3,-5.8,1.8],[4,-8.4,1.8],[10.5,-0.2,.8],[-2,8.8,.7],[3.7,-1.9,.7]]) {
    const disc = mesh(new THREE.CircleGeometry(s, 18), mat('#95a573'), world, false);
    disc.rotation.x = -Math.PI / 2; disc.position.set(x,0.165,z);
  }

  function platform(parent, w, d, y = 0.2, height = 0.3, color = 'creamDark') {
    box(w + 0.3, height, d + 0.3, 0, y, 0, color, parent);
    box(w, 0.12, d, 0, y + height / 2 + 0.05, 0, 'cream', parent);
  }
  function stairs(parent, width, startY, frontZ, count = 4) {
    for (let i = 0; i < count; i++) box(width, 0.11, 0.3, 0, startY - i * 0.1, frontZ + i * 0.25, 'creamDark', parent);
  }
  function thaiRoof(parent, width, depth, y, rise = 1, color = 'red', ornate = true) {
    // Two gently broken slopes, a gilded gable and swept corner finials.
    const verts = [], indices = [];
    const section = [[-depth / 2,0.06],[-depth * .24,rise * .42],[0,rise],[depth * .24,rise * .42],[depth / 2,0.06]];
    for (const x of [-width / 2, width / 2]) section.forEach(([z,h]) => verts.push(x,h+y,z));
    for(let j=0;j<4;j++){indices.push(j,j+1,j+5,j+1,j+6,j+5);}
    indices.push(0,4,2,5,7,9);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    mesh(geometry, mat(PALETTE[color] || color, { side:THREE.DoubleSide, roughness:.9 }), parent);
    for (const side of [-1,1]) {
      line(section.map(([z,h]) => [side * width / 2,y+h+.025,z]), 'gold', parent, .04);
      line([[-width/2,y+.06,side*depth/2],[0,y+.025,side*depth/2],[width/2,y+.06,side*depth/2]], 'goldDark', parent, .045);
      if(ornate) {
        line([[side*width/2-.04*side,y+rise,.0],[side*(width/2+.18),y+rise+.18,0],[side*(width/2+.28),y+rise+.56,0]], 'gold',parent,.055);
        for(const back of [-1,1]) line([[side*width/2-.35*side,y+.045,back*depth/2],[side*width/2,y+.12,back*depth/2],[side*(width/2+.15),y+.4,back*depth/2]], 'gold',parent,.04);
        const disc = cylinder(.15,.035,side*(width/2+.012),y+rise*.52,0,'gold',parent);
        disc.rotation.z=Math.PI/2;
      }
    }
    line([[-width/2,y+rise,0],[width/2,y+rise,0]],'gold',parent,.055);
    // Tile seams read as ceramic rather than a blank polygon.
    for(let i=1;i<Math.floor(width/.31);i++){
      const x=-width/2+i*.31;
      for(const side of [-1,1]) line([[x,y+.08,side*depth/2],[x,y+rise*.43,side*depth*.24],[x,y+rise+.02,0]], color==='red'?'redDark':'wood',parent,.009);
    }
  }
  function walls(parent,w,h,d,y=1.2,material='cream') {
    box(w,h,d,0,y,0,material,parent);
    box(w+.08,.12,d+.08,0,y-h/2+.1,0,'creamDark',parent);
    for(const x of [-w/2+.15,w/2-.15]) for(const z of [-d/2+.1,d/2-.1]){
      box(.16,h+.1,.16,x,y,z,'goldDark',parent);
      box(.24,.15,.24,x,y+h/2-.1,z,'gold',parent);
    }
  }
  function windowFrame(parent,x,y,z,w=.38,h=.65,rotation=0){
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotation;parent.add(g);
    box(w+.09,h+.1,.07,0,0,0,'goldDark',g);
    box(w,h,.075,0,0,.015,'teal',g);
    box(.035,h,.03,0,0,.06,'gold',g);
  }
  function createLot(id, draw) {
    const lot=LOTS[id]; const g=new THREE.Group(); g.position.set(lot.x,.2,lot.z);g.userData.building=id;world.add(g);
    draw(g);
    g.traverse(item=>{if(item.isMesh){item.userData.building=id;interactables.push(item);}});
    buildingGroups.set(id,g);
    return g;
  }

  createLot('palace',g=>{
    platform(g,5.1,3.9,.3,.45);
    platform(g,4.6,3.5,.65,.25);
    walls(g,3.9,2.1,2.7,1.8);
    for(const x of [-1.65,-.75,.75,1.65]) windowFrame(g,x,1.9,1.38,.4,.9);
    box(.8,1.5,.12,0,1.55,1.4,'wood',g);
    box(1,.14,.2,0,2.35,1.45,'gold',g);
    for(const x of [-1.94,1.94]) for(const z of [-.75,.35]) windowFrame(g,x,1.9,z,.4,.9,Math.PI/2);
    for(const x of [-2.25,-1.1,1.1,2.25]){
      cylinder(.085,2.3,x,1.8,1.7,'redDark',g);
      cylinder(.12,.15,x,.75,1.7,'gold',g);
      cylinder(.12,.17,x,2.9,1.7,'gold',g);
    }
    thaiRoof(g,5.5,4.35,2.95,1.35);
    thaiRoof(g,4.6,2.8,3.84,1.18);
    thaiRoof(g,3.75,1.7,4.65,.83);
    cylinder(.2,.28,0,5.7,0,'gold',g);
    cone(.23,.8,0,6.2,0,'gold',g);
    stairs(g,1.5,.71,2.04,5);
    // Terracotta and gold low terrace railing.
    for(const x of [-2.35,2.35]){
      for(let z=-1.65;z<1.7;z+=.48) cylinder(.04,.43,x,.97,z,'goldDark',g);
      box(.09,.08,3.5,x,1.2,0,'gold',g);
    }
    for(const x of [-1.48,1.48]){
      cylinder(.24,.28,x,.95,2.1,'cream',g);
      blob(x,1.22,2.1,.25,.32,.25,'leaf',g);
    }
  });

  function tree(x,z,s=1,kind=0,parent=world) {
    const g=new THREE.Group();g.position.set(x,.16,z);g.scale.setScalar(s);parent.add(g);
    cylinder(.1,1.25,0,.65,0,'wood',g,.07);
    if(kind===1){
      cone(.92,1.55,0,1.6,0,'leafDeep',g);
      cone(.72,1.4,0,2.25,0,'leaf',g);
      cone(.5,1.1,0,2.82,0,'leafLight',g);
    }else{
      blob(0,1.65,0,.85,.8,.75,'leaf',g);
      blob(-.35,1.96,.15,.58,.56,.54,'leafLight',g);
      blob(.34,1.68,.22,.61,.62,.57,'leafDeep',g);
    }
    return g;
  }
  function palm(x,z,s=1,parent=world) {
    const g=new THREE.Group();g.position.set(x,.15,z);g.scale.setScalar(s);parent.add(g);
    cylinder(.11,2.1,0,1.05,0,'woodLight',g,.075);
    for(let j=0;j<6;j++){
      const a=j/6*Math.PI*2;
      const shape=new THREE.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(.4,.4,1.15,-.18);shape.quadraticCurveTo(.4,-.08,0,0);
      const leaf=mesh(new THREE.ShapeGeometry(shape),mat(j%2?'#456e4c':'#5a8355',{side:THREE.DoubleSide}),g);
      leaf.rotation.set(-Math.PI/2+.22,0,a);leaf.position.y=2.1;
    }
    blob(0,2.05,0,.18,.18,.18,'wood',g);
  }
  function pot(parent,x,z,color='brick',size=.2){
    cylinder(size,.34,x,.34,z,color,parent,size*.78);
    cylinder(size*.8,.05,x,.52,z,'wood',parent);
  }
  function crate(parent,x,z,s=.45){
    box(s,s,s,x,.2+s/2,z,'woodLight',parent);
    box(s+.02,.05,.04,x,.3+s/2,z+s/2,'wood',parent);
    box(s+.02,.05,.04,x,.1+s/2,z+s/2,'wood',parent);
  }
  function log(parent,x,y,z,length=1.5){
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.z=Math.PI/2;parent.add(g);
    cylinder(.18,length,0,0,0,'wood',g);
    cylinder(.157,.018,0,length/2+.01,0,'woodLight',g);
    cylinder(.157,.018,0,-length/2-.01,0,'woodLight',g);
    cylinder(.06,.025,0,length/2+.025,0,'goldDark',g);
  }

  createLot('sawmill',g=>{
    platform(g,2.3,2,.25,.2,'woodLight');
    walls(g,1.8,1.1,1.55,.95,'woodLight');
    thaiRoof(g,2.65,2.3,1.6,.86,'red',false);
    windowFrame(g,-.5,.97,.8,.4,.5);
    box(.55,.85,.09,.45,.85,.82,'wood',g);
    for(let j=0;j<3;j++)log(g,1.65,.22+j*.27,.3+j*.06,1.8);
    for(let j=0;j<3;j++)log(g,1.65,.22,-.25-j*.25,1.8);
    box(1,.15,.55,-.35,.65,1.65,'wood',g);
    const saw=cylinder(.35,.04,-.35,1,1.65,'rock',g);saw.rotation.x=Math.PI/2;
    crate(g,-1.35,1.25,.45);
  });

  createLot('quarry',g=>{
    for(let i=0;i<12;i++){
      const a=i*2.4;const r=.55+(i%3)*.47;
      blob(Math.cos(a)*r,.4+(i%4)*.22,Math.sin(a)*r,.5+rnd()*.4,.5+rnd()*.6,.5+rnd()*.5,i%3?'rock':'creamDark',g,true);
    }
    for(const x of [-.65,.65])box(.14,1.5,.17,x,1.1,1.25,'wood',g);
    box(1.6,.2,.25,0,1.8,1.25,'wood',g);
    box(1,.55,.9,1.65,.52,1.25,'woodLight',g);
    for(const z of [.85,1.65])for(const x of [1.3,2]){const wheel=cylinder(.22,.09,x,.35,z,'wood',g);wheel.rotation.x=Math.PI/2;}
    blob(1.65,.9,1.25,.45,.25,.35,'rock',g,true);
  });

  createLot('foundry',g=>{
    platform(g,2.6,2.2,.2,.18,'soil');
    walls(g,2.1,1.25,1.7,1,'brick');
    thaiRoof(g,2.8,2.2,1.7,.9,'redDark',false);
    box(.8,.7,.08,0,.85,.9,'dark',g);
    box(.55,.45,.09,0,.7,.955,mat('#e6ad55',{emissive:'#f09837',emissiveIntensity:.6}),g);
    box(.4,2.8,.5,.72,1.6,-.48,'brick',g);
    box(.6,.15,.68,.72,3,-.48,'redDark',g);
    for(let i=0;i<4;i++){
      const m=blob(.72,3.25+i*.33,-.48,.15+i*.06,.19+i*.06,.15+i*.06,mat('#c8c5b3',{transparent:true,opacity:.32-i*.055,depthWrite:false}),g);
      m.castShadow=false;smoke.push({mesh:m,base:3.25+i*.33,index:i});
    }
    for(let i=0;i<4;i++)box(.47,.22,.25,-1.05+(i%2)*.45,.35+Math.floor(i/2)*.2,1.2,'goldDark',g);
    pot(g,1.5,1.1,'wood',.27);
  });

  createLot('farm',g=>{
    for(const x of [-1.35,1.1]){
      box(2.1,.13,2.5,x,.19,.45,'woodLight',g);
      box(1.95,.1,2.35,x,.27,.45,mat('#8dada0',{roughness:.5}),g);
      for(const side of [-1,1])box(.09,.15,2.5,x+side*1.02,.32,.45,'soil',g);
    }
    const riceMaterial=mat('#9eb65c');
    const rice=new THREE.InstancedMesh(new THREE.ConeGeometry(.075,.42,4),riceMaterial,144);rice.castShadow=true;rice.receiveShadow=true;g.add(rice);
    const dummy=new THREE.Object3D();let instance=0;
    for(const x of [-1.35,1.1])for(let a=0;a<6;a++)for(let b=0;b<12;b++){
      dummy.position.set(x-.75+a*.3,.51,.45-1+b*.18);dummy.rotation.z=(rnd()-.5)*.2;dummy.scale.setScalar(.8+rnd()*.35);dummy.updateMatrix();rice.setMatrixAt(instance++,dummy.matrix);
    }
    rice.instanceMatrix.needsUpdate=true;
    const hut=new THREE.Group();hut.position.set(-.2,0,-1.7);g.add(hut);
    walls(hut,1.4,.85,1,.7,'woodLight');thaiRoof(hut,1.9,1.5,1.2,.65,'redLight',false);
    box(.4,.65,.07,0,.65,.53,'wood',hut);
    for(let i=0;i<3;i++)cylinder(.24,.35,2.2,.4,-.7+i*.4,'gold',g,.18);
  });

  createLot('barracks',g=>{
    platform(g,2.7,2.3,.23,.22);
    walls(g,2.35,1.25,1.8,1.05);
    thaiRoof(g,3.2,2.55,1.82,1.02);
    for(const x of [-.7,0,.7])windowFrame(g,x,1.1,.94,.4,.75);
    box(2.4,.13,.12,0,.65,1.65,'wood',g);
    for(let i=0;i<5;i++){
      cylinder(.025,1.3,-1+i*.48,1.15,1.65,'wood',g);
      cone(.07,.25,-1+i*.48,1.88,1.65,'rock',g);
    }
    for(const x of [-1.7,1.7]){
      cylinder(.04,2.4,x,1.4,.7,'wood',g);
      box(.45,.7,.035,x+.21,2.1,.7,'redDark',g);
      box(.43,.06,.04,x+.21,1.78,.7,'gold',g);
    }
  });

  createLot('market',g=>{
    const colors=['teal','redLight','gold'];
    for(let i=0;i<3;i++){
      const stall=new THREE.Group();stall.position.set((i-1)*1.35,0,i===1?-.45:.1);g.add(stall);
      box(1.1,.65,.8,0,.5,0,'woodLight',stall);
      for(const x of [-.52,.52])for(const z of [-.4,.4])cylinder(.035,1.5,x,.95,z,'wood',stall);
      for(let stripe=0;stripe<5;stripe++){
        const roof=box(.25,.08,1.4,-.5+stripe*.25,1.7,0,stripe%2?'cream':colors[i],stall);roof.rotation.x=.2;
        box(.25,.2,.05,-.5+stripe*.25,1.46,.68,stripe%2?'cream':colors[i],stall);
      }
      for(let j=0;j<4;j++)blob(-.35+j*.23,.89,.16,.1,.1,.1,j%2?'gold':'redLight',stall);
    }
    crate(g,-1.6,1.1,.45);crate(g,-1.15,1.2,.35);
    pot(g,1.5,.9,'brick',.23);pot(g,1.05,1.1,'teal',.18);
  });

  createLot('shrine',g=>{
    platform(g,2.6,2.6,.27,.28);
    for(let i=0;i<3;i++)box(2.1-i*.35,.2,2.1-i*.35,0,.56+i*.2,0,i%2?'cream':'goldDark',g);
    const points=[[.7,0],[.75,.16],[.58,.3],[.66,.52],[.58,.82],[.41,1.07],[.26,1.25],[.22,1.5],[.12,1.6]].map(p=>new THREE.Vector2(...p));
    const bell=mesh(new THREE.LatheGeometry(points,20),mat('#d9b56a',{roughness:.58,metalness:.2}),g);bell.position.y=1;
    for(let i=0;i<6;i++)cylinder(.24-i*.027,.12,0,2.55+i*.13,0,'gold',g);
    cone(.11,.85,0,3.63,0,'gold',g);
    stairs(g,1.1,.47,1.4,3);
    for(const x of [-1.14,1.14])for(const z of [-1.14,1.14]){
      cylinder(.08,.8,x,.9,z,'cream',g);cone(.12,.24,x,1.42,z,'gold',g);
    }
  });

  createLot('wall',g=>{
    const tower=(x)=>{
      box(1.2,1.55,1.2,x,.95,0,'creamDark',g);
      box(1.3,.16,1.3,x,1.78,0,'cream',g);
      const roof=new THREE.Group();roof.position.x=x;g.add(roof);thaiRoof(roof,1.7,1.6,1.92,.72,'red',false);
      windowFrame(g,x,1.2,.63,.25,.5);
    };
    tower(-1.8);tower(1.8);
    for(const x of [-3.2,3.2]){
      box(1.55,1.1,.5,x,.77,0,'creamDark',g);
      for(let i=0;i<4;i++)box(.23,.25,.52,x-.62+i*.4,1.43,0,'cream',g);
    }
    box(2.7,.4,.65,0,1.85,0,'wood',g);
    box(2.55,.12,.72,0,2.12,0,'goldDark',g);
    for(const x of [-1.15,1.15])box(.12,1.5,.23,x,.95,0,'wood',g);
    for(const x of [-.83,.83])box(.62,1.2,.12,x,.8,.1,'woodLight',g);
    // Central opening stays open: this is a welcoming town, not a locked gate.
  });

  // Garden wall sections at the front connect the entrance with the landscape.
  for(const [x,z,angle] of [[-6,7.8,.21],[4.2,8,-.14]]){
    const g=new THREE.Group();g.position.set(x,.2,z);g.rotation.y=angle;world.add(g);
    box(3.2,.65,.33,0,.35,0,'creamDark',g);
    box(3.3,.1,.4,0,.73,0,'cream',g);
    for(let i=0;i<6;i++)box(.21,.16,.39,-1.45+i*.58,.85,0,'cream',g);
  }

  // Timber footbridge over the eastern stream.
  const bridge=new THREE.Group();bridge.position.set(8.65,.36,3.45);bridge.rotation.y=-.2;world.add(bridge);
  for(let i=0;i<14;i++){
    const x=-1.5+i*.23;box(.2,.12,1.35,x,.22+Math.cos(x/1.5*Math.PI/2)*.2,0,'woodLight',bridge);
  }
  for(const z of [-.65,.65]){
    for(const x of [-1.5,-.75,0,.75,1.5])box(.065,.65,.065,x,.65,z,'wood',bridge);
    line([[-1.6,.9,z],[0,1.08,z],[1.6,.9,z]],'wood',bridge,.045);
  }

  // Dense silhouettes at the back, individual trees near the roads.
  const trees=[
    [-11,-4.6,1.1],[-10.3,-6.9,1],[-10.5,-.1,1.25],[-11.7,2.7,.85],[-10.6,5.7,1],
    [-8.9,-8.2,.95],[-4.7,-8.7,.85],[-3,-9.1,.8],[2.5,-9.1,.9],[4.5,-8.4,.85],
    [7.2,-7.7,.85],[10.9,-4.4,.75],[11,-1.7,.8],[10.5,1.3,.78],[9.2,6,.7],
    [-8,7.2,.74],[-4.2,7.8,.65],[-3.5,1.9,.65],[2.9,-3,.65],[3,-6.8,.6],
  ];
  trees.forEach(([x,z,s],i)=>tree(x,z,s,i%4===0?1:0));
  [[-10,3.1,.9],[-4.2,-5.2,.78],[7.3,-2.2,.9],[2.1,7.3,.72],[-8.3,2.3,.68]].forEach(([x,z,s])=>palm(x,z,s));
  for(let i=0;i<34;i++){
    const a=rnd()*Math.PI*2;const r=.91+rnd()*.06;
    const x=Math.cos(a)*11.5*r,z=Math.sin(a)*8.6*r;
    if(x>7&&z>-7)continue;
    blob(x,.4,z,.25+rnd()*.28,.28+rnd()*.25,.24+rnd()*.25,i%3?'leafLight':'leaf',world);
    if(i%5===0){for(let j=0;j<3;j++)blob(x+(rnd()-.5)*.3,.68,z+(rnd()-.5)*.3,.06,.07,.06,j%2?'cream':'gold',world);}
  }
  [[-11,-3.5,1],[-10.3,-8,.8],[6.3,-8.8,.8],[10.9,3,.6],[2.9,8.4,.45],[-9.4,6.2,.65]].forEach(([x,z,s])=>{
    blob(x,.4,z,s,.55*s,s*.7,'rock',world,true);blob(x+.5,.25,z+.4,s*.4,s*.35,s*.4,'creamDark',world,true);
  });
  // A blossom tree beside the palace is the scene's single accent color.
  const blossom=new THREE.Group();blossom.position.set(-3.65,.2,-3.9);world.add(blossom);
  cylinder(.1,1.5,0,.75,0,'wood',blossom);
  blob(0,1.9,0,.75,.68,.68,'#d7a591',blossom);blob(-.35,2.13,.1,.48,.4,.48,'#e6bca2',blossom);
  blob(.4,1.9,.2,.48,.47,.5,'#c58e7e',blossom);

  // Small lamps and residents give the diorama an everyday scale.
  for(const [x,z] of [[-1.4,4],[.4,2.8],[2.8,1.8],[-4.3,.25],[-1.4,7],[-1.5,-5.2]]){
    cylinder(.035,1.12,x,.75,z,'wood',world);
    box(.28,.31,.28,x,1.4,z,'goldDark');
    const glass=box(.21,.23,.21,x,1.4,z,mat('#f7dca0',{emissive:'#e9ac4f',emissiveIntensity:.1}));
    cone(.23,.18,x,1.66,z,'redDark');lanterns.push(glass);
  }
  function citizen(x,z,color,index){
    const g=new THREE.Group();world.add(g);g.position.set(x,.21,z);
    cone(.12,.36,0,.25,0,color,g);
    blob(0,.52,0,.11,.12,.105,'#d5aa79',g);
    cone(.18,.09,0,.64,0,'gold',g);
    for(const side of [-1,1])box(.045,.13,.05,side*.05,.055,0,'wood',g);
    movers.push({mesh:g,x,z,index});
  }
  citizen(-.6,5,'teal',0);citizen(-3,1,'redLight',1);citizen(3,2.8,'cream',2);
  citizen(-4.1,4.8,'goldDark',3);citizen(1.4,-5.4,'teal',4);citizen(-.4,-6.2,'redLight',5);

  const ring=mesh(new THREE.RingGeometry(1.85,1.94,64),new THREE.MeshBasicMaterial({color:'#d4ac58',transparent:true,opacity:.75,side:THREE.DoubleSide}),world,false);
  ring.rotation.x=-Math.PI/2;ring.position.y=.225;ring.visible=false;
  const buildRing=mesh(new THREE.RingGeometry(1.96,2.02,48),new THREE.MeshBasicMaterial({color:'#ddb263',transparent:true,opacity:.6,side:THREE.DoubleSide}),world,false);
  buildRing.rotation.x=-Math.PI/2;buildRing.position.y=.228;buildRing.visible=false;

  // Batch immobile geometry by material AND building identity. Decorative detail
  // stays inexpensive while every lot remains independently raycastable.
  const animatedRoots=new Set(movers.map(item=>item.mesh));
  const animatedMeshes=new Set([ring,buildRing,...smoke.map(item=>item.mesh)]);
  const batches=new Map();
  world.updateMatrixWorld(true);
  world.traverse(item=>{
    if(!item.isMesh||item.isInstancedMesh||animatedMeshes.has(item)||Array.isArray(item.material))return;
    let parent=item.parent;
    while(parent&&parent!==world){if(animatedRoots.has(parent))return;parent=parent.parent;}
    const attributes=Object.keys(item.geometry.attributes).sort().join(',');
    const key=[item.userData.building||'landscape',item.material.uuid,item.castShadow,attributes].join('|');
    if(!batches.has(key))batches.set(key,[]);batches.get(key).push(item);
  });
  for(const items of batches.values()){
    if(items.length<2)continue;
    const geometries=items.map(item=>{
      const geometry=item.geometry.index?item.geometry.toNonIndexed():item.geometry.clone();
      geometry.applyMatrix4(item.matrixWorld);return geometry;
    });
    const combined=mergeGeometries(geometries,false);
    geometries.forEach(geometry=>geometry.dispose());
    if(!combined)continue;
    const batch=mesh(combined,items[0].material,world,items[0].castShadow);
    batch.userData.building=items[0].userData.building;
    for(const item of items){retiredGeometries.add(item.geometry);item.removeFromParent();}
  }
  interactables.length=0;
  world.traverse(item=>{if(item.isMesh&&item.userData.building)interactables.push(item);});

  const labelLayer=document.createElement('div');labelLayer.className='rama-scene-labels';labelLayer.setAttribute('aria-label','สิ่งก่อสร้างในเมือง');container.appendChild(labelLayer);
  Object.entries(LOTS).forEach(([id,lot])=>{
    const button=document.createElement('button');button.type='button';button.className='village-marker';button.dataset.building=id;
    button.innerHTML=`<span class="marker-level">1</span><span class="marker-name">${lot.name}</span><span class="marker-timer"></span>`;
    button.setAttribute('aria-label',`${lot.name} ระดับ 1`);
    button.addEventListener('pointerdown',e=>e.stopPropagation());
    button.addEventListener('click',e=>{e.stopPropagation();setSelected(id);onSelect(id);});
    labelLayer.appendChild(button);labels.set(id,button);
  });

  let controls;
  try {
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;
    renderer.setClearColor(0x000000,0);
    renderer.domElement.className='rama-scene-canvas';renderer.domElement.setAttribute('aria-label','เมืองอโยธยาแบบสามมิติ ลากเพื่อหมุน ใช้ปุ่มซูมเพื่อย่อขยาย');renderer.domElement.setAttribute('role','img');
    container.insertBefore(renderer.domElement,labelLayer);
    controls=new OrbitControls(camera,renderer.domElement);
    controls.target.set(0,.5,0);controls.enableDamping=true;controls.dampingFactor=.08;
    controls.enablePan=true;controls.screenSpacePanning=false;controls.panSpeed=.65;controls.rotateSpeed=.45;
    controls.minPolarAngle=Math.PI*.21;controls.maxPolarAngle=Math.PI*.4;
    controls.minZoom=.75;controls.maxZoom=2.6;
    controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
    controls.update();
  } catch(error) {
    labelLayer.style.display='none';
    fallback=document.createElement('div');fallback.className='rama-scene-fallback';
    fallback.innerHTML='<p>ฉากสามมิติไม่พร้อมใช้งานบนอุปกรณ์นี้ เลือกสิ่งก่อสร้างเพื่อเล่นต่อได้เลย</p><div class="rama-scene-fallback-grid"></div>';
    Object.entries(LOTS).forEach(([id,lot])=>{
      const button=document.createElement('button');button.type='button';button.innerHTML=`<strong>${lot.icon}</strong>${lot.name}`;button.addEventListener('click',()=>onSelect(id));fallback.querySelector('div').appendChild(button);
    });container.appendChild(fallback);
    console.warn('RAMA: 3D renderer unavailable; accessible building controls remain available.',error?.message);
  }

  const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();let pointerStart=null;
  function onPointerDown(event){if(event.isPrimary&&event.button===0)pointerStart={x:event.clientX,y:event.clientY};}
  function onPointerUp(event){
    if(!pointerStart||!renderer||mode!=='city')return;
    const delta=Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y);pointerStart=null;if(delta>7)return;
    const bounds=renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-((event.clientY-bounds.top)/bounds.height)*2+1);
    raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(interactables,false)[0];
    if(hit?.object.userData.building){const id=hit.object.userData.building;setSelected(id);onSelect(id);}
  }
  function onPointerCancel(){pointerStart=null;}
  renderer?.domElement.addEventListener('pointerdown',onPointerDown);
  renderer?.domElement.addEventListener('pointerup',onPointerUp);
  renderer?.domElement.addEventListener('pointercancel',onPointerCancel);
  const projected=new THREE.Vector3();
  let width=1,height=1;
  function positionLabels(){
    if(!renderer||mode!=='city')return;
    Object.entries(LOTS).forEach(([id,lot])=>{
      projected.set(lot.x,lot.y+.3,lot.z).project(camera);
      const label=labels.get(id),x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height-(width<=600&&id==='quarry'?14:0);
      label.style.left=`${x}px`;label.style.top=`${y}px`;
      label.style.opacity=projected.z<1&&x>15&&x<width-15&&y>10&&y<height-15?'1':'0';
      label.style.pointerEvents=label.style.opacity==='1'?'auto':'none';
      label.style.zIndex=String(Math.round(100-projected.z*100));
    });
  }
  function resize(){
    if(destroyed)return;
    width=container.clientWidth||1;height=container.clientHeight||1;
    const aspect=width/height;const viewHeight=Math.max(25,32.8/aspect);
    camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2;camera.top=viewHeight/2;camera.bottom=-viewHeight/2;
    camera.updateProjectionMatrix();renderer?.setSize(width,height,false);positionLabels();
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);
  function getConstruction(){
    return state?.queues?.building||state?.buildingQueue||state?.buildQueue||state?.construction||null;
  }
  function setState(next){
    state=next;
    const queue=getConstruction();
    const buildingId=queue?.buildingId||queue?.id||queue?.building;
    for(const [id,button]of labels){
      const entry=state?.buildings?.[id];const level=typeof entry==='number'?entry:entry?.level??1;
      button.querySelector('.marker-level').textContent=String(level);
      button.classList.toggle('is-building',buildingId===id);
      button.setAttribute('aria-label',`${LOTS[id].name} ระดับ ${level}${buildingId===id?' กำลังก่อสร้าง':''}`);
      const finish=queue?.endsAt||queue?.endAt||queue?.finishAt||queue?.completesAt;
      button.querySelector('.marker-timer').textContent=buildingId===id&&finish?`${Math.max(0,Math.ceil((finish-Date.now())/1000))}s`:'';
    }
    buildRing.visible=Boolean(buildingId&&LOTS[buildingId]);
    if(buildRing.visible)buildRing.position.set(LOTS[buildingId].x,.228,LOTS[buildingId].z);
  }
  function setSelected(id){
    selected=LOTS[id]?id:null;
    labels.forEach((button,key)=>button.classList.toggle('is-selected',key===selected));
    ring.visible=!!selected;if(selected){const lot=LOTS[selected];ring.position.set(lot.x,.225,lot.z);const scale=selected==='palace'?1.5:1;ring.scale.setScalar(scale);}
  }
  function setMode(next){mode=next;labelLayer.style.display=next==='city'&&!fallback?'':'none';}
  function setNight(value){
    night=!!value;ambient.intensity=night?.9:2.15;ambient.color.set(night?'#8ea4ba':'#fff3d9');sun.intensity=night?1.15:3.5;sun.color.set(night?'#b6cadb':'#fff1d3');fill.intensity=night?.45:.75;
    lanterns.forEach(lamp=>{lamp.material.emissiveIntensity=night?2.2:.1;});
    if(renderer)renderer.toneMappingExposure=night?.94:1.16;
  }
  function zoom(delta){camera.zoom=THREE.MathUtils.clamp(camera.zoom+delta,.75,2.6);camera.updateProjectionMatrix();controls?.update();positionLabels();}
  function resetCamera(){camera.position.set(31,29,35);camera.zoom=1;controls?.target.set(0,.5,0);camera.lookAt(0,.5,0);controls?.update();resize();}
  function render(time){
    if(destroyed)return;frameId=requestAnimationFrame(render);
    // 30 FPS is enough for a calm city and avoids burning a mobile battery.
    if(time-lastFrame<32||mode!=='city'||!renderer||!container.isConnected)return;lastFrame=time;
    controls?.update();
    // Keep panning bounded so that the town cannot be lost off-screen.
    if(controls){controls.target.x=THREE.MathUtils.clamp(controls.target.x,-7,7);controls.target.z=THREE.MathUtils.clamp(controls.target.z,-6,6);}
    if(!reducedMotion){
      const t=time*.001;
      movers.forEach(({mesh:person,x,z,index})=>{
        const phase=t*.2+index*1.5;person.position.x=x+Math.sin(phase)*.6;person.position.z=z+Math.cos(phase)*.28;person.position.y=.21+Math.abs(Math.sin(t*4+index))*.018;person.rotation.y=Math.cos(phase)>0?Math.PI*.5:-Math.PI*.5;
      });
      smoke.forEach(({mesh:puff,base,index})=>{puff.position.y=base+Math.sin(t*.8+index)*.09;puff.position.x=.72+Math.sin(t*.5+index)*.09;});
      if(buildRing.visible){buildRing.material.opacity=.43+Math.sin(t*3)*.16;buildRing.rotation.z=t*.15;}
    }
    renderer.render(scene,camera);positionLabels();
  }
  resize();frameId=requestAnimationFrame(render);
  queueMicrotask(()=>{if(!destroyed)onReady({webgl:!!renderer});});

  return {
    setState,setSelected,setMode,setNight,zoom,resetCamera,resize,
    getDiagnostics:()=>({webgl:!!renderer,mode,night,selected,buildings:Object.keys(LOTS).length,drawCalls:renderer?.info.render.calls||0,triangles:renderer?.info.render.triangles||0,geometries:renderer?.info.memory.geometries||0,pixelRatio:renderer?.getPixelRatio()||0}),
    destroy(){
      destroyed=true;cancelAnimationFrame(frameId);resizeObserver.disconnect();controls?.dispose();
      renderer?.domElement.removeEventListener('pointerdown',onPointerDown);renderer?.domElement.removeEventListener('pointerup',onPointerUp);renderer?.domElement.removeEventListener('pointercancel',onPointerCancel);
      const disposed=new Set();scene.traverse(object=>{if(object.geometry&&!disposed.has(object.geometry)){object.geometry.dispose();disposed.add(object.geometry);}if(object.material){const list=Array.isArray(object.material)?object.material:[object.material];list.forEach(material=>{if(!disposed.has(material)){material.dispose();disposed.add(material);}});}});
      materials.forEach(material=>{if(!disposed.has(material))material.dispose();});geometryCache.forEach(geometry=>geometry.dispose());
      retiredGeometries.forEach(geometry=>{if(!disposed.has(geometry))geometry.dispose();});
      renderer?.dispose();renderer?.domElement.remove();labelLayer.remove();fallback?.remove();
    },
  };
}
