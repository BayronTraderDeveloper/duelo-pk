import { Match } from '../src/core/match.js';
import { P } from '../src/core/skeleton.js';
export const I = (held = 0, hit = 0) => ({ held, hit });
// combate listo para pelear (salta la presentación) con los luchadores en x
export function fight(xa = -1.8, xb = 1.8, cfg = {}) { const m = new Match(cfg); m.phase = 'fight'; m.f[0].reset(xa, 1); m.f[1].reset(xb, -1); for (let i = 0; i < 60; i++) m.step(); m.drain(); return m; }
export const run = (m, n, a = () => I(), b = () => I()) => { for (let i = 0; i < n; i++) m.step(a(i), b(i)); };
export const pel = f => ({ x: f.body.x[P.pelvis], y: f.body.y[P.pelvis] });
