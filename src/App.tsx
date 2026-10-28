import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  RadialOrbitalMenu,
  DropOverlay,
  SettingsModal,
  SpeechBubble,
  TimeCapsuleModal,
} from './components/ui';
import { MochiCanvas } from './components/3d';
import { useMochiStore } from './store/useMochiStore';
import { soundFx } from './utils/sound';

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
    // High Shannon entropy (>4.15 bits/char indicates encrypted/cryptographic/random token)
    if (entropy > 4.15) return true;
  }

  return false;
}

export const App: React.FC = () => {
  const {
    mascotState,
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
    autoSanitizeExif,
    setSystemVitals,
    setIsHighSystemLoad,
    showSpeechBubble,
    hideSpeechBubble,
    deleteTimeCapsule,
    lang,
  } = useMochiStore();

  const [isHovered, setIsHovered] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastAlertedClipboardRef = useRef<string>('');
  const alertedCapsulesRef = useRef<Set<string>>(new Set());

  // Determine if side UI (Settings, TimeCapsule, or SpeechBubble) is open
  const isSideUiOpen = isSettingsOpen || isTimeCapsuleModalOpen || !!speechBubble;

  // 1. Dynamic Window Safe-Zone Resizing (Tauri Window Expansion/Collapse)
  // Expands window to 560x360 with screen boundary clamping when side UI opens,
  // collapses back to 240x260 when closed so desktop clicks are 100% unblocked!
  useEffect(() => {
    const updateWindowSize = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const { invoke } = await import('@tauri-apps/api/core');
        const win = getCurrentWindow();
        const side = await invoke<string>('set_settings_open', {
          window: win,
          open: isSideUiOpen,
        });
        if (side === 'left' || side === 'right') {
          setSettingsSide(side);
        }
      } catch {
        // Not in Tauri runtime
      }
    };

    updateWindowSize();
  }, [isSideUiOpen, setSettingsSide]);

  // 2. Auto-dock window to bottom-right corner of the monitor on initial launch
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

  // 3. Global Context Menu Suppression: Disable browser right-click menu
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
    let unlistenFrustration: (() => void) | undefined;
    let unlistenVitals: (() => void) | undefined;

    const setupRustListeners = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');

        // Frustration Comfort: User typing bursts of backspaces
        unlistenFrustration = await listen('user-frustrated', () => {
          setMascotState('waving');
          soundFx.magicChime();
          showSpeechBubble({
            id: 'frustration_' + Date.now(),
            icon: 'sparkle',
            text:
              lang === 'fa'
                ? 'نفس عمیق بکش رفیق، درستش می‌کنیم! 🌱✨'
                : 'Take a deep breath buddy, we got this! 🌱✨',
            timeoutMs: 5000,
          });

          setTimeout(() => {
            if (useMochiStore.getState().mascotState === 'waving') {
              setMascotState('idle');
            }
          }, 3500);
        });

        // System Vitals Stream: RAM load from single background supervisor
        unlistenVitals = await listen<{
          cpu_percent: number;
          memory_percent: number;
          top_process: string;
          is_high_load: boolean;
        }>('system-vitals', (event) => {
          if (!useMochiStore.getState().systemVitalsEnabled) return;
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
      if (unlistenFrustration) unlistenFrustration();
      if (unlistenVitals) unlistenVitals();
    };
  }, [lang, setMascotState, showSpeechBubble, setSystemVitals, setIsHighSystemLoad]);

  // 6. Secret Clipboard Guardian Periodic Scanner (Every 2.8s)
  useEffect(() => {
    if (!clipboardGuardianEnabled) return;

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

    const interval = setInterval(checkClipboard, 2800);
    return () => clearInterval(interval);
  }, [clipboardGuardianEnabled, lang, setMascotState, showSpeechBubble, hideSpeechBubble]);

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
          break; // Show one at a time
        }
      }
    };

    const interval = setInterval(checkCapsules, 4000);
    return () => clearInterval(interval);
  }, [lang, setMascotState, showSpeechBubble, hideSpeechBubble, deleteTimeCapsule]);

  // 8. Native Rust EXIF/Metadata Stripper File Processor (Zero UI freeze, zero Base64 memory overhead)
  const processDroppedImage = useCallback(
    async (filePath: string) => {
      const lower = filePath.toLowerCase();
      const isImage =
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.png') ||
        lower.endsWith('.webp');

      if (!isImage) {
        setMascotState('processing');
        setTimeout(() => setMascotState('idle'), 1800);
        return;
      }

      if (!autoSanitizeExif) {
        setMascotState('waving');
        setTimeout(() => setMascotState('idle'), 2000);
        return;
      }

      try {
        const { invoke } = await import('@tauri-apps/api/core');

        // Play chomp sound & animate eating
        soundFx.nomNom();
        setMascotState('waving');

        // Execute 100% loss-free native Rust EXIF/metadata sanitizer
        const cleanPath = await invoke<string>('sanitize_image_file', { filePath });

        soundFx.magicChime();
        showSpeechBubble({
          id: 'exif_clean_' + Date.now(),
          icon: 'shield',
          text:
            lang === 'fa'
              ? 'اطلاعات مخفی، لوکیشن و متادیتای عکس خورده شد! نسخه امن ذخیره شد ✨'
              : 'EXIF, GPS, and metadata stripped! Clean copy saved ✨',
          timeoutMs: 8000,
          actions: [
            {
              label: lang === 'fa' ? 'مشاهده فایل 📁' : 'View File 📁',
              variant: 'primary',
              onClick: async () => {
                try {
                  await invoke('open_file_in_folder', { path: cleanPath });
                } catch {
                  // Ignore
                }
              },
            },
          ],
        });

        setTimeout(() => {
          if (useMochiStore.getState().mascotState === 'waving') {
            setMascotState('idle');
          }
        }, 2500);
      } catch (err) {
        console.error('EXIF Sanitization failed:', err);
        setMascotState('idle');
      }
    },
    [autoSanitizeExif, lang, setMascotState, showSpeechBubble]
  );

  // 9. Tauri v2 Native File Drag-and-Drop Listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupTauriDrop = async () => {
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        const webview = getCurrentWebview();

        unlisten = await webview.onDragDropEvent((event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            setIsDraggingFile(true);
            setMascotState('dragOver');
          } else if (event.payload.type === 'leave') {
            setIsDraggingFile(false);
            setMascotState('idle');
          } else if (event.payload.type === 'drop') {
            setIsDraggingFile(false);
            const paths = (event.payload as { paths?: string[] }).paths;
            if (paths && paths.length > 0) {
              processDroppedImage(paths[0]);
            } else {
              setMascotState('processing');
              setTimeout(() => setMascotState('idle'), 2000);
            }
          }
        });
      } catch {
        // Not in Tauri runtime
      }
    };

    setupTauriDrop();

    return () => {
      if (unlisten) unlisten();
    };
  }, [setMascotState, processDroppedImage]);

  // 10. Window Drag Interaction: hold left-click and drag on Mochi to move window
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 0 && !isSideUiOpen) {
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

  // Web fallback drag & drop
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingFile(true);
      setMascotState('dragOver');
    },
    [setMascotState]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingFile(false);
      setMascotState('idle');
    },
    [setMascotState]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingFile(false);
      setMascotState('processing');
      setTimeout(() => {
        setMascotState('idle');
      }, 2500);
    },
    [setMascotState]
  );

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
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative w-screen h-screen bg-transparent overflow-hidden select-none flex items-end ${
        !isSideUiOpen
          ? 'justify-center p-0'
          : settingsSide === 'right'
          ? 'flex-row-reverse justify-end p-2 gap-2.5'
          : 'flex-row justify-end p-2 gap-2.5'
      }`}
      style={{
        background: 'transparent',
        backgroundColor: 'transparent',
      }}
    >
      {/* Side Safe-Zone UI Panel (SpeechBubble / SettingsModal / TimeCapsuleModal) */}
      {isSideUiOpen && (
        <div className="flex-1 h-full flex items-center justify-center pointer-events-auto">
          {isSettingsOpen ? (
            <SettingsModal />
          ) : isTimeCapsuleModalOpen ? (
            <TimeCapsuleModal />
          ) : speechBubble ? (
            <SpeechBubble side={settingsSide} />
          ) : null}
        </div>
      )}

      {/* Mascot Viewport (Fixed at 210x250) */}
      <div
        onContextMenu={handleMascotContextMenu}
        className="relative w-[210px] h-[250px] flex items-center justify-center flex-shrink-0 pointer-events-auto"
      >
        {/* Real 3D Floating Mochi Mascot */}
        <MochiCanvas
          isHovered={isHovered}
          onMascotClick={handleMascotClick}
          onContextMenu={handleMascotContextMenu}
        />

        {/* Radial Orbital Glass Menu (Appears strictly on Hover when Settings is closed) */}
        <RadialOrbitalMenu isVisible={isHovered && !isSettingsOpen} />

        {/* Drag & Drop Feedback Overlay */}
        <DropOverlay isDragging={isDraggingFile || mascotState === 'dragOver'} />
      </div>
    </div>
  );
};

export default App;
