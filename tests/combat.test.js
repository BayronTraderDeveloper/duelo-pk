import test from 'node:test'; import assert from 'node:assert/strict';
import { fight, run, I } from './sim.js';
import { B } from '../src/core/input.js';
const hits = m => m.drain().filter(e => e.t === 'hit' || e.t === 'block');
test('el golpe solo cuenta si la extremidad llega: de lejos no hay daño', () => {
  const m = fight(-1.8, 1.8); m.f[0].start('jab'); run(m, 60); assert.equal(hits(m).length, 0); assert.equal(m.f[1].hp, 100);
});
test('combo de tres puñetazos conecta, hace daño creciente y empuja', () => {
  const m = fight(0, .95); const x0 = m.f[1].x; m.step(I(B.punch, B.punch));
  for (let i = 0; i < 90; i++) m.step(I(i === 20 || i === 50 ? B.punch : 0, i === 20 || i === 50 ? B.punch : 0));
  const h = hits(m).filter(e => e.t === 'hit'); assert.ok(h.length >= 2, `golpes ${h.length}`); assert.ok(m.f[1].hp < 90); assert.ok(m.f[1].x > x0 + .1, 'retrocede'); assert.ok(h.at(-1).combo >= 2);
});
test('agacharse esquiva los puñetazos altos (por la posición real de la cabeza)', () => {
  const m = fight(0, .95); run(m, 40, () => I(), () => I(B.down)); m.f[0].start('jab'); run(m, 50, () => I(), () => I(B.down)); assert.equal(m.f[1].hp, 100);
});
test('bloquear (atrás) reduce mucho el daño; la patada baja pasa si no te agachas', () => {
  const m = fight(0, .95); m.f[0].start('cross'); run(m, 60, () => I(), () => I(B.right)); const e = hits(m); assert.equal(e[0]?.t, 'block'); assert.ok(m.f[1].hp > 98.5);
  const n = fight(0, .95); n.f[0].start('low'); run(n, 70, () => I(), () => I(B.right)); assert.equal(hits(n)[0]?.t, 'hit');
});
test('golpe fuerte en la cabeza: retroceso grande y derribo', () => {
  const m = fight(0, 1.05); m.f[0].start('heavy'); let down = false; for (let i = 0; i < 120; i++) { m.step(); if (m.f[1].state === 'down') down = true; }
  assert.ok(down); assert.ok(m.f[1].hp < 92); assert.ok(m.f[1].x > 1.5);
});
test('agarre: sujeta, se puede romper pulsando, y el lanzamiento derriba con daño', () => {
  let m = fight(0, .75); m.step(I(B.grab, B.grab)); run(m, 30); assert.equal(m.f[0].state, 'hold'); assert.equal(m.f[1].state, 'held');
  m.step(I(B.heavy, B.heavy)); let down = false; for (let i = 0; i < 60; i++) { m.step(); if (m.f[1].state === 'down') down = true; } assert.ok(down); assert.ok(m.f[1].hp < 95);
  m = fight(0, .75); m.step(I(B.grab, B.grab)); run(m, 30); for (let i = 0; i < 60 && m.f[1].state === 'held'; i++) m.step(I(), I(i % 4 ? 0 : B.punch, i % 4 ? 0 : B.punch));
  assert.notEqual(m.f[1].state, 'held', 'se suelta pulsando rápido');
});
test('rondas: K.O. da la ronda; al mejor de tres hay ganador y revancha', () => {
  const m = fight(); for (let r = 0; r < 2; r++) { m.phase = 'fight'; m.f[1].hp = 0; m.f[1].ko = true; m.f[1].knockDown(0, 0); run(m, 120 * 5); }
  assert.equal(m.phase, 'end'); assert.equal(m.winner, 0); assert.deepEqual(m.wins, [2, 0]); m.rematch(); assert.equal(m.round, 1); assert.deepEqual(m.wins, [0, 0]); assert.equal(m.f[1].hp, 100);
});
