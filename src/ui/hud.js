// HUD del combate: barras de vida con rastro de daño, equilibrio (riesgo de derribo), rondas, tiempo,
// conexión, avisos grandes (RONDA, ¡PELEA!, K.O.), combos y números de daño.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export class Hud {
  constructor(root, view) { this.root = root; this.view = view; this.trail = [100, 100]; this.shown = false; this.msgT = 0; this.combo = [null, null]; }
  show(match, net) {
    this.match = match; this.net = net; this.shown = true; this.trail = [100, 100];
    const side = i => { const f = match.f[i]; return `<div class="pl p${i}" style="--c:${esc(f.look.color)}"><div class="nm"><b>${esc(match.names[i])}</b><span>${esc(f.ch.name)}</span><em class="wins"></em></div><div class="hp"><i class="tr"></i><i class="v"></i></div><div class="bl"><i></i></div><small class="st"></small></div>`; };
    this.root.innerHTML = `<div class="top">${side(0)}<div class="mid"><div class="clock">60</div><div class="rnd"></div><div class="net"></div></div>${side(1)}</div><div class="big"></div><div class="cmb c0"></div><div class="cmb c1"></div><div class="nums"></div>`;
    this.el = { clock: this.root.querySelector('.clock'), rnd: this.root.querySelector('.rnd'), net: this.root.querySelector('.net'), big: this.root.querySelector('.big'), nums: this.root.querySelector('.nums'), p: [0, 1].map(i => this.root.querySelector('.p' + i)), c: [0, 1].map(i => this.root.querySelector('.c' + i)) };
    this.root.classList.add('on');
  }
  hide() { this.shown = false; this.root.classList.remove('on'); this.root.innerHTML = ''; }
  big(text, sub = '', cls = '') { this.el.big.className = 'big on ' + cls; this.el.big.innerHTML = `<b>${esc(text)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`; this.msgT = 1.5; }
  event(e) {
    if (!this.shown) return; const m = this.match;
    if (e.t === 'round') this.big(e.n >= 5 ? 'RONDA FINAL' : `RONDA ${e.n}`);
    else if (e.t === 'fight') this.big('¡PELEA!', '', 'go');
    else if (e.t === 'ko') this.big('K.O.', e.winner >= 0 ? `Gana ${m.names[e.winner]}` : 'Doble K.O.', 'ko');
    else if (e.t === 'time') this.big('¡TIEMPO!', e.winner >= 0 ? `Gana ${m.names[e.winner]}` : 'Empate');
    else if (e.t === 'guardbreak') this.big('GUARDIA ROTA', '', 'sm');
    else if (e.t === 'break') this.big('¡SE SOLTÓ!', '', 'sm');
    else if ((e.t === 'hit' || e.t === 'throw' || e.t === 'slam') && Number.isInteger(e.who)) {
      if (e.combo >= 2) { const c = this.el.c[e.who]; c.innerHTML = `<b>${e.combo}</b> GOLPES`; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); this.combo[e.who] = 1.4; }
      if (e.dmg && Number.isFinite(e.x)) { const p = this.view.project(e.x, e.y + .15), d = document.createElement('i'); d.className = 'dn' + (e.heavy ? ' hv' : '') + (e.counter ? ' ct' : ''); d.textContent = e.counter ? `-${e.dmg} ¡CONTRA!` : `-${e.dmg}`; d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; this.el.nums.append(d); setTimeout(() => d.remove(), 900); }
    }
  }
  update(dt) {
    if (!this.shown) return; const m = this.match;
    m.f.forEach((f, i) => {
      const el = this.el.p[i], hp = Math.max(0, f.hp); this.trail[i] = hp > this.trail[i] ? hp : Math.max(hp, this.trail[i] - dt * (this.trail[i] - hp > 20 ? 30 : 14));
      el.querySelector('.v').style.width = hp + '%'; el.querySelector('.tr').style.width = this.trail[i] + '%'; el.classList.toggle('low', hp < 25);
      const bl = el.querySelector('.bl i'); bl.style.width = Math.max(0, f.bal) + '%'; bl.parentElement.classList.toggle('warn', f.bal < 35);
      el.querySelector('.st').textContent = f.ko ? 'K.O.' : f.state === 'down' ? 'DERRIBADO' : f.state === 'getup' ? 'LEVANTÁNDOSE' : f.state === 'held' ? 'AGARRADO · pulsa rápido para soltarte' : f.state === 'hold' ? 'AGARRE · T lanzar · S derribar · adelante empujar · R soltar' : f.bal < 35 ? 'SIN EQUILIBRIO' : '';
      el.querySelector('.wins').innerHTML = Array.from({ length: 2 }, (_, k) => `<u class="${k < m.wins[i] ? 'w' : ''}"></u>`).join('');
      if (this.combo[i] !== null && (this.combo[i] -= dt) <= 0) { this.combo[i] = null; this.el.c[i].classList.remove('on'); }
    });
    this.el.clock.textContent = m.training ? '∞' : Math.ceil(m.timer); this.el.clock.classList.toggle('low', m.timer < 10 && !m.training);
    this.el.rnd.textContent = m.training ? 'ENTRENAMIENTO' : `RONDA ${m.round}`;
    const n = this.net; this.el.net.innerHTML = !n ? '<i class="dot ok"></i>LOCAL' : n.lost ? '<i class="dot bad"></i>SIN CONEXIÓN' : `<i class="dot ${n.rtt === null ? 'wait' : n.rtt < 120 ? 'ok' : n.rtt < 250 ? 'mid' : 'bad'}"></i>${n.rtt === null ? 'CONECTANDO' : Math.round(n.rtt) + ' ms'} · ${n.host ? 'ANFITRIÓN' : 'INVITADO'}`;
    if (this.msgT > 0 && (this.msgT -= dt) <= 0) this.el.big.classList.remove('on');
  }
}
