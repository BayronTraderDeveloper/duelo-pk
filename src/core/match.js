// Combate completo a paso fijo (120 Hz): dos luchadores, rondas, tiempo, KO, pausas de impacto y cámara lenta.
// Sin gráficos ni red: lo usan igual la partida local, el anfitrión online y las pruebas.
import { Fighter, HALF } from './fighter.js';
import { checkHit, grabUpdate, grabConstraint, collide } from './combat.js';
import { character, cleanLook } from './characters.js';
import { NONE } from './input.js';
export const TICK = 1 / 120, ROUND_TIME = 60, WINS = 2;
export const WORLD = { ground: 0, left: -HALF - .3, right: HALF + .3 };
export class Match {
  constructor(cfg = {}) {
    this.cfg = cfg; this.ev = []; this.time = 0; this.tick = 0; this.freeze = 0; this.slow = 0; this.combo = [0, 0]; this.auth = cfg.auth !== false; this.remote = [false, false];
    const ids = cfg.chars || ['riko', 'torvo'];
    this.f = ids.map((id, i) => { const ch = character(id); return new Fighter(i, ch, cleanLook(cfg.looks?.[i], ch.look), this); });
    this.names = (cfg.names || ['Jugador 1', 'Jugador 2']).map(String);
    this.wins = [0, 0]; this.round = 0; this.winner = -1; this.training = !!cfg.training; this.newRound();
  }
  newRound() {
    this.round++; this.timer = ROUND_TIME; this.phase = 'intro'; this.pt = 0; this.roundWinner = -1; this.slow = 0; this.freeze = 0; this.combo = [0, 0];
    this.f[0].reset(-1.8, 1); this.f[1].reset(1.8, -1); this.ev.push({ t: 'round', n: this.round });
  }
  rematch() { this.wins = [0, 0]; this.round = 0; this.winner = -1; this.newRound(); this.ev.push({ t: 'rematch' }); }
  drain() { const e = this.ev; this.ev = []; return e; }
  step(inA = NONE, inB = NONE) {
    this.tick++;
    if (this.freeze > 0) { this.freeze -= TICK; return; }   // pausa de impacto (hitstop)
    const dt = TICK * (this.slow > 0 ? .35 : 1); if (this.slow > 0) this.slow -= TICK;
    this.time += dt; this.pt += dt;
    const live = this.phase === 'fight', [a, b] = this.f, ins = [live ? inA : NONE, live ? inB : NONE];
    for (let i = 0; i < 2; i++) if (!this.remote[i]) this.f[i].update(dt, ins[i], this.f[1 - i]);
    if (this.auth) for (const x of this.f) grabUpdate(x, dt, this);
    for (let i = 0; i < 2; i++) if (!this.remote[i]) this.f[i].body.step(dt, WORLD);
    if (this.auth) { checkHit(a, b, this); checkHit(b, a, this); }
    collide(a, b); for (const x of this.f) grabConstraint(x);
    this.rules(dt);
  }
  rules(dt) {
    if (!this.auth) return;
    const [a, b] = this.f;
    if (this.phase === 'intro') { if (this.pt > 1.7) { this.phase = 'fight'; this.pt = 0; this.ev.push({ t: 'fight' }); } return; }
    if (this.phase === 'fight') {
      if (!this.training) this.timer = Math.max(0, this.timer - dt);
      if (this.training) { for (const x of this.f) if (x.hp <= 0 && x.state !== 'down') { x.hp = 100; x.ko = false; } return; }
      const ka = a.hp <= 0, kb = b.hp <= 0;
      if (ka || kb || this.timer <= 0) {
        const w = ka && kb ? -1 : ka ? 1 : kb ? 0 : a.hp === b.hp ? -1 : a.hp > b.hp ? 0 : 1;
        this.roundWinner = w; if (w >= 0) this.wins[w]++; this.phase = 'ko'; this.pt = 0; this.slow = ka || kb ? 1.1 : 0; this.ev.push({ t: ka || kb ? 'ko' : 'time', winner: w });
      }
      return;
    }
    if (this.phase === 'ko') {
      const w = this.roundWinner;
      if (this.pt > 1.4 && w >= 0 && this.f[w].state === 'free' && this.f[w].grounded) { this.f[w].set('win'); const l = this.f[1 - w]; if (!l.down && l.state !== 'lose') l.set('lose'); }
      if (this.pt > 3.6) {
        const best = Math.max(...this.wins);
        if (best >= WINS || this.round >= 5) { this.phase = 'end'; this.pt = 0; this.winner = this.wins[0] === this.wins[1] ? -1 : this.wins[0] > this.wins[1] ? 0 : 1; this.ev.push({ t: 'end', winner: this.winner }); }
        else this.newRound();
      }
    }
  }
}
