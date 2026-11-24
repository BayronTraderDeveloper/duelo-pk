// "Jugar online" (partida rápida): las salas abiertas se anuncian en relés públicos de Nostr con caducidad corta.
// Quien busca entra en la más reciente; si no hay ninguna, abre una y espera. Sin cuentas ni servidor propio.
const DEV = new URLSearchParams(globalThis.location?.search || '').get('rele');   // pruebas: ?rele=ws://localhost:7777
const RELAYS = DEV && /^ws:\/\/localhost:\d+$/.test(DEV) ? [DEV] : ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
const KIND = 30078, APP = 'duelo-pk';
let lib = null, pool = null, sk = null;
async function N() { if (!lib) { lib = await import('nostr-tools'); pool = new lib.SimplePool(); sk = lib.generateSecretKey(); } return lib; }
export async function announce(code, name, char) {
  await N(); const t = Math.floor(Date.now() / 1000);
  const ev = lib.finalizeEvent({ kind: KIND, created_at: t, tags: [['d', `${APP}:room:${code}`], ['t', `${APP}-room`], ['expiration', String(t + 45)]], content: JSON.stringify({ code, name: String(name).slice(0, 16), char }) }, sk);
  const r = await Promise.allSettled(pool.publish(RELAYS, ev)); return r.some(x => x.status === 'fulfilled');
}
export async function close(code) { try { await N(); const t = Math.floor(Date.now() / 1000); const ev = lib.finalizeEvent({ kind: KIND, created_at: t, tags: [['d', `${APP}:room:${code}`], ['t', `${APP}-room`], ['expiration', String(t + 5)]], content: JSON.stringify({ closed: true }) }, sk); await Promise.allSettled(pool.publish(RELAYS, ev)); } catch { } }
export async function findRoom() {
  await N(); const now = Math.floor(Date.now() / 1000);
  const evs = await pool.querySync(RELAYS, { kinds: [KIND], '#t': [`${APP}-room`], since: now - 50, limit: 40 }, { maxWait: 2500 });
  const rooms = new Map();
  for (const e of evs) { let c; try { if (!lib.verifyEvent(e)) continue; c = JSON.parse(e.content); } catch { continue; } const exp = +(e.tags.find(x => x[0] === 'expiration')?.[1] || 0); if (!c || c.closed || exp < now || !/^[A-Z0-9]{5}$/.test(c.code || '') || e.pubkey === lib.getPublicKey(sk)) continue; const o = rooms.get(c.code); if (!o || o.at < e.created_at) rooms.set(c.code, { code: c.code, at: e.created_at }); }
  return [...rooms.values()].sort((a, b) => b.at - a.at)[0] || null;
}
