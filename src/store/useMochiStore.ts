import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { soundFx } from '../utils/sound';

export type MascotState =
  | 'idle'
  | 'waving'
  | 'alert'
  | 'sleeping'
  | 'dragOver'
  | 'processing'
  | 'dizzy';

export type Language = 'en' | 'fa';
export type AnimationSpeed = 'chill' | 'normal' | 'energetic';
export type SettingsSide = 'left' | 'right';

export interface TimeCapsule {
  id: string;
  message: string;
  createdAt: number;
  targetTime: number;
  completed: boolean;
}

export interface SpeechBubbleAction {
  label: string;
  onClick: () => void;
  isPrimary?: boolean;
  isDanger?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface SpeechBubbleMessage {
  id: string;
  text: string;
  icon?: string;
  timeoutMs?: number;
  countdownSeconds?: number;
  actions?: SpeechBubbleAction[];
  onTimeout?: () => void;
}

export interface MochiStoreState {
  // Mascot & UI States
  mascotState: MascotState;
  sleepSource: 'auto' | 'manual' | null;
  lang: Language;
  isSettingsOpen: boolean;
  settingsSide: SettingsSide;
  isWindowVisible: boolean;

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

  // Powers (Module 1 - 5)
  clipboardGuardianEnabled: boolean;
  systemVitalsEnabled: boolean;
  focusMode: boolean;
  vitalsThreshold: number; // Default 88%

  // Runtime Powers State
  systemVitals: { memoryPercent: number; cpuPercent: number; topProcess: string };
  isHighSystemLoad: boolean;
  speechBubble: SpeechBubbleMessage | null;
  timeCapsules: TimeCapsule[];
  isTimeCapsuleModalOpen: boolean;
  activeCapsuleAlarm: TimeCapsule | null;

  // Actions
  setMascotState: (state: MascotState, source?: 'auto' | 'manual') => void;
  cycleMood: () => void;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  setIsSettingsOpen: (isOpen: boolean) => Promise<void>;
  toggleSettings: () => Promise<void>;
  setSettingsSide: (side: SettingsSide) => void;
  setWindowVisible: (visible: boolean) => void;

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

  // Powers Actions
  setClipboardGuardianEnabled: (enabled: boolean) => void;
  setSystemVitalsEnabled: (enabled: boolean) => void;
  setFocusMode: (enabled: boolean) => void;
  toggleFocusMode: () => void;
  setVitalsThreshold: (threshold: number) => void;
  setSystemVitals: (vitals: { memoryPercent: number; cpuPercent: number; topProcess: string }) => void;
  setIsHighSystemLoad: (isHigh: boolean) => void;

  showSpeechBubble: (message: SpeechBubbleMessage) => void;
  hideSpeechBubble: () => void;

  addTimeCapsule: (message: string, durationMinutes: number) => void;
  deleteTimeCapsule: (id: string) => void;
  acknowledgeCapsuleAlarm: (id: string) => void;
  setIsTimeCapsuleModalOpen: (open: boolean) => void;

  resetPosition: () => Promise<void>;
  quitApp: () => Promise<void>;
}

export const useMochiStore = create<MochiStoreState>()(
  persist(
    (set, get) => ({
      mascotState: 'idle',
      sleepSource: null,
      lang: 'fa',
      isSettingsOpen: false,
      settingsSide: 'left',
      isWindowVisible: true,

      alwaysOnTop: true,
      showInTaskbar: true,
      autonomousMode: true,
      globalMouseTracking: true,
      autoSleepDelay: 180000, // 3 minutes default
      mascotScale: 0.76, // 10% smaller, delicate & cute
      mascotOpacity: 1.0,
      animSpeed: 'normal',
      soundEnabled: true,

      // Powers defaults
      clipboardGuardianEnabled: true,
      systemVitalsEnabled: true,
      focusMode: false,
      vitalsThreshold: 88,

      systemVitals: { memoryPercent: 0, cpuPercent: 0, topProcess: 'System' },
      isHighSystemLoad: false,
      speechBubble: null,
      timeCapsules: [],
      isTimeCapsuleModalOpen: false,
      activeCapsuleAlarm: null,

      setMascotState: (state, source) => {
        if (get().soundEnabled && get().mascotState !== state) {
          if (state === 'sleeping') {
            soundFx.sleepChirp();
          } else if (state === 'dizzy') {
            soundFx.dizzy();
          } else if (state === 'waving') {
            soundFx.pop();
          }
        }
        set({
          mascotState: state,
          sleepSource: state === 'sleeping' ? (source || 'manual') : null,
        });
      },

      cycleMood: () => {
        const order: MascotState[] = ['idle', 'waving', 'alert', 'sleeping'];
        const current = get().mascotState;
        const nextIdx = (order.indexOf(current) + 1) % order.length;
        const nextState = order[nextIdx];
        get().setMascotState(nextState, 'manual');
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
          const side = await invoke<string>('set_settings_open', { open: isOpen });
          if (side === 'left' || side === 'right') {
            set({ settingsSide: side as SettingsSide });
          }
        } catch {
          // Ignore in web preview
        }
        if (get().soundEnabled) soundFx.glassTick();
        set({ isSettingsOpen: isOpen });
      },

      toggleSettings: async () => {
        await get().setIsSettingsOpen(!get().isSettingsOpen);
      },

      setSettingsSide: (side) => {
        set({ settingsSide: side });
      },

      setWindowVisible: (visible) => {
        set({ isWindowVisible: visible });
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

      // Powers Actions
      setClipboardGuardianEnabled: (enabled) => {
        if (get().soundEnabled) soundFx.glassTick();
        set({ clipboardGuardianEnabled: enabled });
      },

      setSystemVitalsEnabled: (enabled) => {
        if (get().soundEnabled) soundFx.glassTick();
        set({ systemVitalsEnabled: enabled });
      },

      setFocusMode: (enabled) => {
        if (enabled) {
          set({ focusMode: true, speechBubble: null });
        } else {
          set({ focusMode: false });
        }
        if (get().soundEnabled) soundFx.glassTick();
      },

      toggleFocusMode: () => {
        get().setFocusMode(!get().focusMode);
      },

      setVitalsThreshold: (threshold) => {
        set({ vitalsThreshold: threshold });
      },

      setSystemVitals: (vitals) => {
        const threshold = get().vitalsThreshold;
        const isHigh = vitals.memoryPercent >= threshold || vitals.cpuPercent >= threshold;
        set({
          systemVitals: vitals,
          isHighSystemLoad: isHigh,
        });
      },

      setIsHighSystemLoad: (isHigh) => {
        set({ isHighSystemLoad: isHigh });
      },

      showSpeechBubble: (message) => {
        // Suppress all notifications & bubbles when in Focus & Calm mode!
        if (get().focusMode) return;
        set({ speechBubble: message });
      },

      hideSpeechBubble: () => {
        set({ speechBubble: null });
      },

      addTimeCapsule: (message, durationMinutes) => {
        const newCapsule: TimeCapsule = {
          id: 'tc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          message,
          createdAt: Date.now(),
          targetTime: Date.now() + durationMinutes * 60 * 1000,
          completed: false,
        };
        const updated = [...get().timeCapsules, newCapsule];
        set({
          timeCapsules: updated,
          isTimeCapsuleModalOpen: false,
        });
        get().setMascotState('processing');
        soundFx.nomNom();
        setTimeout(() => {
          if (get().mascotState === 'processing') {
            get().setMascotState('idle');
          }
        }, 1500);
      },

      deleteTimeCapsule: (id) => {
        const updated = get().timeCapsules.filter((tc) => tc.id !== id);
        set({ timeCapsules: updated });
        if (get().soundEnabled) soundFx.glassTick();
      },

      acknowledgeCapsuleAlarm: (id) => {
        const updated = get().timeCapsules.map((tc) =>
          tc.id === id ? { ...tc, completed: true } : tc
        );
        set({
          timeCapsules: updated,
          activeCapsuleAlarm: null,
        });
        if (get().soundEnabled) soundFx.magicChime();
        get().hideSpeechBubble();
      },

      setIsTimeCapsuleModalOpen: (open) => {
        if (get().soundEnabled) soundFx.pop();
        set({ isTimeCapsuleModalOpen: open });
      },

      resetPosition: async () => {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('reset_window_position');
        } catch {
          // Ignore
        }
        if (get().soundEnabled) soundFx.pop();
        set({ isSettingsOpen: false });
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
        clipboardGuardianEnabled: state.clipboardGuardianEnabled,
        systemVitalsEnabled: state.systemVitalsEnabled,
        focusMode: state.focusMode,
        vitalsThreshold: state.vitalsThreshold,
        timeCapsules: state.timeCapsules,
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
