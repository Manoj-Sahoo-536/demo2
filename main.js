import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ═══════════════════════════════════════════════════════
   RouteX — Premium 3D Scene
   ═══════════════════════════════════════════════════════ */

const canvas = document.querySelector('canvas#webgl');
const scene  = new THREE.Scene();
scene.background = new THREE.Color('#a8d8ea');
scene.fog = new THREE.FogExp2('#b8e2f8', 0.011);

const sizes = { width: window.innerWidth, height: window.innerHeight };
const camera = new THREE.PerspectiveCamera(48, sizes.width / sizes.height, 0.1, 200);
camera.position.set(0, 14, 7);
camera.lookAt(0, 0, 0);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

// ── Lighting (3-Point Studio Setup) ─────────────────
const hemiLight = new THREE.HemisphereLight(0xd4efff, 0x4a8c40, 0.9);
scene.add(hemiLight);

const sun = new THREE.DirectionalLight(0xfff5d4, 2.2);
sun.position.set(10, 22, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 1, far: 100 });
scene.add(sun);

const fill = new THREE.DirectionalLight(0xc8e0ff, 0.5);
fill.position.set(-10, 10, -6);
scene.add(fill);

const rimLight = new THREE.DirectionalLight(0xffe8cc, 0.3);
rimLight.position.set(0, 5, -15);
scene.add(rimLight);

// ── Wavy Road Curve ─────────────────────────────────
const curve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-1,   0, -14),
  new THREE.Vector3(-3.5, 0, -10),
  new THREE.Vector3(-1.5, 0,  -6),
  new THREE.Vector3( 2.5, 0,  -2),
  new THREE.Vector3( 3.8, 0,   2),
  new THREE.Vector3( 0.5, 0,   6),
  new THREE.Vector3(-3.5, 0,   9.5),
  new THREE.Vector3(-1.5, 0,  12.5),
  new THREE.Vector3( 2,   0,  15),
]);

// ── Road Texture (Canvas Baked — High Quality) ──────
function makeRoadTex() {
  const W = 512, H = 2048;
  const cvs = document.createElement('canvas');
  cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext('2d');

  // Base asphalt gradient
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#282c34');
  grad.addColorStop(0.5, '#2e3038');
  grad.addColorStop(1, '#282c34');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Gravel noise texture
  for (let i = 0; i < 25000; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    const g = Math.floor(Math.random() * 20 + 28);
    ctx.fillStyle = `rgba(${g},${g},${g + 4},0.5)`;
    ctx.fillRect(x, y, Math.random() * 3, Math.random() * 2);
  }

  // Yellow edge lines with glow
  ctx.shadowColor = '#FFD600';
  ctx.shadowBlur = 4;
  ctx.fillStyle = '#FFD600';
  ctx.fillRect(12, 0, 18, H);
  ctx.fillRect(W - 30, 0, 18, H);
  ctx.shadowBlur = 0;

  // White center dashes
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (let y = 0; y < H; y += 220) {
    ctx.fillRect(W / 2 - 10, y, 20, 130);
  }

  const t = new THREE.CanvasTexture(cvs);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
  return t;
}

// ── Grass Texture ───────────────────────────────────
function makeGrassTex() {
  const W = 256;
  const cvs = document.createElement('canvas');
  cvs.width = W; cvs.height = W;
  const ctx = cvs.getContext('2d');

  // Base
  const grad = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W * 0.7);
  grad.addColorStop(0, '#4da142');
  grad.addColorStop(1, '#3d8835');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, W);

  // Blades
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * W, y = Math.random() * W;
    const h = Math.floor(Math.random() * 30 + 100);
    const l = Math.floor(Math.random() * 15 + 26);
    ctx.fillStyle = `hsl(${h},48%,${l}%)`;
    ctx.fillRect(x, y, 1, Math.random() * 6 + 1);
  }

  const t = new THREE.CanvasTexture(cvs);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(28, 28);
  t.anisotropy = 8;
  return t;
}

// ── Road Strip Builder ──────────────────────────────
const SEGS = 500, RHW = 1.78;
function buildStrip(hw, mat, yOff = 0, uvRep = 15) {
  const v = [], uv = [], tri = [];
  for (let i = 0; i <= SEGS; i++) {
    const s = i / SEGS, p = curve.getPoint(s);
    const tn = curve.getTangent(s); tn.y = 0; tn.normalize();
    const px = new THREE.Vector3(-tn.z, 0, tn.x);
    v.push(p.x + px.x * hw, p.y + yOff, p.z + px.z * hw,
           p.x - px.x * hw, p.y + yOff, p.z - px.z * hw);
    const vc = s * uvRep; uv.push(0, vc, 1, vc);
    if (i < SEGS) { const b = i * 2; tri.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(tri); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; return m;
}

const roadTex  = makeRoadTex();
const grassTex = makeGrassTex();

// Road shoulder
scene.add(buildStrip(RHW + 0.55, new THREE.MeshStandardMaterial({
  color: 0x3a3e46, roughness: 0.92
}), -0.01, 1));

// Main road surface
scene.add(buildStrip(RHW, new THREE.MeshStandardMaterial({
  map: roadTex, roughness: 0.85, metalness: 0.02
}), 0.01, 15));

// ── Terrain ─────────────────────────────────────────
const tGeo = new THREE.PlaneGeometry(160, 160, 60, 60);
const pos = tGeo.attributes.position;
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i), z = pos.getZ(i);
  const d = Math.sqrt(x * x + z * z);
  if (d > 14) {
    pos.setY(i,
      Math.sin(x * 0.25) * Math.cos(z * 0.25) * 0.6 +
      Math.sin(x * 0.6 + z * 0.45) * 0.3
    );
  }
}
tGeo.computeVertexNormals();
const ground = new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({
  map: grassTex, color: 0xffffff, roughness: 1.0
}));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.18;
ground.receiveShadow = true;
scene.add(ground);

// ── Trees (Multiple Types) ──────────────────────────
const trnkM = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.88 });
const leafMs = [
  new THREE.MeshStandardMaterial({ color: 0x296b1a, roughness: 0.82 }),
  new THREE.MeshStandardMaterial({ color: 0x1e5c14, roughness: 0.78 }),
  new THREE.MeshStandardMaterial({ color: 0x358a22, roughness: 0.82 }),
];

function addTree(x, z, type = 0, sc = 1) {
  const g = new THREE.Group();
  const trk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1 * sc, 0.16 * sc, 0.85 * sc, 8), trnkM
  );
  trk.position.y = 0.42 * sc; trk.castShadow = true; g.add(trk);

  if (type === 0) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.68 * sc, 12, 10), leafMs[0]);
    s.position.y = 1.35 * sc; s.castShadow = true; g.add(s);
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.46 * sc, 10, 8), leafMs[2]);
    s2.position.set(0.28 * sc, 1.6 * sc, 0.18 * sc); s2.castShadow = true; g.add(s2);
  } else if (type === 1) {
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.52 * sc, 1.7 * sc, 10), leafMs[1]);
    c1.position.y = 1.5 * sc; c1.castShadow = true; g.add(c1);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.72 * sc, 1.2 * sc, 10), leafMs[0]);
    c2.position.y = 0.9 * sc; c2.castShadow = true; g.add(c2);
  } else {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.44 * sc, 8, 6), leafMs[2]);
    s.position.y = 1.7 * sc; s.scale.y = 1.85; s.castShadow = true; g.add(s);
  }
  g.position.set(x, -0.18, z);
  scene.add(g);
}

// Tree placement array
[
  [-7,-13,1,1.1],[-9,-8,0,1.0],[-8,-2,2,0.9],[-7,4,1,1.2],[-8,9,0,0.9],[-6,13,1,1.0],
  [7,-12,0,1.1],[8,-7,1,0.9],[9,-1,2,1.0],[8,5,0,1.2],[7,10,1,0.9],[7,13,0,0.9],
  [-5,-14,0,0.8],[6,-14,1,0.8],[-5,14,2,0.9],[5,14,0,0.9],
  [-12,-4,1,1.3],[12,-3,0,1.2],[-12,6,0,1.1],[12,7,1,1.3],
  [-10,0,2,1.0],[10,1,1,0.9],[-6,-9,0,0.7],[6,-10,2,0.7],
  [-14, -10, 0, 1.4], [14, -9, 1, 1.3], [-14, 8, 2, 1.2], [14, 10, 0, 1.4],
  [-11, -12, 1, 0.8], [11, -11, 0, 0.7], [-11, 12, 2, 0.9], [11, 11, 1, 0.8],
].forEach(([x, z, t, s]) => addTree(x, z, t, s));

// ── Street Lamps ────────────────────────────────────
const poleM = new THREE.MeshStandardMaterial({ color: 0x7a8a9a, roughness: 0.35, metalness: 0.8 });
const lampGlowM = new THREE.MeshStandardMaterial({
  color: 0xfffce0, emissive: 0xfffce0, emissiveIntensity: 0.0
});

for (let li = 0; li <= 8; li++) {
  const lt = li / 8, lp = curve.getPoint(lt);
  const ltn = curve.getTangent(lt); ltn.y = 0; ltn.normalize();
  const lperp = new THREE.Vector3(-ltn.z, 0, ltn.x);

  [-1, 1].forEach(side => {
    const ox = lp.x + lperp.x * (RHW + 0.55) * side;
    const oz = lp.z + lperp.z * (RHW + 0.55) * side;

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.8, 8), poleM);
    pole.position.set(ox, 1.9 - 0.18, oz); pole.castShadow = true; scene.add(pole);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6), poleM);
    arm.position.set(ox - lperp.x * 0.22 * side, 3.7, oz - lperp.z * 0.22 * side);
    arm.rotation.z = Math.PI / 2; scene.add(arm);

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), lampGlowM);
    bulb.position.set(ox - lperp.x * 0.48 * side, 3.72, oz - lperp.z * 0.48 * side);
    scene.add(bulb);
  });
}

// ── Yellow Semi Truck — Premium Materials ───────────
const mY  = new THREE.MeshStandardMaterial({ color: 0xFFC200, roughness: 0.18, metalness: 0.42 });
const mYD = new THREE.MeshStandardMaterial({ color: 0xE6A800, roughness: 0.22, metalness: 0.45 });
const mYT = new THREE.MeshStandardMaterial({ color: 0xFFCF30, roughness: 0.20, metalness: 0.35 });
const mChr = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.03, metalness: 1.0 });
const mBk  = new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.75, metalness: 0.15 });
const mDk  = new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.55, metalness: 0.25 });
const mGl  = new THREE.MeshStandardMaterial({ color: 0x2a5070, roughness: 0.02, transparent: true, opacity: 0.78, metalness: 0.3 });
const mTire = new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.92 });
const mRim  = new THREE.MeshStandardMaterial({ color: 0x585c62, roughness: 0.15, metalness: 0.95 });
const mHub  = new THREE.MeshStandardMaterial({ color: 0x8090a0, roughness: 0.08, metalness: 1.0 });
const mHL   = new THREE.MeshStandardMaterial({ color: 0xf8fbff, roughness: 0.04, emissive: 0xffffcc, emissiveIntensity: 0.0 });
const mTL   = new THREE.MeshStandardMaterial({ color: 0xff1400, roughness: 0.04, emissive: 0xff0000, emissiveIntensity: 0.0 });
const mAmb  = new THREE.MeshStandardMaterial({ color: 0xff9900, roughness: 0.08, emissive: 0xff7000, emissiveIntensity: 0.0 });
const mExh  = new THREE.MeshStandardMaterial({ color: 0x303235, roughness: 0.45, metalness: 0.92 });
const mGrl  = new THREE.MeshStandardMaterial({ color: 0x08090c, roughness: 0.45, metalness: 0.35 });
const ledMat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x000000, emissiveIntensity: 0 });

const vanGroup = new THREE.Group();
const wheelsGroup = new THREE.Group();

function B(w, h, d, m, px, py, pz, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(px, py, pz); mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}
function C(rt, rb, h, segs, m, px, py, pz, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), m);
  mesh.position.set(px, py, pz); mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true; return mesh;
}

// Cabin
vanGroup.add(B(2.2, 2.5, 2.1, mY, 2.95, 2.15, 0));
vanGroup.add(B(2.2, 0.28, 2.16, mDk, 2.95, 0.79, 0));
vanGroup.add(B(1.5, 0.22, 2.06, mYD, 2.55, 3.46, 0));
vanGroup.add(B(1.6, 0.1, 2.12, mY, 3.38, 3.55, 0));
vanGroup.add(B(0.1, 0.62, 2.1, mY, 3.62, 3.25, 0, -0.55, 0, 0));
[-1.04, 1.04].forEach(z => vanGroup.add(B(0.7, 0.48, 0.08, mY, 3.3, 3.3, z)));

// Windshield
const ws = new THREE.Mesh(new THREE.PlaneGeometry(2.06, 1.12), mGl);
ws.position.set(4.04, 2.56, 0); ws.rotation.set(0, Math.PI / 2, -0.11);
vanGroup.add(ws);
vanGroup.add(B(0.06, 0.1, 2.08, mChr, 4.04, 3.14, 0));
vanGroup.add(B(0.06, 0.1, 2.08, mChr, 4.04, 1.98, 0));
vanGroup.add(B(0.06, 1.18, 0.08, mChr, 4.04, 2.56, 1.04));
vanGroup.add(B(0.06, 1.18, 0.08, mChr, 4.04, 2.56, -1.04));

// Side windows
[1.05, -1.05].forEach(z => {
  const cv = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.52), mGl);
  cv.position.set(4.04, 2.86, z); cv.rotation.y = Math.PI / 2; vanGroup.add(cv);
  const dw = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.62), mGl);
  dw.position.set(3.0, 2.72, z); if (z < 0) dw.rotation.y = Math.PI; vanGroup.add(dw);
  vanGroup.add(B(0.72, 0.05, 0.06, mChr, 3.0, 3.05, z));
});

// Grille
vanGroup.add(B(0.1, 1.1, 1.86, mGrl, 4.05, 1.42, 0));
for (let i = 0; i < 4; i++) vanGroup.add(B(0.12, 0.1, 1.84, mChr, 4.06, 1.08 + i * 0.27, 0));
vanGroup.add(C(0.24, 0.24, 0.1, 20, mChr, 4.08, 1.68, 0, 0, 0, Math.PI / 2));

// Headlights
[-0.7, 0.7].forEach(z => {
  vanGroup.add(B(0.12, 0.28, 0.62, mHL, 4.06, 1.5, z));
  vanGroup.add(B(0.14, 0.36, 0.7, mChr, 4.03, 1.5, z));
  vanGroup.add(B(0.08, 0.06, 0.68, mHL, 4.06, 1.72, z));
});

// Bumper
vanGroup.add(B(0.3, 0.6, 2.14, mBk, 4.12, 0.62, 0));
vanGroup.add(B(0.3, 0.18, 2.14, mDk, 4.14, 0.28, 0));
vanGroup.add(B(0.08, 0.08, 2.0, mChr, 4.16, 0.5, 0));
[-0.74, 0.74].forEach(z => {
  vanGroup.add(B(0.14, 0.18, 0.3, mHL, 4.16, 0.58, z));
  vanGroup.add(B(0.16, 0.22, 0.36, mChr, 4.13, 0.58, z));
});

// Side steps
[-1.05, 1.05].forEach(z => {
  vanGroup.add(B(1.6, 0.09, 0.46, mBk, 2.7, 0.56, z > 0 ? 1.28 : -1.28));
  vanGroup.add(B(1.6, 0.24, 0.08, mBk, 2.7, 0.68, z > 0 ? 1.05 : -1.05));
});

// Exhaust
[-0.72, 0.72].forEach(z => {
  vanGroup.add(C(0.065, 0.065, 2.25, 14, mExh, 1.88, 2.62, z));
  vanGroup.add(C(0.105, 0.065, 0.2, 14, mChr, 1.88, 3.7, z));
});

// Mirrors
[-1.05, 1.05].forEach(z => {
  const s = z > 0 ? 1 : -1;
  vanGroup.add(B(0.06, 0.08, 0.44, mBk, 3.58, 2.98, z + s * 0.22));
  vanGroup.add(B(0.34, 0.52, 0.07, mBk, 3.58, 2.92, z + s * 0.45));
  vanGroup.add(B(0.3, 0.46, 0.06, mChr, 3.6, 2.92, z + s * 0.45));
});

// Chassis
vanGroup.add(B(2.25, 0.14, 1.32, mBk, 2.95, 0.62, 0));
vanGroup.add(B(1.05, 0.1, 1.44, mChr, 1.85, 0.78, 0));
vanGroup.add(C(0.3, 0.3, 0.14, 18, mChr, 1.55, 0.85, 0));

// Trailer
const TC = -3.05, TL = 8.6, TH = 2.3, TCY = 2.1, TZ = 2.05;
vanGroup.add(B(TL, TH, TZ, mYT, TC, TCY, 0));
vanGroup.add(B(TL + 0.05, 0.14, TZ + 0.08, mYD, TC, TCY + TH / 2 + 0.07, 0));
vanGroup.add(B(0.1, TH, TZ, mYD, 1.25, TCY, 0));

// Trailer ribs
for (let i = 0; i < 11; i++) {
  const xr = -7.3 + i * 0.82;
  vanGroup.add(B(0.055, TH + 0.06, 0.06, mYD, xr, TCY, TZ / 2 + 0.03));
  vanGroup.add(B(0.055, TH + 0.06, 0.06, mYD, xr, TCY, -TZ / 2 - 0.03));
}

vanGroup.add(B(TL, 0.14, 1.36, mBk, TC, 0.76, 0));
[-1.04, 1.04].forEach(z => vanGroup.add(B(TL - 0.6, 0.48, 0.07, mDk, TC, 0.66, z)));
vanGroup.add(B(0.1, TH, TZ, mYD, -7.35, TCY, 0));

// Tail lights
[-0.76, 0.76].forEach(z => {
  vanGroup.add(B(0.1, 0.4, 0.3, mTL, -7.38, 1.85, z));
  vanGroup.add(B(0.1, 0.26, 0.18, mAmb, -7.38, 1.85, z > 0 ? 1.04 : -1.04));
});

vanGroup.add(B(0.18, 0.22, TZ + 0.04, mChr, -7.38, 0.5, 0));

// LED status light
const ledMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.65), ledMat);
ledMesh.position.set(-7.38, 2.55, 0);
vanGroup.add(ledMesh);

// ── Wheels ──────────────────────────────────────────
function buildWheel(r, t) {
  const wg = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, t, 40), mTire);
  tire.rotation.x = Math.PI / 2; tire.castShadow = true; wg.add(tire);
  wg.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 8, 40), mTire));
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.74, r * 0.74, t + 0.01, 36), mRim);
  rim.rotation.x = Math.PI / 2; wg.add(rim);
  for (let s = 0; s < 8; s++) {
    const a = (s / 8) * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.BoxGeometry(r * 0.52, 0.075, t + 0.02), mRim);
    sp.rotation.z = a;
    sp.position.x = Math.cos(a) * r * 0.37;
    sp.position.y = Math.sin(a) * r * 0.37;
    wg.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.21, r * 0.21, t + 0.05, 18), mHub);
  hub.rotation.x = Math.PI / 2; wg.add(hub);
  return wg;
}

function addAxle(x, single = false) {
  const r = single ? 0.48 : 0.52, t = single ? 0.26 : 0.3;
  const y = r, zi = single ? 1.04 : 0.98, zo = 1.3;
  const aW = z => { const w = buildWheel(r, t); w.position.set(x, y, z); wheelsGroup.add(w); };
  if (single) { aW(zi); aW(-zi); }
  else { [zi, zo].forEach(z => { aW(z); aW(-z); }); }
  vanGroup.add(B(0.1, 0.12, single ? 2.2 : 2.72, mBk, x, r, 0));
}

addAxle(3.35, true); addAxle(1.62); addAxle(0.88);
addAxle(-5.12); addAxle(-5.95); addAxle(-6.78);
vanGroup.add(wheelsGroup);
vanGroup.scale.setScalar(0.28);
scene.add(vanGroup);

// ── Atmospheric Particles ───────────────────────────
const partGeo = new THREE.BufferGeometry();
const partCount = 3000;
const pPos = new Float32Array(partCount * 3);
const pSizes = new Float32Array(partCount);
for (let i = 0; i < partCount; i++) {
  pPos[i * 3]     = (Math.random() - 0.5) * 70;
  pPos[i * 3 + 1] = (Math.random() - 0.5) * 30 + 5;
  pPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
  pSizes[i] = Math.random() * 0.08 + 0.03;
}
partGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));

const partMat = new THREE.PointsMaterial({
  color: 0x88bbff,
  size: 0.07,
  transparent: true,
  opacity: 0.45,
  blending: THREE.AdditiveBlending,
  sizeAttenuation: true
});
const particles = new THREE.Points(partGeo, partMat);
scene.add(particles);

// ── Postprocessing ──────────────────────────────────
const renderScene = new RenderPass(scene, camera);
const darkBloom  = { strength: 0.5, threshold: 1.2 };
const lightBloom = { strength: 0.0, threshold: 10.0 };

// Initialize bloom with light-mode values (no glow on first load)
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(sizes.width, sizes.height),
  lightBloom.strength, 0.4, lightBloom.threshold
);

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
const outputPass = new OutputPass();
composer.addPass(outputPass);

// ── Theme Transition ────────────────────────────────
let themeValue = 1;
let targetThemeValue = 1;

const darkColors = {
  bg: new THREE.Color('#080c18'),
  fog: new THREE.Color('#0a1020'),
  hemiSky: new THREE.Color(0x2d1b4e),
  hemiGround: new THREE.Color(0x050a14),
  sun: new THREE.Color(0x38bdf8),
  fill: new THREE.Color(0x00c1ff),
  ground: new THREE.Color(0x2a2a3a),
  trunk: new THREE.Color(0x1a1b24),
  leaf0: new THREE.Color(0x1a1020),
  leaf1: new THREE.Color(0x120a18),
  leaf2: new THREE.Color(0x1a1420),
  lampEmissive: new THREE.Color(0x00c1ff),
  particles: new THREE.Color(0x00c1ff),
  intensitySun: 1.6,
  intensityHemi: 0.45,
  intensityLampMin: 2.5,
  intensityLampWave: 0.6
};

const lightColors = {
  bg: new THREE.Color('#a8d8ea'),
  fog: new THREE.Color('#b8e2f8'),
  hemiSky: new THREE.Color(0xd4efff),
  hemiGround: new THREE.Color(0x4a8c40),
  sun: new THREE.Color(0xfff5d4),
  fill: new THREE.Color(0xc8e0ff),
  ground: new THREE.Color(0xffffff),
  trunk: new THREE.Color(0x7a5230),
  leaf0: new THREE.Color(0x296b1a),
  leaf1: new THREE.Color(0x1e5c14),
  leaf2: new THREE.Color(0x358a22),
  lampEmissive: new THREE.Color(0xfffce0),
  particles: new THREE.Color(0xddeeff),
  intensitySun: 2.2,
  intensityHemi: 0.9,
  intensityLampMin: 0.0,
  intensityLampWave: 0.0
};

// Theme toggle
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    targetThemeValue = document.body.classList.contains('dark-mode') ? 0 : 1;
  });
}

// ── Scroll Tracking ─────────────────────────────────
let scrollProgress = 0;
window.addEventListener('scroll', () => {
  const max = document.body.scrollHeight - window.innerHeight;
  scrollProgress = Math.max(0, Math.min(window.scrollY / max, 1));
});

window.addEventListener('resize', () => {
  sizes.width = window.innerWidth; sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
  composer.setSize(sizes.width, sizes.height);
});

// ── Animation Loop ──────────────────────────────────
const clock = new THREE.Clock();
const _fwd = new THREE.Vector3(1, 0, 0);
let sp = 0; // smoothed progress

function animate() {
  const delta = clock.getDelta();
  const time  = clock.getElapsedTime();

  // Smooth scroll interpolation
  sp = THREE.MathUtils.lerp(sp, scrollProgress, 0.06);

  const isDriving = sp > 0.01 && sp < 0.99;

  // Wheel spin
  if (isDriving) {
    wheelsGroup.children.forEach(w => { w.rotation.z -= delta * 14; });
  }

  // Van position on curve
  const t = Math.max(0.001, Math.min(0.999, sp));
  const point   = curve.getPoint(t);
  const tangent = curve.getTangent(t); tangent.y = 0; tangent.normalize();

  // Subtle driving vibration
  const vibrationY = isDriving ? Math.sin(time * 18) * 0.003 + Math.sin(time * 7) * 0.002 : 0;
  vanGroup.position.set(point.x, vibrationY, point.z);
  vanGroup.quaternion.setFromUnitVectors(_fwd, tangent);

  // ── Theme Transition ──
  if (Math.abs(themeValue - targetThemeValue) > 0.001) {
    themeValue = THREE.MathUtils.lerp(themeValue, targetThemeValue, delta * 3.0);

    scene.background.lerpColors(darkColors.bg, lightColors.bg, themeValue);
    scene.fog.color.lerpColors(darkColors.fog, lightColors.fog, themeValue);

    hemiLight.color.lerpColors(darkColors.hemiSky, lightColors.hemiSky, themeValue);
    hemiLight.groundColor.lerpColors(darkColors.hemiGround, lightColors.hemiGround, themeValue);
    hemiLight.intensity = THREE.MathUtils.lerp(darkColors.intensityHemi, lightColors.intensityHemi, themeValue);

    sun.color.lerpColors(darkColors.sun, lightColors.sun, themeValue);
    sun.intensity = THREE.MathUtils.lerp(darkColors.intensitySun, lightColors.intensitySun, themeValue);

    fill.color.lerpColors(darkColors.fill, lightColors.fill, themeValue);
    ground.material.color.lerpColors(darkColors.ground, lightColors.ground, themeValue);

    trnkM.color.lerpColors(darkColors.trunk, lightColors.trunk, themeValue);
    leafMs[0].color.lerpColors(darkColors.leaf0, lightColors.leaf0, themeValue);
    leafMs[1].color.lerpColors(darkColors.leaf1, lightColors.leaf1, themeValue);
    leafMs[2].color.lerpColors(darkColors.leaf2, lightColors.leaf2, themeValue);

    partMat.color.lerpColors(darkColors.particles, lightColors.particles, themeValue);

    bloomPass.strength  = THREE.MathUtils.lerp(darkBloom.strength, lightBloom.strength, themeValue);
    bloomPass.threshold = THREE.MathUtils.lerp(darkBloom.threshold, lightBloom.threshold, themeValue);

    // Vehicle lights: only glow in dark mode (themeValue 0=dark, 1=light)
    const lightIntensity = THREE.MathUtils.lerp(0.9, 0.0, themeValue);
    mHL.emissiveIntensity  = lightIntensity;
    mTL.emissiveIntensity  = lightIntensity;
    mAmb.emissiveIntensity = lightIntensity * 0.65;
  }

  // Lamp glow pulsing
  const currentMin  = THREE.MathUtils.lerp(darkColors.intensityLampMin, lightColors.intensityLampMin, themeValue);
  const currentWave = THREE.MathUtils.lerp(darkColors.intensityLampWave, lightColors.intensityLampWave, themeValue);
  lampGlowM.emissive.lerpColors(darkColors.lampEmissive, lightColors.lampEmissive, themeValue);
  lampGlowM.emissiveIntensity = currentMin + currentWave * Math.sin(time * 2.5);

  // LED status
  if (scrollProgress >= 0.88) {
    ledMat.color.setHex(0x1B8C4B);
    ledMat.emissive.setHex(0x00ff44);
    ledMat.emissiveIntensity = 2.5;
  } else {
    ledMat.color.setHex(0x333333);
    ledMat.emissive.setHex(0x000000);
    ledMat.emissiveIntensity = 0;
  }
  ledMat.needsUpdate = true;

  // Animate particles
  particles.rotation.y = time * 0.015;
  particles.rotation.x = Math.sin(time * 0.3) * 0.02;


  composer.render();
  window.requestAnimationFrame(animate);
}

animate();

/* ═══════════════════════════════════════════════════════
   Moving Warp Grid Canvas — mouse-reactive distortion
   ═══════════════════════════════════════════════════════ */
(function() {
  const cvs = document.getElementById('heroGridCanvas');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');

  let W, H, mouseX = -9999, mouseY = -9999;
  const CELL = 48;          // grid spacing px
  const WARP = 28;          // max warp radius px
  const WARP_RADIUS = 180;  // influence radius px

  function resize() {
    const rect = cvs.parentElement.getBoundingClientRect();
    W = cvs.width  = rect.width  || window.innerWidth;
    H = cvs.height = rect.height || window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // Track mouse over the hero section
  const heroEl = document.getElementById('heroSec') || document.querySelector('.hero-sec');
  if (heroEl) {
    heroEl.addEventListener('mousemove', e => {
      const r = heroEl.getBoundingClientRect();
      mouseX = e.clientX - r.left;
      mouseY = e.clientY - r.top;
    });
    heroEl.addEventListener('mouseleave', () => { mouseX = -9999; mouseY = -9999; });
  }

  let t = 0;
  function drawGrid() {
    ctx.clearRect(0, 0, W, H);
    t += 0.006; // slow drift speed

    // Pick colour from CSS variable (cyan in both modes)
    const isDark = document.body.classList.contains('dark-mode');
    const lineColor = isDark ? 'rgba(0,193,255,0.13)' : 'rgba(0,193,255,0.18)';
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 0.8;

    // Compute cols and rows
    const cols = Math.ceil(W / CELL) + 2;
    const rows = Math.ceil(H / CELL) + 2;

    // Draw horizontal lines
    for (let r = 0; r < rows; r++) {
      ctx.beginPath();
      for (let c = 0; c < cols; c++) {
        let gx = (c - 1) * CELL;
        let gy = (r - 1) * CELL;

        // Slow ambient wave
        const wave = Math.sin(c * 0.4 + t) * 3 + Math.cos(r * 0.3 + t * 0.7) * 2;
        gy += wave;

        // Mouse warp
        const dx = gx - mouseX, dy = gy - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < WARP_RADIUS) {
          const factor = (1 - dist / WARP_RADIUS) * WARP;
          gy -= factor * (dy / (dist || 1));
          gx -= factor * (dx / (dist || 1)) * 0.4;
        }
        if (c === 0) ctx.moveTo(gx, gy); else ctx.lineTo(gx, gy);
      }
      ctx.stroke();
    }

    // Draw vertical lines
    for (let c = 0; c < cols; c++) {
      ctx.beginPath();
      for (let r = 0; r < rows; r++) {
        let gx = (c - 1) * CELL;
        let gy = (r - 1) * CELL;

        const wave = Math.sin(r * 0.4 + t) * 3 + Math.cos(c * 0.3 + t * 0.7) * 2;
        gx += wave;

        const dx = gx - mouseX, dy = gy - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < WARP_RADIUS) {
          const factor = (1 - dist / WARP_RADIUS) * WARP;
          gx -= factor * (dx / (dist || 1));
          gy -= factor * (dy / (dist || 1)) * 0.4;
        }
        if (r === 0) ctx.moveTo(gx, gy); else ctx.lineTo(gx, gy);
      }
      ctx.stroke();
    }

    requestAnimationFrame(drawGrid);
  }
  drawGrid();
})();

/* ═══════════════════════════════════════════════════════
   Hero Stats Count-up Animation
   ═══════════════════════════════════════════════════════ */
(function() {
  const items = document.querySelectorAll('#heroStats .hs-item[data-final]');
  if (!items.length) return;

  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function animateStat(el) {
    const final   = parseFloat(el.dataset.final);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const numEl   = el.querySelector('.hs-num');
    if (!numEl) return;

    const duration = 1800; // ms
    const start    = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const val = final * easeOutExpo(progress);

      // Format with comma-thousands for large numbers
      const formatted = val >= 1000
        ? Math.round(val).toLocaleString('en-US')
        : val.toFixed(decimals);
      numEl.textContent = formatted;

      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // Trigger on intersection
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        animateStat(e.target);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.4 });

  items.forEach(el => obs.observe(el));
})();

/* ═══════════════════════════════════════════════════════
   Get Started Section — Warp Grid Canvas
   ═══════════════════════════════════════════════════════ */
(function() {
  const cvs = document.getElementById('gsGridCanvas');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  let W, H, mouseX = -9999, mouseY = -9999;
  const CELL = 52, WARP = 24, WARP_RADIUS = 160;

  function resize() {
    const rect = cvs.parentElement.getBoundingClientRect();
    W = cvs.width  = rect.width  || window.innerWidth;
    H = cvs.height = rect.height || 600;
  }
  window.addEventListener('resize', resize);
  resize();

  const parent = cvs.parentElement;
  parent.addEventListener('mousemove', e => {
    const r = parent.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  });
  parent.addEventListener('mouseleave', () => { mouseX = -9999; mouseY = -9999; });

  let t = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    t += 0.005;
    const isDark = document.body.classList.contains('dark-mode');
    ctx.strokeStyle = isDark ? 'rgba(0,193,255,0.11)' : 'rgba(0,193,255,0.16)';
    ctx.lineWidth = 0.75;
    const cols = Math.ceil(W / CELL) + 2;
    const rows = Math.ceil(H / CELL) + 2;

    for (let r = 0; r < rows; r++) {
      ctx.beginPath();
      for (let c = 0; c < cols; c++) {
        let gx = (c - 1) * CELL;
        let gy = (r - 1) * CELL + Math.sin(c * 0.35 + t) * 3;
        const dx = gx - mouseX, dy = gy - mouseY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < WARP_RADIUS) {
          const f = (1 - dist/WARP_RADIUS) * WARP;
          gy -= f * (dy / (dist||1));
          gx -= f * (dx / (dist||1)) * 0.4;
        }
        c === 0 ? ctx.moveTo(gx, gy) : ctx.lineTo(gx, gy);
      }
      ctx.stroke();
    }
    for (let c = 0; c < cols; c++) {
      ctx.beginPath();
      for (let r = 0; r < rows; r++) {
        let gx = (c - 1) * CELL + Math.sin(r * 0.35 + t) * 3;
        let gy = (r - 1) * CELL;
        const dx = gx - mouseX, dy = gy - mouseY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < WARP_RADIUS) {
          const f = (1 - dist/WARP_RADIUS) * WARP;
          gx -= f * (dx / (dist||1));
          gy -= f * (dy / (dist||1)) * 0.4;
        }
        r === 0 ? ctx.moveTo(gx, gy) : ctx.lineTo(gx, gy);
      }
      ctx.stroke();
    }
    requestAnimationFrame(draw);
  }
  draw();
})();
