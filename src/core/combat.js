// Detección de impactos (extremidad real contra huesos reales), daño, retroceso, reacciones, agarres y choques
// entre los dos cuerpos. Solo la autoridad (anfitrión o partida local) decide golpes y daño.
import { P, BONES, ZONE, RAD, clamp, lerp, segSeg, segPoint } from './skeleton.js';
const NEAR = { head: [P.head, P.neck, P.chest], body: [P.chest, P.pelvis, P.neck, P.head], arm: [], leg: [] };
const ZMUL = { head: 1.25, body: 1, arm: .6, leg: .85 }, ZBAL = { head: 1.15, body: 1, arm: .6, leg: 1.9 };
// ¿toca la extremidad que golpea a algún hueso del rival? (barrido entre el paso anterior y este: no atraviesa)
export function contact(att, vic, limb, r) {
  const a = att.body, v = vic.body; let best = null;
  for (let i = 0; i < BONES.length; i++) {
    const bn = BONES[i], res = segSeg(a.px[limb], a.py[limb], a.x[limb], a.y[limb], v.x[bn.a], v.y[bn.a], v.x[bn.b], v.y[bn.b]), gap = res.d - r - (i === 2 ? RAD[P.head] : bn.r);
    if (gap < 0 && (!best || gap < best.gap)) best = { gap, bone: i, u: res.u, x: res.cx, y: res.cy };
  }
  return best;
}
export function checkHit(att, vic, m) {
  if (att.state !== 'attack' || att.hitDone || !att.move || att.move.limb < 0) return null;
  const mv = att.move; if (att.mt < mv.act[0] || att.mt > mv.act[1]) return null;
  if (vic.ko || vic.invuln > 0 || vic.state === 'held' && vic.partner !== att) return null;
  if (mv.height === 'high' && vic.high > 0) return null;
  const c = contact(att, vic, mv.limb, mv.r); if (!c) return null;
  const bn = BONES[c.bone], zone = ZONE[bn.name];
  if (mv.grab) { if ((zone === 'body' || zone === 'head') && !vic.down && vic.state !== 'getup' && vic.y < .4 && att.grounded) return grab(att, vic, m); return null; }
  const a = att.body, v = vic.body, s = mv.limb;
  const pvx = lerp(v.vx[bn.a], v.vx[bn.b], c.u), pvy = lerp(v.vy[bn.a], v.vy[bn.b], c.u);
  let rx = a.vx[s] - pvx, ry = a.vy[s] - pvy; const speed = Math.hypot(rx, ry);
  if (speed < mv.minSpeed) return null;            // tocar sin fuerza no hace daño
  rx /= speed; ry /= speed;
  const sf = clamp(speed / mv.refSpeed, .55, 1.35);
  const blocked = vic.canBlock(att.x) && (mv.height !== 'low' || vic.crouching);
  const counter = vic.attacking ? 1.2 : 1, downK = vic.down ? .5 : 1;
  let dmg = mv.dmg * att.ch.dmgK * sf * ZMUL[zone] * counter * downK; if (blocked) dmg *= .15;
  dmg = Math.round(dmg * 10) / 10; att.hitDone = true;
  const was = vic.state, inCombo = was === 'hit' || (was === 'down' && !vic.grounded);
  m.combo[att.idx] = inCombo ? m.combo[att.idx] + 1 : 1;
  vic.hp = Math.max(0, Math.round((vic.hp - dmg) * 10) / 10);
  const ev = { t: blocked ? 'block' : 'hit', who: att.idx, vic: vic.idx, x: c.x, y: c.y, dmg, zone, m: mv.id, sf: Math.round(sf * 100) / 100, combo: m.combo[att.idx], counter: counter > 1 && !blocked, heavy: mv.dmg >= 11 };
  m.ev.push(ev); m.freeze = Math.max(m.freeze, blocked ? .05 : mv.hitstop * (.7 + .3 * sf));
  react(att, vic, mv, { rx, ry, sf, zone, bone: c.bone, u: c.u, blocked }, m);
  return ev;
}
function react(att, vic, mv, h, m) {
  const v = vic.body, bn = BONES[h.bone], kb = vic.ch.kbK, f = att.f;
  if (vic.state === 'held' && vic.partner) vic.partner.release(); if (vic.state === 'hold') vic.release();
  att.vx -= f * (h.blocked ? 1.2 : .4);
  if (h.blocked) {
    v.kick(bn.a, h.rx * 1.5, h.ry * 1.5); v.kick(bn.b, h.rx * 1.5, h.ry * 1.5);
    vic.set('block'); vic.stun = .14 + mv.stun * .35; vic.vx = f * mv.push * .6 * kb; vic.bal -= mv.bal * .35 * vic.ch.balK; vic.balT = 0;
    if (vic.bal <= 0) { vic.set('hit'); vic.stun = .65; vic.zone = 'body'; vic.bal = 30; m.ev.push({ t: 'guardbreak', who: vic.idx }); }
    return;
  }
  // impulso local: la zona golpeada se desplaza y pierde tono un momento (el cuello absorbe, el torso gira...)
  const L = mv.local * h.sf; v.kick(bn.a, h.rx * L * (1 - h.u * .5), h.ry * L * (1 - h.u * .5)); v.kick(bn.b, h.rx * L * (.5 + h.u * .5), h.ry * L * (.5 + h.u * .5));
  NEAR[h.zone].forEach((i, k) => k && v.kick(i, h.rx * L * .35 / k, h.ry * L * .35 / k));
  if (h.zone === 'head') v.dip([P.head, P.neck], .12); else if (h.zone === 'body') v.dip([P.chest, P.pelvis, P.neck, P.head], .3); else if (h.zone === 'leg') v.dip([bn.a, bn.b, P.kneeL, P.kneeR, P.ankleL, P.ankleR], .08); else v.dip([bn.a, bn.b], .2);
  vic.vx = clamp(vic.vx * .3 + f * mv.push * h.sf * kb, -12, 12);
  if (mv.lift) { vic.vy = mv.lift * h.sf * kb; if (vic.vy > 1.5) vic.grounded = false; }
  vic.zone = h.zone; vic.bal -= mv.bal * h.sf * ZBAL[h.zone] * vic.ch.balK; vic.balT = 0;
  const knock = vic.hp <= 0 || vic.bal <= 0 || (mv.knock && h.sf > .85 && h.zone !== 'arm') || (!vic.grounded && (mv.knockAir || mv.dmg >= 8)) || vic.down;
  if (vic.hp <= 0) vic.ko = true;
  if (knock) {
    const up = Math.max(mv.lift * h.sf * kb, vic.hp <= 0 ? 2.5 : 1.2);
    vic.knockDown(f * mv.push * h.sf * kb * .9, up);
    if (h.zone === 'leg') { for (const i of [P.kneeL, P.kneeR, P.ankleL, P.ankleR, P.toeL, P.toeR]) v.kick(i, f * 3.5, 1.2); v.kick(P.head, -f * 1.5, 0); v.kick(P.chest, -f * 1.2, 0); }
  } else { vic.set('hit'); vic.stun = mv.stun * (vic.grounded ? 1 : 1.3); vic.move = null; vic.flip = false; }
}
// ── Agarres: restricción física temporal entre las manos del que agarra y el torso del agarrado ──
function grab(att, vic, m) {
  att.hitDone = true; if (vic.state === 'held' || vic.state === 'hold') return null;
  att.set('hold'); att.move = null; att.partner = vic; vic.set('held'); vic.partner = att; vic.esc = 0; vic.move = null; vic.flip = false; vic.f = -att.f; vic.vx = 0;
  const ev = { t: 'grab', who: att.idx, vic: vic.idx, x: vic.body.x[P.chest], y: vic.body.y[P.chest] }; m.ev.push(ev); return ev;
}
export function grabUpdate(a, dt, m) {
  const v = a.partner; if (!v || v.state !== 'held' || v.partner !== a) return;
  const throwing = a.state === 'attack' && (a.move?.id === 'throw' || a.move?.id === 'slam');
  if (a.state !== 'hold' && !throwing) { a.partner = null; v.partner = null; if (v.state === 'held') { v.set('hit'); v.stun = .2; } return; }
  v.x += (a.x + a.f * .64 - v.x) * Math.min(1, dt * 14); v.vx = a.vx; v.y = 0; v.vy = 0; v.grounded = true; v.f = -a.f;
  if (!throwing) {
    // fuerza opuesta: el agarrado se resiste pulsando; el que agarra aprieta con su botón de agarre
    if (v.pressed) v.esc += 13 * v.ch.grip / a.ch.grip; v.esc += 7 * dt;
    if (v.esc >= 100) { a.partner = null; v.partner = null; a.set('hit'); a.stun = .28; a.zone = 'body'; v.set('hit'); v.stun = .12; a.vx = -a.f * 2.6; v.vx = a.f * 2.6; m.ev.push({ t: 'break', who: v.idx }); }
    return;
  }
  const mv = a.move; v.body.tone = Math.min(v.body.tone, .3);
  if (a.mt >= mv.release) {
    a.partner = null; v.partner = null; const d = Math.round(mv.dmg * a.ch.dmgK * 10) / 10; v.hp = Math.max(0, Math.round((v.hp - d) * 10) / 10); if (v.hp <= 0) v.ko = true;
    if (mv.id === 'throw') v.knockDown(a.f * 6.4 * v.ch.kbK, 5.2); else v.knockDown(a.f * 1.6, -6.5);
    m.combo[a.idx] = 1; m.ev.push({ t: mv.id, who: a.idx, vic: v.idx, x: v.body.x[P.chest], y: v.body.y[P.chest], dmg: d, heavy: true }); m.freeze = Math.max(m.freeze, .08);
  }
}
export function grabConstraint(a) {
  const v = a.partner; if (!v || v.state !== 'held') return;
  const A = a.body, V = v.body, pin = (i, j, rest) => { const dx = V.x[j] - A.x[i], dy = V.y[j] - A.y[i], d = Math.hypot(dx, dy) || 1e-6; if (d <= rest) return; const e = (d - rest) / d, wa = A.inv[i] / (A.inv[i] + V.inv[j] * .25); A.x[i] += dx * e * wa; A.y[i] += dy * e * wa; V.x[j] -= dx * e * (1 - wa); V.y[j] -= dy * e * (1 - wa); };
  for (let k = 0; k < 3; k++) { pin(P.handL, P.chest, .14); pin(P.handR, P.neck, .1); }
}
// ── Choques entre los dos luchadores ──
export function collide(a, b) {
  if (!a.down && !b.down && a.state !== 'held' && b.state !== 'held') {
    const dx = b.x - a.x, over = Math.abs(a.y - b.y) < 1.05, mn = .64;
    if (over && Math.abs(dx) < mn) { const s = dx === 0 ? -a.f : Math.sign(dx), push = (mn - Math.abs(dx)) / 2; a.x -= s * push; b.x += s * push; const rv = (b.vx - a.vx) * s; if (rv < 0) { a.vx += rv * s * .5; b.vx -= rv * s * .5; } }
  }
  // partículas contra los huesos grandes del otro (torso, cabeza): el puño no atraviesa el cuerpo
  for (const [x, y] of [[a, b], [b, a]]) {
    const X = x.body, Y = y.body, k = x.down || y.down ? .6 : .35;
    for (let i = 0; i < 14; i++) for (const bi of [0, 2]) {
      const bn = BONES[bi], r = segPoint(X.x[i], X.y[i], Y.x[bn.a], Y.y[bn.a], Y.x[bn.b], Y.y[bn.b]), mn = RAD[i] + (bi === 2 ? RAD[P.head] : bn.r) * .9;
      if (r.d < mn && r.d > 1e-5) { const e = (mn - r.d) / r.d * k, nx = (X.x[i] - r.cx) * e, ny = (X.y[i] - r.cy) * e, wi = X.inv[i] / (X.inv[i] + Y.inv[bn.a]); X.x[i] += nx * wi; X.y[i] += ny * wi; Y.x[bn.a] -= nx * (1 - wi) * (1 - r.u); Y.y[bn.a] -= ny * (1 - wi) * (1 - r.u); Y.x[bn.b] -= nx * (1 - wi) * r.u; Y.y[bn.b] -= ny * (1 - wi) * r.u; }
    }
  }
}
