// Entrada de un jugador en un paso: botones mantenidos (held) y pulsados desde el paso anterior (hit).
export const B = { left: 1, right: 2, up: 4, down: 8, punch: 16, kick: 32, grab: 64, dodge: 128, heavy: 256 };
export const ACTIONS = Object.keys(B);
export const NONE = Object.freeze({ held: 0, hit: 0 });
export const ALL = 511;
export const clean = (b) => (Number.isInteger(b) ? b : 0) & ALL;
