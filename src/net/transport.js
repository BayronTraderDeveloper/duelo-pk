// Conexión de una sala: directa entre los dos jugadores por internet (WebRTC con Trystero; los relés públicos solo
// sirven para presentarse, los datos van de jugador a jugador) o entre pestañas del mismo navegador (?red=pestanas).
export async function openTransport(code, me, on) { const q = new URLSearchParams(globalThis.location?.search || ''); return q.get('red') === 'pestanas' ? tabs(code, me, on) : p2p(code, me, on); }
async function p2p(code, me, on) {
  const { joinRoom } = await import('trystero'); const room = joinRoom({ appId: 'duelo-pk-v1' }, 'sala-' + code), who = new Map();
  const [hello, getHello] = act(room, 'hola'), [msg, getMsg] = act(room, 'm'), emit = () => on.peers([me, ...who.values()]);
  const join = id => hello(me, { target: id }), left = id => { who.delete(id); emit(); };
  if (typeof room.onPeerJoin === 'function' && room.onPeerJoin.length) { room.onPeerJoin(join); room.onPeerLeave(left); } else { room.onPeerJoin = join; room.onPeerLeave = left; }
  getHello((d, id) => { if (d && typeof d === 'object' && typeof d.id === 'string') { const isNew = !who.has(id); who.set(id, d); if (isNew) hello(me, { target: id }); emit(); } });
  getMsg(d => on.message(d)); setTimeout(emit, 50); on.state?.(true);
  return { kind: 'internet', send: m => msg(m), close: () => room.leave() };
}
// Trystero cambió su API entre versiones: acepta las dos formas
function act(room, id) {
  const a = room.makeAction(id); if (Array.isArray(a)) return [(d, o) => a[0](d, o?.target ?? null), f => a[1]((d, p) => f(d, p))];
  return [(d, o) => a.send(d, o), f => { a.onMessage = (d, m) => f(d, m?.peerId ?? m); }];
}
async function tabs(code, me, on) {
  const bc = new BroadcastChannel('duelo-' + code), seen = new Map([[me.id, { me, t: Infinity }]]), emit = () => on.peers([...seen.values()].map(s => s.me));
  bc.onmessage = ({ data: d }) => { if (d?.hello) { const isNew = !seen.has(d.hello.id); seen.set(d.hello.id, { me: d.hello, t: performance.now() }); if (isNew) { bc.postMessage({ hello: me }); emit(); } } else if (d?.bye) { seen.delete(d.bye); emit(); } else if (d?.m) on.message(d.m); };
  const beat = setInterval(() => { bc.postMessage({ hello: me }); let ch = false; for (const [k, s] of seen) if (performance.now() - s.t > 5000) { seen.delete(k); ch = true; } if (ch) emit(); }, 1000);
  const bye = () => bc.postMessage({ bye: me.id }); addEventListener('pagehide', bye); bc.postMessage({ hello: me }); setTimeout(emit, 60);
  return { kind: 'pestañas', send: m => bc.postMessage({ m }), close: () => { bye(); clearInterval(beat); removeEventListener('pagehide', bye); bc.close(); } };
}
