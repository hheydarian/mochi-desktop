import React, { useEffect, useState, useRef, Suspense, lazy } from 'react';
import { RadialOrbitalMenu, SpeechBubble } from './components/ui';
import { MochiCanvas } from './components/3d';
import { useMochiStore } from './store/useMochiStore';
import { soundFx } from './utils/sound';

const SettingsModal = lazy(() =>
  import('./components/ui/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const TimeCapsuleModal = lazy(() =>
  import('./components/ui/TimeCapsuleModal').then((m) => ({ default: m.TimeCapsuleModal }))
);

// Sensitive pattern and high-entropy detection for Secret Clipboard Guardian
function isSensitiveText(text: string): boolean {
  if (!text || text.length < 16 || text.length > 8000) return false;
  const trimmed = text.trim();

  // 1. Explicit API keys and Token signatures
  const patterns = [
    /\bsk-[a-zA-Z0-9_-]{20,}\b/, // OpenAI
    /\bghp_[a-zA-Z0-9]{30,}\b/, // GitHub PAT
    /\bgithub_pat_[a-zA-Z0-9_]{30,}\b/, // GitHub fine-grained PAT
    /\bAIza[0-9A-Za-z-_]{35}\b/, // Google API Key
    /\beyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/, // JWT Token
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/, // RSA/OpenSSL Private Key
    /\bxox[baprs]-[0-9a-zA-Z-]{20,}\b/, // Slack Token
    /\bAKIA[0-9A-Z]{16}\b/, // AWS Access Key
  ];

  for (const pattern of patterns) {
    if (pattern.test(trimmed)) return true;
  }

  // 2. High-entropy token / password detection (long string without spaces)
  if (trimmed.length >= 28 && !trimmed.includes(' ') && !trimmed.includes('\n')) {
    const freq: Record<string, number> = {};
    for (const char of trimmed) {
      freq[char] = (freq[char] || 0) + 1;
    }
    let entropy = 0;
    const len = trimmed.length;
    for (const char in freq) {
      const p = freq[char] / len;
      entropy -= p * Math.log2(p);
    }
    if (entropy > 4.15) return true;
  }

  return false;
}

export const App: React.FC = () => {
  const {
    setMascotState,
    isSettingsOpen,
    setIsSettingsOpen,
    toggleSettings,
    toggleAlwaysOnTop,
    setWindowVisible,
    settingsSide,
    setSettingsSide,
    isTimeCapsuleModalOpen,
    speechBubble,
    clipboardGuardianEnabled,
    focusMode,
    setSystemVitals,
    setIsHighSystemLoad,
    showSpeechBubble,
    hideSpeechBubble,
    deleteTimeCapsule,
    lang,
  } = useMochiStore();

  const [isHovered, setIsHovered] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastAlertedClipboardRef = useRef<string>('');
  const alertedCapsulesRef = useRef<Set<string>>(new Set());

  // Proactive working set trim 1.5s after mount to immediately flush startup cache from RAM
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('trim_memory');
      } catch {
        // Ignore in browser
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Window expands ONLY for Settings or TimeCapsule modal (NEVER for speech bubbles, eliminating position jumps!)
  const isModalOpen = isSettingsOpen || isTimeCapsuleModalOpen;

  // 1. Mathematically Zero-Jump Window Expansion for Settings Panel
  useEffect(() => {
    const updateWindowSize = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const { invoke } = await import('@tauri-apps/api/core');
        const win = getCurrentWindow();
        const side = await invoke<string>('set_settings_open', {
          window: win,
          open: isModalOpen,
        });
        if (side === 'left' || side === 'right') {
          setSettingsSide(side);
        }
      } catch {
        // Not in Tauri runtime
      }
    };

    updateWindowSize();
  }, [isModalOpen, setSettingsSide]);

  // 2. Auto-dock window to bottom-right corner of the monitor on initial launch (320x280)
  useEffect(() => {
    const dockToBottomRight = async () => {
      try {
        const { getCurrentWindow, currentMonitor, PhysicalPosition } = await import(
          '@tauri-apps/api/window'
        );
        const win = getCurrentWindow();
        const monitor = await currentMonitor();
        if (monitor) {
          const size = await win.outerSize();
          const scale = monitor.scaleFactor || 1;
          const marginX = Math.round(4 * scale);
          const marginY = Math.round(4 * scale);
          const x = monitor.size.width - size.width - marginX;
          const y = monitor.size.height - size.height - marginY;
          await win.setPosition(new PhysicalPosition(x, y));
        }
      } catch {
        // Not in Tauri runtime
      }
    };

    dockToBottomRight();
  }, []);

  // 3. Global Context Menu Suppression
  useEffect(() => {
    const disableContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', disableContextMenu, { capture: true });
    return () => window.removeEventListener('contextmenu', disableContextMenu, { capture: true });
  }, []);

  // 4. Tauri Tray Menu & Visibility Event Listeners
  useEffect(() => {
    let unlistenSettings: (() => void) | undefined;
    let unlistenPin: (() => void) | undefined;
    let unlistenVisibility: (() => void) | undefined;

    const setupTrayListeners = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlistenSettings = await listen('open-settings', () => {
          setIsSettingsOpen(true);
        });
        unlistenPin = await listen('toggle-always-on-top', () => {
          toggleAlwaysOnTop();
        });
        unlistenVisibility = await listen<boolean>('window-visibility-changed', (event) => {
          setWindowVisible(event.payload);
        });
      } catch {
        // Not in Tauri runtime
      }
    };

    setupTrayListeners();

    return () => {
      if (unlistenSettings) unlistenSettings();
      if (unlistenPin) unlistenPin();
      if (unlistenVisibility) unlistenVisibility();
    };
  }, [setIsSettingsOpen, toggleAlwaysOnTop, setWindowVisible]);

  // 5. Frustration Comfort & System Vitals Listeners (Rust event bridge)
  useEffect(() => {
    let unlistenVitals: (() => void) | undefined;

    const setupRustListeners = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');

        // System Vitals Stream: RAM load from single background supervisor
        unlistenVitals = await listen<{
          cpu_percent: number;
          memory_percent: number;
          top_process: string;
          is_high_load: boolean;
        }>('system-vitals', (event) => {
          const { memory_percent, cpu_percent, top_process, is_high_load } = event.payload;
          setSystemVitals({
            memoryPercent: memory_percent,
            cpuPercent: cpu_percent,
            topProcess: top_process,
          });
          setIsHighSystemLoad(is_high_load);
        });
      } catch {
        // Not in Tauri runtime
      }
    };

    setupRustListeners();

    return () => {
      if (unlistenVitals) unlistenVitals();
    };
  }, [setSystemVitals, setIsHighSystemLoad]);

  // 6. Secret Clipboard Guardian Scanner (Pauses in Focus Mode to respect concentration)
  useEffect(() => {
    if (!clipboardGuardianEnabled || focusMode) return;

    const checkClipboard = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const text = await invoke<string>('read_clipboard_text');
        if (!text || text === lastAlertedClipboardRef.current) return;

        if (isSensitiveText(text)) {
          lastAlertedClipboardRef.current = text;
          setMascotState('alert');
          soundFx.alertChirp();

          showSpeechBubble({
            id: 'clipboard_guardian_' + Date.now(),
            icon: 'shield',
            text:
              lang === 'fa'
                ? 'هشدار! کلید محرمانه/رمز در کلیپ‌بوردت مانده است! ممکن است تصادفاً جایی Paste شود!'
                : 'Warning! Secret API key or password left in your clipboard! It could be leaked accidentally!',
            countdownSeconds: 60,
            actions: [
              {
                label: lang === 'fa' ? 'پاکسازی همین الان 🧼' : 'Clear Now 🧼',
                variant: 'danger',
                onClick: async () => {
                  try {
                    await invoke('clear_clipboard');
                    lastAlertedClipboardRef.current = '';
                    hideSpeechBubble();
                    setMascotState('idle');
                    soundFx.nomNom();
                    showSpeechBubble({
                      id: 'cleared_' + Date.now(),
                      icon: 'shield',
                      text:
                        lang === 'fa'
                          ? 'کلیپ‌بورد با موفقیت پاکسازی شد 🧼🛡️'
                          : 'Clipboard securely cleared 🧼🛡️',
                      timeoutMs: 3000,
                    });
                  } catch {
                    hideSpeechBubble();
                    setMascotState('idle');
                  }
                },
              },
              {
                label: lang === 'fa' ? 'نادیده گرفتن' : 'Ignore',
                variant: 'secondary',
                onClick: () => {
                  hideSpeechBubble();
                  setMascotState('idle');
                },
              },
            ],
            onTimeout: async () => {
              try {
                await invoke('clear_clipboard');
                lastAlertedClipboardRef.current = '';
                setMascotState('idle');
                soundFx.nomNom();
                showSpeechBubble({
                  id: 'auto_cleared_' + Date.now(),
                  icon: 'shield',
                  text:
                    lang === 'fa'
                      ? 'کلیپ‌بوردت برای امنیت خودت خالی شد 🧼🛡️'
                      : 'Clipboard automatically cleared for your safety 🧼🛡️',
                  timeoutMs: 4000,
                });
              } catch {
                setMascotState('idle');
              }
            },
          });
        }
      } catch {
        // Not in Tauri runtime
      }
    };

    const interval = setInterval(checkClipboard, 3500);
    return () => clearInterval(interval);
  }, [clipboardGuardianEnabled, focusMode, lang, setMascotState, showSpeechBubble, hideSpeechBubble]);

  // 7. Time Capsule Alarm Watcher
  useEffect(() => {
    const checkCapsules = () => {
      const now = Date.now();
      const capsules = useMochiStore.getState().timeCapsules;

      for (const cap of capsules) {
        if (cap.targetTime <= now && !alertedCapsulesRef.current.has(cap.id)) {
          alertedCapsulesRef.current.add(cap.id);
          setMascotState('waving');
          soundFx.magicChime();

          showSpeechBubble({
            id: 'capsule_alert_' + cap.id,
            icon: 'capsule',
            text: `⏳ ${cap.message}`,
            actions: [
              {
                label: lang === 'fa' ? 'تحویل گرفتم ✓' : 'Received ✓',
                variant: 'primary',
                onClick: () => {
                  deleteTimeCapsule(cap.id);
                  hideSpeechBubble();
                  if (useMochiStore.getState().mascotState === 'waving') {
                    setMascotState('idle');
                  }
                },
              },
            ],
          });
          break;
        }
      }
    };

    const interval = setInterval(checkCapsules, 5000);
    return () => clearInterval(interval);
  }, [lang, setMascotState, showSpeechBubble, hideSpeechBubble, deleteTimeCapsule]);

  // 8. Window Drag Interaction
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 0 && !isModalOpen) {
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePointerMove = async (e: React.PointerEvent) => {
    if (pointerStartRef.current && e.buttons === 1) {
      const dx = Math.abs(e.clientX - pointerStartRef.current.x);
      const dy = Math.abs(e.clientY - pointerStartRef.current.y);
      if (dx > 4 || dy > 4) {
        pointerStartRef.current = null;
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().startDragging();
        } catch {
          // Ignore
        }
      }
    }
  };

  const handlePointerUp = () => {
    pointerStartRef.current = null;
  };

  // Clicking Mochi while settings is open toggles it closed
  const handleMascotClick = () => {
    if (isSettingsOpen) {
      setIsSettingsOpen(false);
    }
  };

  // Right-clicking on Mochi opens/closes the settings modal
  const handleMascotContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSettings();
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        pointerStartRef.current = null;
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      dir="ltr"
      className="relative w-screen h-screen bg-transparent overflow-hidden select-none"
      style={{
        background: 'transparent',
        backgroundColor: 'transparent',
      }}
    >
      {/* Side Panel for SettingsModal or TimeCapsuleModal when explicitly opened */}
      {isModalOpen && (
        <div
          className={`absolute bottom-3 ${
            settingsSide === 'right' ? 'right-3' : 'left-3'
          } w-[390px] h-[454px] flex items-center justify-center pointer-events-auto z-40`}
        >
          <Suspense fallback={null}>
            {isSettingsOpen ? <SettingsModal /> : <TimeCapsuleModal />}
          </Suspense>
        </div>
      )}

      {/* Mascot Viewport (Fixed at 200x230 - NEVER resizes or shifts camera aspect ratio!) */}
      <div
        onContextMenu={handleMascotContextMenu}
        className={`absolute bottom-2 ${
          settingsSide === 'right' ? 'left-2' : 'right-2'
        } w-[200px] h-[230px] flex items-center justify-center flex-shrink-0 pointer-events-auto z-30`}
      >
        {/* Real 3D Floating Mochi Mascot */}
        <MochiCanvas
          isHovered={isHovered}
          onMascotClick={handleMascotClick}
          onContextMenu={handleMascotContextMenu}
        />

        {/* Radial Orbital Glass Menu (Appears on Hover when Settings is closed) */}
        <RadialOrbitalMenu isVisible={isHovered && !isSettingsOpen} />
      </div>

      {/* Floating Speech Bubble (Rendered in upper safe space above Mochi - ZERO window resize, ZERO lag!) */}
      {speechBubble && !isModalOpen && (
        <SpeechBubble side={settingsSide} />
      )}
    </div>
  );
};

export default App;
