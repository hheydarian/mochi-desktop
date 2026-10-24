import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { soundFx } from '../utils/sound';

export type MascotState =
  | 'idle'
  | 'waving'
  | 'alert'
  | 'sleeping'
  | 'dragOver'
  | 'processing';

export type Language = 'en' | 'fa';
export type AnimationSpeed = 'chill' | 'normal' | 'energetic';

export interface MochiStoreState {
  // Mascot & UI States
  mascotState: MascotState;
  lang: Language;
  isSettingsOpen: boolean;

  // Real-time Settings
  alwaysOnTop: boolean;
  showInTaskbar: boolean;
  autonomousMode: boolean;
  globalMouseTracking: boolean;
  autoSleepDelay: number; // in milliseconds (e.g. 60000, 180000, 300000, 0 for off)
  mascotScale: number; // 0.45 to 1.30, default 0.76
  mascotOpacity: number; // 0.30 to 1.0, default 1.0
  animSpeed: AnimationSpeed;
  soundEnabled: boolean;

  // Actions
  setMascotState: (state: MascotState) => void;
  cycleMood: () => void;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  setIsSettingsOpen: (isOpen: boolean) => Promise<void>;
  toggleSettings: () => Promise<void>;

  setAlwaysOnTop: (enabled: boolean) => Promise<void>;
  toggleAlwaysOnTop: () => Promise<void>;
  setShowInTaskbar: (enabled: boolean) => Promise<void>;
  setAutonomousMode: (enabled: boolean) => void;
  setGlobalMouseTracking: (enabled: boolean) => void;
  setAutoSleepDelay: (delayMs: number) => void;
  setMascotScale: (scale: number) => void;
  setMascotOpacity: (opacity: number) => void;
  setAnimSpeed: (speed: AnimationSpeed) => void;
  setSoundEnabled: (enabled: boolean) => void;

  resetPosition: () => Promise<void>;
  quitApp: () => Promise<void>;
}

export const useMochiStore = create<MochiStoreState>()(
  persist(
    (set, get) => ({
      mascotState: 'idle',
      lang: 'fa',
      isSettingsOpen: false,

      alwaysOnTop: true,
      showInTaskbar: true,
      autonomousMode: true,
      globalMouseTracking: true,
      autoSleepDelay: 180000, // 3 minutes default
      mascotScale: 0.76, // 10% smaller, delicate & cute
      mascotOpacity: 1.0,
      animSpeed: 'normal',
      soundEnabled: true,

      setMascotState: (state) => {
        if (get().soundEnabled && get().mascotState !== state) {
          if (state === 'sleeping') {
            soundFx.sleepChirp();
          } else {
            soundFx.pop();
          }
        }
        set({ mascotState: state });
      },

      cycleMood: () => {
        const order: MascotState[] = ['idle', 'waving', 'alert', 'sleeping'];
        const current = get().mascotState;
        const nextIdx = (order.indexOf(current) + 1) % order.length;
        const nextState = order[nextIdx];
        get().setMascotState(nextState);
      },

      setLang: (lang) => {
        if (typeof document !== 'undefined') {
          document.documentElement.lang = lang;
          document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
        }
        if (get().soundEnabled) soundFx.glassTick();
        set({ lang });
      },

      toggleLang: () => {
        const next = get().lang === 'fa' ? 'en' : 'fa';
        get().setLang(next);
      },

      setIsSettingsOpen: async (isOpen) => {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('set_settings_open', { open: isOpen });
        } catch {
          // Ignore in web preview
        }
        if (get().soundEnabled) soundFx.glassTick();
        set({ isSettingsOpen: isOpen });
      },

      toggleSettings: async () => {
        await get().setIsSettingsOpen(!get().isSettingsOpen);
      },

      setAlwaysOnTop: async (enabled) => {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('set_window_always_on_top', { alwaysOnTop: enabled });
        } catch {
          // Ignore
        }
        if (get().soundEnabled) soundFx.glassTick();
        set({ alwaysOnTop: enabled });
      },

      toggleAlwaysOnTop: async () => {
        await get().setAlwaysOnTop(!get().alwaysOnTop);
      },

      setShowInTaskbar: async (enabled) => {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('set_window_skip_taskbar', { skip: !enabled });
        } catch {
          // Ignore
        }
        if (get().soundEnabled) soundFx.glassTick();
        set({ showInTaskbar: enabled });
      },

      setAutonomousMode: (enabled) => {
        if (get().soundEnabled) soundFx.glassTick();
        set({ autonomousMode: enabled });
      },

      setGlobalMouseTracking: (enabled) => {
        if (get().soundEnabled) soundFx.glassTick();
        set({ globalMouseTracking: enabled });
      },

      setAutoSleepDelay: (delayMs) => {
        if (get().soundEnabled) soundFx.glassTick();
        set({ autoSleepDelay: delayMs });
      },

      setMascotScale: (scale) => set({ mascotScale: scale }),

      setMascotOpacity: (opacity) => set({ mascotOpacity: opacity }),

      setAnimSpeed: (speed) => {
        if (get().soundEnabled) soundFx.glassTick();
        set({ animSpeed: speed });
      },

      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),

      resetPosition: async () => {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('reset_window_position');
        } catch {
          // Ignore
        }
        if (get().soundEnabled) soundFx.pop();
      },

      quitApp: async () => {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('quit_app');
        } catch {
          // Ignore
        }
      },
    }),
    {
      name: 'mochi-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        lang: state.lang,
        alwaysOnTop: state.alwaysOnTop,
        showInTaskbar: state.showInTaskbar,
        autonomousMode: state.autonomousMode,
        globalMouseTracking: state.globalMouseTracking,
        autoSleepDelay: state.autoSleepDelay,
        mascotScale: state.mascotScale,
        mascotOpacity: state.mascotOpacity,
        animSpeed: state.animSpeed,
        soundEnabled: state.soundEnabled,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && typeof document !== 'undefined') {
          document.documentElement.lang = state.lang;
          document.documentElement.dir = state.lang === 'fa' ? 'rtl' : 'ltr';
        }
      },
    }
  )
);
