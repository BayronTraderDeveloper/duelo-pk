// Arena: plataforma de piedra, pilares con braseros en los límites, montañas por capas con niebla, luna, brasas.
import * as THREE from 'three';
const canvasTex = (w, h, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
export function buildArena(scene) {
  scene.background = canvasTex(4, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b0f17'); g.addColorStop(.55, '#1a2232'); g.addColorStop(.8, '#2c2a33'); g.addColorStop(1, '#3a2e2c'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog(0x1d2130, 14, 70);
  scene.add(new THREE.HemisphereLight(0x8aa0c8, 0x2a1e18, .75));
  const key = new THREE.DirectionalLight(0xffd9b0, 1.7); key.position.set(-4, 8, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fb8ff, 1.5); rim.position.set(3, 5, -7); scene.add(rim);
  // suelo
  const stone = canvasTex(512, 128, (x, w, h) => { const r = rng(7); x.fillStyle = '#3a3330'; x.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { const v = 40 + r() * 30 | 0; x.fillStyle = `rgba(${v},${v - 4},${v - 8},.35)`; x.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2); } x.strokeStyle = 'rgba(15,12,11,.7)'; x.lineWidth = 2; for (let i = 0; i < 16; i++) { const px = i * 32 + (r() - .5) * 6; x.beginPath(); x.moveTo(px, 0); x.lineTo(px + (r() - .5) * 4, h); x.stroke(); } x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke(); });
  stone.wrapS = stone.wrapT = THREE.RepeatWrapping; stone.repeat.set(4, 1);
  const top = new THREE.MeshStandardMaterial({ map: stone, roughness: .9 }), side = new THREE.MeshStandardMaterial({ map: stone, color: 0x6a5e58, roughness: 1 });
  const plat = new THREE.Mesh(new THREE.BoxGeometry(17.4, 1.2, 4.2), [side, side, top, side, side, side]); plat.position.set(0, -.6, -.3); scene.add(plat);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(17.6, .08, .1), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: .5, metalness: .6 })); edge.position.set(0, -.04, 1.82); scene.add(edge);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), new THREE.MeshStandardMaterial({ color: 0x14161d, roughness: 1 })); under.rotation.x = -Math.PI / 2; under.position.y = -3; scene.add(under);
  // pilares y braseros en los límites laterales
  const lights = [], flames = [];
  const flameTex = canvasTex(64, 128, (x, w, h) => { const g = x.createRadialGradient(32, 90, 2, 32, 80, 60); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(.3, 'rgba(255,150,50,.9)'); g.addColorStop(1, 'rgba(120,30,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(s * 8.05, 0, -.4); scene.add(g);
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: .85 });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(.42, .5, 4.4, 10), mat); col.position.y = 2.2; g.add(col);
    for (const y of [.2, 4.3]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.25, .32, 1.25), mat); b.position.y = y; g.add(b); }
    for (let k = 0; k < 4; k++) { const rune = new THREE.Mesh(new THREE.BoxGeometry(.05, .26, .02), new THREE.MeshBasicMaterial({ color: 0x6fb6ff })); rune.position.set(-s * .02, 1.3 + k * .55, .47); rune.rotation.z = (k % 2 ? .4 : -.4); g.add(rune); }
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.42, .22, .3, 14), new THREE.MeshStandardMaterial({ color: 0x2b2420, metalness: .6, roughness: .4 })); bowl.position.y = 4.62; g.add(bowl);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); fl.position.y = 5.1; fl.scale.set(.9, 1.5, 1); g.add(fl); flames.push(fl);
    const L = new THREE.PointLight(0xff9440, 9, 9, 1.6); L.position.set(s * 7.9, 5, .3); scene.add(L); lights.push(L);
  }
  // escudos y piedras rúnicas al fondo (decoración discreta)
  const r = rng(11);
  for (let i = 0; i < 7; i++) { const x = -6 + i * 2 + (r() - .5) * .6, stoneM = new THREE.Mesh(new THREE.BoxGeometry(.5 + r() * .4, .8 + r() * 1.2, .3), new THREE.MeshStandardMaterial({ color: 0x2e2a2a, roughness: 1 })); stoneM.position.set(x, .4, -2.3 - r() * .6); stoneM.rotation.y = (r() - .5) * .5; scene.add(stoneM); }
  for (let i = 0; i < 4; i++) { const sh = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .06, 20), new THREE.MeshStandardMaterial({ color: [0x6b2b22, 0x23405e, 0x5c4a22, 0x2f4a33][i], roughness: .7, metalness: .2 })); sh.rotation.x = Math.PI / 2; sh.position.set(-4.5 + i * 3, 1.5 + (i % 2) * .4, -2.05); scene.add(sh); const boss = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 8), new THREE.MeshStandardMaterial({ color: 0xb59a5a, metalness: .8, roughness: .3 })); boss.position.set(sh.position.x, sh.position.y, -2.0); scene.add(boss); }
  // montañas por capas (profundidad)
  const layer = (z, color, amp, base, seed) => { const rr = rng(seed), s = new THREE.Shape(), W = 160; s.moveTo(-W, -5); let y = base; for (let x = -W; x <= W; x += 3) { y = base + Math.sin(x * .05 + seed) * amp * .5 + (rr() - .3) * amp * .6 + Math.max(0, Math.sin(x * .021 + seed * 2)) * amp; s.lineTo(x, y); } s.lineTo(W, -5); const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color, fog: true })); m.position.z = z; scene.add(m); };
  layer(-70, 0x252c3c, 14, 6, 3); layer(-45, 0x1c2230, 9, 3, 5); layer(-26, 0x141923, 5, 1, 9);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(4, 40), new THREE.MeshBasicMaterial({ color: 0xdfe6ef, fog: false })); moon.position.set(-14, 22, -90); scene.add(moon);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 10, 64, 64, 64); g.addColorStop(0, 'rgba(200,215,240,.45)'); g.addColorStop(1, 'rgba(200,215,240,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }), transparent: true, depthWrite: false, fog: false })); glow.position.copy(moon.position); glow.scale.setScalar(26); scene.add(glow);
  // brasas que suben
  const N = 120, pos = new Float32Array(N * 3), spd = new Float32Array(N); for (let i = 0; i < N; i++) { pos.set([(r() - .5) * 22, r() * 8, -1 - r() * 6], i * 3); spd[i] = .2 + r() * .5; }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const embers = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0xff9a4a, size: .05, transparent: true, opacity: .75, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(embers);
  return {
    update(t, dt) {
      lights.forEach((L, i) => { L.intensity = 8 + Math.sin(t * 13 + i * 3) * .9 + Math.sin(t * 29 + i) * .6; });
      flames.forEach((f, i) => { f.scale.set(.85 + Math.sin(t * 17 + i) * .06, 1.45 + Math.sin(t * 11 + i * 2) * .12, 1); });
      for (let i = 0; i < N; i++) { pos[i * 3 + 1] += spd[i] * dt; pos[i * 3] += Math.sin(t + i) * dt * .1; if (pos[i * 3 + 1] > 9) pos[i * 3 + 1] = 0; }
      eg.attributes.position.needsUpdate = true;
    },
  };
}
