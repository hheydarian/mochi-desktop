// Web Audio API procedural sound synthesizer for Mochi Desktop
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export const soundFx = {
  // Cute popping bubble sound (when buttons clicked or state changes)
  pop: () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const startTime = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, startTime);
      osc.frequency.exponentialRampToValueAtTime(880, startTime + 0.08);

      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.09);
    } catch {
      // Ignore
    }
  },

  // Springy squash boing sound (when Mochi is clicked)
  boing: () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const startTime = ctx.currentTime;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, startTime);
      osc.frequency.exponentialRampToValueAtTime(560, startTime + 0.06);
      osc.frequency.exponentialRampToValueAtTime(260, startTime + 0.16);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.18);
    } catch {
      // Ignore
    }
  },

  // Delicate glassy click
  glassTick: () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const startTime = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, startTime);
      osc.frequency.exponentialRampToValueAtTime(600, startTime + 0.04);

      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.04);
    } catch {
      // Ignore
    }
  },

  // Sleepy chirp / yawn
  sleepChirp: () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const startTime = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, startTime);
      osc.frequency.exponentialRampToValueAtTime(300, startTime + 0.28);

      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    } catch {
      // Ignore
    }
  },

  // Cute nom-nom munching sound (when eating images or time capsules)
  nomNom: () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;

      // Bite 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(460, t);
      osc1.frequency.exponentialRampToValueAtTime(210, t + 0.08);
      gain1.gain.setValueAtTime(0.22, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(t);
      osc1.stop(t + 0.09);

      // Bite 2 (nom!)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(520, t + 0.11);
      osc2.frequency.exponentialRampToValueAtTime(240, t + 0.22);
      gain2.gain.setValueAtTime(0.24, t + 0.11);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(t + 0.11);
      osc2.stop(t + 0.24);
    } catch {
      // Ignore
    }
  },

  // Comic dizzy wobble sound
  dizzy: () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(360, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.7);

      lfo.frequency.setValueAtTime(14, t);
      lfoGain.gain.setValueAtTime(45, t);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);

      lfo.start(t);
      osc.start(t);
      lfo.stop(t + 0.7);
      osc.stop(t + 0.7);
    } catch {
      // Ignore
    }
  },

  // Magical sparkling crystal arpeggio (when image is sanitized or capsule alarm fires)
  magicChime: () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      const notes = [1046, 1318, 1568, 2093]; // C6, E6, G6, C7

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteStart = t + idx * 0.07;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.18, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.38);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + 0.4);
      });
    } catch {
      // Ignore
    }
  },

  // High alert ping (when secret in clipboard is caught)
  alertChirp: () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(980, t);
      osc.frequency.exponentialRampToValueAtTime(1760, t + 0.12);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.22);
    } catch {
      // Ignore
    }
  },

  // Sleepy yawn sigh for midnight gremlin
  yawn: () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340, t);
      osc.frequency.exponentialRampToValueAtTime(420, t + 0.25);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.85);

      gain.gain.setValueAtTime(0.02, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.9);
    } catch {
      // Ignore
    }
  },
};

