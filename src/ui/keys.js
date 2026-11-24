// Teclado: dos mapas de controles reasignables (se guardan en el navegador). Las pulsaciones rápidas entre
// dos pasos de física no se pierden: se acumulan hasta que el juego las lee.
import { B, ACTIONS } from '../core/input.js';
export const LABELS = { left: 'Izquierda', right: 'Derecha', up: 'Saltar', down: 'Agacharse', punch: 'Puñetazo', kick: 'Patada', grab: 'Agarre', dodge: 'Esquivar', heavy: 'Golpe fuerte' };
export const DEFAULT = [
  { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', punch: 'KeyF', kick: 'KeyG', grab: 'KeyH', dodge: 'KeyR', heavy: 'KeyT' },
  { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', punch: 'KeyK', kick: 'KeyL', grab: 'KeyO', dodge: 'KeyP', heavy: 'KeyI' },
];
const KEY = 'duelo.keys.v1';
export const keyName = c => c ? c.replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow', '').replace('Left', '←').replace('Right', '→').replace('Up', '↑').replace('Down', '↓').replace('Space', 'Espacio') : '—';
export class Keys {
  constructor() {
    this.maps = this.load(); this.down = new Set(); this.hits = [0, 0]; this.capture = null;
    addEventListener('keydown', e => { if (this.capture) { e.preventDefault(); const c = this.capture; this.capture = null; c(e.code); return; } if (e.repeat) return; this.down.add(e.code); for (let p = 0; p < 2; p++) for (const a of ACTIONS) if (this.maps[p][a] === e.code) { this.hits[p] |= B[a]; if (this.active) e.preventDefault(); } });
    addEventListener('keyup', e => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
  }
  load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(s) && s.length === 2) return s.map((m, i) => ({ ...DEFAULT[i], ...Object.fromEntries(Object.entries(m || {}).filter(([k, v]) => ACTIONS.includes(k) && typeof v === 'string' && v.length < 24)) })); } catch { } return DEFAULT.map(m => ({ ...m })); }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.maps)); } catch { } }
  reset() { this.maps = DEFAULT.map(m => ({ ...m })); this.save(); }
  set(p, a, code) { for (let q = 0; q < 2; q++) for (const k of ACTIONS) if (this.maps[q][k] === code) this.maps[q][k] = ''; this.maps[p][a] = code; this.save(); }
  // entrada del jugador p; merge = también vale el mapa del otro jugador (online: juegas con cualquiera de los dos)
  sample(p, merge = false) {
    let held = 0, hit = this.hits[p]; this.hits[p] = 0;
    const maps = merge ? [this.maps[p], this.maps[1 - p]] : [this.maps[p]];
    if (merge) { hit |= this.hits[1 - p]; this.hits[1 - p] = 0; }
    for (const m of maps) for (const a of ACTIONS) if (this.down.has(m[a])) held |= B[a];
    return { held, hit };
  }
  clear() { this.hits = [0, 0]; }
}
