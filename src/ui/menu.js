// Menús en HTML: principal, elección de personaje, salas online, configuración, pausa y fin de combate.
import { CHAR_IDS, character, COLORS, GEARS } from '../core/characters.js';
import { ACTIONS } from '../core/input.js';
import { LABELS, keyName } from './keys.js';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GEAR = { cinta: 'Cinta', casco: 'Casco', nada: 'Nada' };
export class Menu {
  constructor(root, app) { this.root = root; this.app = app; this.view = null; root.addEventListener('click', e => this.click(e)); root.addEventListener('submit', e => { e.preventDefault(); this.submit(e.target); }); root.addEventListener('input', e => { if (e.target.dataset.i === 'vol') this.app.setVolume(+e.target.value); }); }
  show(view, data = {}) { this.view = view; this.data = data; this.root.className = 'menu on v-' + view; this.root.innerHTML = this[view](data); this.root.querySelector('[autofocus]')?.focus(); }
  hide() { this.view = null; this.root.className = 'menu'; this.root.innerHTML = ''; }
  refresh() { if (this.view) this.show(this.view, this.data); }
  head(t, sub = '') { return `<header><button class="bk" data-a="back">Volver</button><div><h2>${t}</h2>${sub ? `<p>${sub}</p>` : ''}</div></header>`; }
  home() {
    const it = [['local', 'JUGAR LOCAL', 'Dos jugadores en este ordenador'], ['quick', 'JUGAR ONLINE', 'Busca rival en una sala abierta'], ['create', 'CREAR SALA', 'Comparte el código con un amigo'], ['join', 'UNIRSE A SALA', 'Escribe el código que te pasaron'], ['train', 'ENTRENAMIENTO', 'Prueba golpes contra un rival quieto'], ['config', 'CONFIGURACIÓN', 'Controles y volumen']];
    return `<div class="home"><a class="games" href="https://bayrontraderdeveloper.github.io/">← Todos los juegos</a><h1>DUELO<span>PK</span></h1><p class="tag">Lucha física 1 contra 1 · dos luchadores con peso, equilibrio y ragdoll</p><nav>${it.map(([k, t, d]) => `<button data-a="${k}"><b>${t}</b><span>${d}</span></button>`).join('')}</nav></div>`;
  }
  picker(p, sel, title) {
    return `<section class="pick" data-p="${p}"><h3>${esc(title)}</h3><div class="chars">${CHAR_IDS.map(id => { const c = character(id); return `<button class="ch ${sel.char === id ? 'sel' : ''}" data-a="char" data-p="${p}" data-v="${id}"><b>${c.name}</b><em>${esc(c.role)}</em><span>${esc(c.about)}</span><dl><dt>Velocidad</dt><dd><i style="width:${Math.round(c.run / 5.6 * 100)}%"></i></dd><dt>Fuerza</dt><dd><i style="width:${Math.round(c.dmgK / 1.14 * 100)}%"></i></dd><dt>Peso</dt><dd><i style="width:${Math.round(c.mass / 1.25 * 100)}%"></i></dd></dl></button>`; }).join('')}</div>
      <div class="look"><span>Color</span>${COLORS.map(c => `<button class="sw ${sel.look.color === c ? 'sel' : ''}" style="--c:${c}" data-a="color" data-p="${p}" data-v="${c}" aria-label="Color ${c}"></button>`).join('')}</div>
      <div class="look"><span>Accesorio</span>${GEARS.map(g => `<button class="${sel.look.gear === g ? 'sel' : ''}" data-a="gear" data-p="${p}" data-v="${g}">${GEAR[g]}</button>`).join('')}</div></section>`;
  }
  select({ mode }) {
    const s = this.app.sel, one = mode !== 'local' && mode !== 'train';
    const t = { local: 'Elige luchadores', train: 'Entrenamiento', create: 'Crear sala', join: 'Unirse a sala', quick: 'Jugar online' }[mode];
    const sub = { local: 'Jugador 1 a la izquierda (WASD), Jugador 2 a la derecha (flechas).', train: 'El rival no se mueve; la vida se rellena sola.', create: 'Elige tu luchador; después te damos el código de la sala.', join: 'Elige tu luchador y escribe el código.', quick: 'Elige tu luchador y buscamos una sala abierta.' }[mode];
    return `${this.head(t, sub)}<div class="pickers ${one ? 'one' : ''}">${this.picker(0, s[0], one ? 'Tu luchador' : 'Jugador 1')}${one ? '' : this.picker(1, s[1], mode === 'train' ? 'Rival de práctica' : 'Jugador 2')}</div>
      ${one ? `<div class="namerow"><label>Tu nombre <input id="nm" maxlength="16" value="${esc(this.app.name)}"></label></div>` : ''}
      ${mode === 'join' ? `<form class="code" data-f="join"><input id="code" maxlength="5" placeholder="CÓDIGO" autocomplete="off" value="${esc(this.data.code || '')}" autofocus><button class="go">Entrar</button></form>` : `<button class="go start" data-a="go" data-v="${mode}">${{ local: 'A pelear', train: 'Entrenar', create: 'Crear sala', quick: 'Buscar rival' }[mode]}</button>`}`;
  }
  lobby({ code, status, link, error }) {
    return `${this.head('Sala online', '')}<div class="lobby">${code ? `<div class="bigcode"><small>Código de la sala</small><b>${esc(code)}</b></div><div class="row"><button data-a="copy" data-v="${esc(link)}">Copiar enlace</button><button data-a="copycode" data-v="${esc(code)}">Copiar código</button></div>` : ''}
      <p class="status ${error ? 'bad' : ''}"><i class="spin ${error ? 'off' : ''}"></i>${esc(error || status)}</p></div>`;
  }
  config() {
    const k = this.app.keys;
    const col = p => `<section><h3>Jugador ${p + 1}</h3><table>${ACTIONS.map(a => `<tr><td>${LABELS[a]}</td><td><button class="key" data-a="rebind" data-p="${p}" data-v="${a}">${esc(keyName(k.maps[p][a]))}</button></td></tr>`).join('')}</table></section>`;
    return `${this.head('Configuración', 'Pulsa una tecla para cambiarla. En online juegas con cualquiera de los dos mapas.')}<div class="cfg">${col(0)}${col(1)}</div>
      <div class="cfg2"><label>Volumen <input type="range" min="0" max="1" step=".05" value="${this.app.sound.vol}" data-i="vol"></label><button data-a="resetkeys">Restaurar controles</button></div>
      <div class="help"><h3>Cómo se pelea</h3><ul><li><b>Puñetazo</b> tres veces seguidas = combo de tres golpes · abajo + puñetazo = uppercut</li><li><b>Patada</b>: sola = frontal · adelante = lateral · atrás = giratoria · abajo = baja · en el aire = aérea · corriendo + abajo = barrida</li><li><b>Golpe fuerte</b> (en el aire = golpe descendente)</li><li><b>Atrás</b> = bloquear (agachado bloquea lo bajo) · doble toque adelante = correr · arriba dos veces = doble salto</li><li><b>Esquivar</b>: solo = apartar el cuerpo · adelante = avance rápido · atrás = paso atrás</li><li><b>Agarre</b>: luego golpe fuerte = lanzar · abajo = derribar · adelante = empujar · atrás = tirar · esquivar = soltar. El agarrado se suelta pulsando rápido.</li><li>Derribado: pulsa cualquier tecla para levantarte antes.</li></ul></div>`;
  }
  pause({ online }) { return `<div class="dlg"><h2>Pausa</h2>${online ? '<p>El combate online sigue mientras miras este menú.</p>' : ''}<button data-a="resume" autofocus>Continuar</button>${online ? '' : '<button data-a="restart">Reiniciar combate</button>'}<button data-a="config2">Controles</button><button data-a="quit">Salir al menú</button></div>`; }
  end({ title, sub, online, waiting }) { return `<div class="dlg end"><h2>${esc(title)}</h2><p>${esc(sub)}</p><button data-a="again" autofocus ${waiting ? 'disabled' : ''}>${waiting ? 'Esperando a tu rival…' : 'Revancha (Enter)'}</button><button data-a="quit">Salir al menú</button></div>`; }
  lost({ why }) { return `<div class="dlg"><h2>Conexión perdida</h2><p>${esc(why)}</p><button data-a="quit" autofocus>Volver al menú</button></div>`; }
  click(e) {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a, p = +b.dataset.p, v = b.dataset.v, app = this.app;
    app.sound.ensure();
    if (a === 'back') return this.data?.fromPause ? this.show('pause', { online: !!app.net }) : (app.leaveNet(), this.show('home'));
    if (['local', 'create', 'join', 'quick', 'train'].includes(a)) return this.show('select', { mode: a });
    if (a === 'config') return this.show('config');
    if (a === 'char') { app.pick(p, v); return this.refresh(); }
    if (a === 'color') { app.sel[p].look.color = v; app.fixColors(p); app.preview(); return this.refresh(); }
    if (a === 'gear') { app.sel[p].look.gear = v; app.preview(); return this.refresh(); }
    if (a === 'go') { this.readName(); return app.go(v); }
    if (a === 'copy' || a === 'copycode') { navigator.clipboard?.writeText(v).then(() => { b.textContent = '¡Copiado!'; setTimeout(() => (b.textContent = a === 'copy' ? 'Copiar enlace' : 'Copiar código'), 1200); }); return; }
    if (a === 'rebind') { b.textContent = 'Pulsa…'; b.classList.add('wait'); app.keys.capture = code => { if (code !== 'Escape') app.keys.set(p, v, code); this.refresh(); }; return; }
    if (a === 'resetkeys') { app.keys.reset(); return this.refresh(); }
    if (a === 'resume') return app.resume();
    if (a === 'restart') return app.restart();
    if (a === 'config2') return this.show('config', { fromPause: true });
    if (a === 'quit') return app.quit();
    if (a === 'again') return app.again();
  }
  readName() { const n = this.root.querySelector('#nm'); if (n) this.app.setName(n.value); }
  submit(f) { if (f.dataset.f === 'join') { this.readName(); this.app.go('join', f.querySelector('#code').value); } }
}
