// Partida online de 2. El ANFITRIÓN (quien crea la sala) hace de servidor: simula el combate completo con las
// entradas del invitado y decide golpes, daño, agarres, rondas y resultado. El INVITADO predice su propio
// luchador al instante (sin esperar a la red), corrige poco a poco contra lo que dice el anfitrión y ve al rival
// interpolado entre fotografías. Nada que llegue por la red se acepta sin validar.
import { openTransport } from './transport.js';
import { Match } from '../core/match.js';
import { CHAR_IDS, cleanLook, character } from '../core/characters.js';
import { packFighter, packMatch, applyFighter, applyMatch, validFighter, lerpFighter, setBody, STATES } from '../core/snap.js';
import { clean } from '../core/input.js';
export const SNAP_EVERY = 4, INPUT_EVERY = 2;      // 30 fotografías/s; 60 envíos de entrada/s
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', rid = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => ABC[b % ABC.length]).join('');
export const newCode = () => rid(5), cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
export const cleanName = s => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Luchador';
const AUTH = new Set(['hit', 'block', 'down', 'getup', 'held', 'hold', 'win', 'lose']);
const OWN = new Set(['whoosh', 'step', 'jump', 'land']);
const SENT = new Set(['hit', 'block', 'grab', 'throw', 'slam', 'break', 'guardbreak', 'down', 'getup', 'round', 'fight', 'ko', 'time', 'end', 'rematch', 'shove', 'whoosh', 'step', 'jump', 'land']);
export class Online {
  constructor(role, code, me, cb = {}, open = openTransport) {
    this.role = role; this.code = cleanCode(code); this.cb = cb; this.open = open; this.host = role === 'host';
    this.me = { id: rid(10), name: cleanName(me.name), char: CHAR_IDS.includes(me.char) ? me.char : 'riko', look: me.look };
    this.peer = null; this.match = null; this.lastMsg = 0; this.rtt = null; this.out = []; this.again = [false, false];
    this.gHeld = 0; this.gHit = 0; this.seq = -1; this.tick = 0; this.hist = new Array(256); this.buf = []; this.off = null; this.corr = { x: 0, y: 0 }; this.hitAcc = 0; this.snapRound = 0; this.closed = false;
  }
  get idx() { return this.host ? 0 : 1; }
  async start(now = performance.now()) {
    this.lastMsg = now; this.tr = await this.open(this.code, { id: this.me.id, name: this.me.name }, { message: m => this.message(m), peers: l => this.peers(l), state: ok => this.cb.state?.(ok) });
    this.pingT = setInterval(() => this.send('ping', { t: Math.round(performance.now()) }), 1000); this.pingT.unref?.(); return this;
  }
  send(k, d = {}) { if (!this.closed) this.tr?.send({ k, f: this.me.id, ...(this.peer ? { to: this.peer.id } : {}), ...d }); }
  peers(list) {
    const others = list.filter(p => p && typeof p.id === 'string' && p.id !== this.me.id && p.id.length <= 24);
    if (this.peer && !others.some(p => p.id === this.peer.id)) { this.lose('Tu rival se desconectó'); return; }
    if (!this.peer && others.length) this.send('hi', { name: this.me.name, char: this.me.char, look: this.me.look, role: this.role });
  }
  lose(why) { if (this.lost) return; this.lost = why; this.cb.lost?.(why); }
  message(m, now = performance.now()) {
    if (this.closed || !m || typeof m !== 'object' || typeof m.f !== 'string' || m.f === this.me.id || m.f.length > 24) return;
    if (m.to && m.to !== this.me.id) return;
    if (m.k === 'hi') return this.hello(m);
    if (!this.peer || m.f !== this.peer.id) return;
    this.lastMsg = now;
    if (m.k === 'ping') return this.send('pong', { t: m.t });
    if (m.k === 'pong') { const r = performance.now() - m.t; if (Number.isFinite(r) && r >= 0 && r < 10000) this.rtt = this.rtt === null ? r : this.rtt * .7 + r * .3; return; }
    if (m.k === 'bye') return this.lose('Tu rival salió de la sala');
    if (m.k === 'again') { this.again[this.host ? 1 : 0] = true; this.cb.again?.(this.again); return this.tryAgain(); }
    if (this.host && m.k === 'in') return this.input(m);
    if (!this.host && m.k === 'cfg') return this.config(m);
    if (!this.host && m.k === 'sn') return this.snap(m, now);
  }
  hello(m) {
    if (this.peer) { if (m.f !== this.peer.id && this.host) this.tr?.send({ k: 'full', f: this.me.id, to: m.f }); return; }
    if (m.role === this.role) return;     // dos anfitriones o dos invitados: no es mi pareja
    this.lastMsg = performance.now();
    this.peer = { id: m.f, name: cleanName(m.name), char: CHAR_IDS.includes(m.char) ? m.char : 'riko', look: m.look };
    this.send('hi', { name: this.me.name, char: this.me.char, look: this.me.look, role: this.role });
    if (this.host) { const cfg = this.cfg(); this.match = new Match(cfg); this.send('cfg', cfg); this.cb.start?.(this.match, this.peer); }
    this.cb.peer?.(this.peer);
  }
  cfg() {
    const c = [this.me.char, this.peer.char], looks = [cleanLook(this.me.look, character(c[0]).look), cleanLook(this.peer.look, character(c[1]).look)];
    if (looks[0].color === looks[1].color) looks[1].color = looks[0].color === '#3fa7e0' ? '#e5482d' : '#3fa7e0';   // que no se confundan
    return { chars: c, looks, names: [this.me.name, this.peer.name === this.me.name ? this.peer.name + ' 2' : this.peer.name] };
  }
  config(m) {
    if (this.match || !Array.isArray(m.chars) || m.chars.length !== 2) return;
    const chars = m.chars.map(c => CHAR_IDS.includes(c) ? c : 'riko'), looks = (Array.isArray(m.looks) ? m.looks : []).slice(0, 2).map((l, i) => cleanLook(l, character(chars[i]).look)), names = (Array.isArray(m.names) ? m.names : []).slice(0, 2).map(cleanName);
    this.match = new Match({ chars, looks, names, auth: false }); this.match.remote[0] = true; this.cb.start?.(this.match, this.peer);
  }
  // ── anfitrión ──
  input(m) { const s = m.s; if (!Number.isInteger(s) || s < 0 || s <= this.seq) return; this.seq = s; this.gHeld = clean(m.b); this.gHit |= clean(m.h); }
  // ── invitado ──
  snap(m, now) {
    const M = this.match; if (!M || !Number.isInteger(m.t) || !Array.isArray(m.F) || m.F.length !== 2 || !m.F.every(validFighter) || !applyMatchSafe(M, m.M)) return;
    const s = m.t - this.tick; this.off = this.off === null || s > this.off || Math.abs(s - this.off) > 60 ? s : this.off + (s - this.off) * .05;
    if (this.buf.length && m.t <= this.buf.at(-1).t) return; this.buf.push({ t: m.t, a: m.F[0] }); if (this.buf.length > 30) this.buf.shift();
    if (Array.isArray(m.E)) for (const e of m.E.slice(0, 40)) if (e && typeof e.t === 'string' && SENT.has(e.t) && !(OWN.has(e.t) && e.who === 1)) this.out.push(sanitizeEv(e));
    if (Number.isFinite(m.M[7]) && m.M[7] > M.freeze) M.freeze = Math.min(.2, m.M[7]);
    // mi luchador: el anfitrión manda en lo que decide él (golpes, derribos, agarres, rondas)
    const me = M.f[1], h = m.F[1], hs = STATES[h[5]], newRound = M.round !== this.snapRound; this.snapRound = M.round;
    if (newRound || AUTH.has(hs) || AUTH.has(me.state)) { applyFighter(me, h, M.f[0]); this.corr.x = this.corr.y = 0; }
    else {
      me.hp = h[9]; me.bal = h[10]; me.ko = !!(h[11] & 4);
      const past = Number.isInteger(m.a) ? this.hist[m.a & 255] : null;
      if (past && past.s === m.a) { const ex = h[0] - past.x, ey = h[1] - past.y; if (Math.hypot(ex, ey) > 1.2) { applyFighter(me, h, M.f[0]); this.corr.x = this.corr.y = 0; } else { this.corr.x = ex; this.corr.y = ey; } }
    }
  }
  remote() {
    const M = this.match, B = this.buf; if (!B.length || this.off === null) return;
    const t = this.tick + this.off - SNAP_EVERY * 1.6; while (B.length > 2 && B[1].t <= t) B.shift();
    const A = B[0], N = B[1], f = M.f[0], b = f.body; b.px.set(b.x); b.py.set(b.y);
    const st = !N || t <= A.t ? A.a : lerpFighter(A.a, N.a, Math.min(1, (t - A.t) / (N.t - A.t)));
    applyFighter(f, st, M.f[1], true); setBody(f, st, 1);
  }
  // un paso de 120 Hz; inp = entrada local {held, hit}
  step(inp) {
    const M = this.match; if (!M || this.lost) return;
    this.tick++;
    if (this.host) {
      const g = { held: this.gHeld, hit: this.gHit }; this.gHit = 0; M.step(inp, g);
      this.out.push(...M.ev);
      if (this.tick % SNAP_EVERY === 0) { const E = this.pending || []; this.pending = []; this.send('sn', { t: this.tick, a: this.seq, F: [packFighter(M.f[0]), packFighter(M.f[1])], M: packMatch(M), E }); }
      this.pending = (this.pending || []).concat(M.ev.filter(e => SENT.has(e.t)).map(sanitizeEv));
    } else {
      this.remote(); this.hitAcc |= inp.hit;
      const me = M.f[1];
      if (this.corr.x || this.corr.y) { const k = .12, dx = this.corr.x * k, dy = this.corr.y * k; me.x += dx; me.y = Math.max(0, me.y + dy); for (let i = 0; i < 14; i++) { me.body.x[i] += dx; me.body.y[i] += dy; } this.corr.x -= dx; this.corr.y -= dy; if (Math.abs(this.corr.x) < 1e-3 && Math.abs(this.corr.y) < 1e-3) this.corr.x = this.corr.y = 0; }
      M.step({ held: 0, hit: 0 }, inp);
      for (const e of M.ev) if (OWN.has(e.t) && e.who === 1) this.out.push(e);
      this.hist[this.tick & 255] = { s: this.tick, x: me.x, y: me.y };
      if (this.tick % INPUT_EVERY === 0) { this.send('in', { s: this.tick, b: inp.held, h: this.hitAcc }); this.hitAcc = 0; }
    }
    M.ev.length = 0;
  }
  drain() { const e = this.out; this.out = []; return e; }
  check(now = performance.now()) { if (this.peer && !this.lost && now - this.lastMsg > 4500) this.lose('Se perdió la conexión con tu rival'); }
  rematch() { this.again[this.idx] = true; this.send('again'); this.cb.again?.(this.again); this.tryAgain(); }
  tryAgain() { if (this.again[0] && this.again[1] && this.match) { this.again = [false, false]; if (this.host) this.match.rematch(); this.cb.again?.(this.again); } }
  leave() { if (this.closed) return; this.send('bye'); this.closed = true; clearInterval(this.pingT); setTimeout(() => this.tr?.close(), 60); }
}
function applyMatchSafe(M, a) { return applyMatch(M, a); }
function sanitizeEv(e) {
  const o = { t: e.t }; for (const k of ['who', 'vic', 'n', 'winner', 'combo']) if (Number.isInteger(e[k]) && Math.abs(e[k]) < 1000) o[k] = e[k];
  for (const k of ['x', 'y', 'dmg', 'sf', 'w', 'v']) if (Number.isFinite(e[k]) && Math.abs(e[k]) < 1000) o[k] = Math.round(e[k] * 1000) / 1000;
  for (const k of ['zone', 'm']) if (typeof e[k] === 'string' && e[k].length < 16) o[k] = e[k];
  for (const k of ['heavy', 'counter', 'up', 'run']) if (e[k] === true) o[k] = true;
  return o;
}
