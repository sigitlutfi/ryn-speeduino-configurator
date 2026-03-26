import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  AlertTriangle, 
  X 
} from 'lucide-react';
import { useStore } from '../core/store';

const ICONS = {
  success: <CheckCircle2 size={18} className="text-neon-green glow-green" />,
  error: <AlertCircle size={18} className="text-neon-red glow-red" />,
  warning: <AlertTriangle size={18} className="text-neon-yellow glow-yellow" />,
  info: <Info size={18} className="text-neon-cyan glow-cyan" />
};

const BORDERS = {
  success: 'border-neon-green/30 shadow-glow-green/20',
  error: 'border-neon-red/30 shadow-glow-red/20',
  warning: 'border-neon-yellow/30 shadow-glow-yellow/20',
  info: 'border-neon-cyan/30 shadow-glow-cyan/20'
};

const BG_ACCENTS = {
  success: 'bg-neon-green/10',
  error: 'bg-neon-red/10',
  warning: 'bg-neon-yellow/10',
  info: 'bg-neon-cyan/10'
};

export default function NotificationTray() {
  const { notifications, removeNotification } = useStore();

  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 w-80 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            layout
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95, transition: { duration: 0.2 } }}
            className={`pointer-events-auto relative group overflow-hidden glass-card border rounded-2xl p-4 flex items-start gap-4 ${BORDERS[n.type]} ${BG_ACCENTS[n.type]} shadow-2xl`}
          >
            {/* Background Glow Pulse */}
            <div className={`absolute -inset-1 opacity-20 blur-xl ${BG_ACCENTS[n.type]} animate-pulse`} />

            {/* Icon Section */}
            <div className="flex-shrink-0 mt-0.5 relative z-10">
              {ICONS[n.type] || ICONS.info}
            </div>

            {/* Message payload */}
            <div className="flex-1 min-w-0 relative z-10">
              <p className="text-[11px] font-orbitron font-black text-white leading-relaxed tracking-wider py-0.5">
                {n.message}
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={() => removeNotification(n.id)}
              className="text-white/20 hover:text-white transition-colors relative z-10 p-1 -mr-2 -mt-2 group/btn"
            >
              <X size={14} className="group-hover/btn:rotate-90 transition-transform duration-300" />
            </button>

            {/* Progress Timer Bar */}
            {n.duration > 0 && (
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: n.duration / 1000, ease: 'linear' }}
                className={`absolute bottom-0 left-0 h-0.5 ${BORDERS[n.type].split(' ')[0].replace('border', 'bg')}`}
              />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
