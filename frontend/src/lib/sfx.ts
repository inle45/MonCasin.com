// Web Audio API sound engine — no external files needed

let _ctx: AudioContext | null = null;
let _muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch { return null; }
  }
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

function osc(
  freq: number,
  dur: number,
  type: OscillatorType = 'sine',
  vol = 0.25,
  delay = 0,
) {
  const ctx = getCtx();
  if (!ctx || _muted) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    g.gain.setValueAtTime(vol, ctx.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + dur);
    o.start(ctx.currentTime + delay);
    o.stop(ctx.currentTime + delay + dur + 0.02);
  } catch {}
}

function noise(dur: number, vol = 0.15, delay = 0) {
  const ctx = getCtx();
  if (!ctx || _muted) return;
  try {
    const samples = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, samples, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < samples; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    src.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(vol, ctx.currentTime + delay);
    src.start(ctx.currentTime + delay);
  } catch {}
}

export const sfx = {
  // Clic générique (boutons)
  click() {
    osc(900, 0.04, 'square', 0.07);
  },

  // Case sûre (Mines) / bonne réponse (Hilo)
  ping() {
    osc(1047, 0.14, 'sine', 0.2);
    osc(1319, 0.09, 'sine', 0.13, 0.06);
  },

  // Victoire standard
  win() {
    [523, 659, 784, 1047].forEach((f, i) => osc(f, 0.18, 'sine', 0.22, i * 0.08));
  },

  // Gros gain / jackpot
  bigWin() {
    [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) =>
      osc(f, 0.28, 'sine', 0.3, i * 0.065),
    );
    noise(0.2, 0.06, 0.3);
  },

  // Défaite
  lose() {
    osc(280, 0.12, 'sawtooth', 0.18);
    osc(190, 0.2, 'sawtooth', 0.15, 0.1);
  },

  // Mine / crash explosion
  explosion() {
    noise(0.55, 0.35);
    osc(70, 0.4, 'sawtooth', 0.22);
    osc(40, 0.45, 'sine', 0.15, 0.06);
  },

  // Cashout (pluie de pièces)
  cashout() {
    [1319, 1175, 1047, 880, 784].forEach((f, i) =>
      osc(f, 0.12, 'sine', 0.18, i * 0.045),
    );
    noise(0.1, 0.05, 0.18);
  },

  // Flip de carte (Hilo)
  cardFlip() {
    noise(0.07, 0.13);
    osc(700, 0.05, 'square', 0.06, 0.015);
  },

  // Lancer de dés
  diceRoll() {
    for (let i = 0; i < 5; i++) noise(0.045, 0.1, i * 0.065);
  },

  // Tick pendant Crash (tension progressive)
  tick(mult = 1) {
    const freq = Math.min(150 + mult * 25, 1100);
    osc(freq, 0.025, 'square', 0.045);
  },

  // Crash BOOM
  crashBoom() {
    noise(0.7, 0.42);
    osc(55, 0.65, 'sawtooth', 0.28);
    osc(100, 0.4, 'sawtooth', 0.18, 0.06);
  },

  // Succès débloqué
  achievement() {
    [784, 988, 1175, 1568].forEach((f, i) =>
      osc(f, 0.22, 'sine', 0.26, i * 0.09),
    );
  },

  // Pièce reçue (virement)
  coin() {
    osc(1200, 0.09, 'sine', 0.18);
    osc(1500, 0.07, 'sine', 0.13, 0.045);
  },

  // Jackpot progressif
  jackpot() {
    [392, 523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) =>
      osc(f, 0.32, 'sine', 0.35, i * 0.06),
    );
    noise(0.25, 0.08, 0.4);
  },

  toggleMute(): boolean {
    _muted = !_muted;
    return _muted;
  },

  isMuted(): boolean {
    return _muted;
  },
};
