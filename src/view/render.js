// Dibujo con Three.js, visto de lado: luchadores (cápsulas por hueso + contorno), arena con profundidad,
// cámara que sigue el centro entre los dos y se aleja si se separan, chispas, polvo y vibración.
import * as THREE from 'three';
import { BONES, P, NP } from '../core/skeleton.js';
import { buildArena } from './arena.js';
const Z = { L: 1, R: -1 };
export class View {
  constructor(canvas) {
    const r = this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(2, devicePixelRatio)); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(24, 1, .1, 400);
    this.arena = buildArena(this.scene); this.fighters = []; this.cx = 0; this.cy = 1.2; this.cw = 9; this.shake = 0; this.t = 0;
    this.fx = new Sparks(this.scene); this.dust = new Dust(this.scene);
    addEventListener('resize', () => this.resize()); this.resize();
  }
  resize() { const w = innerWidth, h = innerHeight; this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
  setFighters(list) { for (const f of this.fighters) f.dispose(); this.fighters = list.map(x => new FighterMesh(this.scene, x.look, x.ch)); }
  bump(k) { this.shake = Math.min(.5, this.shake + k); }
  event(e) {
    if (e.t === 'hit' || e.t === 'block') { const k = e.t === 'block' ? .5 : Math.min(1.6, (e.dmg || 4) / 7); this.fx.burst(e.x, e.y, e.t === 'block' ? 0x9fd4ff : e.heavy ? 0xffc27a : 0xfff1d6, Math.round(10 + k * 16), 2 + k * 3); this.fx.ring(e.x, e.y, e.t === 'block' ? 0x9fd4ff : 0xffffff, .2 + k * .25); this.bump(e.t === 'block' ? .04 : .05 + k * .1); }
    else if (e.t === 'throw' || e.t === 'slam') this.bump(.18);
    else if (e.t === 'land' && e.v > 4) this.dust.puff(e.x, 0, Math.min(1, e.v / 9));
    else if (e.t === 'down') this.dust.puff(e.x, 0, .6);
    else if (e.t === 'ko') this.bump(.25);
  }
  // a = fracción entre el paso anterior y el actual (dibujo suave aunque la física vaya a 120 Hz)
  draw(match, a, dt) {
    this.t += dt; this.arena.update(this.t, dt);
    if (match) match.f.forEach((f, i) => this.fighters[i]?.update(f, a, dt));
    this.fx.update(dt); this.dust.update(dt);
    // cámara: centro entre los dos, se aleja cuando se separan, sin movimientos bruscos
    let tx = 0, ty = 1.15, tw = 8.5;
    if (match) {
      const [p, q] = match.f.map(f => ({ x: f.body.x[P.pelvis], y: Math.max(f.body.y[P.head], f.body.y[P.pelvis] + .7) }));
      tx = (p.x + q.x) / 2; tw = Math.max(7.2, Math.min(16.5, Math.abs(p.x - q.x) + 4.6)); ty = 1.15 + Math.max(0, Math.max(p.y, q.y) - 2.1) * .55;
    }
    const k = 1 - Math.exp(-dt * 3.2); this.cx += (tx - this.cx) * k; this.cy += (ty - this.cy) * k; this.cw += (tw - this.cw) * (1 - Math.exp(-dt * 2.2));
    const half = this.cw / 2; this.cx = Math.max(-7.8 + Math.min(half, 7.6) * .5, Math.min(7.8 - Math.min(half, 7.6) * .5, this.cx));
    const hf = 2 * Math.atan(Math.tan(this.cam.fov * Math.PI / 360) * this.cam.aspect), d = half / Math.tan(hf / 2);
    this.shake *= Math.exp(-dt * 9); const s = this.shake, n = this.t * 60;
    this.cam.position.set(this.cx + Math.sin(n * 1.7) * s * .15, this.cy + .35 + Math.cos(n * 2.3) * s * .12, d); this.cam.lookAt(this.cx, this.cy, 0);
    this.r.render(this.scene, this.cam);
  }
  project(x, y) { const v = new THREE.Vector3(x, y, 0).project(this.cam); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }
}
// ── Luchador: una cápsula por hueso (con su contorno), cabeza negra, manos, accesorio con cintas que ondean ──
const capGeo = new Map(), sphGeo = new THREE.SphereGeometry(1, 24, 16);
const cap = (r, l) => { const k = r.toFixed(3) + l.toFixed(3); if (!capGeo.has(k)) capGeo.set(k, new THREE.CapsuleGeometry(r, l, 6, 14)); return capGeo.get(k); };
class FighterMesh {
  constructor(scene, look, ch) {
    this.g = new THREE.Group(); scene.add(this.g); this.look = look;
    const accent = new THREE.Color(look.color);
    this.mNear = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: .55, metalness: .05 });
    this.mFar = new THREE.MeshStandardMaterial({ color: 0x060608, roughness: .7 });
    this.mLine = new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(.75), side: THREE.BackSide });
    this.mGear = new THREE.MeshStandardMaterial({ color: accent, roughness: .45, emissive: accent, emissiveIntensity: .18 });
    this.parts = BONES.map((b, i) => {
      if (b.name === 'head') return null;
      const far = b.name.endsWith('R'), r = b.r * (ch.mass > 1.1 && (b.name === 'torso' || b.name.startsWith('ua') || b.name.startsWith('th')) ? 1.13 : 1);
      const m = new THREE.Mesh(cap(r, Math.max(.01, b.len - r * .6)), far ? this.mFar : this.mNear), o = new THREE.Mesh(cap(r + .013, Math.max(.01, b.len - r * .6)), this.mLine);
      this.g.add(o, m); return { b, m, o, z: b.name.endsWith('L') ? Z.L : b.name.endsWith('R') ? Z.R : 0 };
    }).filter(Boolean);
    const hr = .125 * (ch.mass > 1.1 ? 1.04 : 1);
    this.head = new THREE.Mesh(sphGeo, this.mNear); this.head.scale.setScalar(hr); this.headO = new THREE.Mesh(sphGeo, this.mLine); this.headO.scale.setScalar(hr + .014);
    this.hands = [P.handL, P.handR].map((i, k) => { const m = new THREE.Mesh(sphGeo, k ? this.mFar : this.mNear), o = new THREE.Mesh(sphGeo, this.mLine); m.scale.setScalar(.058); o.scale.setScalar(.071); this.g.add(o, m); return { i, m, o, z: k ? Z.R : Z.L }; });
    this.pelvisM = new THREE.Mesh(sphGeo, this.mNear); this.pelvisM.scale.set(.13, .11, .12); this.g.add(this.pelvisM);
    this.g.add(this.headO, this.head);
    // accesorio
    this.gear = new THREE.Group(); this.g.add(this.gear); this.tails = null;
    if (look.gear === 'cinta') {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(hr + .006, hr + .006, .045, 28, 1, true), this.mGear); band.position.y = .03; this.gear.add(band);
      this.tails = [0, 1].map(k => ({ pts: Array.from({ length: 6 }, () => new THREE.Vector3()), old: Array.from({ length: 6 }, () => new THREE.Vector3()), meshes: Array.from({ length: 5 }, () => { const m = new THREE.Mesh(cap(.014 - k * .002, .06), this.mGear); this.g.add(m); return m; }), k, init: false }));
    } else if (look.gear === 'casco') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(hr + .018, 26, 14, 0, Math.PI * 2, 0, Math.PI * .5), new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: .35, metalness: .75 })); dome.position.y = .012; this.gear.add(dome);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(hr + .018, .014, 8, 28), this.mGear); rim.rotation.x = Math.PI / 2; rim.position.y = .012; this.gear.add(rim);
      for (const s of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(.032, .16, 12), new THREE.MeshStandardMaterial({ color: 0xe9e1cf, roughness: .5 })); horn.position.set(0, .1, s * .12); horn.rotation.x = -s * .9; this.gear.add(horn); }
    }
    // sombra
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = .005; this.g.add(this.shadow);
    this.X = new Float64Array(NP); this.Y = new Float64Array(NP);
  }
  update(f, a, dt) {
    const b = f.body, X = this.X, Y = this.Y, ff = b.f, zs = .095;
    for (let i = 0; i < NP; i++) { X[i] = b.px[i] + (b.x[i] - b.px[i]) * a; Y[i] = b.py[i] + (b.y[i] - b.py[i]) * a; }
    for (const p of this.parts) {
      const { b: bn, m, o } = p, ax = X[bn.a], ay = Y[bn.a], bx = X[bn.b], by = Y[bn.b], z = p.z * ff * zs + (bn.name === 'torso' ? 0 : p.z ? 0 : .01);
      m.position.set((ax + bx) / 2, (ay + by) / 2, z); m.rotation.set(0, 0, Math.atan2(by - ay, bx - ax) - Math.PI / 2); o.position.copy(m.position); o.position.z -= .02; o.rotation.copy(m.rotation);
    }
    for (const h of this.hands) { h.m.position.set(X[h.i], Y[h.i], h.z * ff * zs); h.o.position.copy(h.m.position); h.o.position.z -= .02; }
    this.pelvisM.position.set(X[P.pelvis], Y[P.pelvis] + .02, 0);
    const ang = Math.atan2(Y[P.head] - Y[P.neck], X[P.head] - X[P.neck]);
    this.head.position.set(X[P.head], Y[P.head], .02); this.headO.position.copy(this.head.position); this.headO.position.z -= .02;
    this.gear.position.copy(this.head.position); this.gear.rotation.set(0, 0, ang - Math.PI / 2);
    if (this.tails) this.ribbons(X[P.head], Y[P.head], ang, ff, dt);
    const hgt = Math.max(0, Math.min(X.length && Y[P.pelvis], 3)); this.shadow.position.x = X[P.pelvis]; const s = Math.max(.3, 1.1 - hgt * .25); this.shadow.scale.set(s, s * .45, 1); this.shadow.material.opacity = Math.max(.15, .8 - hgt * .2);
  }
  // cintas: cadenas de partículas que cuelgan de la nuca y siguen el movimiento (movimiento secundario)
  ribbons(hx, hy, ang, ff, dt) {
    const back = ang + Math.PI / 2 * ff, ox = hx + Math.cos(ang) * .03 - Math.cos(ang - Math.PI / 2) * .12 * ff, oy = hy + Math.sin(ang) * .03 - Math.sin(ang - Math.PI / 2) * .12 * ff;
    for (const t of this.tails) {
      const P0 = t.pts, O = t.old, seg = .065;
      if (!t.init) { P0.forEach((p, i) => { p.set(ox - ff * seg * i, oy - .02 * i, 0); O[i].copy(p); }); t.init = true; }
      P0[0].set(ox, oy - t.k * .03, -.03 - t.k * .04); O[0].copy(P0[0]);
      const h = Math.min(dt, 1 / 30);
      for (let i = 1; i < P0.length; i++) { const p = P0[i], o = O[i], vx = (p.x - o.x) * .96, vy = (p.y - o.y) * .96; o.copy(p); p.x += vx - ff * 1.2 * h * h; p.y += vy - 7 * h * h + Math.sin(this.tw = (this.tw || 0) + h * 3) * .00002; }
      for (let it = 0; it < 3; it++) for (let i = 1; i < P0.length; i++) { const a = P0[i - 1], b = P0[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, e = (d - seg) / d; b.x -= dx * e; b.y -= dy * e; if (b.y < .02) b.y = .02; }
      t.meshes.forEach((m, i) => { const a = P0[i], b = P0[i + 1]; m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, a.z); m.rotation.set(0, 0, Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2); });
    }
  }
  dispose() { this.g.parent?.remove(this.g); }
}
// ── chispas de impacto y polvo ──
class Sparks {
  constructor(scene) {
    this.n = 300; this.p = new Float32Array(this.n * 3); this.v = new Float32Array(this.n * 3); this.life = new Float32Array(this.n); this.c = new Float32Array(this.n * 3); this.i = 0;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.p, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
    this.pts = new THREE.Points(g, new THREE.PointsMaterial({ size: .045, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); this.pts.frustumCulled = false; scene.add(this.pts);
    this.rings = []; this.scene = scene; this.p.fill(-99);
  }
  burst(x, y, color, n, sp) { const c = new THREE.Color(color); for (let k = 0; k < n; k++) { const i = this.i++ % this.n, a = Math.random() * Math.PI * 2, s = sp * (.3 + Math.random()); this.p.set([x, y, .2], i * 3); this.v.set([Math.cos(a) * s, Math.sin(a) * s + 1, (Math.random() - .5)], i * 3); this.life[i] = .25 + Math.random() * .25; this.c.set([c.r, c.g, c.b], i * 3); } }
  ring(x, y, color, size) { const m = new THREE.Mesh(new THREE.RingGeometry(.6, 1, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.set(x, y, .25); m.scale.setScalar(size * .3); this.scene.add(m); this.rings.push({ m, t: 0, size }); }
  update(dt) {
    for (let i = 0; i < this.n; i++) { if (this.life[i] <= 0) continue; this.life[i] -= dt; const o = i * 3; this.v[o + 1] -= 9 * dt; for (let k = 0; k < 3; k++) this.p[o + k] += this.v[o + k] * dt; if (this.life[i] <= 0) this.p[o + 1] = -99; else for (let k = 0; k < 3; k++) this.c[o + k] *= 1 - dt * 3; }
    this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true;
    this.rings = this.rings.filter(r => { r.t += dt; const u = r.t / .22; r.m.scale.setScalar(r.size * (.3 + u)); r.m.material.opacity = .8 * (1 - u); if (u >= 1) { this.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); return false; } return true; });
  }
}
class Dust {
  constructor(scene) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 1, 32, 32, 32); g.addColorStop(0, 'rgba(190,175,160,.55)'); g.addColorStop(1, 'rgba(190,175,160,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    this.tex = new THREE.CanvasTexture(c); this.scene = scene; this.list = [];
  }
  puff(x, y, k) { for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, opacity: .7 * k })); s.position.set(x + (Math.random() - .5) * .5, .1, (Math.random() - .5) * .4); s.scale.setScalar(.3); this.scene.add(s); this.list.push({ s, t: 0, vx: (Math.random() - .5) * 2.2 * k, vy: .3 + Math.random() * .5, k }); } }
  update(dt) { this.list = this.list.filter(d => { d.t += dt; d.s.position.x += d.vx * dt; d.s.position.y += d.vy * dt; d.vx *= 1 - dt * 3; d.s.scale.setScalar(.3 + d.t * 1.4); d.s.material.opacity = .7 * d.k * (1 - d.t / .8); if (d.t > .8) { this.scene.remove(d.s); d.s.material.dispose(); return false; } return true; }); }
}
