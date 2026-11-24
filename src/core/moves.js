// Ataques y posturas de cada personaje. Cada ataque: preparación (startup), ventana activa, recuperación y
// reutilización; fuerza, alcance (lo da la extremidad real), dirección y la partícula que golpea.
// El daño NO lo da la animación: solo cuenta si la extremidad toca de verdad al rival con velocidad suficiente.
import { P } from './skeleton.js';
import { def } from './poses.js';
// spec: postura base del personaje (grados). g(o) = guardia con cambios.
export function buildPoses(spec) {
  const g = o => def({ ...spec.guard, ...o });
  const crouch = def({ ...spec.guard, ...spec.crouch });
  return {
    g, guard: def(spec.guard), crouch,
    block: g({ t: 86, n: 80, h: 72, aL: [-12, 104], aR: [-28, 110] }),
    crouchBlock: def({ ...spec.guard, ...spec.crouch, t: 58, n: 56, h: 52, aL: [8, 112], aR: [-10, 116] }),
    sway: g({ t: 114, n: 112, h: 108, aL: [-48, 92], aR: [-62, 102] }),
    lean: g({ t: 62, n: 66, h: 76 }),
    back: g({ t: 100, n: 98, h: 94 }),
    run: g({ t: 70, n: 76, h: 84 }),
    jumpUp: g({ t: 84, fL: [.2, .42, -10], fR: [-.12, .5, -30], aL: [-25, 100], aR: [-55, 112] }),
    fall: g({ t: 86, fL: [.16, .18, -17], fR: [-.2, .24, -17], aL: [-5, 55], aR: [25, 65] }),
    tuck: g({ t: 66, n: 70, fL: [.28, .56, 0], fR: [.12, .6, 0], aL: [-40, 120], aR: [-50, 125] }),
    hitHead: g({ t: 102, n: 120, h: 128, aL: [-85, 35], aR: [-105, 45] }),
    hitBody: g({ t: 50, n: 54, h: 64, aL: [-98, 62], aR: [-108, 72] }),
    hitLeg: g({ t: 70, n: 80, h: 92, aL: [10, 40], aR: [-150, 40] }),
    hold: g({ t: 72, aL: [-8, 22], aR: [-4, 32] }),
    held: g({ t: 58, n: 64, h: 80, aL: [-12, 42], aR: [-22, 52] }),
    win: g({ t: 92, n: 96, h: 102, aL: [98, 104], aR: [78, 98], fL: [.2, .08, -17], fR: [-.2, .08, -17] }),
    lose: def({ p: [0, .55], t: 70, n: 52, h: 42, aL: [-95, -88], aR: [-100, -92], fL: [.34, .08, -17], fR: [-.46, .07, -100] }),
    sit: def({ p: [0, .13], t: 122, n: 116, h: 102, aL: [-118, -102], aR: [-126, -112], fL: [.55, .06, -17], fR: [.36, .06, -17] }),
    pushup: def({ p: [0, .3], t: 22, n: 30, h: 42, aL: [-86, -92], aR: [-92, -95], fL: [-.5, .06, -100], fR: [-.56, .06, -100] }),
    rise: g({ p: [0, .56], t: 62, n: 70, h: 80, fL: [.25, .08, -17], fR: [-.22, .08, -17], aL: [-70, 60], aR: [-80, 70] }),
  };
}
// tiempos en segundos; act = [inicio, fin] de la ventana activa; total = duración
export function buildMoves(ps, k = 1) {
  const { g, guard: G, crouch: C } = ps, A = ps.fall;
  const m = o => ({ upper: false, r: .07, minSpeed: 1.2, refSpeed: 6, height: 'high', push: 2, lift: 0, local: 3, bal: 15, stun: .25, hitstop: .06, knock: false, cool: .05, lunge: null, ...o, total: o.keys.at(-1)[0] });
  const scale = mv => { if (k === 1) return mv; const s = x => x * k; return { ...mv, keys: mv.keys.map(([t, p, e]) => [s(t), p, e]), act: mv.act.map(s), total: s(mv.total), lunge: mv.lunge && [s(mv.lunge[0]), mv.lunge[1]], flip: mv.flip && mv.flip.map(s), release: mv.release && s(mv.release), dive: mv.dive && [s(mv.dive[0]), mv.dive[1]] }; };
  const L = {
    jab: m({ name: 'Puñetazo izquierdo', limb: P.handL, upper: true, act: [.055, .13], dmg: 4, push: 1.6, local: 3.5, bal: 10, stun: .22, refSpeed: 10, lunge: [.03, 1.4], next: 'cross',
      keys: [[0, G], [.04, g({ t: 75, aL: [-38, 52] })], [.09, g({ t: 68, n: 72, h: 80, aL: [3, 2], aR: [-76, 86] }), 'out'], [.14, g({ t: 69, n: 72, h: 80, aL: [2, 4], aR: [-76, 86] })], [.27, G]] }),
    cross: m({ name: 'Puñetazo derecho', limb: P.handR, upper: true, act: [.075, .17], dmg: 6, push: 2.4, local: 4.2, bal: 14, stun: .28, refSpeed: 11, lunge: [.05, 1.8], next: 'hook',
      keys: [[0, G], [.05, g({ t: 80, aR: [-60, 70] })], [.12, g({ t: 63, n: 67, h: 78, aR: [2, 0], aL: [-70, 92] }), 'out'], [.18, g({ t: 64, n: 67, h: 78, aR: [1, 3], aL: [-70, 92] })], [.34, G]] }),
    hook: m({ name: 'Gancho (3.º golpe)', limb: P.handL, upper: true, act: [.1, .2], dmg: 9, push: 3.4, local: 5, bal: 32, stun: .4, hitstop: .085, refSpeed: 10, lunge: [.07, 2.2],
      keys: [[0, G], [.08, g({ t: 86, aL: [-22, 102] })], [.15, g({ t: 58, n: 62, h: 74, aL: [14, 34], aR: [-74, 96] }), 'out'], [.22, g({ t: 60, n: 63, h: 76, aL: [10, 40] })], [.42, G]] }),
    upper: m({ name: 'Uppercut', limb: P.handR, act: [.095, .21], dmg: 10, push: 1.8, lift: 6, local: 6, bal: 45, stun: .5, hitstop: .1, refSpeed: 17, knock: true, lunge: [.06, 1.4],
      keys: [[0, C], [.08, g({ p: [0, .68], t: 70, aR: [-100, 40], fL: [.28, .08, -17], fR: [-.22, .08, -17] })], [.17, g({ p: [0, .97], t: 90, n: 96, h: 102, aR: [52, 112], aL: [-60, 82] }), 'out'], [.25, g({ t: 88, n: 94, h: 100, aR: [48, 112] })], [.46, G]] }),
    heavy: m({ name: 'Golpe fuerte', limb: P.handR, r: .08, act: [.22, .34], dmg: 14, push: 5.5, lift: 1.5, local: 6.5, bal: 60, stun: .55, hitstop: .13, refSpeed: 20, knock: true, cool: .25, lunge: [.2, 3.2],
      keys: [[0, G], [.2, g({ t: 98, n: 96, aR: [-160, 122], aL: [-40, 72] }), 'out'], [.28, g({ t: 55, n: 60, h: 72, aR: [0, -2], aL: [-82, 60] }), 'in'], [.36, g({ t: 56, n: 60, h: 72, aR: [-2, 2], aL: [-82, 60] })], [.66, G]] }),
    front: m({ name: 'Patada frontal', limb: P.ankleL, r: .085, height: 'mid', act: [.13, .26], dmg: 8, push: 4.6, local: 4, bal: 30, stun: .35, hitstop: .08, refSpeed: 12, lunge: [.1, .8],
      keys: [[0, G], [.1, g({ t: 92, fL: [.35, .62, 30], fR: [-.18, .08, -17], aL: [-30, 95], aR: [-50, 100] })], [.18, g({ t: 104, n: 100, fL: [.86, 1.0, 40], fR: [-.2, .08, -17], aL: [-10, 92], aR: [-80, 110] }), 'out'], [.26, g({ t: 104, n: 100, fL: [.84, .98, 40], fR: [-.2, .08, -17], aL: [-10, 92], aR: [-80, 110] })], [.46, G]] }),
    side: m({ name: 'Patada lateral', limb: P.ankleR, r: .085, height: 'mid', act: [.17, .3], dmg: 11, push: 6.2, local: 5, bal: 42, stun: .42, hitstop: .1, refSpeed: 15, lunge: [.12, 2.2], cool: .1,
      keys: [[0, G], [.14, g({ t: 110, fR: [.2, .66, 40], fL: [.1, .08, -17], aL: [-60, 92], aR: [-40, 100] })], [.22, g({ p: [-.05, .9], t: 122, n: 110, h: 100, fR: [.86, 1.05, 60], fL: [.05, .08, -17], aL: [-122, 60], aR: [-50, 82] }), 'out'], [.3, g({ p: [-.05, .9], t: 120, n: 110, h: 100, fR: [.84, 1.03, 60], fL: [.05, .08, -17], aL: [-120, 60], aR: [-50, 82] })], [.52, G]] }),
    spin: m({ name: 'Patada giratoria', limb: P.ankleR, r: .09, height: 'high', act: [.2, .32], dmg: 14, push: 6.5, lift: 1.5, local: 6.5, bal: 55, stun: .5, hitstop: .12, refSpeed: 9.5, knock: true, cool: .25, lunge: [.1, 1.6], flip: [.11, .38],
      keys: [[0, G], [.1, g({ t: 72, aL: [-100, 40], aR: [-122, 60] })], [.14, g({ t: 58, n: 55, h: 60, fL: [.1, .08, -17], fR: [-.3, .52, -60], aL: [-130, 22], aR: [-150, 40] })], [.23, g({ p: [.08, .9], t: 40, n: 42, h: 52, fL: [.12, .08, -17], fR: [-.9, 1.12, -120], aL: [-140, 10], aR: [-120, 30] }), 'out'], [.32, g({ p: [.08, .9], t: 42, n: 44, h: 54, fL: [.12, .08, -17], fR: [-.86, 1.08, -120], aL: [-140, 10], aR: [-120, 30] })], [.38, g({ t: 70, fR: [-.25, .3, -40] })], [.6, G]] }),
    low: m({ name: 'Patada baja', limb: P.ankleL, r: .08, height: 'low', act: [.13, .27], dmg: 6, push: 1.4, local: 4, bal: 58, stun: .35, refSpeed: 9, lunge: [.08, .8],
      keys: [[0, C], [.1, g({ p: [0, .6], t: 70, fL: [.3, .3, 0], fR: [-.3, .08, -17], aL: [-60, 90], aR: [-75, 100] })], [.18, g({ p: [-.05, .58], t: 80, fL: [.95, .12, 10], fR: [-.35, .08, -17], aL: [-50, 92], aR: [-70, 100] }), 'out'], [.27, g({ p: [-.05, .58], t: 80, fL: [.92, .12, 10], fR: [-.35, .08, -17], aL: [-50, 92], aR: [-70, 100] })], [.48, C]] }),
    air: m({ name: 'Patada aérea', limb: P.ankleL, r: .09, height: 'mid', air: true, act: [.06, .4], dmg: 9, push: 4.6, local: 5, bal: 40, stun: .4, hitstop: .09, refSpeed: 6, knockAir: true,
      keys: [[0, A], [.08, g({ t: 96, fL: [.72, .5, 20], fR: [-.15, .45, -30], aL: [-20, 80], aR: [-100, 60] }), 'out'], [.4, g({ t: 96, fL: [.7, .5, 20], fR: [-.15, .45, -30], aL: [-20, 80], aR: [-100, 60] })], [.5, A]] }),
    dive: m({ name: 'Golpe descendente', limb: P.handR, r: .095, air: true, act: [.14, .48], dmg: 11, push: 2, lift: -3, local: 6, bal: 50, stun: .5, hitstop: .11, refSpeed: 9, knock: true, dive: [.14, -8.5], cool: .2,
      keys: [[0, A], [.12, g({ t: 96, aR: [138, 148], aL: [128, 138], fL: [.2, .5, -17], fR: [-.1, .55, -17] }), 'out'], [.2, g({ t: 55, n: 50, h: 60, aR: [-30, -20], aL: [-20, -30], fL: [.3, .35, -17], fR: [0, .4, -17] }), 'in'], [.5, g({ t: 58, n: 52, h: 60, aR: [-35, -25], aL: [-25, -30], fL: [.3, .3, -17], fR: [0, .35, -17] })], [.62, A]] }),
    slide: m({ name: 'Barrida', limb: P.ankleL, r: .09, height: 'low', act: [.05, .45], dmg: 5, push: 1, local: 4, bal: 75, stun: .3, refSpeed: 5, minSpeed: .8, slide: true, cool: .3,
      keys: [[0, ps.run], [.08, g({ p: [0, .38], t: 125, n: 115, h: 100, fL: [.8, .07, 10], fR: [.25, .07, -17], aL: [-160, -150], aR: [-150, -140] })], [.5, g({ p: [0, .38], t: 125, n: 115, h: 100, fL: [.8, .07, 10], fR: [.25, .07, -17], aL: [-160, -150], aR: [-150, -140] })], [.64, C]] }),
    grab: m({ name: 'Agarre', limb: P.handL, upper: true, grab: true, act: [.08, .2], dmg: 0, cool: .3,
      keys: [[0, G], [.09, g({ t: 70, aL: [-5, 10], aR: [0, 16] }), 'out'], [.2, g({ t: 70, aL: [-6, 12], aR: [-1, 18] })], [.45, G]] }),
    throw: m({ name: 'Lanzamiento', limb: -1, act: [9, 9], dmg: 10, release: .22, cool: .2,
      keys: [[0, ps.hold], [.15, g({ t: 102, n: 106, aL: [30, 60], aR: [52, 70] })], [.3, g({ t: 50, n: 50, aL: [-40, -18], aR: [-30, -10] }), 'out'], [.56, G]] }),
    slam: m({ name: 'Derribo', limb: -1, act: [9, 9], dmg: 12, release: .15, cool: .2,
      keys: [[0, ps.hold], [.15, g({ p: [0, .7], t: 50, aL: [-60, -30], aR: [-50, -30] }), 'in'], [.42, G]] }),
  };
  for (const id in L) L[id] = { id, ...scale(L[id]) };
  return L;
}
