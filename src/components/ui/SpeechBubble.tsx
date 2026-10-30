import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ShieldAlert, Clock, AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useMochiStore } from '../../store/useMochiStore';

export interface PortProcessInfo {
  port: number;
  pid: number;
  name: string;
}

interface SpeechBubbleProps {
  side?: 'left' | 'right';
  isOpen?: boolean;
  onClose?: () => void;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({ side = 'left', isOpen, onClose }) => {
  const speechBubble = useMochiStore((s) => s.speechBubble);
  const hideSpeechBubble = useMochiStore((s) => s.hideSpeechBubble);
  const lang = useMochiStore((s) => s.lang);

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  // Localhost Ghost Hunter state
  const isPortHunter = speechBubble?.icon === 'ghost-hunter' || isOpen === true;
  const [ports, setPorts] = useState<PortProcessInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [killingPid, setKillingPid] = useState<number | null>(null);

  const fetchPorts = async () => {
    setLoading(true);
    try {
      const res = await invoke<PortProcessInfo[]>('check_local_ports');
      setPorts(res);
    } catch (err) {
      console.error('Error fetching ports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isPortHunter) {
      fetchPorts();
      const interval = setInterval(fetchPorts, 4000);
      return () => clearInterval(interval);
    }
  }, [isPortHunter]);

  const handleKill = async (pid: number) => {
    setKillingPid(pid);
    try {
      await invoke('kill_port_process', { pid });
      await fetchPorts();
    } catch (err) {
      console.error('Error killing process:', err);
    } finally {
      setKillingPid(null);
    }
  };

  const handleClose = () => {
    if (onClose) onClose();
    hideSpeechBubble();
  };

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

  const isVisible = Boolean(isOpen || speechBubble);
  if (!isVisible) return null;

  const isRTL = lang === 'fa';

  return (
    <AnimatePresence>
      <motion.div
        key={speechBubble?.id || 'port-hunter-bubble'}
        initial={{ opacity: 0, scale: 0.88, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: -8 }}
        transition={{ type: 'spring', damping: 20, stiffness: 380 }}
        className={`absolute top-2 ${
          side === 'left' ? 'left-2' : 'right-2'
        } ${isPortHunter ? 'w-[260px]' : 'w-[215px]'} z-50 pointer-events-auto select-none`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="relative bg-[#09090B]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-3 text-white/95">
          {/* Subtle Top Ambient Accent */}
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent rounded-t-2xl" />

          {/* Comic Arrow Pointer directed down towards Mochi */}
          <div
            className={`absolute -bottom-1.5 ${
              side === 'left' ? 'right-6' : 'left-6'
            } w-3 h-3 bg-[#09090B] border-b border-r border-white/10 rotate-45 pointer-events-none`}
          />

          {/* Header Bar */}
          <div className="flex items-center justify-between gap-1.5 mb-2 pb-1.5 border-b border-white/10">
            <div className="flex items-center gap-1.5 min-w-0">
              {isPortHunter ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                  <span className="font-semibold text-[11px] tracking-wide text-zinc-200 truncate">
                    Localhost Ghost Hunter 👻
                  </span>
                </>
              ) : (
                <>
                  <span className="flex-shrink-0">
                    {speechBubble?.icon === 'shield' ? (
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                    ) : speechBubble?.icon === 'vitals' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    ) : speechBubble?.icon === 'capsule' ? (
                      <Clock className="w-3.5 h-3.5 text-cyan-300" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-pink-300" />
                    )}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-medium">Mochi</span>
                </>
              )}

              {remainingSeconds !== null && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  {remainingSeconds}s
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {isPortHunter && (
                <button
                  type="button"
                  onClick={fetchPorts}
                  title={isRTL ? 'بروزرسانی پورت‌ها' : 'Refresh ports'}
                  className="text-zinc-400 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="text-white/40 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Body: Ghost Hunter vs Standard Bubble */}
          {isPortHunter ? (
            <div className="space-y-1.5">
              <div className="space-y-1 max-h-44 overflow-y-auto pr-0.5">
                {ports.length === 0 ? (
                  <div className="text-zinc-400 text-center py-4">
                    <p className="text-[11px]">{isRTL ? 'هیچ پورت زامبی فعالی نیست 👻' : 'No ghost ports active 👻'}</p>
                    <p className="text-[9px] text-zinc-500 mt-1">
                      {isRTL ? 'لوکال‌هاست امن و آزاد است' : 'Localhost is free & clean'}
                    </p>
                  </div>
                ) : (
                  ports.map((p) => (
                    <div
                      key={`${p.port}-${p.pid}`}
                      className="flex items-center justify-between bg-zinc-900/90 border border-white/5 px-2.5 py-1.5 rounded-xl hover:border-white/15 transition-all"
                    >
                      <div className="min-w-0 pr-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-emerald-400 font-bold text-[11px]">:{p.port}</span>
                          <span className="text-[9px] text-zinc-400 truncate max-w-[95px]">{p.name}</span>
                        </div>
                        <div className="text-[8.5px] text-zinc-500 font-mono">PID: {p.pid}</div>
                      </div>
                      <button
                        type="button"
                        disabled={killingPid === p.pid}
                        onClick={() => handleKill(p.pid)}
                        className="flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        <Zap className="w-2.5 h-2.5 text-rose-400" />
                        <span>{killingPid === p.pid ? '...' : isRTL ? 'شکار' : 'Kill'}</span>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Mini Footer */}
              <div className="pt-1.5 border-t border-white/5 text-[9px] text-zinc-500 flex items-center justify-between">
                <span>{isRTL ? 'محافظ لوکال‌هاست' : 'Localhost Guardian'} 🛡️</span>
                <span className="font-mono text-[8.5px] text-zinc-600">{ports.length} {isRTL ? 'پورت' : 'ports'}</span>
              </div>
            </div>
          ) : (
            <>
              {/* Dialogue Text */}
              <p className="text-[10.5px] leading-relaxed font-medium text-white/95 mb-2 whitespace-pre-wrap">
                {speechBubble?.text}
              </p>

              {/* Action Buttons */}
              {speechBubble?.actions && speechBubble.actions.length > 0 && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
                  {speechBubble.actions.map((action, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        action.onClick();
                        hideSpeechBubble();
                      }}
                      className={`flex-1 py-1 px-2 rounded-lg text-[9.5px] font-semibold text-center transition-all cursor-pointer ${
                        action.variant === 'danger' || action.isDanger
                          ? 'bg-rose-500/30 hover:bg-rose-500/50 text-rose-200 border border-rose-400/30'
                          : action.variant === 'primary' || action.isPrimary
                          ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white shadow-sm'
                          : 'bg-white/10 hover:bg-white/20 text-white/80 border border-white/10'
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SpeechBubble;
