import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Bell, Moon, Hand, UploadCloud, Loader2 } from 'lucide-react';
import { useMochiStore, type MascotState } from '../../store/useMochiStore';
import { useTranslation } from '../../locales';
import { GlassCard } from './GlassCard';

export const ToolsDrawer: React.FC = () => {
  const { isSettingsOpen, toggleSettings, mascotState, setMascotState, lang, setLang } =
    useMochiStore();
  const { t } = useTranslation();

  const states: { id: MascotState; label: string; icon: React.ReactNode }[] = [
    { id: 'idle', label: t.mascot.state.idle, icon: <Heart className="w-4 h-4 text-emerald-400" /> },
    { id: 'waving', label: t.mascot.state.waving, icon: <Hand className="w-4 h-4 text-pink-400" /> },
    { id: 'alert', label: t.mascot.state.alert, icon: <Bell className="w-4 h-4 text-amber-400" /> },
    { id: 'sleeping', label: t.mascot.state.sleeping, icon: <Moon className="w-4 h-4 text-indigo-400" /> },
    { id: 'dragOver', label: t.mascot.state.dragOver, icon: <UploadCloud className="w-4 h-4 text-sky-400" /> },
    { id: 'processing', label: t.mascot.state.processing, icon: <Loader2 className="w-4 h-4 text-purple-400 animate-spin" /> },
  ];

  return (
    <AnimatePresence>
      {isSettingsOpen && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 25, scale: 0.95 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          className="absolute inset-x-3 bottom-3 z-40 max-h-[70vh] flex flex-col"
        >
          <GlassCard className="p-4 flex flex-col gap-3 shadow-2xl border border-white/20">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-sm font-semibold text-white/90">
                {t.ui.tools}
              </span>
              <button
                type="button"
                onClick={toggleSettings}
                className="w-6 h-6 rounded-md glass-button flex items-center justify-center text-white/70 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mascot State Control */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-white/60 font-medium">
                {lang === 'fa' ? 'حالت‌های موچی' : 'Mochi States'}
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {states.map((s) => {
                  const isActive = mascotState === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setMascotState(s.id)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all ${
                        isActive
                          ? 'bg-white/25 border border-white/40 shadow-sm text-white font-medium'
                          : 'glass-surface-subtle text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {s.icon}
                      <span className="truncate">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Language Switcher */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-white/10">
              <span className="text-xs text-white/60 font-medium">
                {t.ui.language}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLang('fa')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    lang === 'fa'
                      ? 'bg-gradient-to-r from-pink-500/80 to-purple-500/80 text-white shadow-md'
                      : 'glass-surface-subtle text-white/70 hover:text-white'
                  }`}
                >
                  فارسی (FA)
                </button>
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    lang === 'en'
                      ? 'bg-gradient-to-r from-pink-500/80 to-purple-500/80 text-white shadow-md'
                      : 'glass-surface-subtle text-white/70 hover:text-white'
                  }`}
                >
                  English (EN)
                </button>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
