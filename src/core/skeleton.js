// Esqueleto articulado 2D del luchador (plano x/y, metros). Sin gráficos: solo datos.
// Marco del luchador: x = hacia donde mira, y = arriba. Ángulos en radianes, 0 = adelante, π/2 = arriba.
export const DEG = Math.PI / 180;
export const P = { head: 0, neck: 1, chest: 2, pelvis: 3, elbowL: 4, handL: 5, elbowR: 6, handR: 7, kneeL: 8, ankleL: 9, toeL: 10, kneeR: 11, ankleR: 12, toeR: 13 };
export const NP = 14;
export const PNAME = Object.keys(P);
// masa (kg) y radio de colisión de cada partícula
export const MASS = [4.5, 2, 15, 15, 2, 1.2, 2, 1.2, 5, 2.5, .8, 5, 2.5, .8];
export const RAD = [.125, .05, .12, .11, .05, .055, .05, .055, .07, .055, .035, .07, .055, .035];
// Huesos: [nombre, partícula padre, partícula hija, largo, grosor de dibujo/colisión, hueso padre (articulación), desfase, mín, máx]
// La articulación limita el ángulo del hueso respecto a su hueso padre (en el marco del luchador).
const B = (name, a, b, len, r, parent, off, lo, hi) => ({ name, a, b, len, r, parent, off: off * DEG, lo: lo * DEG, hi: hi * DEG });
export const BONES = [
  B('torso', P.pelvis, P.chest, .5, .115, -1, 0, 0, 0),
  B('neck', P.chest, P.neck, .12, .045, 0, 0, -50, 40),      // cuello: hacia delante / atrás
  B('head', P.neck, P.head, .13, .125, 1, 0, -35, 35),
  B('uaL', P.chest, P.elbowL, .29, .052, 0, 0, -400, 400),   // hombro: libre
  B('faL', P.elbowL, P.handL, .27, .044, 3, 0, -4, 155),     // codo: solo se dobla hacia delante
  B('uaR', P.chest, P.elbowR, .29, .052, 0, 0, -400, 400),
  B('faR', P.elbowR, P.handR, .27, .044, 5, 0, -4, 155),
  B('thL', P.pelvis, P.kneeL, .45, .078, 0, 180, -70, 135),  // cadera: muslo respecto al torso invertido
  B('shL', P.kneeL, P.ankleL, .44, .06, 7, 0, -160, 3),      // rodilla: solo hacia atrás
  B('ftL', P.ankleL, P.toeL, .17, .042, 8, 0, 45, 135),      // tobillo
  B('thR', P.pelvis, P.kneeR, .45, .078, 0, 180, -70, 135),
  B('shR', P.kneeR, P.ankleR, .44, .06, 10, 0, -160, 3),
  B('ftR', P.ankleR, P.toeR, .17, .042, 11, 0, 45, 135),
];
export const BI = Object.fromEntries(BONES.map((b, i) => [b.name, i]));
// zona del cuerpo de cada hueso (para daño y reacción)
export const ZONE = { torso: 'body', neck: 'head', head: 'head', uaL: 'arm', faL: 'arm', uaR: 'arm', faR: 'arm', thL: 'leg', shL: 'leg', ftL: 'leg', thR: 'leg', shR: 'leg', ftR: 'leg' };
export const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
// ángulo de mundo <-> ángulo en el marco del luchador (f = 1 mira a la derecha, -1 a la izquierda)
export const toLocal = (a, f) => f > 0 ? a : Math.PI - a;
export const toWorld = toLocal;
// distancia de un punto al segmento ab y punto más cercano (u en 0..1)
export function segPoint(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; let u = l2 > 1e-9 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; u = clamp(u, 0, 1);
  const cx = ax + dx * u, cy = ay + dy * u; return { d: Math.hypot(px - cx, py - cy), u, cx, cy };
}
// distancia mínima entre dos segmentos (muestreo + refinamiento: suficiente para golpes)
export function segSeg(a0x, a0y, a1x, a1y, b0x, b0y, b1x, b1y) {
  let best = null;
  for (let i = 0; i <= 4; i++) { const t = i / 4, px = lerp(a0x, a1x, t), py = lerp(a0y, a1y, t), r = segPoint(px, py, b0x, b0y, b1x, b1y); if (!best || r.d < best.d) best = { ...r, t, px, py }; }
  return best;
}
