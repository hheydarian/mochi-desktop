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

// ============================================================================
// Procedural Web Audio Ambient Radio Synthesizer (Zero Assets, 100% Client-side)
// Modes: 'rain' | 'fireplace' | 'binaural' | 'off'
// ============================================================================

export type RadioMode = 'off' | 'rain' | 'fireplace' | 'binaural';

interface RadioState {
  currentMode: RadioMode;
  masterGain: GainNode | null;
  activeNodes: { stop: () => void }[];
  intervalIds: number[];
  volume: number;
}

const radioState: RadioState = {
  currentMode: 'off',
  masterGain: null,
  activeNodes: [],
  intervalIds: [],
  volume: 0.5,
};

export const ambientRadio = {
  getMode: (): RadioMode => radioState.currentMode,

  setVolume: (vol: number) => {
    radioState.volume = Math.max(0, Math.min(1, vol));
    if (radioState.masterGain) {
      const ctx = getAudioContext();
      if (ctx) {
        radioState.masterGain.gain.setTargetAtTime(radioState.volume * 0.35, ctx.currentTime, 0.05);
      }
    }
  },

  stop: () => {
    if (radioState.currentMode === 'off') return;
    radioState.intervalIds.forEach((id) => clearInterval(id));
    radioState.intervalIds = [];

    const ctx = getAudioContext();
    if (radioState.masterGain && ctx) {
      radioState.masterGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
      setTimeout(() => {
        radioState.activeNodes.forEach((node) => {
          try {
            node.stop();
          } catch {}
        });
        radioState.activeNodes = [];
        radioState.masterGain = null;
        radioState.currentMode = 'off';
      }, 100);
    } else {
      radioState.currentMode = 'off';
    }
  },

  start: (mode: 'rain' | 'fireplace' | 'binaural', volume?: number) => {
    if (volume !== undefined) {
      radioState.volume = Math.max(0, Math.min(1, volume));
    }
    ambientRadio.stop();

    const ctx = getAudioContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(radioState.volume * 0.35, ctx.currentTime + 0.3);
    masterGain.connect(ctx.destination);
    radioState.masterGain = masterGain;
    radioState.currentMode = mode;

    if (mode === 'rain') {
      // 1. Procedural Pink Noise Buffer for continuous gentle rain
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Lowpass filter to simulate rain behind a window pane
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(850, ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(masterGain);
      whiteNoise.start();

      radioState.activeNodes.push({
        stop: () => whiteNoise.stop(),
      });

      // Subtle water droplet modulation
      const dropTimer = window.setInterval(() => {
        if (Math.random() > 0.45 || radioState.currentMode !== 'rain') return;
        try {
          const osc = ctx.createOscillator();
          const dropGain = ctx.createGain();
          const freq = 1200 + Math.random() * 800;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.6, ctx.currentTime + 0.04);
          dropGain.gain.setValueAtTime(0.04, ctx.currentTime);
          dropGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
          osc.connect(dropGain);
          dropGain.connect(masterGain);
          osc.start();
          osc.stop(ctx.currentTime + 0.05);
        } catch {}
      }, 350);

      radioState.intervalIds.push(dropTimer);
    } else if (mode === 'fireplace') {
      // 1. Warm low rumble hearth base
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
      }

      const rumbleSource = ctx.createBufferSource();
      rumbleSource.buffer = noiseBuffer;
      rumbleSource.loop = true;

      const rumbleFilter = ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.setValueAtTime(140, ctx.currentTime);

      rumbleSource.connect(rumbleFilter);
      rumbleFilter.connect(masterGain);
      rumbleSource.start();

      radioState.activeNodes.push({
        stop: () => rumbleSource.stop(),
      });

      // 2. Random procedural crackle pulses
      const crackleTimer = window.setInterval(() => {
        if (radioState.currentMode !== 'fireplace') return;
        const crackleCount = Math.floor(Math.random() * 3) + 1;
        for (let c = 0; c < crackleCount; c++) {
          setTimeout(() => {
            if (radioState.currentMode !== 'fireplace') return;
            try {
              const buffer = ctx.createBuffer(1, 80, ctx.sampleRate);
              const data = buffer.getChannelData(0);
              for (let i = 0; i < 80; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 15);
              }
              const crackle = ctx.createBufferSource();
              crackle.buffer = buffer;
              const crackleGain = ctx.createGain();
              crackleGain.gain.setValueAtTime(0.08 + Math.random() * 0.12, ctx.currentTime);
              crackle.connect(crackleGain);
              crackleGain.connect(masterGain);
              crackle.start();
            } catch {}
          }, Math.random() * 220);
        }
      }, 180);

      radioState.intervalIds.push(crackleTimer);
    } else if (mode === 'binaural') {
      // Deep focus 10Hz Alpha Binaural Wave (Left = 200Hz, Right = 210Hz)
      const merger = ctx.createChannelMerger(2);

      const oscLeft = ctx.createOscillator();
      oscLeft.type = 'sine';
      oscLeft.frequency.setValueAtTime(200, ctx.currentTime);
      const gainLeft = ctx.createGain();
      gainLeft.gain.setValueAtTime(0.3, ctx.currentTime);
      oscLeft.connect(gainLeft);
      gainLeft.connect(merger, 0, 0);

      const oscRight = ctx.createOscillator();
      oscRight.type = 'sine';
      oscRight.frequency.setValueAtTime(210, ctx.currentTime); // +10Hz Alpha beat
      const gainRight = ctx.createGain();
      gainRight.gain.setValueAtTime(0.3, ctx.currentTime);
      oscRight.connect(gainRight);
      gainRight.connect(merger, 0, 1);

      // Warm background sub-harmonic pad (100Hz triangle wave)
      const subPad = ctx.createOscillator();
      subPad.type = 'triangle';
      subPad.frequency.setValueAtTime(100, ctx.currentTime);
      const subFilter = ctx.createBiquadFilter();
      subFilter.type = 'lowpass';
      subFilter.frequency.setValueAtTime(220, ctx.currentTime);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.12, ctx.currentTime);
      subPad.connect(subFilter);
      subFilter.connect(subGain);
      subGain.connect(masterGain);

      merger.connect(masterGain);

      oscLeft.start();
      oscRight.start();
      subPad.start();

      radioState.activeNodes.push({
        stop: () => {
          oscLeft.stop();
          oscRight.stop();
          subPad.stop();
        },
      });
    }
  },
};
