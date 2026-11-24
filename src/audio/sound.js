// Efectos de sonido sintetizados con Web Audio (sin archivos): golpes, bloqueos, silbidos, pasos, caídas.
export class Sound {
  constructor() { this.ctx = null; this.vol = 0.7; }
  ensure() { if (!this.ctx) { try { this.ctx = new AudioContext(); this.out = this.ctx.createGain(); this.out.gain.value = this.vol; this.out.connect(this.ctx.destination); this.noiseBuf = this.makeNoise(); } catch { this.ctx = null; } } if (this.ctx?.state === 'suspended') this.ctx.resume(); return this.ctx; }
  setVolume(v) { this.vol = v; if (this.out) this.out.gain.value = v; }
  makeNoise() { const b = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  noise(t, dur, f0, f1, q, gain, type = 'bandpass') { const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noiseBuf; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(fl).connect(g).connect(this.out); s.start(t, Math.random() * .5); s.stop(t + dur + .02); }
  tone(t, dur, f0, f1, gain, type = 'sine') { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + .02); }
  play(e) {
    if (!this.ensure()) return; const t = this.ctx.currentTime;
    switch (e.t) {
      case 'hit': { const k = Math.min(1.5, (e.dmg || 4) / 7); this.noise(t, .09 + k * .05, 1800, 300, 1.2, .5 + k * .3); this.tone(t, .14 + k * .08, 140 + (e.zone === 'head' ? 40 : 0), 45, .7 * k + .3); if (e.heavy) this.noise(t + .01, .25, 600, 80, .7, .4, 'lowpass'); break; }
      case 'block': this.noise(t, .07, 3200, 1500, 4, .35); this.tone(t, .06, 900, 600, .15, 'triangle'); break;
      case 'whoosh': if (e.m === 'dodge' || (e.w || 0) >= 5) this.noise(t, .16, 500, 2600, 1.4, .12 + Math.min(.15, (e.w || 3) / 90), 'bandpass'); break;
      case 'step': this.noise(t, .05, 900, 200, 1, e.run ? .07 : .035, 'lowpass'); break;
      case 'jump': this.noise(t, .08, 400, 1200, 1, .08); break;
      case 'land': this.noise(t, .12, 500, 90, .8, Math.min(.4, (e.v || 2) / 18), 'lowpass'); break;
      case 'down': this.noise(t, .3, 400, 60, .7, .45, 'lowpass'); this.tone(t, .25, 90, 40, .45); break;
      case 'grab': this.noise(t, .1, 1200, 500, 2, .2); break;
      case 'throw': case 'slam': this.noise(t, .35, 300, 50, .6, .6, 'lowpass'); this.tone(t, .3, 80, 35, .6); break;
      case 'break': case 'shove': case 'guardbreak': this.noise(t, .12, 1600, 400, 2, .3); break;
      case 'ko': this.tone(t, 1.2, 70, 30, .8); this.noise(t, .8, 800, 60, .5, .4, 'lowpass'); break;
      case 'fight': this.tone(t, .35, 330, 330, .2, 'sawtooth'); this.tone(t + .12, .5, 494, 494, .18, 'sawtooth'); break;
      case 'round': this.tone(t, .3, 220, 220, .15, 'triangle'); break;
    }
  }
}
