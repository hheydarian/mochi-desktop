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
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="absolute inset-3 rounded-3xl glass-surface border-2 border-dashed border-sky-400/60 bg-sky-500/15 backdrop-blur-xl flex flex-col items-center justify-center gap-3 z-50 pointer-events-none shadow-2xl"
        >
          <div className="w-14 h-14 rounded-full bg-sky-400/20 border border-sky-300/40 flex items-center justify-center text-sky-300 animate-bounce">
            <UploadCloud className="w-7 h-7" />
          </div>
          <p className="text-sm font-semibold text-sky-100 text-center px-4">
            {t.ui.dropHint}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
