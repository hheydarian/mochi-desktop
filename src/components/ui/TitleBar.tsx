import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, X, Languages, Sliders, Sparkles } from 'lucide-react';
import { useMochiStore } from '../../store/useMochiStore';
import { useTranslation } from '../../locales';

export const TitleBar: React.FC = () => {
  const { lang, toggleLang, toggleSettings, isSettingsOpen, mascotState } = useMochiStore();
  const { t } = useTranslation();

  const handleMinimize = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.minimize();
    } catch {
      // In web preview mode, ignore
    }
  };

  const handleClose = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.close();
    } catch {
      // In web preview mode, ignore
    }
  };

  const stateColors: Record<string, string> = {
    idle: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30',
    waving: 'bg-pink-400/20 text-pink-300 border-pink-400/30',
    alert: 'bg-amber-400/20 text-amber-300 border-amber-400/30',
    sleeping: 'bg-indigo-400/20 text-indigo-300 border-indigo-400/30',
    dragOver: 'bg-sky-400/20 text-sky-300 border-sky-400/30',
    processing: 'bg-purple-400/20 text-purple-300 border-purple-400/30',
  };

  return (
    <header
      data-tauri-drag-region
      className="w-full h-12 flex items-center justify-between px-3 select-none z-50 transition-colors"
    >
      {/* Left: App Identity & State indicator */}
      <div className="flex items-center gap-2 pointer-events-none">
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-pink-500 to-purple-500 flex items-center justify-center shadow-lg shadow-pink-500/20">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-xs tracking-wide text-white/90 drop-shadow">
          {t.app.title}
        </span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full border backdrop-blur-md transition-colors ${
            stateColors[mascotState] || stateColors.idle
          }`}
        >
          {t.mascot.state[mascotState]}
        </span>
      </div>

      {/* Right: Actions & Window controls */}
      <div className="flex items-center gap-1.5" data-tauri-drag-region={false}>
        {/* Toggle Language */}
        <button
          type="button"
          onClick={toggleLang}
          title={t.ui.language}
          className="w-7 h-7 rounded-lg glass-button flex items-center justify-center text-white/80 hover:text-white"
        >
          <Languages className="w-3.5 h-3.5" />
          <span className="sr-only">{lang}</span>
        </button>

        {/* Toggle Settings Modal */}
        <button
          type="button"
          onClick={toggleSettings}
          title={t.ui.settings}
          className={`w-7 h-7 rounded-lg glass-button flex items-center justify-center transition-colors ${
            isSettingsOpen
              ? 'bg-white/30 text-white border-white/40'
              : 'text-white/80 hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>

        {/* Minimize Window */}
        <button
          type="button"
          onClick={handleMinimize}
          title={t.ui.minimize}
          className="w-7 h-7 rounded-lg glass-button flex items-center justify-center text-white/70 hover:text-white"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Close Window */}
        <button
          type="button"
          onClick={handleClose}
          title={t.ui.close}
          className="w-7 h-7 rounded-lg glass-button flex items-center justify-center text-white/70 hover:bg-red-500/30 hover:border-red-400/40 hover:text-red-200"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
