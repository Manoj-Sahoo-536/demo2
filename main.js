import * as THREE from 'three';

// --- Setup Scene, Camera, Renderer ---
const canvas = document.querySelector('canvas#webgl');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#ECECEC');
scene.fog = new THREE.Fog('#ECECEC', 10, 30); // volumetric fog effect

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
};

const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 0.1, 100);
// Side profile camera setup
camera.position.set(0, 2, 12);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// --- Lighting ---
// Premium soft diffused lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
scene.add(directionalLight);

const rimLight = new THREE.DirectionalLight(0xffeedd, 0.5);
rimLight.position.set(-5, 5, -5);
scene.add(rimLight);

// --- Materials ---
const whiteMaterial = new THREE.MeshStandardMaterial({ 
  color: 0xf5f5f5, 
  roughness: 0.2, 
  metalness: 0.1 
});
const glassMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x111111, 
  roughness: 0.1, 
  metalness: 0.8 
});
const tangerineMaterial = new THREE.MeshStandardMaterial({ 
  color: 0xff5e00, 
  roughness: 0.4, 
  metalness: 0.3 
});
const wheelMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x222222, 
  roughness: 0.8, 
  metalness: 0.2 
});
const rimGroupMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x888888, 
  roughness: 0.3, 
  metalness: 0.8 
});

// --- Build Delivery Van ---
const vanGroup = new THREE.Group();

// Main Cargo Body
const cargoGeo = new THREE.BoxGeometry(3.5, 2, 1.8);
const cargoMesh = new THREE.Mesh(cargoGeo, whiteMaterial);
cargoMesh.position.set(-0.75, 1.3, 0);
cargoMesh.castShadow = true;
cargoMesh.receiveShadow = true;
vanGroup.add(cargoMesh);

// Front Cab
const cabGeo = new THREE.BoxGeometry(1.5, 1.5, 1.8);
const cabMesh = new THREE.Mesh(cabGeo, whiteMaterial);
cabMesh.position.set(1.75, 1.05, 0);
cabMesh.castShadow = true;
cabMesh.receiveShadow = true;
vanGroup.add(cabMesh);

// Windshield
const windshieldGeo = new THREE.PlaneGeometry(1.3, 0.7);
const windshieldMesh = new THREE.Mesh(windshieldGeo, glassMaterial);
windshieldMesh.position.set(2.51, 1.3, 0);
windshieldMesh.rotation.y = Math.PI / 2;
vanGroup.add(windshieldMesh);

// Side Window
const sideWindowGeo = new THREE.PlaneGeometry(0.8, 0.6);
const sideWindowMeshLeft = new THREE.Mesh(sideWindowGeo, glassMaterial);
sideWindowMeshLeft.position.set(1.75, 1.35, 0.91);
vanGroup.add(sideWindowMeshLeft);

const sideWindowMeshRight = new THREE.Mesh(sideWindowGeo, glassMaterial);
sideWindowMeshRight.position.set(1.75, 1.35, -0.91);
sideWindowMeshRight.rotation.y = Math.PI;
vanGroup.add(sideWindowMeshRight);

// Tangerine Accent Line
const accentGeo = new THREE.BoxGeometry(5.0, 0.15, 1.85);
const accentMesh = new THREE.Mesh(accentGeo, tangerineMaterial);
accentMesh.position.set(0, 0.5, 0);
vanGroup.add(accentMesh);

// Wheels
const wheelRadius = 0.4;
const wheelThickness = 0.3;
const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 32);
const insideRimGeo = new THREE.CylinderGeometry(wheelRadius*0.6, wheelRadius*0.6, wheelThickness + 0.05, 16);

const wheelPositions = [
  { x: 1.5, y: 0.4, z: 1.0 }, // front left
  { x: 1.5, y: 0.4, z: -1.0 }, // front right
  { x: -1.5, y: 0.4, z: 1.0 }, // rear left
  { x: -1.5, y: 0.4, z: -1.0 }, // rear right
];

const wheelsGroup = new THREE.Group();

wheelPositions.forEach((pos) => {
  const group = new THREE.Group();
  group.position.set(pos.x, pos.y, pos.z);
  
  const wheel = new THREE.Mesh(wheelGeo, wheelMaterial);
  wheel.rotation.x = Math.PI / 2;
  wheel.castShadow = true;
  group.add(wheel);

  const rim = new THREE.Mesh(insideRimGeo, rimGroupMaterial);
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  wheelsGroup.add(group);
});

vanGroup.add(wheelsGroup);

// Parcel LED Light at the back
const ledGeo = new THREE.BoxGeometry(0.1, 0.2, 0.8);
const ledMaterial = new THREE.MeshBasicMaterial({ color: 0x444444 }); // starts off/gray
const ledMesh = new THREE.Mesh(ledGeo, ledMaterial);
ledMesh.position.set(-2.55, 1.8, 0);
vanGroup.add(ledMesh);

scene.add(vanGroup);

// --- Environment ---
// Ground Plane
const groundGeo = new THREE.PlaneGeometry(100, 100);
const groundMat = new THREE.MeshStandardMaterial({ color: 0xFAFAFA, roughness: 1.0 });
const groundMesh = new THREE.Mesh(groundGeo, groundMat);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.position.y = 0;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// Reroute Path (Neon Orange)
const pathGeo = new THREE.PlaneGeometry(50, 2);
const pathMat = new THREE.MeshBasicMaterial({ color: 0xff5e00, transparent: true, opacity: 0 });
const pathMesh = new THREE.Mesh(pathGeo, pathMat);
pathMesh.rotation.x = -Math.PI / 2;
pathMesh.position.y = 0.01; // slightly above ground
scene.add(pathMesh);


// Particles / fog effect elements moving in background
const fogGeo = new THREE.BoxGeometry(1, 1, 1);
const fogMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
const cubesGroup = new THREE.Group();
for(let i=0; i<30; i++) {
  const mesh = new THREE.Mesh(fogGeo, fogMat);
  mesh.position.set(
    (Math.random() - 0.5) * 40,
    Math.random() * 5 + 0.5,
    -(Math.random() * 15 + 5)
  );
  mesh.scale.setScalar(Math.random() * 2 + 1);
  cubesGroup.add(mesh);
}
scene.add(cubesGroup);


// --- Scroll Animation Logic ---
let scrollProgress = 0;

window.addEventListener('scroll', () => {
  const maxScroll = document.body.scrollHeight - window.innerHeight;
  scrollProgress = window.scrollY / maxScroll;
  // clamp just in case
  scrollProgress = Math.max(0, Math.min(scrollProgress, 1));
});

window.addEventListener('resize', () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
});

// Animation Loop
const clock = new THREE.Clock();

function animate() {
  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  // 1. Move the van down the timeline
  // Parallax mapping: 
  // Base position X offset
  const startX = -3;
  const endX = 3;

  // We add some bobbing motion to simulate driving
  const isDriving = scrollProgress > 0.05 && scrollProgress < 0.95;
  const bobbing = isDriving ? Math.sin(time * 15) * 0.03 : 0;
  
  // Speed is derived from scroll moving, we just add constant wheel spin if driving
  if (isDriving) {
    wheelsGroup.children.forEach(w => {
      w.rotation.z -= delta * 15; // rotate wheels
    });
    // Move background cubes to left to simulate forward movement
    cubesGroup.position.x -= delta * 10;
    if(cubesGroup.position.x < -20) cubesGroup.position.x = 20;
  } else {
    // stop background
  }

  // Smoothly interpolate the visual state based on scrollProgress
  // Phase 0-20% : Genesis
  // Phase 20-40% : Transit
  // Phase 40-60% : Warning
  // Phase 60-80% : Recovery
  // Phase 80-100% : Delivery

  let currentFogColor = new THREE.Color('#ECECEC');
  let currentAmbientLight = 0.7;
  let currentRimLightOpacity = 0.5;
  let pathOpacity = 0;

  // Position
  // Let the van move slowly to the right from -2 to +2
  const targetX = startX + (endX - startX) * scrollProgress;
  vanGroup.position.x = THREE.MathUtils.lerp(vanGroup.position.x, targetX, 0.1);
  vanGroup.position.y = bobbing; // Apply bobbing

  // Risk Event (Around 40-60%)
  if (scrollProgress > 0.35 && scrollProgress < 0.65) {
    // Transition to AMBER
    const riskIntensity = Math.sin((scrollProgress - 0.35) * (Math.PI / 0.3)); // 0 to 1
    currentFogColor.lerp(new THREE.Color('#E68A00'), Math.max(0, riskIntensity));
    currentAmbientLight = 0.3; // dimmer
    currentRimLightOpacity = 1.0;
  }

  // Recovery Event (Around 60-80%)
  if (scrollProgress > 0.55 && scrollProgress < 0.85) {
    const recoveryIntensity = Math.sin((scrollProgress - 0.55) * (Math.PI / 0.3));
    pathOpacity = Math.max(0, recoveryIntensity * 0.8);
  }

  // Final Delivery (Around 80-100%)
  if (scrollProgress >= 0.85) {
    ledMaterial.color.setHex(0x1B8C4B); // Green
    ledMaterial.needsUpdate = true;
  } else {
    ledMaterial.color.setHex(0x444444); // Gray
    ledMaterial.needsUpdate = true;
  }

  // Apply visual transitions smoothly
  scene.fog.color.lerp(currentFogColor, 0.05);
  scene.background.lerp(currentFogColor, 0.05);
  pathMat.opacity = THREE.MathUtils.lerp(pathMat.opacity, pathOpacity, 0.1);
  ambientLight.intensity = THREE.MathUtils.lerp(ambientLight.intensity, currentAmbientLight, 0.1);
  rimLight.intensity = THREE.MathUtils.lerp(rimLight.intensity, currentRimLightOpacity, 0.1);

  renderer.render(scene, camera);
  window.requestAnimationFrame(animate);
}

animate();
