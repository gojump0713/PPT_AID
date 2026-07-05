// three-scenes.js — WebGL particle network for hero & closing (Three.js)
// Graceful: if WebGL unavailable → caller shows .hero-fallback gradient instead.
import * as THREE from 'three';
import { Perf } from './performance.js';

export function createNetworkScene(container, { mode = 'hero' } = {}) {
  if (!Perf.webgl || Perf.quiet) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    Perf.enterLowPower('webgl renderer creation failed');
    return null;
  }
  const W = 1920, H = 1080;
  renderer.setSize(W, H, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.domElement.className = 'hero-canvas';
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 100);
  camera.position.set(0, 0, mode === 'hero' ? 11 : 13);

  // node cloud: campus-like lattice sphere
  const COUNT = 420;
  const positions = new Float32Array(COUNT * 3);
  const seeds = [];
  for (let i = 0; i < COUNT; i++) {
    // fibonacci-ish sphere with jitter → organic network globe
    const phi = Math.acos(1 - (2 * (i + 0.5)) / COUNT);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const r = 4.4 + (Math.random() - 0.5) * 1.7;
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi) * 0.72;
    const z = r * Math.sin(phi) * Math.sin(theta);
    positions.set([x, y, z], i * 3);
    seeds.push({ x, y, z, sp: 0.3 + Math.random() * 0.8, ph: Math.random() * Math.PI * 2 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const sprite = makeDotTexture();
  const mat = new THREE.PointsMaterial({
    size: 0.14,
    map: sprite,
    color: new THREE.Color('#59e6ff'),
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  // connective lines between near nodes
  const linePositions = [];
  for (let i = 0; i < COUNT; i++) {
    for (let j = i + 1; j < COUNT; j++) {
      const dx = positions[i * 3] - positions[j * 3];
      const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
      const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
      if (dx * dx + dy * dy + dz * dz < 1.35) {
        linePositions.push(
          positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2],
          positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2],
        );
      }
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(mode === 'hero' ? '#3d6bff' : '#7c5cff'),
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(lines);

  // inner glow core
  const coreGeo = new THREE.SphereGeometry(0.65, 24, 24);
  const coreMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#00e5ff'),
    transparent: true,
    opacity: 0.55,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  scene.add(core);

  let raf = 0, running = true, t = 0;
  let mx = 0, my = 0;
  const onMove = (e) => {
    mx = (e.clientX / window.innerWidth - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener('mousemove', onMove);

  const pos = geo.attributes.position;
  const tick = () => {
    if (!running) return;
    t += 0.008;
    // breathing nodes
    for (let i = 0; i < COUNT; i++) {
      const s = seeds[i];
      const w = 1 + Math.sin(t * s.sp * 2 + s.ph) * 0.035;
      pos.setXYZ(i, s.x * w, s.y * w, s.z * w);
    }
    pos.needsUpdate = true;
    const grp = t * 0.35;
    points.rotation.y = grp; lines.rotation.y = grp;
    points.rotation.x = Math.sin(t * 0.4) * 0.08; lines.rotation.x = points.rotation.x;
    core.scale.setScalar(1 + Math.sin(t * 2.2) * 0.12);
    // mouse parallax camera drift
    camera.position.x += (mx * 1.1 - camera.position.x) * 0.04;
    camera.position.y += (-my * 0.7 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };

  return {
    start() { if (!running) { running = true; } raf = requestAnimationFrame(tick); },
    stop() { running = false; cancelAnimationFrame(raf); },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      geo.dispose(); lineGeo.dispose(); coreGeo.dispose();
      mat.dispose(); lineMat.dispose(); coreMat.dispose(); sprite.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(160,235,255,0.8)');
  g.addColorStop(1, 'rgba(160,235,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}
