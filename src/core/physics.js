// Física del cuerpo: partículas con masa unidas por huesos (restricciones de distancia), límites articulares,
// suelo y paredes. Los "músculos" son resortes PD que llevan cada partícula hacia la postura deseada; su fuerza
// (tono) baja con los golpes y llega casi a cero en el ragdoll, donde solo quedan articulaciones con un tono leve.
import { NP, MASS, RAD, BONES, clamp, wrap } from './skeleton.js';
export const G = 22;                       // gravedad (m/s²), algo más que la real para que los saltos no floten
export const KP = 1900, KD = 78;           // rigidez y amortiguación de los músculos con tono 1
const ITER = 6, FEET = [9, 10, 12, 13];
// ángulo de relajación de cada articulación en ragdoll (en el marco del luchador)
const RELAX = { neck: 0, head: 0, faL: .6, faR: .6, thL: .6, thR: .6, shL: -1.3, shR: -1.3, ftL: 1.4, ftR: 1.4 };
export class Body {
  constructor() {
    const F = () => new Float64Array(NP);
    this.x = F(); this.y = F(); this.vx = F(); this.vy = F(); this.px = F(); this.py = F();   // px/py: posición del paso anterior (para dibujar entre pasos)
    this.tx = F(); this.ty = F(); this.tvx = F(); this.tvy = F();                             // objetivo de los músculos
    this.loc = new Float64Array(NP).fill(1);   // tono local (baja en la zona golpeada y se recupera)
    this.tone = 1; this.f = 1; this.jointTone = .006; this.grounded = new Uint8Array(NP); this.friction = .2;
    this.inv = MASS.map(m => 1 / m); this.pin = new Float64Array(NP); this.ax = new Float64Array(NP); this.ay = new Float64Array(NP); this.pinOK = false;
  }
  place(xs, ys) { for (let i = 0; i < NP; i++) { this.x[i] = this.px[i] = this.tx[i] = xs[i]; this.y[i] = this.py[i] = this.ty[i] = ys[i]; this.vx[i] = this.vy[i] = this.tvx[i] = this.tvy[i] = 0; } }
  setTargets(xs, ys, dt) { for (let i = 0; i < NP; i++) { this.tvx[i] = (xs[i] - this.tx[i]) / dt; this.tvy[i] = (ys[i] - this.ty[i]) / dt; if (!Number.isFinite(this.tvx[i]) || Math.abs(this.tvx[i]) > 40) this.tvx[i] = 0; if (!Number.isFinite(this.tvy[i]) || Math.abs(this.tvy[i]) > 40) this.tvy[i] = 0; this.tx[i] = xs[i]; this.ty[i] = ys[i]; } }
  // empuje local: cambio de velocidad en una partícula
  kick(i, dvx, dvy) { this.vx[i] += dvx; this.vy[i] += dvy; }
  // baja el tono de un grupo de partículas (se recupera solo)
  dip(list, to) { for (const i of list) this.loc[i] = Math.min(this.loc[i], to); }
  get com() { let m = 0, x = 0, y = 0; for (let i = 0; i < NP; i++) { m += MASS[i]; x += this.x[i] * MASS[i]; y += this.y[i] * MASS[i]; } return { x: x / m, y: y / m }; }
  momentum() { let x = 0, y = 0; for (let i = 0; i < NP; i++) { x += this.vx[i] * MASS[i]; y += this.vy[i] * MASS[i]; } return { x, y }; }
  step(dt, w) {
    const { x, y, vx, vy } = this, k = KP, c = KD;
    for (let i = 0; i < NP; i++) {
      this.px[i] = x[i]; this.py[i] = y[i];
      const s = this.tone * this.loc[i]; let ax = 0, ay = -G;
      if (s > .001) { ax += k * s * (this.tx[i] - x[i]) + c * Math.sqrt(s) * (this.tvx[i] - vx[i]); ay += k * s * (this.ty[i] - y[i]) + c * Math.sqrt(s) * (this.tvy[i] - vy[i]) + G * Math.min(1, s * 1.1); }
      vx[i] += ax * dt; vy[i] += ay * dt;
      const drag = 1 - .15 * dt; vx[i] *= drag; vy[i] *= drag;
      this.loc[i] = Math.min(1, this.loc[i] + dt * 2.2);
    }
    const x0 = Float64Array.from(x), y0 = Float64Array.from(y);
    for (let i = 0; i < NP; i++) { x[i] += vx[i] * dt; y[i] += vy[i] * dt; }
    // pie de apoyo bloqueado: si el músculo lo pide quieto en el suelo, no resbala aunque la pelvis tire de él
    for (const i of FEET) {
      const want = this.pinOK && this.ty[i] < (i === 9 || i === 12 ? .0805 : .045) && Math.abs(this.tvx[i]) < .05 && this.loc[i] > .9 && this.tone > .8;
      if (want && !this.pin[i]) { this.pin[i] = 1; this.ax[i] = x[i]; this.ay[i] = Math.max(this.ty[i], Math.min(y[i], this.ty[i] + .01)); }
      if (!want || Math.abs(this.ax[i] - this.tx[i]) > .15) this.pin[i] = 0;
      if (this.pin[i]) { x[i] = this.ax[i]; y[i] = this.ay[i]; }
    }
    const inv0 = this.inv; this.inv = this.inv.map((v, i) => v * (1 - this.pin[i]) + 1e-9);
    const limp = this.tone < .5;
    for (let it = 0; it < ITER; it++) {
      for (const b of BONES) this.bone(b);
      this.limits(limp ? 1 : .5);
      if (limp) this.relax(this.jointTone);
      this.bounds(w);
    }
    this.inv = inv0;
    for (let i = 0; i < NP; i++) {
      vx[i] = (x[i] - x0[i]) / dt; vy[i] = (y[i] - y0[i]) / dt;
      if (this.grounded[i]) { const fr = limp ? .09 : this.friction; vx[i] *= Math.max(0, 1 - fr); }
      if (limp) { vx[i] *= .9985; vy[i] *= .9985; }
    }
  }
  bone(b) {
    const { x, y } = this, ia = this.inv[b.a], ib = this.inv[b.b], dx = x[b.b] - x[b.a], dy = y[b.b] - y[b.a], d = Math.hypot(dx, dy) || 1e-6, e = (d - b.len) / d / (ia + ib);
    x[b.a] += dx * e * ia; y[b.a] += dy * e * ia; x[b.b] -= dx * e * ib; y[b.b] -= dy * e * ib;
  }
  angle(bi) { const b = BONES[bi]; return Math.atan2(this.y[b.b] - this.y[b.a], this.x[b.b] - this.x[b.a]); }
  rel(bi) { const b = BONES[bi]; return wrap(this.f * (this.angle(bi) - this.angle(b.parent)) - b.off); }
  // gira la partícula hija del hueso alrededor de su articulación (y la del padre al revés, según masas)
  turn(bi, da) {
    const b = BONES[bi], { x, y } = this, j = b.a, c = b.b, p = BONES[b.parent].a, ax = x[j], ay = y[j];
    const ic = this.inv[c], ip = this.inv[p], wc = ic / (ic + ip);
    const mc = MASS[c], mp = MASS[p], mj = MASS[j], ox = mc * x[c] + mp * x[p], oy = mc * y[c] + mp * y[p];
    const rot = (i, a) => { const dx = x[i] - ax, dy = y[i] - ay, cs = Math.cos(a), sn = Math.sin(a); x[i] = ax + dx * cs - dy * sn; y[i] = ay + dx * sn + dy * cs; };
    rot(c, da * wc); rot(p, -da * (1 - wc));
    // sin crear impulso: lo que se movió el conjunto se reparte entre las tres partículas
    const sx = (mc * x[c] + mp * x[p] - ox) / (mc + mp + mj), sy = (mc * y[c] + mp * y[p] - oy) / (mc + mp + mj);
    for (const i of [c, p, j]) { x[i] -= sx * (this.inv[i] > 1e-6 ? 1 : 0); y[i] -= sy * (this.inv[i] > 1e-6 ? 1 : 0); }
  }
  limits(k) {
    for (let i = 1; i < BONES.length; i++) { const b = BONES[i]; if (b.hi - b.lo > 6) continue; const r = this.rel(i), cr = clamp(r, b.lo, b.hi); if (cr !== r) this.turn(i, this.f * (cr - r) * k); }
  }
  relax(k) { for (let i = 1; i < BONES.length; i++) { const r0 = RELAX[BONES[i].name]; if (r0 === undefined) continue; this.turn(i, this.f * wrap(r0 - this.rel(i)) * k); } }
  bounds(w) {
    const { x, y } = this;
    for (let i = 0; i < NP; i++) {
      const r = RAD[i], g = w.ground + r; this.grounded[i] = 0;
      if (y[i] < g) { y[i] = g; this.grounded[i] = 1; }
      if (x[i] < w.left + r) x[i] = w.left + r; else if (x[i] > w.right - r) x[i] = w.right - r;
    }
  }
}
