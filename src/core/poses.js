// Posturas: [pelvisX, pelvisY, ...13 ángulos de hueso] en el marco del luchador, relativas a la "raíz" (punto del
// suelo bajo el luchador). Se crean con ángulos para tronco y brazos e IK para las piernas (el pie va donde se pide).
import { BONES, NP, P, DEG, wrap, lerp, toLocal } from './skeleton.js';
export const NPOSE = 2 + BONES.length;
const L = BONES.map(b => b.len), TH = L[7], SH = L[8];
// IK de dos huesos: cadera (hx,hy) -> tobillo (ax,ay); rodilla siempre hacia delante
export function legIK(hx, hy, ax, ay) {
  let dx = ax - hx, dy = ay - hy, d = Math.hypot(dx, dy); const mx = TH + SH - 1e-3, mn = .2;
  if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx; } else if (d < mn) { const k = mn / (d || 1e-6); dx *= k; dy *= k; d = mn; }
  const phi = Math.atan2(dy, dx), al = Math.acos(Math.max(-1, Math.min(1, (TH * TH + d * d - SH * SH) / (2 * TH * d))));
  const th = phi + al, kx = hx + Math.cos(th) * TH, ky = hy + Math.sin(th) * TH, sh = Math.atan2(hy + dy - ky, hx + dx - kx);
  return [th, sh];
}
// pone las piernas de la postura con IK (tobillos relativos a la raíz)
export function setLegs(p, lx, ly, lf, rx, ry, rf) { const a = legIK(p[0], p[1], lx, ly), b = legIK(p[0], p[1], rx, ry); p[9] = a[0]; p[10] = a[1]; p[11] = lf; p[12] = b[0]; p[13] = b[1]; p[14] = rf; return p; }
export function def(o) {
  const p = new Float64Array(NPOSE), t = o.t ?? 80, n = o.n ?? t + 2, h = o.h ?? n + 6, aL = o.aL || [-55, 65], aR = o.aR || [-70, 78];
  p[0] = o.p?.[0] ?? 0; p[1] = o.p?.[1] ?? .9; p[2] = t * DEG; p[3] = n * DEG; p[4] = h * DEG; p[5] = aL[0] * DEG; p[6] = aL[1] * DEG; p[7] = aR[0] * DEG; p[8] = aR[1] * DEG;
  if (o.legs) { const g = o.legs; for (let i = 0; i < 6; i++) p[9 + i] = g[i] * DEG; return p; }
  const fL = o.fL || [.24, .08, -17], fR = o.fR || [-.22, .08, -17];
  return setLegs(p, fL[0], fL[1], fL[2] * DEG, fR[0], fR[1], fR[2] * DEG);
}
export function copy(src, out = new Float64Array(NPOSE)) { out.set(src); return out; }
export function blend(a, b, t, out = new Float64Array(NPOSE)) {
  out[0] = lerp(a[0], b[0], t); out[1] = lerp(a[1], b[1], t);
  for (let i = 2; i < NPOSE; i++) out[i] = a[i] + wrap(b[i] - a[i]) * t;
  return out;
}
// mezcla solo una parte: 'upper' = tronco, cabeza y brazos; 'legs' = piernas y pelvis
export function blendPart(a, b, t, part, out = a) {
  const r = part === 'upper' ? [2, 9] : [9, 15];
  if (part !== 'upper') { out[0] = lerp(a[0], b[0], t); out[1] = lerp(a[1], b[1], t); }
  for (let i = r[0]; i < r[1]; i++) out[i] = a[i] + wrap(b[i] - a[i]) * t;
  return out;
}
// muestra una lista de claves [[tiempo, postura], ...] con suavizado entre claves
export function sample(keys, t, out = new Float64Array(NPOSE)) {
  if (t <= keys[0][0]) return copy(keys[0][1], out);
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, a] = keys[i - 1], [t1, b] = keys[i], u = (t - t0) / (t1 - t0 || 1); return blend(a, b, ease(u, keys[i][2]), out); }
  return copy(keys.at(-1)[1], out);
}
const ease = (u, e) => e === 'in' ? u * u : e === 'out' ? 1 - (1 - u) * (1 - u) : e === 'lin' ? u : u * u * (3 - 2 * u);
// cinemática directa: postura -> posiciones de mundo de las 14 partículas
export function fk(p, rx, ry, f, xs, ys) {
  const ang = i => toLocal(p[2 + i], f), at = (from, bi, to) => { const a = ang(bi); xs[to] = xs[from] + Math.cos(a) * L[bi]; ys[to] = ys[from] + Math.sin(a) * L[bi]; };
  xs[P.pelvis] = rx + p[0] * f; ys[P.pelvis] = ry + p[1];
  at(P.pelvis, 0, P.chest); at(P.chest, 1, P.neck); at(P.neck, 2, P.head);
  at(P.chest, 3, P.elbowL); at(P.elbowL, 4, P.handL); at(P.chest, 5, P.elbowR); at(P.elbowR, 6, P.handR);
  at(P.pelvis, 7, P.kneeL); at(P.kneeL, 8, P.ankleL); at(P.ankleL, 9, P.toeL);
  at(P.pelvis, 10, P.kneeR); at(P.kneeR, 11, P.ankleR); at(P.ankleR, 12, P.toeR);
}
// postura real del cuerpo (para arrancar el levantamiento desde donde quedó tirado)
export function measure(body, rx, ry, f, out = new Float64Array(NPOSE)) {
  out[0] = (body.x[P.pelvis] - rx) * f; out[1] = body.y[P.pelvis] - ry;
  for (let i = 0; i < BONES.length; i++) out[2 + i] = wrap(toLocal(body.angle(i), f));
  return out;
}
export const D = DEG, NPART = NP;
