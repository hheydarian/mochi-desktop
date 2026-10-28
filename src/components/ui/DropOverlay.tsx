import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud } from 'lucide-react';
import { useTranslation } from '../../locales';

interface DropOverlayProps {
  isDragging: boolean;
}

export const DropOverlay: React.FC<DropOverlayProps> = ({ isDragging }) => {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="absolute inset-2 rounded-full glass-surface border-2 border-purple-400/80 bg-purple-950/25 backdrop-blur-md flex flex-col items-center justify-center gap-2 z-50 pointer-events-none shadow-[0_0_35px_rgba(168,85,247,0.5)] animate-pulse"
        >
          <div className="w-12 h-12 rounded-full bg-purple-500/25 border border-purple-300/60 flex items-center justify-center text-purple-200 animate-bounce shadow-[0_0_15px_rgba(168,85,247,0.6)]">
            <UploadCloud className="w-6 h-6" />
          </div>
          <p className="text-xs font-bold text-purple-100 text-center px-3 tracking-wide">
            {t.powers.exifSanitizer}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
