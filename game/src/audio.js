// Procedural sound: every effect is synthesized with WebAudio, no audio
// files, no network. A tiny noise buffer + filters + envelopes per effect.
export function createAudio() {
  const api = { ctx: null, muted: false };
  const ensure = () => {
    if (!api.ctx) {
      try {
        api.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { api.ctx = null; }
    }
    if (api.ctx && api.ctx.state === 'suspended') api.ctx.resume();
    return api.ctx;
  };
  const noiseBuf = () => {
    const ctx = ensure();
    if (!ctx) return null;
    const len = ctx.sampleRate * 0.25;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    return buf;
  };
  let noise = null;
  const burst = (freq, dur, gain, type = 'lowpass') => {
    if (api.muted) return;
    const ctx = ensure();
    if (!ctx) return;
    if (!noise) noise = noiseBuf();
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start();
    src.stop(ctx.currentTime + dur);
  };
  const tone = (freq, dur, gain, type = 'sine', slideTo = 0) => {
    if (api.muted) return;
    const ctx = ensure();
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  };
  return {
    unlock() { ensure(); },
    shot(kind) {
      if (kind === 'sniper') { burst(900, 0.28, 0.5); tone(160, 0.22, 0.4, 'sawtooth', 50); }
      else if (kind === 'smg') burst(1600, 0.08, 0.28);
      else if (kind === 'pistol') { burst(1200, 0.1, 0.32); tone(220, 0.08, 0.2, 'square', 90); }
      else burst(1100, 0.12, 0.4);
    },
    dry() { tone(1400, 0.05, 0.12, 'square'); },
    reload() { tone(700, 0.05, 0.15, 'square'); setTimeout(() => tone(900, 0.05, 0.15, 'square'), 160); },
    hit(head) { tone(head ? 2400 : 1800, 0.06, 0.18, 'sine'); },
    hurt() { tone(110, 0.18, 0.3, 'sawtooth', 60); },
    plant() { tone(880, 0.09, 0.2, 'sine'); setTimeout(() => tone(880, 0.09, 0.2, 'sine'), 130); },
    beep() { tone(1200, 0.08, 0.15, 'sine'); },
    boom() { burst(220, 0.7, 0.7); tone(70, 0.6, 0.5, 'sine', 30); },
    win() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.22, 0.2, 'triangle'), i * 130)); },
    lose() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.25, 0.2, 'triangle'), i * 150)); },
    click() { tone(1000, 0.04, 0.12, 'square'); },
    setMuted(m) { api.muted = m; },
  };
}
