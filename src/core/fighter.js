// Luchador: controlador (raíz con inercia, gravedad y fricción), máquina de estados, capas de animación procedural
// (pasos sin deslizar, suspensión de la pelvis, inclinación por aceleración) y ragdoll con levantamiento.
import { Body, G } from './physics.js';
import { P, NP, DEG, clamp, lerp, smooth, wrap } from './skeleton.js';
import { NPOSE, copy, blend, blendPart, sample, setLegs, fk, measure } from './poses.js';
import { B } from './input.js';
export const HALF = 7.2;                     // media anchura de la arena (límites laterales)
const TICK = 1 / 120, frac = x => x - Math.floor(x);
export class Fighter {
  constructor(idx, ch, look, match) {
    this.idx = idx; this.ch = ch; this.look = look; this.match = match; this.body = new Body(); this.pose = new Float64Array(NPOSE); this.tmp = new Float64Array(NPOSE);
    this.xs = new Float64Array(NP); this.ys = new Float64Array(NP); this.reset(idx ? 1.8 : -1.8, idx ? -1 : 1);
  }
  reset(x, f) {
    Object.assign(this, { x, y: 0, vx: 0, vy: 0, f, grounded: true, jumps: 0, state: 'free', st: 0, move: null, mt: 0, hitDone: false, hp: 100, bal: 100, balT: 9, combo: 0, comboT: 0, cool: {}, buf: null, phase: 0, suspY: 0, suspV: 0, lean: 0, leanV: 0, prevVx: 0, tuckT: 0, runOn: false, tapT: 9, lastFwd: 0, invuln: 0, high: 0, dodgeK: null, stun: 0, zone: 'body', partner: null, esc: 0, keys: null, ko: false, lunged: false, dived: false, flip: false, landT: 0, blockHeld: false, crouching: false, hitsTaken: 0, chain: 0, lastStep: 0, downMin: .9, pressed: 0 });
    copy(this.ch.poses.guard, this.pose); fk(this.pose, x, 0, f, this.xs, this.ys); this.body.place(this.xs, this.ys); this.body.f = f; this.body.tone = 1; this.body.loc.fill(1);
  }
  emit(t, o = {}) { this.match.ev.push({ t, who: this.idx, x: this.body.x[P.pelvis], y: this.body.y[P.pelvis], ...o }); }
  get pelvis() { return { x: this.body.x[P.pelvis], y: this.body.y[P.pelvis] }; }
  get down() { return this.state === 'down' || this.state === 'ko'; }
  get actionable() { return this.state === 'free' && this.landT <= 0; }
  get attacking() { return this.state === 'attack' && this.move && this.mt < this.move.act[1]; }
  canBlock(fromX) { return (this.state === 'free' || this.state === 'block') && this.grounded && this.blockHeld && Math.sign(fromX - this.x) === this.f; }
  update(dt, inp, opp) {
    const held = inp.held | 0, hit = inp.hit | 0; this.pressed = hit;
    const h = (held & B.right ? 1 : 0) - (held & B.left ? 1 : 0), fwd = h * this.f;
    this.st += dt; this.balT += dt; this.comboT += dt; this.tapT += dt; this.landT -= dt; this.invuln -= dt; this.high -= dt; this.tuckT -= dt;
    for (const k in this.cool) this.cool[k] -= dt;
    if (this.balT > .9) this.bal = Math.min(100, this.bal + 28 * dt);
    if (hit) { const a = ['punch', 'kick', 'heavy', 'grab', 'dodge', 'up'].find(k => hit & B[k]); if (a) this.buf = { a, held, t: .14 }; }
    if (this.buf && (this.buf.t -= dt) <= 0) this.buf = null;
    // doble toque adelante = correr
    if (fwd > 0 && this.lastFwd <= 0) { if (this.tapT < .26) this.runOn = true; this.tapT = 0; }
    if (fwd <= 0) this.runOn = false; this.lastFwd = fwd;
    this.blockHeld = fwd < 0 && this.grounded; this.crouching = false;
    const S = this.state;
    if (S === 'free') this.free(dt, held, fwd, opp);
    else if (S === 'squat') { if (this.st >= .065 * this.ch.timeK) this.launch(h); }
    else if (S === 'attack') this.attack(dt, held, fwd);
    else if (S === 'hit' || S === 'block') { if (this.st >= this.stun) this.toFree(); }
    else if (S === 'dodge') { if (this.st >= this.dodgeK.t) { this.toFree(); this.cool.dodge = .3; } }
    else if (S === 'down') this.downed(dt, hit);
    else if (S === 'getup') { if (this.st >= .95) { this.toFree(); this.bal = 100; } }
    else if (S === 'hold') this.holding(dt, held, hit, fwd);
    this.root(dt, h, fwd, held);
    this.animate(dt, opp);
  }
  toFree() { this.state = 'free'; this.st = 0; this.move = null; this.flip = false; }
  set(s) { this.state = s; this.st = 0; }
  free(dt, held, fwd, opp) {
    // girar hacia el rival
    if (this.grounded && Math.abs(opp.x - this.x) > .1 && Math.sign(opp.x - this.x) !== this.f && !opp.down) { this.f = -this.f; this.phase += .25; }
    this.crouching = !!(held & B.down) && this.grounded;
    if (this.landT > 0) return;
    const b = this.buf; if (!b) return;
    const bf = ((b.held & B.right ? 1 : 0) - (b.held & B.left ? 1 : 0)) * this.f, down = b.held & B.down;
    let id = null;
    if (b.a === 'up') { this.buf = null; if (this.grounded) { this.set('squat'); this.suspV -= 1.6; } else if (this.jumps < 2) { this.vy = this.ch.jump2; this.jumps = 2; this.tuckT = .38; this.emit('jump', { n: 2 }); } return; }
    if (!this.grounded) id = b.a === 'kick' ? 'air' : b.a === 'heavy' || (b.a === 'punch' && down) ? 'dive' : b.a === 'punch' ? 'jab' : null;
    else if (b.a === 'punch') id = down ? 'upper' : this.chain === 1 && this.comboT < .4 ? 'cross' : this.chain === 2 && this.comboT < .4 ? 'hook' : 'jab';
    else if (b.a === 'kick') id = this.runOn && Math.abs(this.vx) > 3 && down ? 'slide' : down ? 'low' : bf > 0 ? 'side' : bf < 0 ? 'spin' : 'front';
    else if (b.a === 'heavy') id = 'heavy';
    else if (b.a === 'grab') id = 'grab';
    else if (b.a === 'dodge') { this.buf = null; if ((this.cool.dodge || 0) > 0 || !this.grounded) return; this.dodge(down && Math.abs(this.vx) > 3 ? 'slide' : bf > 0 ? 'dash' : bf < 0 ? 'back' : 'sway'); return; }
    if (b.a === 'kick' && this.grounded && down && this.runOn) id = 'slide';
    if (id) { this.buf = null; this.start(id); }
  }
  start(id) {
    const mv = this.ch.moves[id]; if (!mv || (this.cool[id] || 0) > 0) return false;
    if (id === 'jab' || id === 'cross' || id === 'hook') { this.chain = id === 'jab' ? 1 : id === 'cross' ? 2 : 0; this.comboT = 0; } else this.chain = 0;
    this.move = mv; this.mt = 0; this.hitDone = false; this.lunged = false; this.dived = false; this.set('attack'); this.flip = false;
    if (mv.slide) this.vx = Math.max(Math.abs(this.vx), 5.2) * this.f;
    this.emit('whoosh', { m: id, w: mv.dmg }); return true;
  }
  attack(dt, held, fwd) {
    const m = this.move; this.mt += dt;
    if (m.lunge && !this.lunged && this.mt >= m.lunge[0]) { this.lunged = true; this.vx += m.lunge[1] * this.f; }
    if (m.dive && !this.dived && this.mt >= m.dive[0] && !this.grounded) { this.dived = true; this.vy = m.dive[1]; }
    this.flip = !!(m.flip && this.mt >= m.flip[0] && this.mt < m.flip[1]);
    // encadenar el combo de puños: el siguiente golpe sale al terminar la ventana activa
    if (m.next && this.grounded && this.buf?.a === 'punch' && this.mt >= m.act[1] && !(this.buf.held & B.down)) { this.buf = null; this.cool[m.id] = 0; this.start(m.next); return; }
    if (this.mt >= m.total) { this.cool[m.id] = m.cool; this.toFree(); }
  }
  launch(h) { this.grounded = false; this.vy = this.ch.jump; this.vx += h * this.ch.walk * .35; this.jumps = 1; this.set('free'); this.suspV += 1.2; this.emit('jump', { n: 1 }); }
  dodge(k) {
    if (k === 'slide') { this.start('slide'); return; }
    const D = { back: { t: .32, v: -6.2, inv: .2 }, dash: { t: .26, v: 7.2, inv: .1 }, sway: { t: .36, v: 0, inv: 0 } }[k];
    this.dodgeK = { k, ...D }; this.set('dodge'); this.vx = D.v * this.f * (k === 'sway' ? 0 : 1); this.invuln = D.inv; if (k === 'sway') this.high = .28; this.emit('whoosh', { m: 'dodge', w: 2 });
  }
  // derribo: el tono muscular baja poco a poco (no de golpe) y el cuerpo sigue con la inercia del impacto
  knockDown(vx = 0, vy = 0) {
    if (this.state === 'held' && this.partner) this.partner.release();
    this.set('down'); this.move = null; this.flip = false; this.grounded = false; this.downMin = .9; this.buf = null;
    this.kpose = measure(this.body, this.body.x[P.pelvis], 0, this.f, new Float64Array(NPOSE)); this.kpose[0] = 0;
    // el tronco sale con el golpe; los pies se quedan atrás (o resbalan al revés): el cuerpo gira y cae
    const b = this.body, K = [1.1, 1.05, 1, .85, .9, .9, .9, .9, .25, -.25, -.3, .25, -.25, -.3];
    for (let i = 0; i < NP; i++) { b.vx[i] += vx * K[i]; b.vy[i] += vy * (i >= 8 ? .3 : 1); }
    this.emit('down');
  }
  downed(dt, hit) {
    const b = this.body, pv = Math.hypot(b.vx[P.pelvis], b.vy[P.pelvis]);
    if (this.ko) return;
    if (hit && this.st > .5) this.downMin = Math.min(this.downMin, .55);
    if ((this.st > this.downMin && pv < .9 && b.y[P.pelvis] < .5) || this.st > 3.2) this.getUp();
  }
  getUp() {
    const b = this.body; this.x = clamp(b.x[P.pelvis], -HALF + .4, HALF - .4); this.y = 0; this.vx = this.vy = 0; this.grounded = true; b.f = this.f;
    const tx = b.x[P.chest] - b.x[P.pelvis], faceUp = this.f * tx < 0, ps = this.ch.poses, m0 = measure(b, this.x, 0, this.f, new Float64Array(NPOSE));
    this.keys = [[0, m0], [.32, faceUp ? ps.sit : ps.pushup], [.62, ps.rise], [.95, ps.guard]];
    this.set('getup'); this.invuln = .7; this.emit('getup', { up: faceUp });
  }
  holding(dt, held, hit, fwd) {
    const v = this.partner; if (!v || v.state !== 'held') { this.toFree(); return; }
    if (this.st > 3) return this.release(true);
    if (hit & B.heavy) { this.start('throw'); this.state = 'attack'; return; }
    if (hit & B.down) { this.start('slam'); return; }
    if (hit & B.dodge) return this.release(true);
    if (hit & (B.left | B.right) && fwd > 0) return this.shove();
    if (hit & B.grab) v.esc = Math.max(0, v.esc - 7 * this.ch.grip);
  }
  release(push = false) { const v = this.partner; this.partner = null; if (this.state === 'hold') this.toFree(); if (v && v.state === 'held') { v.partner = null; v.set('hit'); v.stun = .2; if (push) { v.vx = this.f * 2.5; this.vx = -this.f * 1.5; } } }
  shove() { const v = this.partner; this.release(); if (!v) return; v.vx = this.f * 6 * v.ch.kbK; v.stun = .4; v.bal -= 45 * v.ch.balK; v.balT = 0; this.vx = -this.f * 1; this.emit('shove'); if (v.bal <= 0) v.knockDown(this.f * 4, 2); }
  // raíz: posición del luchador sobre el suelo, con aceleración, inercia, gravedad y fricción
  root(dt, h, fwd, held) {
    const S = this.state, b = this.body, ch = this.ch;
    if (S === 'down') { this.x = b.x[P.pelvis]; this.vx = b.vx[P.pelvis]; this.y = 0; this.vy = 0; this.grounded = false; return; }
    if (S === 'held') return;   // la lleva el agarre
    let tv = null, acc = this.grounded ? ch.accel : 9;
    if (S === 'free') {
      if (this.crouching) tv = 0;
      else if (this.landT > 0) tv = this.vx * .5;
      else if (fwd > 0) tv = (this.runOn ? ch.run : ch.walk) * this.f;
      else if (fwd < 0) tv = -ch.back * this.f;
      else tv = 0;
      if (!this.grounded) { tv = h ? h * Math.max(ch.walk, Math.abs(this.vx)) : this.vx; acc = 8; }
    } else if (S === 'attack') {
      const m = this.move; if (m.slide) { tv = 0; acc = 5.5; } else if (m.upper && this.grounded) { tv = fwd > 0 ? ch.walk * .4 * this.f : fwd < 0 ? -ch.back * .4 * this.f : 0; acc = 10; } else if (this.grounded) { tv = 0; acc = 9; } else tv = this.vx;
    } else if (S === 'hold') { tv = fwd < 0 ? -1.7 * this.f : 0; acc = 12; }
    else if (S === 'dodge') { tv = 0; acc = this.dodgeK.k === 'sway' ? 30 : 15; }
    else if (S === 'getup' || S === 'squat') { tv = 0; acc = 30; }
    else { tv = 0; acc = 12; }   // golpeado / bloqueando: el retroceso se frena con la fricción
    if (tv !== null) { const d = tv - this.vx, mx = acc * dt; this.vx += clamp(d, -mx, mx); }
    if (!this.grounded) { this.vx *= 1 - .25 * dt; this.vy -= G * dt; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.x < -HALF + .35) { this.x = -HALF + .35; if (this.vx < 0) this.vx = -this.vx * .2; }
    if (this.x > HALF - .35) { this.x = HALF - .35; if (this.vx > 0) this.vx = -this.vx * .2; }
    if (!this.grounded && this.y <= 0) this.land();
  }
  land() {
    const v = -this.vy; this.y = 0; this.vy = 0; this.grounded = true; this.jumps = 0; this.suspV -= Math.min(3.2, v * .42); this.emit('land', { v });
    if (this.state === 'attack' && this.move?.air) { this.cool[this.move.id] = this.move.cool; this.toFree(); this.landT = this.move.id === 'dive' ? .14 : .07; }
    else if (this.state === 'free' && v > 6) this.landT = .05;
  }
  // capas de animación -> objetivos de los músculos
  animate(dt, opp) {
    const b = this.body, ps = this.ch.poses, S = this.state, p = this.pose;
    // suspensión de la pelvis (absorbe aterrizajes e impulsos) e inclinación por aceleración
    const ax = (this.vx - this.prevVx) / dt * this.f; this.prevVx = this.vx;
    this.suspV += (-140 * this.suspY - 15 * this.suspV) * dt; this.suspY = clamp(this.suspY + this.suspV * dt, -.3, .12);
    const lt = clamp(-ax * .012, -.28, .28) * (this.grounded ? 1 : .3); this.leanV += (90 * (lt - this.lean) - 14 * this.leanV) * dt; this.lean += this.leanV * dt;
    if (S === 'down') {
      // pierde la postura poco a poco: los músculos solo frenan el movimiento entre articulaciones, no el del cuerpo
      b.pinOK = false; b.tone = Math.max(0, b.tone - dt * 7); copy(this.kpose, p); b.f = this.f;
      fk(p, b.x[P.pelvis], b.y[P.pelvis] - p[1], this.f, this.xs, this.ys);
      for (let i = 0; i < NP; i++) { b.tx[i] = this.xs[i]; b.ty[i] = this.ys[i]; b.tvx[i] = b.vx[P.pelvis]; b.tvy[i] = b.vy[P.pelvis]; }
      return;
    }
    if (S === 'getup') { sample(this.keys, this.st, p); b.tone = Math.min(1, smooth(this.st / .38) * .95 + .05); }
    else {
      this.locomotion(dt, p);
      if (S === 'attack') { const mp = sample(this.move.keys, this.mt, this.tmp); if (this.move.upper) blendPart(p, mp, 1, 'upper'); else if (this.grounded || this.move.air) copy(mp, p); else blendPart(p, mp, 1, 'upper'); }
      else if (S === 'hit') { const u = this.st / this.stun, w = Math.min(1, this.st / .05) * (1 - smooth((u - .45) / .55)); blendPart(p, this.zone === 'head' ? ps.hitHead : this.zone === 'leg' ? ps.hitLeg : ps.hitBody, w, 'upper'); }
      else if (S === 'block' || (S === 'free' && this.blockHeld && !this.crouching)) blendPart(p, ps.block, S === 'block' ? 1 : .8, 'upper');
      else if (S === 'free' && this.blockHeld && this.crouching) blendPart(p, ps.crouchBlock, 1, 'upper');
      else if (S === 'dodge') { const k = this.dodgeK.k, w = Math.sin(Math.PI * clamp(this.st / this.dodgeK.t, 0, 1)); blendPart(p, k === 'sway' ? ps.sway : k === 'back' ? ps.back : ps.lean, Math.min(1, w * 1.6), 'upper'); }
      else if (S === 'hold') blendPart(p, ps.hold, 1, 'upper');
      else if (S === 'held') { blendPart(p, ps.held, 1, 'upper'); p[2] += Math.sin(this.st * 31) * .06 * Math.min(1, this.esc / 30); }
      else if (S === 'win') blend(p, ps.win, smooth(this.st / .5), p);
      else if (S === 'lose') blend(p, ps.lose, smooth(this.st / .8), p);
      p[2] += this.lean;
      const tone = S === 'hit' ? lerp(.45, 1, smooth(this.st / this.stun)) : S === 'held' ? .7 : 1;
      b.tone += (tone - b.tone) * Math.min(1, dt * 14);
    }
    const ff = this.flip ? -this.f : this.f; b.f = ff; b.friction = .05; b.pinOK = this.grounded && S !== 'held' && S !== 'getup';
    fk(p, this.x, this.y, ff, this.xs, this.ys); b.setTargets(this.xs, this.ys, dt);
  }
  // pasos procedurales: el pie de apoyo queda fijo en el suelo (sin deslizar) y el otro avanza en arco
  locomotion(dt, p) {
    const ps = this.ch.poses, sp = Math.abs(this.vx), ch = this.ch;
    if (!this.grounded) {
      copy(this.vy > 1.5 ? ps.jumpUp : ps.fall, p); if (this.tuckT > 0) blend(p, ps.tuck, Math.sin(Math.PI * clamp(1 - this.tuckT / .38, 0, 1)), p);
      return;
    }
    const base = this.crouching ? ps.crouch : ps.guard; copy(base, p);
    if (this.state === 'squat') { blend(p, ps.crouch, .55, p); }
    const runW = smooth((sp - 2.6) / 1.4), stride = lerp(.36, .98, runW) * (this.crouching ? .7 : 1), dist = this.vx * this.f * dt;
    this.phase += dist / (2 * stride);
    const w = smooth(sp / .55);
    // respiración / rebote en la guardia
    const t = this.match.time; p[1] += Math.sin(t * (ch.bounce > .01 ? 9 : 3.2)) * (ch.bounce > .01 ? ch.bounce : .008) * (1 - w);
    if (w > .001) {
      const g = this.ch.guard, lc = lerp(g.fL[0], 0, runW), rc = lerp(g.fR[0], 0, runW), lift = lerp(.09, .24, runW), bob = lerp(.02, .055, runW);
      const foot = (ph, c) => { const q = frac(ph); if (q < .5) return [c + stride * (.5 - 2 * q), .08, -17 * DEG]; const u = (q - .5) / .5; return [c - stride * .5 + stride * smooth(u), .08 + lift * Math.sin(Math.PI * u), lerp(-17, -40, Math.sin(Math.PI * u)) * DEG]; };
      const [lx, ly, lf] = foot(this.phase, lc), [rx, ry, rf] = foot(this.phase + .5, rc);
      const gp = runW > .01 ? blend(base, ps.run, runW, this.tmp) : copy(base, this.tmp);
      gp[1] = lerp(base[1], base[1] - .04, runW) - bob * (.5 - .5 * Math.cos(4 * Math.PI * this.phase));
      if (runW > 0) { const s = Math.sin(2 * Math.PI * this.phase); gp[5] = lerp(gp[5], (-70 - 45 * s) * DEG, runW); gp[6] = lerp(gp[6], (10 - 20 * s) * DEG, runW); gp[7] = lerp(gp[7], (-70 + 45 * s) * DEG, runW); gp[8] = lerp(gp[8], (10 + 20 * s) * DEG, runW); }
      setLegs(gp, lx, ly, lf, rx, ry, rf); blend(p, gp, w, p);
      const step = Math.floor(this.phase * 2); if (step !== this.lastStep) { this.lastStep = step; if (w > .5) this.emit('step', { run: runW > .5 }); }
    }
    // la suspensión baja la pelvis, pero los pies se quedan en el suelo: las rodillas se doblan
    this.groundLegs(p, this.suspY);
  }
  groundLegs(p, dy) {
    const L1 = .45, L2 = .44, ank = (th, sh) => [p[0] + Math.cos(th) * L1 + Math.cos(sh) * L2, p[1] + Math.sin(th) * L1 + Math.sin(sh) * L2];
    let [lx, ly] = ank(p[9], p[10]), [rx, ry] = ank(p[12], p[13]); p[1] += dy;
    ly = Math.max(.08, ly); ry = Math.max(.08, ry);
    setLegs(p, lx, ly, p[11], rx, ry, p[14]);
  }
}
