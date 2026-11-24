// DUELO PK: arranque y bucle principal. La física va a paso fijo de 120 Hz, separada del dibujo (que interpola).
import { Match, TICK } from './core/match.js';
import { character } from './core/characters.js';
import { NONE } from './core/input.js';
import { View } from './view/render.js';
import { Hud } from './ui/hud.js';
import { Menu } from './ui/menu.js';
import { Keys } from './ui/keys.js';
import { Sound } from './audio/sound.js';
import { Online, newCode, cleanCode, cleanName } from './net/session.js';
import * as lobby from './net/lobby.js';
const $ = s => document.querySelector(s);
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };
class App {
  constructor() {
    this.view = new View($('#view')); this.hud = new Hud($('#hud'), this.view); this.keys = new Keys(); this.sound = new Sound(); this.sound.setVolume(store.get('duelo.vol', .7));
    this.name = store.get('duelo.name', 'Luchador');
    this.sel = store.get('duelo.sel', null) || [{ char: 'riko', look: { ...character('riko').look } }, { char: 'torvo', look: { ...character('torvo').look } }];
    this.menu = new Menu($('#ui'), this); this.mode = 'menu'; this.match = null; this.net = null; this.paused = false; this.acc = 0; this.last = performance.now();
    this.preview(); this.menu.show('home');
    const q = new URLSearchParams(location.search).get('sala'); if (q) this.menu.show('select', { mode: 'join', code: cleanCode(q) });
    addEventListener('keydown', e => this.key(e));
    requestAnimationFrame(t => this.frame(t)); $('#load').classList.add('off');
    // si la pestaña queda en segundo plano el navegador frena el dibujo: la simulación sigue (sobre todo el anfitrión)
    setInterval(() => { const n = performance.now(); if (n - this.last > 150) this.frame(n, true); }, 50);
    window.__duelo = this;   // para depurar desde la consola
  }
  pick(p, id) { this.sel[p] = { char: id, look: { ...character(id).look } }; this.fixColors(p); this.preview(); }
  fixColors(p) { const o = this.sel[1 - p]; if (o.look.color === this.sel[p].look.color && o.char === this.sel[p].char) o.look.color = this.sel[p].look.color === '#3fa7e0' ? '#e5482d' : '#3fa7e0'; store.set('duelo.sel', this.sel); }
  setName(n) { this.name = cleanName(n); store.set('duelo.name', this.name); }
  setVolume(v) { this.sound.setVolume(v); store.set('duelo.vol', v); }
  // fondo del menú: los dos luchadores elegidos, quietos frente a frente
  preview() { if (this.mode !== 'menu') return; this.match = new Match({ chars: this.sel.map(s => s.char), looks: this.sel.map(s => s.look), training: true }); this.view.setFighters(this.match.f); }
  go(mode, code) {
    store.set('duelo.sel', this.sel);
    if (mode === 'local' || mode === 'train') return this.startLocal(mode);
    if (mode === 'create') return this.online('host', newCode(), false);
    if (mode === 'join') { const c = cleanCode(code); if (c.length < 4) return; return this.online('guest', c, false); }
    if (mode === 'quick') return this.quick();
  }
  startLocal(mode) {
    this.leaveNet(); this.mode = mode; this.paused = false;
    this.match = new Match({ chars: this.sel.map(s => s.char), looks: this.sel.map(s => s.look), names: mode === 'train' ? ['Tú', 'Saco de práctica'] : ['Jugador 1', 'Jugador 2'], training: mode === 'train' });
    this.view.setFighters(this.match.f); this.menu.hide(); this.hud.show(this.match, null); this.keys.active = true; this.keys.clear();
  }
  async online(role, code, pub) {
    this.leaveNet(); const link = `${location.origin}${location.pathname}?sala=${code}`;
    this.menu.show('lobby', { code: role === 'host' ? code : '', link, status: role === 'host' ? 'Esperando a tu rival… pásale el código o el enlace.' : `Buscando la sala ${code}…` });
    const net = new Online(role, code, { name: this.name, char: this.sel[0].char, look: this.sel[0].look }, {
      start: (m, peer) => { if (this.net !== net) return; this.mode = 'online'; this.match = m; this.paused = false; this.view.setFighters(m.f); this.menu.hide(); this.hud.show(m, net); this.keys.active = true; this.keys.clear(); if (this.pubT) { clearInterval(this.pubT); this.pubT = null; lobby.close(code); } },
      lost: why => { if (this.net !== net) return; this.menu.show('lost', { why }); this.keys.active = false; },
      again: a => { if (this.match?.phase === 'end' && this.menu.view === 'end') this.showEnd(); },
    });
    this.net = net;
    try { await net.start(); } catch (e) { if (this.net === net) this.menu.show('lobby', { error: 'No se pudo conectar: ' + (e?.message || e) }); return; }
    if (pub) { const a = () => lobby.announce(code, this.name, this.sel[0].char).catch(() => { }); a(); this.pubT = setInterval(a, 30000); }
    if (role === 'guest') this.findT = setTimeout(() => { if (this.net === net && !net.peer) this.menu.show('lobby', { error: `No encontramos la sala ${code}. Revisa el código o pide uno nuevo.` }); }, 15000);
  }
  async quick() {
    this.menu.show('lobby', { status: 'Buscando salas abiertas…' });
    let r = null; try { r = await lobby.findRoom(); } catch { }
    if (this.menu.view !== 'lobby') return;
    if (r) this.online('guest', r.code, false); else this.online('host', newCode(), true);
  }
  leaveNet() { if (this.net) { this.net.leave(); this.net = null; } if (this.pubT) { clearInterval(this.pubT); this.pubT = null; } clearTimeout(this.findT); }
  resume() { this.paused = false; this.menu.hide(); this.keys.active = true; this.keys.clear(); }
  restart() { if (this.mode === 'local' || this.mode === 'train') this.startLocal(this.mode); }
  quit() { this.leaveNet(); this.mode = 'menu'; this.paused = false; this.hud.hide(); this.keys.active = false; this.preview(); this.menu.show('home'); }
  again() { if (this.mode === 'online') { this.net?.rematch(); this.showEnd(); } else { this.match.rematch(); this.menu.hide(); } }
  key(e) {
    if (this.keys.capture) return;
    if (e.code === 'Escape' && this.mode !== 'menu') { if (this.menu.view === 'pause' || this.menu.view === 'config') this.resume(); else if (!this.menu.view) { this.paused = this.mode !== 'online'; this.keys.active = false; this.menu.show('pause', { online: this.mode === 'online' }); } }
    if (e.code === 'Enter' && this.menu.view === 'end') this.again();
  }
  showEnd() {
    const m = this.match, w = m.winner, on = this.mode === 'online', me = on ? this.net.idx : 0;
    const title = w < 0 ? 'EMPATE' : on ? (w === me ? 'VICTORIA' : 'DERROTA') : `GANA ${m.names[w].toUpperCase()}`;
    const sub = `${m.names[0]} ${m.wins[0]} – ${m.wins[1]} ${m.names[1]}` + (w >= 0 ? ` · ${m.f[w].ch.name}` : '');
    this.menu.show('end', { title, sub, online: on, waiting: on && this.net.again[me] });
  }
  frame(now, bg = false) {
    const dt = Math.min(bg ? .25 : .1, (now - this.last) / 1000); this.last = now;
    if (!this.paused) {
      this.acc += dt;
      while (this.acc >= TICK) { this.tick(); this.acc -= TICK; }
    }
    this.net?.check(now);
    if (bg) return;
    this.view.draw(this.match, this.paused ? 1 : this.acc / TICK, dt); this.hud.update(dt);
    requestAnimationFrame(t => this.frame(t));
  }
  tick() {
    let evs;
    if (this.mode === 'online') { if (!this.net?.match) return; this.net.step(this.menu.view ? NONE : this.keys.sample(0, true)); evs = this.net.drain(); this.match = this.net.match; }
    else if (this.mode === 'local' || this.mode === 'train') { const a = this.menu.view ? NONE : this.keys.sample(0), b = this.menu.view || this.mode === 'train' ? (this.keys.sample(1), NONE) : this.keys.sample(1); this.match.step(a, b); evs = this.match.drain(); }
    else { this.match.step(); this.match.drain(); return; }
    for (const e of evs) {
      this.view.event(e); this.hud.event(e); this.sound.play(e);
      if (e.t === 'end') setTimeout(() => { if (this.match?.phase === 'end' && !this.menu.view) this.showEnd(); }, 1400);
      if (e.t === 'rematch' || (e.t === 'round' && e.n === 1 && this.menu.view === 'end')) this.menu.hide();
    }
  }
}
new App();
