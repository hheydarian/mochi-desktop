import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Settings, Pin, Move, X, Clock, Sparkles } from 'lucide-react';
import { useMochiStore } from '../../store/useMochiStore';
import { useTranslation } from '../../locales';

interface RadialOrbitalMenuProps {
  isVisible: boolean;
}

export const RadialOrbitalMenu: React.FC<RadialOrbitalMenuProps> = ({ isVisible }) => {
  const {
    alwaysOnTop,
    toggleAlwaysOnTop,
    isSettingsOpen,
    setIsSettingsOpen,
    toggleSettings,
    focusMode,
    toggleFocusMode,
    setIsTimeCapsuleModalOpen,
    lang,
  } = useMochiStore();
  const { t } = useTranslation();
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const startWindowDrag = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.startDragging();
    } catch {
      // Ignore in web preview
    }
  };

  const hideToTray = async () => {
    // Ensure all panels are closed when hiding so reopening is always clean
    setIsSettingsOpen(false);
    setIsTimeCapsuleModalOpen(false);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('hide_window_to_tray');
    } catch {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.hide();
      } catch {
        // Ignore
      }
    }
  };

  // Center of Mochi in 200x230 viewport
  const centerX = 100;
  const centerY = 115;
  const radius = 68;

  // Smart Screen-Roof Adaptation: If window is close to screen roof (<120px), open arc downwards
  const isNearTop = typeof window !== 'undefined' && window.screenY < 120;
  // 6 items evenly spread across a clean, balanced arc
  const arcAngles = isNearTop
    ? [28, 52, 76, 104, 128, 152] // Open downwards when near screen ceiling
    : [-152, -128, -104, -76, -52, -28]; // Open upwards in normal position

  interface OrbItem {
    id: string;
    icon: React.ReactNode;
    tooltip: string;
    active?: boolean;
    activeClass?: string;
    onClick?: () => void;
    onPointerDown?: (e: React.PointerEvent) => void;
    isDrag?: boolean;
    isDanger?: boolean;
  }

  const focusTooltip = focusMode
    ? lang === 'fa'
      ? 'حالت تمرکز و آرامش (فعال) 🧘'
      : 'Focus Mode (Active) 🧘'
    : lang === 'fa'
    ? 'حالت تمرکز و آرامش 🧘'
    : 'Focus & Calm Mode 🧘';

  const items: OrbItem[] = [
    {
      id: 'settings',
      icon: <Settings className="w-3.5 h-3.5" />,
      tooltip: t.ui.settings,
      active: isSettingsOpen,
      activeClass: 'text-purple-300 ring-2 ring-purple-400/80 bg-purple-500/30 shadow-purple-500/40',
      onClick: toggleSettings,
    },
    {
      id: 'capsule',
      icon: <Clock className="w-3.5 h-3.5 text-cyan-200" />,
      tooltip: 'کپسول زمان ⏳',
      activeClass: 'text-cyan-300 ring-2 ring-cyan-400/80 bg-cyan-500/30 shadow-cyan-500/40',
      onClick: () => setIsTimeCapsuleModalOpen(true),
    },
    {
      id: 'focus',
      icon: <Sparkles className="w-3.5 h-3.5 text-emerald-200" />,
      tooltip: focusTooltip,
      active: focusMode,
      activeClass: 'text-emerald-300 ring-2 ring-emerald-400/80 bg-emerald-500/30 shadow-emerald-500/40 animate-pulse',
      onClick: toggleFocusMode,
    },
    {
      id: 'pin',
      icon: <Pin className={`w-3.5 h-3.5 ${alwaysOnTop ? 'rotate-45' : ''} transition-transform duration-200`} />,
      tooltip: alwaysOnTop ? t.ui.pin : t.ui.unpin,
      active: alwaysOnTop,
      activeClass: 'text-amber-300 ring-2 ring-amber-400/80 bg-amber-500/30 shadow-amber-500/40',
      onClick: toggleAlwaysOnTop,
    },
    {
      id: 'move',
      icon: <Move className="w-3.5 h-3.5 text-sky-200" />,
      tooltip: t.ui.move,
      isDrag: true,
      onPointerDown: (e) => {
        e.stopPropagation();
        startWindowDrag();
      },
    },
    {
      id: 'close',
      icon: <X className="w-3.5 h-3.5 text-rose-300" />,
      tooltip: t.ui.hide,
      isDanger: true,
      onClick: hideToTray,
    },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none z-40 select-none overflow-hidden">
      <AnimatePresence>
        {isVisible &&
          items.map((item, idx) => {
            const angleDeg = arcAngles[idx];
            const rad = (angleDeg * Math.PI) / 180;
            const x = centerX + radius * Math.cos(rad) - 14;
            const y = centerY + radius * Math.sin(rad) - 14;

            return (
              <motion.div
                key={item.id}
                initial={{ scale: 0, opacity: 0, x: centerX - 14, y: centerY - 14 }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  x,
                  y,
                  transition: {
                    type: 'spring',
                    damping: 14,
                    stiffness: 380,
                    delay: idx * 0.025,
                  },
                }}
                exit={{
                  scale: 0.15,
                  opacity: 0,
                  transition: { duration: 0.16, ease: 'easeOut' },
                }}
                style={{ position: 'absolute', top: 0, left: 0 }}
                className="pointer-events-auto flex flex-col items-center"
                onMouseEnter={() => setActiveTooltip(item.id)}
                onMouseLeave={() => setActiveTooltip(null)}
              >
                {/* Micro Tooltip */}
                <AnimatePresence>
                  {activeTooltip === item.id && (
                    <motion.div
                      initial={{ opacity: 0, y: isNearTop ? 4 : -4, scale: 0.85 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.12 }}
                      className={`absolute pointer-events-none z-50 whitespace-nowrap px-2 py-0.5 rounded-lg text-[9px] font-medium bg-black/85 backdrop-blur-md text-white/90 border border-white/15 shadow-xl ${
                        isNearTop ? 'top-8' : '-top-6'
                      }`}
                    >
                      {item.tooltip}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Orb Button */}
                <motion.button
                  type="button"
                  onClick={item.onClick}
                  onPointerDown={item.onPointerDown}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.88 }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all duration-200 cursor-pointer shadow-lg ${
                    item.isDanger
                      ? 'bg-rose-500/25 border-rose-400/50 text-rose-300 hover:bg-rose-500/45 hover:text-white hover:border-rose-300'
                      : item.active
                      ? item.activeClass
                      : 'bg-black/40 border-white/20 text-white/80 hover:bg-white/20 hover:text-white hover:border-white/40'
                  }`}
                >
                  {item.icon}
                </motion.button>
              </motion.div>
            );
          })}
      </AnimatePresence>
    </div>
  );
};

export default RadialOrbitalMenu;
