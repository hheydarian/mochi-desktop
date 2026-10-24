import React, { useEffect, useState, useCallback, useRef } from 'react';
import { RadialOrbitalMenu, DropOverlay, SettingsModal } from './components/ui';
import { MochiCanvas } from './components/3d';
import { useMochiStore } from './store/useMochiStore';

export const App: React.FC = () => {
  const {
    mascotState,
    setMascotState,
    isSettingsOpen,
    setIsSettingsOpen,
    toggleAlwaysOnTop,
  } = useMochiStore();

  const [isHovered, setIsHovered] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  // 1. Auto-dock window to bottom-right corner of the monitor (4px margin from right & taskbar)
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
        // Not in Tauri runtime (e.g. browser preview)
      }
    };

    dockToBottomRight();
  }, []);

  // 2. Tauri Tray Menu Event Listeners
  useEffect(() => {
    let unlistenSettings: (() => void) | undefined;
    let unlistenPin: (() => void) | undefined;

    const setupTrayListeners = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlistenSettings = await listen('open-settings', () => {
          setIsSettingsOpen(true);
        });
        unlistenPin = await listen('toggle-always-on-top', () => {
          toggleAlwaysOnTop();
        });
      } catch {
        // Not in Tauri runtime
      }
    };

    setupTrayListeners();

    return () => {
      if (unlistenSettings) unlistenSettings();
      if (unlistenPin) unlistenPin();
    };
  }, [setIsSettingsOpen, toggleAlwaysOnTop]);

  // 3. Tauri v2 native file drop listener
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
            setMascotState('processing');
            setTimeout(() => {
              setMascotState('idle');
            }, 2500);
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
  }, [setMascotState]);

  // 4. Window drag interaction: hold left-click and drag anywhere on Mochi to move window
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 0 && !isSettingsOpen) {
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

  // 5. Web fallback drag & drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
    setMascotState('dragOver');
  }, [setMascotState]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    setMascotState('idle');
  }, [setMascotState]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    setMascotState('processing');
    setTimeout(() => {
      setMascotState('idle');
    }, 2500);
  }, [setMascotState]);

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
      className={`relative w-screen h-screen bg-transparent overflow-hidden select-none flex items-center ${
        isSettingsOpen ? 'justify-end pr-1' : 'justify-center'
      }`}
      style={{
        background: 'transparent',
        backgroundColor: 'transparent',
      }}
    >
      {/* Side-by-Side: Left Column for Settings Panel */}
      {isSettingsOpen && (
        <div className="flex-1 h-full flex items-center justify-center pl-2">
          <SettingsModal />
        </div>
      )}

      {/* Mascot Viewport (Fixed at 240x260 in normal mode or on the right in expanded mode) */}
      <div className="relative w-[240px] h-[260px] flex items-center justify-center flex-shrink-0">
        {/* Real 3D Floating Mochi Mascot */}
        <MochiCanvas />

        {/* Radial Orbital Glass Menu (Appears strictly on Hover when Settings is closed) */}
        <RadialOrbitalMenu isVisible={isHovered && !isSettingsOpen} />

        {/* Drag & Drop Feedback Overlay */}
        <DropOverlay isDragging={isDraggingFile || mascotState === 'dragOver'} />
      </div>
    </div>
  );
};

export default App;
