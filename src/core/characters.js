// Los dos únicos personajes. Mismo sistema físico; cambian postura, ritmo, peso, fuerza y aspecto.
import { buildPoses, buildMoves } from './moves.js';
const SPECS = {
  riko: {
    id: 'riko', name: 'RIKO', role: 'Rápido y técnico', about: 'Boxeador ligero: guardia alta, rebota sobre las puntas y encadena golpes muy rápido. Pega menos y sale volando antes.',
    walk: 2.35, back: 1.8, run: 5.6, jump: 7.5, jump2: 6.6, accel: 26, timeK: .9, dmgK: .92, kbK: 1.12, balK: 1.08, grip: 1, bounce: .018, mass: 1,
    guard: { p: [0, .9], t: 78, n: 80, h: 88, aL: [-52, 64], aR: [-70, 78], fL: [.25, .08, -17], fR: [-.22, .08, -20] },
    crouch: { p: [0, .5], t: 52, n: 58, h: 72, fL: [.3, .08, -17], fR: [-.3, .08, -17], aL: [-40, 100], aR: [-60, 108] },
    look: { color: '#e5482d', gear: 'cinta' },
  },
  torvo: {
    id: 'torvo', name: 'TORVO', role: 'Pesado y potente', about: 'Luchador grande de postura baja y abierta. Más lento, pero cada golpe derriba y cuesta mucho moverlo o tirarlo.',
    walk: 1.95, back: 1.45, run: 4.7, jump: 6.9, jump2: 6, accel: 19, timeK: 1.1, dmgK: 1.14, kbK: .8, balK: .78, grip: 1.3, bounce: .006, mass: 1.25,
    guard: { p: [0, .84], t: 82, n: 82, h: 86, aL: [-38, 86], aR: [-60, 96], fL: [.3, .08, -17], fR: [-.28, .08, -17] },
    crouch: { p: [0, .48], t: 54, n: 58, h: 70, fL: [.34, .08, -17], fR: [-.32, .08, -17], aL: [-36, 104], aR: [-54, 110] },
    look: { color: '#3fa7e0', gear: 'casco' },
  },
};
export const CHAR_IDS = Object.keys(SPECS);
const cache = {};
export function character(id) {
  const s = SPECS[id] || SPECS.riko; if (cache[s.id]) return cache[s.id];
  const poses = buildPoses(s); return cache[s.id] = { ...s, poses, moves: buildMoves(poses, s.timeK) };
}
export const COLORS = ['#e5482d', '#3fa7e0', '#f2b84b', '#8fd694', '#e58fb5', '#b39ddb', '#f5f3ee', '#5cc9b8'];
export const GEARS = ['cinta', 'casco', 'nada'];
export function cleanLook(l, base) { const c = COLORS.includes(l?.color) ? l.color : base.color, g = GEARS.includes(l?.gear) ? l.gear : base.gear; return { color: c, gear: g }; }
