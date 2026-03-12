import * as THREE from 'three';

const canvas = document.querySelector('canvas#webgl');
const scene  = new THREE.Scene();
scene.background = new THREE.Color('#a2d4f0');
scene.fog = new THREE.FogExp2('#b8e2f8', 0.014);

const sizes = { width: window.innerWidth, height: window.innerHeight };
const camera = new THREE.PerspectiveCamera(50, sizes.width/sizes.height, 0.1, 150);
camera.position.set(0, 13, 6); camera.lookAt(0, 0, 0);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;

// Lights
scene.add(new THREE.HemisphereLight(0xc4e8ff, 0x4a7c40, 0.85));
const sun = new THREE.DirectionalLight(0xfff8e0, 2.0);
sun.position.set(8, 20, 4); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0003;
Object.assign(sun.shadow.camera, { left:-30, right:30, top:30, bottom:-30, near:1, far:100 });
scene.add(sun);
const fill = new THREE.DirectionalLight(0xd0e8ff, 0.4);
fill.position.set(-8, 8, -5); scene.add(fill);

// ── Wavy Road Curve (XZ plane) ─────────────────────
const curve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-1,  0,-14),
  new THREE.Vector3(-5,  0,-10),
  new THREE.Vector3(-3,  0, -6),
  new THREE.Vector3( 3,  0, -2.5),
  new THREE.Vector3( 5,  0,  0.5),
  new THREE.Vector3( 0,  0,  4),
  new THREE.Vector3(-5,  0,  7.5),
  new THREE.Vector3(-2,  0, 11),
  new THREE.Vector3( 2,  0, 14),
]);

// ── Road Texture (canvas baked) ────────────────────
function makeRoadTex() {
  const W=512, H=2048, cvs=document.createElement('canvas');
  cvs.width=W; cvs.height=H;
  const ctx=cvs.getContext('2d');
  // Base asphalt
  ctx.fillStyle='#2e3038'; ctx.fillRect(0,0,W,H);
  // Gravel noise
  for(let i=0;i<20000;i++){
    const x=Math.random()*W, y=Math.random()*H, g=Math.floor(Math.random()*22+30);
    ctx.fillStyle=`rgba(${g},${g},${g},0.6)`; ctx.fillRect(x,y,Math.random()*3,Math.random()*2);
  }
  // Yellow edge lines
  ctx.fillStyle='#FFD600';
  ctx.fillRect(14,0,20,H); ctx.fillRect(W-34,0,20,H);
  // White center dashes
  ctx.fillStyle='rgba(255,255,255,0.95)';
  for(let y=0;y<H;y+=240){ ctx.fillRect(W/2-12,y,24,140); }
  const t=new THREE.CanvasTexture(cvs);
  t.wrapS=THREE.ClampToEdgeWrapping; t.wrapT=THREE.RepeatWrapping; t.anisotropy=16;
  return t;
}

// ── Grass Texture ──────────────────────────────────
function makeGrassTex() {
  const W=256, cvs=document.createElement('canvas'); cvs.width=W; cvs.height=W;
  const ctx=cvs.getContext('2d');
  ctx.fillStyle='#4d9142'; ctx.fillRect(0,0,W,W);
  for(let i=0;i<5000;i++){
    const x=Math.random()*W, y=Math.random()*W;
    const h=Math.floor(Math.random()*25+105), l=Math.floor(Math.random()*15+28);
    ctx.fillStyle=`hsl(${h},45%,${l}%)`; ctx.fillRect(x,y,1,Math.random()*5+1);
  }
  const t=new THREE.CanvasTexture(cvs); t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.repeat.set(25,25); t.anisotropy=8; return t;
}

// ── Road Strip Builder with UVs ────────────────────
const SEGS=500, RHW=1.78;
function buildStrip(hw, mat, yOff=0, uvRep=15) {
  const v=[], uv=[], tri=[];
  for(let i=0;i<=SEGS;i++){
    const s=i/SEGS, p=curve.getPoint(s);
    const tn=curve.getTangent(s); tn.y=0; tn.normalize();
    const px=new THREE.Vector3(-tn.z,0,tn.x);
    v.push(p.x+px.x*hw, p.y+yOff, p.z+px.z*hw,
           p.x-px.x*hw, p.y+yOff, p.z-px.z*hw);
    const vc=s*uvRep; uv.push(0,vc,1,vc);
    if(i<SEGS){ const b=i*2; tri.push(b,b+2,b+1,b+1,b+2,b+3); }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(tri); geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,mat); m.receiveShadow=true; return m;
}

const roadTex  = makeRoadTex();
const grassTex = makeGrassTex();
scene.add(buildStrip(RHW+0.55, new THREE.MeshStandardMaterial({color:0x404349,roughness:0.95}), -0.01, 1));
scene.add(buildStrip(RHW, new THREE.MeshStandardMaterial({map:roadTex,roughness:0.88}), 0.01, 15));

// ── Terrain ────────────────────────────────────────
const tGeo=new THREE.PlaneGeometry(140,140,50,50);
const pos=tGeo.attributes.position;
for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),z=pos.getZ(i), d=Math.sqrt(x*x+z*z);
  if(d>14) pos.setY(i, Math.sin(x*0.28)*Math.cos(z*0.28)*0.5+Math.sin(x*0.7+z*0.5)*0.25);
}
tGeo.computeVertexNormals();
const ground=new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({map:grassTex,roughness:1.0}));
ground.rotation.x=-Math.PI/2; ground.position.y=-0.18; ground.receiveShadow=true;
scene.add(ground);

// ── Trees ──────────────────────────────────────────
const trnkM =new THREE.MeshStandardMaterial({color:0x7a5230,roughness:0.9});
const leafMs=[
  new THREE.MeshStandardMaterial({color:0x296b1a,roughness:0.85}),
  new THREE.MeshStandardMaterial({color:0x1e5c14,roughness:0.8}),
  new THREE.MeshStandardMaterial({color:0x358a22,roughness:0.85}),
];
function addTree(x,z,type=0,sc=1){
  const g=new THREE.Group();
  const trk=new THREE.Mesh(new THREE.CylinderGeometry(0.11*sc,0.17*sc,0.85*sc,8),trnkM);
  trk.position.y=0.42*sc; trk.castShadow=true; g.add(trk);
  if(type===0){
    const s=new THREE.Mesh(new THREE.SphereGeometry(0.68*sc,10,8),leafMs[0]);
    s.position.y=1.35*sc; s.castShadow=true; g.add(s);
    const s2=new THREE.Mesh(new THREE.SphereGeometry(0.46*sc,10,8),leafMs[2]);
    s2.position.set(0.28*sc,1.6*sc,0.18*sc); s2.castShadow=true; g.add(s2);
  } else if(type===1){
    const c1=new THREE.Mesh(new THREE.ConeGeometry(0.52*sc,1.7*sc,10),leafMs[1]);
    c1.position.y=1.5*sc; c1.castShadow=true; g.add(c1);
    const c2=new THREE.Mesh(new THREE.ConeGeometry(0.72*sc,1.2*sc,10),leafMs[0]);
    c2.position.y=0.9*sc; c2.castShadow=true; g.add(c2);
  } else {
    const s=new THREE.Mesh(new THREE.SphereGeometry(0.44*sc,8,6),leafMs[2]);
    s.position.y=1.7*sc; s.scale.y=1.85; s.castShadow=true; g.add(s);
  }
  g.position.set(x,-0.18,z); scene.add(g);
}
[[-7,-13,1,1.1],[-9,-8,0,1.0],[-8,-2,2,0.9],[-7,4,1,1.2],[-8,9,0,0.9],[-6,13,1,1.0],
 [7,-12,0,1.1],[8,-7,1,0.9],[9,-1,2,1.0],[8,5,0,1.2],[7,10,1,0.9],[7,13,0,0.9],
 [-5,-14,0,0.8],[6,-14,1,0.8],[-5,14,2,0.9],[5,14,0,0.9],
 [-12,-4,1,1.3],[12,-3,0,1.2],[-12,6,0,1.1],[12,7,1,1.3],
 [-10,0,2,1.0],[10,1,1,0.9],[-6,-9,0,0.7],[6,-10,2,0.7],
].forEach(([x,z,t,s])=>addTree(x,z,t,s));

// ── Street Lamps ───────────────────────────────────
const poleM=new THREE.MeshStandardMaterial({color:0x8899aa,roughness:0.4,metalness:0.75});
const lampGlowM=new THREE.MeshStandardMaterial({color:0xfffce0,emissive:0xfffce0,emissiveIntensity:1.0});
for(let li=0;li<=8;li++){
  const lt=li/8, lp=curve.getPoint(lt);
  const ltn=curve.getTangent(lt); ltn.y=0; ltn.normalize();
  const lperp=new THREE.Vector3(-ltn.z,0,ltn.x);
  [-1,1].forEach(side=>{
    const ox=lp.x+lperp.x*(RHW+0.55)*side, oz=lp.z+lperp.z*(RHW+0.55)*side;
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.075,3.8,8),poleM);
    pole.position.set(ox,1.9-0.18,oz); pole.castShadow=true; scene.add(pole);
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.028,0.55,6),poleM);
    arm.position.set(ox-lperp.x*0.22*side,3.7,oz-lperp.z*0.22*side);
    arm.rotation.z=Math.PI/2; scene.add(arm);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(0.13,10,8),lampGlowM);
    bulb.position.set(ox-lperp.x*0.48*side,3.72,oz-lperp.z*0.48*side); scene.add(bulb);
  });
}

// ── Yellow Semi Truck ──────────────────────────────
const mY =new THREE.MeshStandardMaterial({color:0xFFC200,roughness:0.2, metalness:0.38});
const mYD=new THREE.MeshStandardMaterial({color:0xE6A800,roughness:0.25,metalness:0.42});
const mYT=new THREE.MeshStandardMaterial({color:0xFFCF30,roughness:0.24,metalness:0.32});
const mChr=new THREE.MeshStandardMaterial({color:0xe0e4ec,roughness:0.04,metalness:1.0 });
const mBk =new THREE.MeshStandardMaterial({color:0x0a0b0d,roughness:0.78,metalness:0.12});
const mDk =new THREE.MeshStandardMaterial({color:0x141618,roughness:0.6, metalness:0.22});
const mGl =new THREE.MeshStandardMaterial({color:0x2a5070,roughness:0.02,transparent:true,opacity:0.75});
const mTire=new THREE.MeshStandardMaterial({color:0x141516,roughness:0.95});
const mRim =new THREE.MeshStandardMaterial({color:0x585c62,roughness:0.18,metalness:0.95});
const mHub =new THREE.MeshStandardMaterial({color:0x8090a0,roughness:0.1, metalness:1.0 });
const mHL  =new THREE.MeshStandardMaterial({color:0xf8fbff,roughness:0.05,emissive:0xffffcc,emissiveIntensity:0.8});
const mTL  =new THREE.MeshStandardMaterial({color:0xff1400,roughness:0.05,emissive:0xff0000,emissiveIntensity:0.8});
const mAmb =new THREE.MeshStandardMaterial({color:0xff9900,roughness:0.1, emissive:0xff7000,emissiveIntensity:0.5});
const mExh =new THREE.MeshStandardMaterial({color:0x303235,roughness:0.5, metalness:0.9 });
const mGrl =new THREE.MeshStandardMaterial({color:0x08090c,roughness:0.5, metalness:0.3 });
const ledMat=new THREE.MeshStandardMaterial({color:0x333333,emissive:0x000000,emissiveIntensity:0});

const vanGroup=new THREE.Group(), wheelsGroup=new THREE.Group();
function B(w,h,d,m,px,py,pz,rx=0,ry=0,rz=0){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  mesh.position.set(px,py,pz); mesh.rotation.set(rx,ry,rz);
  mesh.castShadow=true; mesh.receiveShadow=true; return mesh;
}
function C(rt,rb,h,segs,m,px,py,pz,rx=0,ry=0,rz=0){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segs),m);
  mesh.position.set(px,py,pz); mesh.rotation.set(rx,ry,rz); mesh.castShadow=true; return mesh;
}
vanGroup.add(B(2.2,2.5,2.1,mY,2.95,2.15,0),B(2.2,0.28,2.16,mDk,2.95,0.79,0));
vanGroup.add(B(1.5,0.22,2.06,mYD,2.55,3.46,0),B(1.6,0.1,2.12,mY,3.38,3.55,0));
vanGroup.add(B(0.1,0.62,2.1,mY,3.62,3.25,0,-0.55,0,0));
[-1.04,1.04].forEach(z=>vanGroup.add(B(0.7,0.48,0.08,mY,3.3,3.3,z)));
const ws=new THREE.Mesh(new THREE.PlaneGeometry(2.06,1.12),mGl);
ws.position.set(4.04,2.56,0); ws.rotation.set(0,Math.PI/2,-0.11); vanGroup.add(ws);
vanGroup.add(B(0.06,0.1,2.08,mChr,4.04,3.14,0),B(0.06,0.1,2.08,mChr,4.04,1.98,0));
vanGroup.add(B(0.06,1.18,0.08,mChr,4.04,2.56,1.04),B(0.06,1.18,0.08,mChr,4.04,2.56,-1.04));
[1.05,-1.05].forEach(z=>{
  const cv=new THREE.Mesh(new THREE.PlaneGeometry(0.32,0.52),mGl);
  cv.position.set(4.04,2.86,z); cv.rotation.y=Math.PI/2; vanGroup.add(cv);
  const dw=new THREE.Mesh(new THREE.PlaneGeometry(0.72,0.62),mGl);
  dw.position.set(3.0,2.72,z); if(z<0)dw.rotation.y=Math.PI; vanGroup.add(dw);
  vanGroup.add(B(0.72,0.05,0.06,mChr,3.0,3.05,z));
});
vanGroup.add(B(0.1,1.1,1.86,mGrl,4.05,1.42,0));
for(let i=0;i<4;i++) vanGroup.add(B(0.12,0.1,1.84,mChr,4.06,1.08+i*0.27,0));
vanGroup.add(C(0.24,0.24,0.1,20,mChr,4.08,1.68,0,0,0,Math.PI/2));
[-0.7,0.7].forEach(z=>{
  vanGroup.add(B(0.12,0.28,0.62,mHL,4.06,1.5,z),B(0.14,0.36,0.7,mChr,4.03,1.5,z));
  vanGroup.add(B(0.08,0.06,0.68,mHL,4.06,1.72,z));
});
vanGroup.add(B(0.3,0.6,2.14,mBk,4.12,0.62,0),B(0.3,0.18,2.14,mDk,4.14,0.28,0));
vanGroup.add(B(0.08,0.08,2.0,mChr,4.16,0.5,0));
[-0.74,0.74].forEach(z=>{vanGroup.add(B(0.14,0.18,0.3,mHL,4.16,0.58,z),B(0.16,0.22,0.36,mChr,4.13,0.58,z));});
[-1.05,1.05].forEach(z=>{
  vanGroup.add(B(1.6,0.09,0.46,mBk,2.7,0.56,z>0?1.28:-1.28));
  vanGroup.add(B(1.6,0.24,0.08,mBk,2.7,0.68,z>0?1.05:-1.05));
});
[-0.72,0.72].forEach(z=>{
  vanGroup.add(C(0.065,0.065,2.25,14,mExh,1.88,2.62,z));
  vanGroup.add(C(0.105,0.065,0.2,14,mChr,1.88,3.7,z));
});
[-1.05,1.05].forEach(z=>{
  const s=z>0?1:-1;
  vanGroup.add(B(0.06,0.08,0.44,mBk,3.58,2.98,z+s*0.22));
  vanGroup.add(B(0.34,0.52,0.07,mBk,3.58,2.92,z+s*0.45));
  vanGroup.add(B(0.3,0.46,0.06,mChr,3.6,2.92,z+s*0.45));
});
vanGroup.add(B(2.25,0.14,1.32,mBk,2.95,0.62,0),B(1.05,0.1,1.44,mChr,1.85,0.78,0));
vanGroup.add(C(0.3,0.3,0.14,18,mChr,1.55,0.85,0));
const TC=-3.05,TL=8.6,TH=2.3,TCY=2.1,TZ=2.05;
vanGroup.add(B(TL,TH,TZ,mYT,TC,TCY,0),B(TL+0.05,0.14,TZ+0.08,mYD,TC,TCY+TH/2+0.07,0));
vanGroup.add(B(0.1,TH,TZ,mYD,1.25,TCY,0));
for(let i=0;i<11;i++){
  const xr=-7.3+i*0.82;
  vanGroup.add(B(0.055,TH+0.06,0.06,mYD,xr,TCY,TZ/2+0.03));
  vanGroup.add(B(0.055,TH+0.06,0.06,mYD,xr,TCY,-TZ/2-0.03));
}
vanGroup.add(B(TL,0.14,1.36,mBk,TC,0.76,0));
[-1.04,1.04].forEach(z=>vanGroup.add(B(TL-0.6,0.48,0.07,mDk,TC,0.66,z)));
vanGroup.add(B(0.1,TH,TZ,mYD,-7.35,TCY,0));
[-0.76,0.76].forEach(z=>{
  vanGroup.add(B(0.1,0.4,0.3,mTL,-7.38,1.85,z));
  vanGroup.add(B(0.1,0.26,0.18,mAmb,-7.38,1.85,z>0?1.04:-1.04));
});
vanGroup.add(B(0.18,0.22,TZ+0.04,mChr,-7.38,0.5,0));
const ledMesh=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.2,0.65),ledMat);
ledMesh.position.set(-7.38,2.55,0); vanGroup.add(ledMesh);

function buildWheel(r,t){
  const wg=new THREE.Group();
  const tire=new THREE.Mesh(new THREE.CylinderGeometry(r,r,t,40),mTire);
  tire.rotation.x=Math.PI/2; tire.castShadow=true; wg.add(tire);
  wg.add(new THREE.Mesh(new THREE.TorusGeometry(r,0.05,8,40),mTire));
  const rim=new THREE.Mesh(new THREE.CylinderGeometry(r*0.74,r*0.74,t+0.01,36),mRim);
  rim.rotation.x=Math.PI/2; wg.add(rim);
  for(let s=0;s<8;s++){
    const a=(s/8)*Math.PI*2;
    const sp=new THREE.Mesh(new THREE.BoxGeometry(r*0.52,0.075,t+0.02),mRim);
    sp.rotation.z=a; sp.position.x=Math.cos(a)*r*0.37; sp.position.y=Math.sin(a)*r*0.37; wg.add(sp);
  }
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(r*0.21,r*0.21,t+0.05,18),mHub);
  hub.rotation.x=Math.PI/2; wg.add(hub);
  return wg;
}
function addAxle(x,single=false){
  const r=single?0.48:0.52, t=single?0.26:0.3, y=r, zi=single?1.04:0.98, zo=1.3;
  const aW=z=>{const w=buildWheel(r,t); w.position.set(x,y,z); wheelsGroup.add(w);};
  if(single){aW(zi);aW(-zi);}else{[zi,zo].forEach(z=>{aW(z);aW(-z);});}
  vanGroup.add(B(0.1,0.12,single?2.2:2.72,mBk,x,r,0));
}
addAxle(3.35,true);addAxle(1.62);addAxle(0.88);addAxle(-5.12);addAxle(-5.95);addAxle(-6.78);
vanGroup.add(wheelsGroup);
vanGroup.scale.setScalar(0.28);
scene.add(vanGroup);

// Scroll
let scrollProgress=0, smooth=0;
window.addEventListener('scroll',()=>{
  smooth=0; // force react
  const max=document.body.scrollHeight-window.innerHeight;
  scrollProgress=Math.max(0,Math.min(window.scrollY/max,1));
});
window.addEventListener('resize',()=>{
  sizes.width=window.innerWidth; sizes.height=window.innerHeight;
  camera.aspect=sizes.width/sizes.height; camera.updateProjectionMatrix();
  renderer.setSize(sizes.width,sizes.height);
});

const clock=new THREE.Clock();
const _fwd=new THREE.Vector3(1,0,0);
let sp=0; // smoothed progress

function animate(){
  const delta=clock.getDelta(), time=clock.getElapsedTime();
  sp=THREE.MathUtils.lerp(sp,scrollProgress,0.07);
  const isDriving=sp>0.01&&sp<0.99;
  if(isDriving) wheelsGroup.children.forEach(w=>{w.rotation.z-=delta*14;});
  const t=Math.max(0.001,Math.min(0.999,sp));
  const point=curve.getPoint(t);
  const tangent=curve.getTangent(t); tangent.y=0; tangent.normalize();
  vanGroup.position.set(point.x, isDriving?Math.sin(time*14)*0.005:0, point.z);
  vanGroup.quaternion.setFromUnitVectors(_fwd,tangent);
  lampGlowM.emissiveIntensity=0.85+0.1*Math.sin(time*1.5);
  if(scrollProgress>=0.88){
    ledMat.color.setHex(0x1B8C4B); ledMat.emissive.setHex(0x00ff44); ledMat.emissiveIntensity=0.9;
  } else {
    ledMat.color.setHex(0x333333); ledMat.emissive.setHex(0x000000); ledMat.emissiveIntensity=0;
  }
  ledMat.needsUpdate=true;
  // Update HUD
  const pctEl=document.getElementById('hudPct'), fillEl=document.getElementById('hudFill');
  if(pctEl) pctEl.textContent=Math.round(sp*100)+'%';
  if(fillEl) fillEl.style.width=(sp*100)+'%';
  renderer.render(scene,camera);
  window.requestAnimationFrame(animate);
}
animate();
