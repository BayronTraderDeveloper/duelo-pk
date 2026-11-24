import test from 'node:test'; import assert from 'node:assert/strict';
import { Online } from '../src/net/session.js';
import { B } from '../src/core/input.js';
import { P } from '../src/core/skeleton.js';
import { packFighter, validFighter } from '../src/core/snap.js';
// red simulada con retardo (en pasos de 1/120 s)
function net(lat) { let now = 0; const q = [], L = new Map(); const sync = () => { for (const x of L.values()) x.on.peers([...L.values()].map(y => y.me)); };
  const open = async (code, me, on) => { L.set(me.id, { me, on }); sync(); return { send: m => { const c = JSON.parse(JSON.stringify(m)); for (const [id, x] of L) if (id !== me.id) q.push({ at: now + lat, fn: () => x.on.message(c) }); }, close: () => { L.delete(me.id); sync(); } }; };
  return { open, tick() { now++; q.sort((a, b) => a.at - b.at); while (q.length && q[0].at <= now) q.shift().fn(); } }; }
test('online: el invitado ve lo mismo que el anfitrión; el anfitrión decide el daño', async () => {
  const n = net(8), H = await new Online('host', 'AAAAA', { name: 'Ana', char: 'riko' }, {}, n.open).start(), G = await new Online('guest', 'AAAAA', { name: 'Beto', char: 'torvo' }, {}, n.open).start();
  for (let i = 0; i < 30 && !G.match; i++) n.tick(); assert.ok(H.match && G.match); assert.equal(G.match.f[1].ch.id, 'torvo');
  let worst = 0, sum = 0, k = 0;
  for (let t = 0; t < 1500; t++) {
    n.tick(); const gi = t > 250 && t < 520 ? { held: B.left, hit: 0 } : [700, 760, 820].includes(t) ? { held: B.punch, hit: B.punch } : { held: 0, hit: 0 };
    H.step(t > 220 && t < 330 ? { held: B.right, hit: 0 } : { held: 0, hit: 0 }); G.step(gi); H.drain(); G.drain();
    if (t > 230) for (const i of [0, 1]) { const d = Math.abs(H.match.f[i].body.x[P.pelvis] - G.match.f[i].body.x[P.pelvis]); worst = Math.max(worst, d); sum += d; k++; }
  }
  assert.ok(sum / k < .08, `diferencia media ${sum / k}`); assert.ok(worst < .9, `peor ${worst}`);
  assert.ok(H.match.f[0].hp < 100, 'los puñetazos del invitado llegaron'); assert.equal(G.match.f[0].hp, H.match.f[0].hp, 'misma vida en los dos');
  H.leave(); G.leave();
});
test('online: datos falsos se ignoran; tercer jugador rechazado; desconexión detectada', async () => {
  const n = net(2); let lost = null; const H = await new Online('host', 'BBBBB', { name: 'A' }, { lost: w => lost = w }, n.open).start(), G = await new Online('guest', 'BBBBB', { name: 'B' }, {}, n.open).start();
  for (let i = 0; i < 10; i++) n.tick();
  const hp = G.match.f[1].hp; for (const m of [null, 5, { k: 'sn', f: H.me.id, t: 'x' }, { k: 'sn', f: H.me.id, t: 9999, F: [[1], [2]], M: [] }, { k: 'in', f: 'nadie', s: 1, b: 9 }]) { G.message(m); H.message(m); } assert.equal(G.match.f[1].hp, hp);
  H.message({ k: 'in', f: G.me.id, s: 1e9, b: 2 ** 30 }); assert.equal(H.gHeld & ~511, 0);
  const bad = packFighter(H.match.f[0]); bad[9] = 1e6; assert.ok(!validFighter(bad)); assert.ok(validFighter(packFighter(H.match.f[0])));
  const X = await new Online('guest', 'BBBBB', { name: 'C' }, {}, n.open).start(); for (let i = 0; i < 10; i++) n.tick(); assert.ok(!X.match, 'sala llena');
  G.tr.close(); n.tick(); assert.ok(lost); H.leave(); X.leave(); G.closed = true; clearInterval(G.pingT);
});
