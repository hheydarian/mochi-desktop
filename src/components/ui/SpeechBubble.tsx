import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ShieldAlert, Clock, AlertTriangle } from 'lucide-react';
import { useMochiStore } from '../../store/useMochiStore';

interface SpeechBubbleProps {
  side?: 'left' | 'right';
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({ side = 'left' }) => {
  const speechBubble = useMochiStore((s) => s.speechBubble);
  const hideSpeechBubble = useMochiStore((s) => s.hideSpeechBubble);
  const lang = useMochiStore((s) => s.lang);

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!speechBubble) {
      setRemainingSeconds(null);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (speechBubble.countdownSeconds) {
      setRemainingSeconds(speechBubble.countdownSeconds);
      const interval = window.setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            speechBubble.onTimeout?.();
            hideSpeechBubble();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      timerRef.current = interval;
      return () => clearInterval(interval);
    } else if (speechBubble.timeoutMs) {
      const timeout = window.setTimeout(() => {
        hideSpeechBubble();
      }, speechBubble.timeoutMs);
      return () => clearTimeout(timeout);
    }
  }, [speechBubble, hideSpeechBubble]);

  if (!speechBubble) return null;

  const isRTL = lang === 'fa';

  return (
    <AnimatePresence>
      <motion.div
        key={speechBubble.id}
        initial={{ opacity: 0, scale: 0.9, x: side === 'left' ? -12 : 12 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.9, x: side === 'left' ? -12 : 12 }}
        transition={{ type: 'spring', damping: 24, stiffness: 350 }}
        className="w-[280px] max-w-full z-40 pointer-events-auto select-none relative"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="relative bg-slate-950/90 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl p-3 text-white/95">
          {/* Subtle Glass Top Highlight */}
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-pink-400/50 to-transparent rounded-t-2xl" />

          {/* Comic-Book Horizontal Speech Pointer Arrow targeting Mochi */}
          {side === 'left' ? (
            <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-slate-950/90 border-t border-r border-white/20 rotate-45 pointer-events-none" />
          ) : (
            <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-slate-950/90 border-b border-l border-white/20 rotate-45 pointer-events-none" />
          )}

          {/* Top Bar with Icon, Timer & Dismiss Button */}
          <div className="flex items-center justify-between gap-1.5 mb-2 pb-1.5 border-b border-white/10">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="flex-shrink-0">
                {speechBubble.icon === 'shield' ? (
                  <ShieldAlert className="w-4 h-4 text-amber-300 animate-pulse" />
                ) : speechBubble.icon === 'vitals' ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
                ) : speechBubble.icon === 'capsule' ? (
                  <Clock className="w-4 h-4 text-cyan-300" />
                ) : (
                  <Sparkles className="w-4 h-4 text-pink-300" />
                )}
              </span>

              {remainingSeconds !== null && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  {remainingSeconds}s
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={hideSpeechBubble}
              className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Dialogue Text */}
          <p className="text-[11px] leading-relaxed font-medium text-white/95 mb-2.5 whitespace-pre-wrap">
            {speechBubble.text}
          </p>

          {/* Action Buttons */}
          {speechBubble.actions && speechBubble.actions.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1.5 border-t border-white/10">
              {speechBubble.actions.map((action, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    action.onClick();
                    hideSpeechBubble();
                  }}
                  className={`flex-1 py-1.5 px-2.5 rounded-xl text-[10px] font-semibold text-center transition-all cursor-pointer ${
                    action.variant === 'danger' || action.isDanger
                      ? 'bg-rose-500/30 hover:bg-rose-500/50 text-rose-200 border border-rose-400/30'
                      : action.variant === 'primary' || action.isPrimary
                      ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white shadow-md shadow-pink-500/25'
                      : 'bg-white/10 hover:bg-white/20 text-white/80 border border-white/10'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
export default SpeechBubble;
