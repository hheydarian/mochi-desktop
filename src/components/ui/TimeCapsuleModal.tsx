import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Send, Sparkles } from 'lucide-react';
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
      <div className="absolute inset-0 z-50 flex items-center justify-center p-2.5 bg-black/40 backdrop-blur-sm pointer-events-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={{ type: 'spring', damping: 22, stiffness: 320 }}
          className="w-[228px] bg-slate-950/90 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl p-3 text-white select-none"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-300" />
              <span className="text-[11px] font-semibold text-white/95">
                {isRTL ? 'کپسول زمان ⏳' : 'Time Capsule ⏳'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-white/40 hover:text-white p-0.5 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            {/* Note text input */}
            <input
              type="text"
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={isRTL ? 'یادداشت یا هدف کوتاه...' : 'Quick note or reminder...'}
              className="w-full bg-white/10 border border-white/15 rounded-xl px-2.5 py-1.5 text-[11px] text-white placeholder-white/40 focus:outline-none focus:border-cyan-400/60"
            />

            {/* Duration presets */}
            <div className="grid grid-cols-2 gap-1">
              {presets.map((preset) => (
                <button
                  key={preset.mins}
                  type="button"
                  onClick={() => {
                    setSelectedDuration(preset.mins);
                    setCustomMinutes('');
                  }}
                  className={`py-1 px-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
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
              className="mt-1 w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/30 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isRTL ? 'قورت دادن کپسول ✨' : 'Swallow Capsule ✨'}</span>
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
