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
  Radio,
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
      className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer select-none border border-white/[0.06]"
    >
      <div className="flex items-center gap-2 min-w-0 pr-1">
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
        className={`w-9 h-5 rounded-full p-0.5 transition-colors flex-shrink-0 flex items-center ${
          checked ? 'bg-pink-500' : 'bg-white/20'
        }`}
      >
        <motion.div
          animate={{ x: checked ? 16 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className="w-4 h-4 rounded-full bg-white shadow-sm"
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
    radioMode,
    setRadioMode,
    radioVolume,
    setRadioVolume,
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

  // Fail-Safe Close 1: Escape key closes settings instantly
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 8 }}
      transition={{ type: 'spring', damping: 22, stiffness: 320 }}
      className="w-[310px] h-[340px] bg-slate-950/90 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-2xl p-3 flex flex-col justify-between select-none text-white overflow-hidden pointer-events-auto"
      style={{ scrollbarWidth: 'none' }}
    >
      {/* 1. Header with Close Button */}
      <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-pink-500/20 border border-pink-400/40 flex items-center justify-center text-pink-300">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white/95 leading-none">
              {t.settings.title}
            </h3>
            <p className="text-[9px] text-white/50 leading-none mt-1">
              {t.settings.subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsSettingsOpen(false)}
          className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
          title="Esc"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Four Top Navigation Tabs */}
      <div className="grid grid-cols-4 gap-1 bg-black/40 p-0.5 rounded-xl border border-white/10 my-1">
        <button
          type="button"
          onClick={() => setActiveTab('appearance')}
          className={`py-1.5 px-0.5 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all ${
            activeTab === 'appearance'
              ? 'bg-pink-500 text-white shadow-sm font-semibold'
              : 'text-white/60 hover:text-white/90'
          }`}
        >
          <Palette className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{t.settings.tabAppearance}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('behavior')}
          className={`py-1.5 px-0.5 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all ${
            activeTab === 'behavior'
              ? 'bg-pink-500 text-white shadow-sm font-semibold'
              : 'text-white/60 hover:text-white/90'
          }`}
        >
          <Bot className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{t.settings.tabBehavior}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('window')}
          className={`py-1.5 px-0.5 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all ${
            activeTab === 'window'
              ? 'bg-pink-500 text-white shadow-sm font-semibold'
              : 'text-white/60 hover:text-white/90'
          }`}
        >
          <AppWindow className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{t.settings.tabWindow}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('powers')}
          className={`py-1.5 px-0.5 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all ${
            activeTab === 'powers'
              ? 'bg-pink-500 text-white shadow-sm font-semibold'
              : 'text-white/60 hover:text-white/90'
          }`}
        >
          <Zap className="w-3 h-3 text-amber-300 flex-shrink-0" />
          <span className="truncate">{t.settings.tabPowers}</span>
        </button>
      </div>

      {/* 3. Tab Content Area (Zero scrollbar, strictly compact) */}
      <div className="flex-1 flex flex-col justify-center py-1">
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
              <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-1">
                <div className="flex justify-between items-center text-white/80">
                  <span className="flex items-center gap-1.5 text-[10px] font-medium">
                    <Sliders className="w-3 h-3 text-pink-300" />
                    {t.settings.scale}
                  </span>
                  <span className="font-mono text-[10px] text-pink-300 font-semibold">
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
                  className="w-full accent-pink-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Opacity Slider */}
              <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-1">
                <div className="flex justify-between items-center text-white/80">
                  <span className="flex items-center gap-1.5 text-[10px] font-medium">
                    <Eye className="w-3 h-3 text-sky-300" />
                    {t.settings.opacity}
                  </span>
                  <span className="font-mono text-[10px] text-sky-300 font-semibold">
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
                  className="w-full accent-sky-400 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Language Switcher */}
              <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-white/85">
                  <Languages className="w-3.5 h-3.5 text-purple-300" />
                  {t.ui.language}
                </span>
                <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded-lg border border-white/10">
                  <button
                    type="button"
                    onClick={() => setLang('fa')}
                    className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-all ${
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
                    className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-all ${
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
              className="space-y-1.5"
            >
              {/* 4 Moods / Mascot States Interactive Selector */}
              <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-1">
                <div className="flex justify-between items-center text-white/80">
                  <span className="flex items-center gap-1.5 text-[10px] font-medium">
                    <Sparkles className="w-3 h-3 text-pink-300" />
                    {lang === 'fa' ? 'حالت و انیمیشن موچی' : 'Mascot Mood'}
                  </span>
                  <span className="text-[9px] text-pink-300 font-semibold font-mono">
                    {t.mascot.state[mascotState]}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 bg-black/30 p-0.5 rounded-lg border border-white/10">
                  {[
                    { key: 'idle', labelFa: 'آماده', labelEn: 'Idle', icon: <Smile className="w-3 h-3" /> },
                    { key: 'waving', labelFa: 'دست‌تکان', labelEn: 'Wave', icon: <Sparkles className="w-3 h-3" /> },
                    { key: 'alert', labelFa: 'هوشیار', labelEn: 'Alert', icon: <Bell className="w-3 h-3" /> },
                    { key: 'sleeping', labelFa: 'خواب', labelEn: 'Sleep', icon: <Moon className="w-3 h-3" /> },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setMascotState(item.key as any, 'manual')}
                      className={`py-1 rounded text-[9px] font-medium transition-all flex items-center justify-center gap-1 ${
                        mascotState === item.key
                          ? 'bg-pink-500 text-white shadow-sm font-bold'
                          : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      {item.icon}
                      <span>{lang === 'fa' ? item.labelFa : item.labelEn}</span>
                    </button>
                  ))}
                </div>
              </div>

              <CapsuleToggle
                icon={<Compass className="w-3.5 h-3.5 text-sky-300" />}
                title={t.settings.globalCursor}
                checked={globalMouseTracking}
                onChange={setGlobalMouseTracking}
              />

              <CapsuleToggle
                icon={<Sparkles className="w-3.5 h-3.5 text-pink-300" />}
                title={t.settings.autonomousMode}
                checked={autonomousMode}
                onChange={setAutonomousMode}
              />

              <CapsuleToggle
                icon={
                  soundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-white/40" />
                  )
                }
                title={t.settings.soundEnabled}
                checked={soundEnabled}
                onChange={setSoundEnabled}
              />

              {/* Auto Sleep Inactivity Timer */}
              <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-1">
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-white/85">
                  <Moon className="w-3 h-3 text-indigo-300" />
                  {t.settings.sleepDelay}
                </span>
                <div className="grid grid-cols-4 gap-1 bg-black/30 p-0.5 rounded-lg border border-white/10">
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
                      className={`py-1 text-center rounded text-[9px] font-medium transition-all ${
                        autoSleepDelay === item.val
                          ? 'bg-indigo-500 text-white shadow-sm'
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
              className="space-y-1.5"
            >
              <CapsuleToggle
                icon={<Pin className="w-3.5 h-3.5 text-amber-300" />}
                title={t.settings.alwaysOnTop}
                desc={t.settings.alwaysOnTopDesc}
                checked={alwaysOnTop}
                onChange={setAlwaysOnTop}
              />

              <CapsuleToggle
                icon={<AppWindow className="w-3.5 h-3.5 text-indigo-300" />}
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
                  className="flex-1 py-1.5 px-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white/90 flex items-center justify-center gap-1.5 font-medium transition-all cursor-pointer text-[10px]"
                >
                  <RotateCcw className="w-3 h-3 text-amber-300" />
                  <span className="truncate">{t.settings.resetPosition}</span>
                </button>
                <button
                  type="button"
                  onClick={quitApp}
                  className="py-1.5 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-rose-300 flex items-center justify-center gap-1.5 font-medium transition-all cursor-pointer text-[10px]"
                >
                  <Power className="w-3 h-3 text-rose-400" />
                  <span className="truncate">{t.settings.quit}</span>
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
              className="space-y-1.5 max-h-[220px] overflow-y-auto pr-0.5"
              style={{ scrollbarWidth: 'none' }}
            >
              {/* 1. Ambient Focus Radio */}
              <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-pink-300" />
                    <span className="text-[11px] font-medium text-white/95">
                      {lang === 'fa' ? 'رادیو تمرکز و آرامش' : 'Focus Ambient Sound'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRadioMode(radioMode === 'off' ? 'rain' : 'off')}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-semibold transition-all cursor-pointer ${
                      radioMode !== 'off'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-white/10 hover:bg-white/20 text-white/70'
                    }`}
                  >
                    {radioMode !== 'off'
                      ? (lang === 'fa' ? 'روشن (حالت تمرکز)' : 'ON (Focus Mode)')
                      : (lang === 'fa' ? 'خاموش' : 'OFF')}
                  </button>
                </div>
                {radioMode !== 'off' && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <Volume2 className="w-3 h-3 text-white/50" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={radioVolume}
                      onChange={(e) => setRadioVolume(parseFloat(e.target.value))}
                      className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-pink-500"
                    />
                    <span className="text-[9px] font-mono text-white/50">{Math.round(radioVolume * 100)}%</span>
                  </div>
                )}
              </div>

              {/* 2. Time Capsules */}
              <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-300" />
                    <span className="text-[11px] font-medium text-white/95">{t.settings.timeCapsuleTitle}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTimeCapsuleModalOpen(true)}
                    className="py-0.5 px-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30 text-cyan-200 text-[9px] font-medium flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span>{t.settings.newCapsuleBtn}</span>
                  </button>
                </div>
                {/* Active capsules */}
                {timeCapsules.length === 0 ? (
                  <p className="text-[9px] text-white/40 italic py-0.5 text-center">{t.settings.noCapsules}</p>
                ) : (
                  <div className="space-y-1 max-h-[60px] overflow-y-auto pr-0.5" style={{ scrollbarWidth: 'none' }}>
                    {timeCapsules.map((tc) => {
                      const minsLeft = Math.max(0, Math.round((tc.targetTime - Date.now()) / 60000));
                      return (
                        <div
                          key={tc.id}
                          className="flex items-center justify-between py-1 px-1.5 rounded-lg bg-white/[0.03] border border-white/[0.04] text-[9px]"
                        >
                          <span className="truncate flex-1 text-white/80 font-medium">{tc.message}</span>
                          <div className="flex items-center gap-1.5 pl-1.5">
                            <span className="text-cyan-300 font-mono text-[8px]">{minsLeft}m</span>
                            <button
                              type="button"
                              onClick={() => deleteTimeCapsule(tc.id)}
                              className="text-white/40 hover:text-rose-300 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. Automation Toggles */}
              <CapsuleToggle
                icon={<ShieldAlert className="w-3.5 h-3.5 text-amber-300" />}
                title={t.settings.clipboardGuardian}
                desc={t.settings.clipboardGuardianDesc}
                checked={clipboardGuardianEnabled}
                onChange={setClipboardGuardianEnabled}
              />

              <CapsuleToggle
                icon={<Activity className="w-3.5 h-3.5 text-rose-300" />}
                title={t.settings.systemVitals}
                desc={t.settings.systemVitalsDesc}
                checked={systemVitalsEnabled}
                onChange={setSystemVitalsEnabled}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. Fail-Safe Close Button 3 in Footer */}
      <div className="pt-2 border-t border-white/10">
        <button
          type="button"
          onClick={() => setIsSettingsOpen(false)}
          className="w-full py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-white/80 hover:text-white flex items-center justify-center gap-1 text-[10px] font-medium transition-all cursor-pointer"
        >
          <ChevronDown className="w-3.5 h-3.5 text-pink-300" />
          <span>{lang === 'fa' ? 'بستن پنل تنظیمات (Esc)' : 'Close Settings Panel (Esc)'}</span>
        </button>
      </div>
    </motion.div>
  );
};

export default SettingsModal;
