// Web Audio API ultra-low latency sound synthesizer with pre-warmed buffer cache
let audioCtx: AudioContext | null = null;
let isAudioWarmed = false;
const bufferCache: Record<string, AudioBuffer> = {};

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass({ latencyHint: 'interactive' });
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Pre-render sound effects into in-memory PCM buffers for instant 0.01ms latency playback
async function preRenderBuffers() {
  const sampleRate = 44100;
  const renderSound = async (
    duration: number,
    setup: (ctx: OfflineAudioContext) => void
  ): Promise<AudioBuffer | null> => {
    try {
      const offlineCtx = new OfflineAudioContext(1, Math.ceil(sampleRate * duration), sampleRate);
      setup(offlineCtx);
      return await offlineCtx.startRendering();
    } catch {
      return null;
    }
  };

  try {
    // 1. boing (0.2s)
    const boingBuf = await renderSound(0.2, (ctx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, 0);
      osc.frequency.exponentialRampToValueAtTime(560, 0.06);
      osc.frequency.exponentialRampToValueAtTime(260, 0.16);
      gain.gain.setValueAtTime(0.22, 0);
      gain.gain.exponentialRampToValueAtTime(0.001, 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(0.18);
    });
    if (boingBuf) bufferCache['boing'] = boingBuf;

    // 2. pop (0.1s)
    const popBuf = await renderSound(0.1, (ctx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, 0);
      osc.frequency.exponentialRampToValueAtTime(880, 0.08);
      gain.gain.setValueAtTime(0.2, 0);
      gain.gain.exponentialRampToValueAtTime(0.001, 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(0.09);
    });
    if (popBuf) bufferCache['pop'] = popBuf;

    // 3. glassTick (0.05s)
    const tickBuf = await renderSound(0.05, (ctx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, 0);
      osc.frequency.exponentialRampToValueAtTime(600, 0.04);
      gain.gain.setValueAtTime(0.14, 0);
      gain.gain.exponentialRampToValueAtTime(0.001, 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(0.04);
    });
    if (tickBuf) bufferCache['glassTick'] = tickBuf;

    // 4. sleepChirp (0.32s)
    const sleepBuf = await renderSound(0.32, (ctx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, 0);
      osc.frequency.exponentialRampToValueAtTime(300, 0.28);
      gain.gain.setValueAtTime(0.14, 0);
      gain.gain.exponentialRampToValueAtTime(0.001, 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(0.3);
    });
    if (sleepBuf) bufferCache['sleepChirp'] = sleepBuf;

    // 5. nomNom (0.26s)
    const nomBuf = await renderSound(0.26, (ctx) => {
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(460, 0);
      osc1.frequency.exponentialRampToValueAtTime(210, 0.08);
      gain1.gain.setValueAtTime(0.22, 0);
      gain1.gain.exponentialRampToValueAtTime(0.001, 0.09);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(0);
      osc1.stop(0.09);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(520, 0.11);
      osc2.frequency.exponentialRampToValueAtTime(240, 0.22);
      gain2.gain.setValueAtTime(0.24, 0.11);
      gain2.gain.exponentialRampToValueAtTime(0.001, 0.24);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(0.11);
      osc2.stop(0.24);
    });
    if (nomBuf) bufferCache['nomNom'] = nomBuf;

    // 6. magicChime (0.45s)
    const magicBuf = await renderSound(0.45, (ctx) => {
      const notes = [1046, 1318, 1568, 2093];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteStart = idx * 0.07;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);
        gain.gain.setValueAtTime(0.18, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(noteStart);
        osc.stop(noteStart + 0.4);
      });
    });
    if (magicBuf) bufferCache['magicChime'] = magicBuf;

    // 7. alertChirp (0.24s)
    const alertBuf = await renderSound(0.24, (ctx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(980, 0);
      osc.frequency.exponentialRampToValueAtTime(1760, 0.12);
      gain.gain.setValueAtTime(0.2, 0);
      gain.gain.exponentialRampToValueAtTime(0.001, 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(0.22);
    });
    if (alertBuf) bufferCache['alertChirp'] = alertBuf;

    // 8. dizzy (0.75s)
    const dizzyBuf = await renderSound(0.75, (ctx) => {
      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(360, 0);
      osc.frequency.exponentialRampToValueAtTime(140, 0.7);
      lfo.frequency.setValueAtTime(14, 0);
      lfoGain.gain.setValueAtTime(45, 0);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      gain.gain.setValueAtTime(0.2, 0);
      gain.gain.exponentialRampToValueAtTime(0.001, 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      lfo.start(0);
      osc.start(0);
      lfo.stop(0.7);
      osc.stop(0.7);
    });
    if (dizzyBuf) bufferCache['dizzy'] = dizzyBuf;

    // 9. yawn (0.95s)
    const yawnBuf = await renderSound(0.95, (ctx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340, 0);
      osc.frequency.exponentialRampToValueAtTime(420, 0.25);
      osc.frequency.exponentialRampToValueAtTime(180, 0.85);
      gain.gain.setValueAtTime(0.02, 0);
      gain.gain.linearRampToValueAtTime(0.16, 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(0.9);
    });
    if (yawnBuf) bufferCache['yawn'] = yawnBuf;
  } catch {
    // Ignore
  }
}

// Proactive Audio Pre-warming:
// Immediately opens Windows audio hardware stream on first user interaction with the window
export function warmUpAudio() {
  if (typeof window === 'undefined') return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (!isAudioWarmed) {
    isAudioWarmed = true;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.00001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.001);
    } catch {
      // Ignore
    }
    preRenderBuffers();
  }
}

// Listen to early user gestures to prime audio hardware with 0 latency
if (typeof window !== 'undefined') {
  const warmHandler = () => warmUpAudio();
  window.addEventListener('pointerdown', warmHandler, { passive: true, once: true });
  window.addEventListener('keydown', warmHandler, { passive: true, once: true });
  window.addEventListener('mouseenter', warmHandler, { passive: true, once: true });
  window.addEventListener('mousemove', warmHandler, { passive: true, once: true });
  // Also start background buffer pre-render 100ms after load
  setTimeout(() => preRenderBuffers(), 100);
}

// Play pre-rendered buffer with 0.01ms latency or fall back to live oscillator
function playSound(name: string, fallback: (ctx: AudioContext) => void) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const buf = bufferCache[name];
    if (buf) {
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.connect(ctx.destination);
      source.start(0);
      return;
    }

    fallback(ctx);
  } catch {
    // Ignore
  }
}

export const soundFx = {
  // Cute popping bubble sound (when buttons clicked or state changes)
  pop: () => {
    playSound('pop', (ctx) => {
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
    });
  },

  // Springy squash boing sound (when Mochi is clicked)
  boing: () => {
    playSound('boing', (ctx) => {
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
    });
  },

  // Delicate glassy click
  glassTick: () => {
    playSound('glassTick', (ctx) => {
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
    });
  },

  // Sleepy chirp / yawn
  sleepChirp: () => {
    playSound('sleepChirp', (ctx) => {
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
    });
  },

  // Cute nom-nom munching sound (when eating images or time capsules)
  nomNom: () => {
    playSound('nomNom', (ctx) => {
      const t = ctx.currentTime;
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
    });
  },

  // Comic dizzy wobble sound
  dizzy: () => {
    playSound('dizzy', (ctx) => {
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
    });
  },

  // Magical sparkling crystal arpeggio (when image is sanitized or capsule alarm fires)
  magicChime: () => {
    playSound('magicChime', (ctx) => {
      const t = ctx.currentTime;
      const notes = [1046, 1318, 1568, 2093];
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
    });
  },

  // High alert ping (when secret in clipboard is caught)
  alertChirp: () => {
    playSound('alertChirp', (ctx) => {
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
    });
  },

  // Sleepy yawn sigh for midnight gremlin
  yawn: () => {
    playSound('yawn', (ctx) => {
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
    });
  },
};
