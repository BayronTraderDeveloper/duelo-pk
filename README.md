# DUELO PK

Lucha física 1 contra 1 en el navegador. Solo dos luchadores (RIKO y TORVO), cada uno con esqueleto articulado,
músculos que lo mantienen de pie, golpes que dependen de la extremidad real y ragdoll con levantamiento.
Misma tecnología que TINAJAS PK: HTML + JavaScript en módulos + Three.js (vista de lado) + Vite; online P2P.

    npm install
    npm run dev    # http://localhost:5191
    npm test       # física, combate y red

- `src/core/` simulación pura a 120 Hz, sin gráficos (la usan el juego, el anfitrión online y las pruebas)
  - `skeleton.js` 14 partículas, 13 huesos, límites de cada articulación · `physics.js` cuerpo: músculos PD, huesos, límites, pies que no resbalan, suelo y paredes
  - `poses.js` posturas, IK de piernas, mezcla · `moves.js` ataques (preparación, ventana activa, recuperación, reutilización, fuerza) y posturas
  - `characters.js` RIKO y TORVO · `fighter.js` controlador, estados, pasos procedurales, saltos, derribo y levantamiento
  - `combat.js` impactos, daño, retroceso, reacciones, agarres, choques · `match.js` rondas, tiempo, K.O., pausa de impacto · `snap.js` fotografías para la red
- `src/net/` online: `session.js` (anfitrión con autoridad + predicción e interpolación del invitado), `transport.js` (WebRTC con Trystero o `?red=pestanas`), `lobby.js` (partida rápida por relés Nostr)
- `src/view/` Three.js: luchadores, arena, cámara, chispas · `src/ui/` menú, HUD, teclado reasignable · `src/audio/` sonidos sintetizados

Online: quien crea la sala es la autoridad (valida golpes, daño, agarres y resultado); el invitado predice su propio
luchador y se corrige poco a poco. Probar sin internet: abre dos pestañas con `?red=pestanas`.

Se publica en GitHub Pages con cada `push` a `main` (`.github/workflows/pages.yml`) y aparece en el menú de juegos.
