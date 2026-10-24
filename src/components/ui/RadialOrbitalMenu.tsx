import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Settings, Sparkles, Pin, Move, X } from 'lucide-react';
import { useMochiStore } from '../../store/useMochiStore';
import { useTranslation } from '../../locales';

interface RadialOrbitalMenuProps {
  isVisible: boolean;
}

export const RadialOrbitalMenu: React.FC<RadialOrbitalMenuProps> = ({ isVisible }) => {
  const {
    mascotState,
    cycleMood,
    alwaysOnTop,
    toggleAlwaysOnTop,
    isSettingsOpen,
    toggleSettings,
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

  const closeWindow = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('quit_app');
    } catch {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.close();
      } catch {
        // Ignore
      }
    }
  };

  // Center of Mochi in 240x260 viewport
  const centerX = 120;
  const centerY = 135;
  const radius = 74;

  // 5 buttons distributed in an arch over Mochi
  const arcAngles = [-150, -120, -90, -60, -30];

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
      id: 'mood',
      icon: <Sparkles className="w-3.5 h-3.5 text-pink-300" />,
      tooltip: `${t.ui.moodCycle}: ${t.mascot.state[mascotState]}`,
      active: true,
      activeClass: 'text-pink-300 ring-1 ring-pink-400/50 bg-pink-500/20 shadow-pink-500/30',
      onClick: cycleMood,
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
      tooltip: t.ui.close,
      isDanger: true,
      onClick: closeWindow,
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
                    <motion.span
                      initial={{ opacity: 0, y: 4, scale: 0.85 }}
                      animate={{ opacity: 1, y: -22, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.85 }}
                      className="absolute -top-1 pointer-events-none px-2 py-0.5 rounded-full text-[9px] font-medium tracking-tight text-white/95 bg-slate-900/90 backdrop-blur-md shadow-lg border border-white/20 whitespace-nowrap z-50"
                    >
                      {item.tooltip}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Orb Button */}
                <button
                  type="button"
                  data-tauri-drag-region={item.isDrag ? true : undefined}
                  onClick={item.onClick}
                  onPointerDown={item.onPointerDown}
                  className={`w-7 h-7 rounded-full glass-orb flex items-center justify-center cursor-pointer transition-all ${
                    item.active
                      ? item.activeClass
                      : item.isDanger
                      ? 'hover:bg-rose-500/35 hover:border-rose-400/60 hover:text-rose-100'
                      : 'text-white/80 hover:text-white hover:bg-white/15'
                  }`}
                >
                  {item.icon}
                </button>
              </motion.div>
            );
          })}
      </AnimatePresence>
    </div>
  );
};

export default RadialOrbitalMenu;
