import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ShieldAlert, Clock, AlertTriangle } from 'lucide-react';
import { useMochiStore } from '../../store/useMochiStore';

export const SpeechBubble: React.FC = () => {
  const speechBubble = useMochiStore((s) => s.speechBubble);
  const hideSpeechBubble = useMochiStore((s) => s.hideSpeechBubble);
  const lang = useMochiStore((s) => s.lang);

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  // Near screen roof check for smart vertical clamping
  const isNearTop = typeof window !== 'undefined' && window.screenY < 120;

  // Handle countdowns and auto-timeouts
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
        initial={{ opacity: 0, scale: 0.85, y: isNearTop ? -10 : 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: isNearTop ? -10 : 10 }}
        transition={{ type: 'spring', damping: 20, stiffness: 340 }}
        className={`absolute left-1/2 -translate-x-1/2 ${
          isNearTop ? 'top-[195px]' : 'top-2'
        } w-[224px] z-40 pointer-events-auto select-none`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="relative bg-slate-950/85 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl p-2.5 text-white/95">
          {/* Subtle Glass Glow Highlight */}
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-pink-400/50 to-transparent" />

          {/* Speech Bubble Arrow Tail pointing at Mochi */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-950/85 border-white/20 rotate-45 ${
              isNearTop
                ? '-top-1.5 border-t border-l'
                : '-bottom-1.5 border-b border-r'
            }`}
          />

          {/* Top Bar with Icon & Dismiss */}
          <div className="flex items-start justify-between gap-1.5 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-pink-300 flex-shrink-0">
                {speechBubble.icon === 'shield' ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
                ) : speechBubble.icon === 'vitals' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
                ) : speechBubble.icon === 'capsule' ? (
                  <Clock className="w-3.5 h-3.5 text-cyan-300" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-pink-300" />
                )}
              </span>

              {remainingSeconds !== null && (
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  {remainingSeconds}s
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={hideSpeechBubble}
              className="text-white/40 hover:text-white p-0.5 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Dialogue Text */}
          <p className="text-[11px] leading-relaxed font-medium text-white/90 mb-2">
            {speechBubble.text}
          </p>

          {/* Action Buttons */}
          {speechBubble.actions && speechBubble.actions.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
              {speechBubble.actions.map((action, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    action.onClick();
                    hideSpeechBubble();
                  }}
                  className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-semibold text-center transition-all cursor-pointer ${
                    action.isPrimary
                      ? 'bg-pink-500 hover:bg-pink-400 text-white shadow-lg shadow-pink-500/30'
                      : action.isDanger
                      ? 'bg-rose-500/30 hover:bg-rose-500/50 text-rose-200 border border-rose-400/30'
                      : 'bg-white/10 hover:bg-white/20 text-white/80'
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
