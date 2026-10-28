import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Sparkles } from 'lucide-react';
import { useMochiStore } from '../../store/useMochiStore';

export const TimeCapsuleModal: React.FC = () => {
  const isOpen = useMochiStore((s) => s.isTimeCapsuleModalOpen);
  const setIsOpen = useMochiStore((s) => s.setIsTimeCapsuleModalOpen);
  const addTimeCapsule = useMochiStore((s) => s.addTimeCapsule);
  const lang = useMochiStore((s) => s.lang);

  const [message, setMessage] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<number>(15);
  const [customMinutes, setCustomMinutes] = useState('');

  if (!isOpen) return null;

  const isRTL = lang === 'fa';

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
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 8 }}
        transition={{ type: 'spring', damping: 22, stiffness: 320 }}
        className="w-[290px] bg-slate-950/90 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl p-3.5 text-white select-none pointer-events-auto"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-white/95">
              {isRTL ? 'کپسول زمان ⏳' : 'Time Capsule ⏳'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          {/* Note text input */}
          <input
            type="text"
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isRTL ? 'یادداشت یا هدف کوتاه...' : 'Quick note or reminder...'}
            className="w-full bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400/60"
          />

          {/* Duration presets */}
          <div className="grid grid-cols-4 gap-1">
            {presets.map((preset) => (
              <button
                key={preset.mins}
                type="button"
                onClick={() => {
                  setSelectedDuration(preset.mins);
                  setCustomMinutes('');
                }}
                className={`py-1 px-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer text-center ${
                  selectedDuration === preset.mins && !customMinutes
                    ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/50 shadow-sm shadow-cyan-500/20'
                    : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/5'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={!message.trim()}
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/30 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isRTL ? 'قورت دادن کپسول ✨' : 'Swallow Capsule ✨'}</span>
          </button>
        </form>
      </motion.div>
    </AnimatePresence>
  );
};
export default TimeCapsuleModal;
