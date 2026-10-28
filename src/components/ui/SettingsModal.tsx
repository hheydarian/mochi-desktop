import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Palette,
  Bot,
  AppWindow,
  Sliders,
  Eye,
  Languages,
  Compass,
  Sparkles,
  Volume2,
  VolumeX,
  Moon,
  Pin,
  RotateCcw,
  Power,
  ChevronDown,
  Smile,
  Bell,
  Zap,
  Clock,
  Trash2,
  ShieldAlert,
  Activity,
  Plus,
} from 'lucide-react';
import { useMochiStore } from '../../store/useMochiStore';
import { useTranslation } from '../../locales';

interface CapsuleToggleProps {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

const CapsuleToggle: React.FC<CapsuleToggleProps> = ({
  icon,
  title,
  desc,
  checked,
  onChange,
}) => {
  return (
    <div
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer select-none border border-white/[0.07]"
    >
      <div className="flex items-center gap-2.5 min-w-0 pr-1">
        <div className="text-white/70 flex-shrink-0">{icon}</div>
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-medium text-white/95 leading-tight truncate">
            {title}
          </span>
          {desc && (
            <span className="text-[9px] text-white/50 leading-tight truncate mt-0.5">
              {desc}
            </span>
          )}
        </div>
      </div>
      <div
        dir="ltr"
        className={`w-10 h-5.5 rounded-full p-0.5 transition-colors flex-shrink-0 flex items-center border ${
          checked
            ? 'bg-gradient-to-r from-pink-500 to-purple-500 border-pink-400/50 shadow-sm shadow-pink-500/30'
            : 'bg-white/15 border-white/10'
        }`}
      >
        <motion.div
          animate={{ x: checked ? 18 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="w-4 h-4 rounded-full bg-white shadow-md"
        />
      </div>
    </div>
  );
};

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    mascotState,
    setMascotState,
    alwaysOnTop,
    setAlwaysOnTop,
    showInTaskbar,
    setShowInTaskbar,
    autonomousMode,
    setAutonomousMode,
    globalMouseTracking,
    setGlobalMouseTracking,
    autoSleepDelay,
    setAutoSleepDelay,
    mascotScale,
    setMascotScale,
    mascotOpacity,
    setMascotOpacity,
    soundEnabled,
    setSoundEnabled,
    resetPosition,
    quitApp,
    lang,
    setLang,
    focusMode,
    setFocusMode,
    timeCapsules,
    deleteTimeCapsule,
    setIsTimeCapsuleModalOpen,
    clipboardGuardianEnabled,
    setClipboardGuardianEnabled,
    systemVitalsEnabled,
    setSystemVitalsEnabled,
  } = useMochiStore();

  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'appearance' | 'behavior' | 'window' | 'powers'>('appearance');

  // Fail-Safe Close: Escape key closes settings instantly
  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, setIsSettingsOpen]);

  if (!isSettingsOpen) return null;

  const isRTL = lang === 'fa';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 8 }}
      transition={{ type: 'spring', damping: 24, stiffness: 340 }}
      dir={isRTL ? 'rtl' : 'ltr'}
      className="relative w-[390px] h-[454px] bg-slate-950/92 backdrop-blur-3xl border border-white/15 rounded-3xl shadow-2xl p-3.5 flex flex-col justify-between select-none text-white overflow-hidden pointer-events-auto"
      style={{ scrollbarWidth: 'none' }}
    >
      {/* Subtle Top Pink Glow Line */}
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-pink-400/50 to-transparent rounded-t-3xl" />

      {/* 1. Header with Close Button */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-pink-500/25 to-purple-500/25 border border-pink-400/35 flex items-center justify-center text-pink-300 shadow-sm shadow-pink-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-wide leading-none">
              {t.settings.title}
            </h3>
            <p className="text-[10px] text-white/50 leading-none mt-1">
              {t.settings.subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsSettingsOpen(false)}
          className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer"
          title="Esc"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Four Top Navigation Tabs (Generous spacing, no text clipping) */}
      <div className="grid grid-cols-4 gap-1.5 bg-black/40 p-1 rounded-2xl border border-white/10 my-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('appearance')}
          className={`py-1.5 px-1 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'appearance'
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold shadow-md shadow-pink-500/30 border border-pink-400/40'
              : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <Palette className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{t.settings.tabAppearance}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('behavior')}
          className={`py-1.5 px-1 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'behavior'
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold shadow-md shadow-pink-500/30 border border-pink-400/40'
              : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <Bot className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{t.settings.tabBehavior}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('window')}
          className={`py-1.5 px-1 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'window'
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold shadow-md shadow-pink-500/30 border border-pink-400/40'
              : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <AppWindow className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{t.settings.tabWindow}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('powers')}
          className={`py-1.5 px-1 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'powers'
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold shadow-md shadow-pink-500/30 border border-pink-400/40'
              : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />
          <span>{isRTL ? 'امکانات' : 'Powers'}</span>
        </button>
      </div>

      {/* 3. Tab Content Area (Smooth scrolling, generous height, no bottom clipping) */}
      <div
        className="flex-1 overflow-y-auto pr-1 pl-0.5 space-y-2 max-h-[300px]"
        style={{ scrollbarWidth: 'none' }}
      >
        <AnimatePresence mode="wait">
          {activeTab === 'appearance' && (
            <motion.div
              key="appearance"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="space-y-2"
            >
              {/* Mascot Scale Slider */}
              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.07] space-y-2">
                <div className="flex justify-between items-center text-white/80">
                  <span className="flex items-center gap-2 text-[11px] font-medium">
                    <Sliders className="w-3.5 h-3.5 text-pink-300" />
                    {t.settings.scale}
                  </span>
                  <span className="font-mono text-[11px] text-pink-300 font-bold px-2 py-0.5 rounded-lg bg-pink-500/15 border border-pink-400/20">
                    {Math.round(mascotScale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.45"
                  max="1.30"
                  step="0.05"
                  value={mascotScale}
                  onChange={(e) => setMascotScale(parseFloat(e.target.value))}
                  className="w-full accent-pink-500 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Opacity Slider */}
              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.07] space-y-2">
                <div className="flex justify-between items-center text-white/80">
                  <span className="flex items-center gap-2 text-[11px] font-medium">
                    <Eye className="w-3.5 h-3.5 text-sky-300" />
                    {t.settings.opacity}
                  </span>
                  <span className="font-mono text-[11px] text-sky-300 font-bold px-2 py-0.5 rounded-lg bg-sky-500/15 border border-sky-400/20">
                    {Math.round(mascotOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.30"
                  max="1.0"
                  step="0.05"
                  value={mascotOpacity}
                  onChange={(e) => setMascotOpacity(parseFloat(e.target.value))}
                  className="w-full accent-sky-400 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Language Switcher */}
              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-between">
                <span className="flex items-center gap-2 text-[11px] font-medium text-white/85">
                  <Languages className="w-4 h-4 text-purple-300" />
                  {t.ui.language}
                </span>
                <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setLang('fa')}
                    className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                      lang === 'fa'
                        ? 'bg-purple-500 text-white shadow-sm'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    فارسی
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang('en')}
                    className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                      lang === 'en'
                        ? 'bg-purple-500 text-white shadow-sm'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'behavior' && (
            <motion.div
              key="behavior"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="space-y-2"
            >
              {/* 4 Moods / Mascot States Interactive Selector */}
              <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.07] space-y-1.5">
                <div className="flex justify-between items-center text-white/80">
                  <span className="flex items-center gap-2 text-[11px] font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-pink-300" />
                    {isRTL ? 'حالت و انیمیشن موچی' : 'Mascot Mood'}
                  </span>
                  <span className="text-[10px] text-pink-300 font-bold font-mono">
                    {t.mascot.state[mascotState]}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 bg-black/30 p-1 rounded-xl border border-white/10">
                  {[
                    { key: 'idle', labelFa: 'آماده', labelEn: 'Idle', icon: <Smile className="w-3.5 h-3.5" /> },
                    { key: 'waving', labelFa: 'دست‌تکان', labelEn: 'Wave', icon: <Sparkles className="w-3.5 h-3.5" /> },
                    { key: 'alert', labelFa: 'هوشیار', labelEn: 'Alert', icon: <Bell className="w-3.5 h-3.5" /> },
                    { key: 'sleeping', labelFa: 'خواب', labelEn: 'Sleep', icon: <Moon className="w-3.5 h-3.5" /> },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setMascotState(item.key as any, 'manual')}
                      className={`py-1.5 rounded-lg text-[10px] font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        mascotState === item.key
                          ? 'bg-pink-500 text-white shadow-sm font-bold'
                          : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      {item.icon}
                      <span>{isRTL ? item.labelFa : item.labelEn}</span>
                    </button>
                  ))}
                </div>
              </div>

              <CapsuleToggle
                icon={<Compass className="w-4 h-4 text-sky-300" />}
                title={t.settings.globalCursor}
                checked={globalMouseTracking}
                onChange={setGlobalMouseTracking}
              />

              <CapsuleToggle
                icon={<Sparkles className="w-4 h-4 text-pink-300" />}
                title={t.settings.autonomousMode}
                checked={autonomousMode}
                onChange={setAutonomousMode}
              />

              <CapsuleToggle
                icon={
                  soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-emerald-300" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-white/40" />
                  )
                }
                title={t.settings.soundEnabled}
                checked={soundEnabled}
                onChange={setSoundEnabled}
              />

              {/* Auto Sleep Inactivity Timer */}
              <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.07] space-y-1.5">
                <span className="flex items-center gap-2 text-[11px] font-medium text-white/85">
                  <Moon className="w-3.5 h-3.5 text-indigo-300" />
                  {t.settings.sleepDelay}
                </span>
                <div className="grid grid-cols-4 gap-1.5 bg-black/30 p-1 rounded-xl border border-white/10">
                  {[
                    { label: t.settings.sleep1m, val: 60000 },
                    { label: t.settings.sleep3m, val: 180000 },
                    { label: t.settings.sleep5m, val: 300000 },
                    { label: t.settings.sleepOff, val: 0 },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setAutoSleepDelay(item.val)}
                      className={`py-1.5 text-center rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                        autoSleepDelay === item.val
                          ? 'bg-indigo-500 text-white shadow-sm font-bold'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'window' && (
            <motion.div
              key="window"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="space-y-2"
            >
              <CapsuleToggle
                icon={<Pin className="w-4 h-4 text-amber-300" />}
                title={t.settings.alwaysOnTop}
                desc={t.settings.alwaysOnTopDesc}
                checked={alwaysOnTop}
                onChange={setAlwaysOnTop}
              />

              <CapsuleToggle
                icon={<AppWindow className="w-4 h-4 text-indigo-300" />}
                title={t.settings.showInTaskbar}
                desc={t.settings.showInTaskbarDesc}
                checked={showInTaskbar}
                onChange={setShowInTaskbar}
              />

              {/* Action Buttons */}
              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={resetPosition}
                  className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white/90 flex items-center justify-center gap-2 font-medium transition-all cursor-pointer text-[11px]"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                  <span>{t.settings.resetPosition}</span>
                </button>
                <button
                  type="button"
                  onClick={quitApp}
                  className="py-2 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-rose-300 flex items-center justify-center gap-2 font-semibold transition-all cursor-pointer text-[11px]"
                >
                  <Power className="w-3.5 h-3.5 text-rose-400" />
                  <span>{t.settings.quit}</span>
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'powers' && (
            <motion.div
              key="powers"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="space-y-2"
            >
              {/* 1. Focus & Calm Mode (Silent) */}
              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.07] space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-300" />
                    <span className="text-[11px] font-semibold text-white/95">
                      {isRTL ? 'حالت تمرکز و آرامش (سکوت کامل)' : 'Focus & Calm Mode (Silent)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFocusMode(!focusMode)}
                    className={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                      focusMode
                        ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                        : 'bg-white/10 hover:bg-white/20 text-white/70'
                    }`}
                  >
                    {focusMode
                      ? (isRTL ? 'فعال 🧘' : 'ACTIVE 🧘')
                      : (isRTL ? 'غیرفعال' : 'OFF')}
                  </button>
                </div>
                <p className="text-[9.5px] text-white/50 leading-relaxed">
                  {isRTL
                    ? 'بدون صدا، تمام نوتیف‌ها و پیام‌ها متوقف می‌شوند تا با آرامش روی کارها تمرکز کنید.'
                    : 'Silent mode: mutes all bubbles and notifications for deep, distraction-free focus.'}
                </p>
              </div>

              {/* 2. Time Capsules */}
              <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.07] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-300" />
                    <span className="text-[11px] font-semibold text-white/95">
                      {isRTL ? 'کپسول‌های زمان' : 'Time Capsules'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTimeCapsuleModalOpen(true)}
                    className="px-2.5 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30 text-cyan-300 text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isRTL ? 'ساخت کپسول جدید' : 'New Capsule'}</span>
                  </button>
                </div>

                {timeCapsules.length === 0 ? (
                  <p className="text-[9.5px] text-white/40 italic text-center py-1">
                    {isRTL ? 'هیچ کپسول فعالی وجود ندارد' : 'No active time capsules'}
                  </p>
                ) : (
                  <div className="space-y-1 max-h-[85px] overflow-y-auto pr-0.5">
                    {timeCapsules.map((tc) => (
                      <div
                        key={tc.id}
                        className="flex items-center justify-between p-1.5 rounded-xl bg-black/30 border border-white/5 text-[10px]"
                      >
                        <span className="truncate max-w-[240px] text-white/90">
                          {tc.message}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteTimeCapsule(tc.id)}
                          className="text-white/40 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Clipboard Guardian */}
              <CapsuleToggle
                icon={<ShieldAlert className="w-4 h-4 text-amber-300" />}
                title={t.settings.clipboardGuardian}
                desc={t.settings.clipboardGuardianDesc}
                checked={clipboardGuardianEnabled}
                onChange={setClipboardGuardianEnabled}
              />

              {/* 4. System Vitals */}
              <CapsuleToggle
                icon={<Activity className="w-4 h-4 text-rose-300" />}
                title={t.settings.systemVitals}
                desc={t.settings.systemVitalsDesc}
                checked={systemVitalsEnabled}
                onChange={setSystemVitalsEnabled}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. Footer Close Bar */}
      <div className="pt-2 border-t border-white/10 flex-shrink-0">
        <button
          type="button"
          onClick={() => setIsSettingsOpen(false)}
          className="w-full py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/80 hover:text-white flex items-center justify-center gap-1.5 text-[11px] font-medium transition-all cursor-pointer"
        >
          <ChevronDown className="w-3.5 h-3.5 text-pink-300" />
          <span>{isRTL ? 'بستن پنل تنظیمات (Esc)' : 'Close Settings Panel (Esc)'}</span>
        </button>
      </div>
    </motion.div>
  );
};

export default SettingsModal;
