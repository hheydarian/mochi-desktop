import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Clock, Sparkles, Trash2, ChevronDown, Plus, Target } from 'lucide-react';
import { useMochiStore } from '../../store/useMochiStore';

function formatRemainingTime(targetTime: number, isRTL: boolean): string {
  const diffMs = targetTime - Date.now();
  if (diffMs <= 0) return isRTL ? 'آماده تحویل!' : 'Ready!';
  const diffMins = Math.ceil(diffMs / 60000);
  if (diffMins < 60) {
    return isRTL ? `${diffMins} دقیقه مانده` : `${diffMins}m remaining`;
  }
  const hours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  if (remainingMins === 0) {
    return isRTL ? `${hours} ساعت مانده` : `${hours}h remaining`;
  }
  return isRTL ? `${hours} ساعت و ${remainingMins} دقیقه مانده` : `${hours}h ${remainingMins}m left`;
}

export const TimeCapsuleModal: React.FC = () => {
  const isOpen = useMochiStore((s) => s.isTimeCapsuleModalOpen);
  const setIsOpen = useMochiStore((s) => s.setIsTimeCapsuleModalOpen);
  const addTimeCapsule = useMochiStore((s) => s.addTimeCapsule);
  const deleteTimeCapsule = useMochiStore((s) => s.deleteTimeCapsule);
  const timeCapsules = useMochiStore((s) => s.timeCapsules);
  const lang = useMochiStore((s) => s.lang);

  const [message, setMessage] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<number>(15);
  const [customMinutes, setCustomMinutes] = useState('');

  const isRTL = lang === 'fa';

  // Fail-Safe Close: Escape key closes modal instantly
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  const presets = [
    { label: isRTL ? '۱۵ دقیقه' : '15m', mins: 15 },
    { label: isRTL ? '۳۰ دقیقه' : '30m', mins: 30 },
    { label: isRTL ? '۱ ساعت' : '1h', mins: 60 },
    { label: isRTL ? '۲ ساعت' : '2h', mins: 120 },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    const duration = customMinutes ? parseInt(customMinutes, 10) || selectedDuration : selectedDuration;
    addTimeCapsule(trimmed, duration);
    setMessage('');
    setCustomMinutes('');
  };

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
      {/* Subtle Top Cyan Glow Line */}
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent rounded-t-3xl" />

      {/* 1. Header with Close Button */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-cyan-500/25 to-blue-500/25 border border-cyan-400/35 flex items-center justify-center text-cyan-300 shadow-sm shadow-cyan-500/20">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-wide leading-none">
              {isRTL ? 'کپسول زمان موچی' : 'Mochi Time Capsule'}
            </h3>
            <p className="text-[10px] text-white/50 leading-none mt-1">
              {isRTL ? 'ارسال پیام و یادآوری هدف به آینده' : 'Send goals and reminders to your future self'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer"
          title="Esc"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Main Content Area (Form + Active List) */}
      <div
        className="flex-1 overflow-y-auto pr-1 pl-0.5 space-y-2.5 my-2 max-h-[330px]"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Create Capsule Section */}
        <form onSubmit={handleSubmit} className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.07] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/90">
              <Plus className="w-3.5 h-3.5 text-cyan-300" />
              {isRTL ? 'ثبت کپسول جدید' : 'Create New Capsule'}
            </span>
          </div>

          {/* Message input */}
          <input
            type="text"
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isRTL ? 'یادداشت، هدف، یا پیام به آینده...' : 'Write a goal or note to the future...'}
            className="w-full bg-white/[0.06] hover:bg-white/[0.08] border border-white/15 focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none transition-all"
          />

          {/* Duration presets */}
          <div className="grid grid-cols-4 gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.mins}
                type="button"
                onClick={() => {
                  setSelectedDuration(preset.mins);
                  setCustomMinutes('');
                }}
                className={`py-1.5 px-1 rounded-xl text-[10px] font-medium transition-all cursor-pointer text-center ${
                  selectedDuration === preset.mins && !customMinutes
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-md shadow-cyan-500/25 border border-cyan-400/40'
                    : 'bg-white/[0.05] hover:bg-white/[0.09] text-white/70 border border-white/[0.08]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={!message.trim()}
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/25 border border-cyan-400/30 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isRTL ? 'ذخیره در کپسول زمان موچی ⏳✨' : 'Seal in Time Capsule ⏳✨'}</span>
          </button>
        </form>

        {/* Active Capsules List */}
        <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.07] space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/90">
              <Target className="w-3.5 h-3.5 text-cyan-300" />
              {isRTL ? 'کپسول‌های فعال' : 'Active Capsules'}
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-400/20">
              {timeCapsules.length}
            </span>
          </div>

          {timeCapsules.length === 0 ? (
            <div className="text-center py-3 px-2">
              <p className="text-[10px] text-white/40 italic leading-relaxed">
                {isRTL
                  ? 'هنوز کپسولی ثبت نکردی! یک هدف کوتاه بنویس تا موچی سر وقت بهت یادآوری کنه 🎯'
                  : 'No active capsules. Write a quick reminder and Mochi will bring it back to you on time! 🎯'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-0.5" style={{ scrollbarWidth: 'none' }}>
              {timeCapsules.map((tc) => (
                <div
                  key={tc.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/10 text-white/95"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-[11px] font-medium leading-tight truncate max-w-[250px]">
                      {tc.message}
                    </span>
                    <span className="text-[9px] text-cyan-300/80 font-mono mt-0.5 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 inline" />
                      {formatRemainingTime(tc.targetTime, isRTL)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteTimeCapsule(tc.id)}
                    className="p-1 rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title={isRTL ? 'حذف' : 'Delete'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Footer Close Bar (Identical to SettingsModal) */}
      <div className="pt-2 border-t border-white/10 flex-shrink-0">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="w-full py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/80 hover:text-white flex items-center justify-center gap-1.5 text-[11px] font-medium transition-all cursor-pointer"
        >
          <ChevronDown className="w-3.5 h-3.5 text-cyan-300" />
          <span>{isRTL ? 'بستن کپسول زمان (Esc)' : 'Close Time Capsule (Esc)'}</span>
        </button>
      </div>
    </motion.div>
  );
};

export default TimeCapsuleModal;
