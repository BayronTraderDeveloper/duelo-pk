import test from 'node:test'; import assert from 'node:assert/strict';
import { fight, run, I, pel } from './sim.js';
import { P, NP, BONES } from '../src/core/skeleton.js';
import { B } from '../src/core/input.js';
const finite = f => { for (let i = 0; i < NP; i++) if (!Number.isFinite(f.body.x[i] + f.body.y[i])) return false; return true; };
test('de pie: estable, sin flotar ni hundirse, huesos con su largo', () => {
  const m = fight(); run(m, 600);
  for (const f of m.f) { assert.ok(finite(f)); assert.ok(Math.abs(f.body.y[P.ankleL] - .08) < .015 && Math.abs(f.body.y[P.ankleR] - .08) < .015, 'pies en el suelo'); assert.ok(f.body.y[P.head] > 1.5, 'de pie'); for (const b of BONES) assert.ok(Math.abs(Math.hypot(f.body.x[b.b] - f.body.x[b.a], f.body.y[b.b] - f.body.y[b.a]) - b.len) < .01, b.name); }
});
test('caminar y correr: el pie de apoyo no resbala; acelera y frena con inercia', () => {
  const m = fight(-5, 6); const a = m.f[0];
  let sl = 0, px = null, ptx = null, pty = null, sp = [];
  run(m, 300, () => I(B.right), () => I()); sp.push(a.vx);
  for (let i = 0; i < 240; i++) { m.step(I(B.right)); const b = a.body, k = P.ankleL; if (px !== null && pty < .0801 && b.ty[k] < .0801 && Math.abs(b.tx[k] - ptx) < 1e-6) sl += Math.abs(b.x[k] - px); px = b.x[k]; ptx = b.tx[k]; pty = b.ty[k]; }
  assert.ok(sl < .06, `resbala ${sl}`);
  m.step(I(0)); const v1 = a.vx; m.step(I(0)); assert.ok(a.vx > 0 && a.vx < v1, 'frena poco a poco, no de golpe');
  run(m, 120); assert.ok(Math.abs(a.vx) < .01);
  const r = fight(-6, 6), c = r.f[0]; r.step(I(B.right, B.right)); r.step(I()); r.step(I(B.right, B.right)); run(r, 100, () => I(B.right)); assert.ok(c.vx > 5, `doble toque = correr (${c.vx})`);
});
test('salto, doble salto y aterrizaje con rodillas que absorben', () => {
  const m = fight(); const a = m.f[0]; let top = 0, dip = 0;
  m.step(I(B.up, B.up)); for (let i = 0; i < 40; i++) { m.step(); top = Math.max(top, a.y); }
  m.step(I(B.up, B.up)); let top2 = 0; for (let i = 0; i < 200; i++) { m.step(); top2 = Math.max(top2, a.y); if (a.grounded) dip = Math.min(dip, a.suspY); }
  assert.ok(top > .9 && top < 1.6, `altura ${top}`); assert.ok(top2 > top + .4, 'el doble salto sube más'); assert.ok(a.grounded && a.jumps === 0); assert.ok(dip < -.04, 'flexiona al caer');
});
test('ragdoll: cae de forma gradual, conserva el esqueleto y se levanta solo', () => {
  const m = fight(-1.8, 1.8); const b = m.f[1]; b.knockDown(-4, 1.5); const tones = [];
  for (let i = 0; i < 30; i++) { m.step(); tones.push(b.body.tone); }
  assert.ok(tones[3] > .5 && tones[29] < .05, 'el tono baja en unas décimas, no de golpe');
  let low = 9; for (let i = 0; i < 400 && b.state !== 'getup'; i++) { m.step(); low = Math.min(low, pel(b).y); for (const bn of BONES) assert.ok(Math.abs(Math.hypot(b.body.x[bn.b] - b.body.x[bn.a], b.body.y[bn.b] - b.body.y[bn.a]) - bn.len) < .03); }
  assert.ok(low < .4, 'llega al suelo'); assert.equal(b.state, 'getup'); run(m, 200); assert.equal(b.state, 'free'); assert.ok(b.body.y[P.head] > 1.45, 'de pie otra vez'); assert.ok(finite(b));
});
