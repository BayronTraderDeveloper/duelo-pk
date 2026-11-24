// Fotografía del estado (para la red): lo que el anfitrión manda y el invitado aplica. Todo número se valida.
import { NP, P } from './skeleton.js';
import { NPOSE, measure } from './poses.js';
export const STATES = ['free', 'squat', 'attack', 'hit', 'block', 'dodge', 'down', 'getup', 'hold', 'held', 'win', 'lose'];
export const PHASES = ['intro', 'fight', 'ko', 'end'];
const ZONES = ['body', 'head', 'arm', 'leg'], DODGES = ['back', 'dash', 'sway'];
const r3 = v => Math.round(v * 1000) / 1000, r2 = v => Math.round(v * 100) / 100;
const HEAD = 22, LEN = HEAD + NP * 4;
export const FIGHTER_LEN = LEN;
export function packFighter(f) {
  const fl = (f.grounded ? 1 : 0) | (f.flip ? 2 : 0) | (f.ko ? 4 : 0) | (f.blockHeld ? 8 : 0) | (f.crouching ? 16 : 0) | (f.hitDone ? 32 : 0) | (f.runOn ? 64 : 0) | (f.lunged ? 128 : 0) | (f.dived ? 256 : 0) | (f.partner ? 512 : 0);
  const mv = f.move ? Object.keys(f.ch.moves).indexOf(f.move.id) : -1;
  const a = [r3(f.x), r3(f.y), r2(f.vx), r2(f.vy), f.f, STATES.indexOf(f.state), r3(f.st), mv, r3(f.mt), r2(f.hp), r2(f.bal), fl, r3(f.body.tone), r2(f.esc), r3(f.stun), ZONES.indexOf(f.zone), f.dodgeK ? DODGES.indexOf(f.dodgeK.k) : -1, f.jumps, r3(f.suspY), r3(f.invuln), r3(f.high), r3(f.landT)];
  const b = f.body; for (let i = 0; i < NP; i++) a.push(r3(b.x[i]), r3(b.y[i]), r2(b.vx[i]), r2(b.vy[i]));
  return a;
}
const ok = (a, i, lo, hi) => Number.isFinite(a[i]) && a[i] >= lo && a[i] <= hi;
export function validFighter(a) {
  if (!Array.isArray(a) || a.length !== LEN) return false;
  for (let i = 0; i < LEN; i++) if (!Number.isFinite(a[i]) || Math.abs(a[i]) > 1e4) return false;
  return ok(a, 0, -20, 20) && ok(a, 1, -5, 30) && (a[4] === 1 || a[4] === -1) && ok(a, 5, 0, STATES.length - 1) && ok(a, 9, 0, 100) && ok(a, 10, -200, 100);
}
// aplica una fotografía al luchador (estado completo)
export function applyFighter(f, a, other, light = false) {
  const mk = Object.keys(f.ch.moves), was = f.state;
  f.x = a[0]; f.y = a[1]; f.vx = a[2]; f.vy = a[3]; f.f = a[4]; f.state = STATES[a[5] | 0]; f.st = a[6]; f.move = a[7] >= 0 ? f.ch.moves[mk[a[7] | 0]] || null : null; f.mt = a[8];
  f.hp = a[9]; f.bal = a[10]; const fl = a[11] | 0; f.grounded = !!(fl & 1); f.flip = !!(fl & 2); f.ko = !!(fl & 4); f.blockHeld = !!(fl & 8); f.crouching = !!(fl & 16); f.hitDone = !!(fl & 32); f.runOn = !!(fl & 64); f.lunged = !!(fl & 128); f.dived = !!(fl & 256);
  f.partner = fl & 512 ? other : null; f.body.tone = a[12]; f.esc = a[13]; f.stun = a[14]; f.zone = ZONES[a[15]] || 'body';
  f.dodgeK = a[16] >= 0 ? { k: DODGES[a[16]], t: { back: .32, dash: .26, sway: .36 }[DODGES[a[16]]] } : null; f.jumps = a[17]; f.suspY = a[18]; f.invuln = a[19]; f.high = a[20]; f.landT = a[21];
  if (!f.move && f.state === 'attack') f.state = 'free';
  setBody(f, a, 1); if (light) return;
  if (f.state === 'down' && (was !== 'down' || !f.kpose)) { f.kpose = measure(f.body, f.body.x[P.pelvis], 0, f.f, new Float64Array(NPOSE)); f.kpose[0] = 0; }
  if (f.state === 'getup' && (was !== 'getup' || !f.keys)) { const st = f.st; f.getUp(); f.st = st; f.match.ev.pop(); }
}
export function setBody(f, a, k = 1) {
  const b = f.body;
  for (let i = 0; i < NP; i++) { const o = HEAD + i * 4; b.x[i] += (a[o] - b.x[i]) * k; b.y[i] += (a[o + 1] - b.y[i]) * k; b.vx[i] = a[o + 2]; b.vy[i] = a[o + 3]; }
}
// mezcla de dos fotografías (para dibujar al rival entre muestras)
export function lerpFighter(a, b, u) { const o = a.slice(); for (const i of [0, 1, 18]) o[i] = a[i] + (b[i] - a[i]) * u; for (let i = HEAD; i < LEN; i += 4) { o[i] = a[i] + (b[i] - a[i]) * u; o[i + 1] = a[i + 1] + (b[i + 1] - a[i + 1]) * u; } return o; }
export function packMatch(m) { return [m.tick, PHASES.indexOf(m.phase), r2(m.timer), m.round, m.wins[0], m.wins[1], r3(m.pt), r3(m.freeze), r3(m.slow), m.combo[0], m.combo[1], m.winner, m.roundWinner]; }
export function applyMatch(m, a) {
  if (!Array.isArray(a) || a.length !== 13 || !a.every(Number.isFinite)) return false;
  m.phase = PHASES[a[1]] || 'fight'; m.timer = Math.max(0, Math.min(99, a[2])); m.round = a[3] | 0; m.wins = [a[4] | 0, a[5] | 0]; m.pt = a[6]; m.slow = a[8]; m.combo = [a[9] | 0, a[10] | 0]; m.winner = a[11] | 0; m.roundWinner = a[12] | 0; return true;
}
