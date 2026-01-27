import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ScreenTransitionProps {
  children: ReactNode;
  screenKey: string;
  direction?: 'forward' | 'back';
}

const variants = {
  enter: (direction: 'forward' | 'back') => ({
    x: direction === 'forward' ? '100%' : '-30%',
    opacity: direction === 'forward' ? 1 : 0.5,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: 'forward' | 'back') => ({
    x: direction === 'forward' ? '-30%' : '100%',
    opacity: direction === 'forward' ? 0.5 : 1,
  }),
};

export const ScreenTransition = ({
  children,
  screenKey,
  direction = 'forward'
}: ScreenTransitionProps) => {
  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={screenKey}
        custom={direction}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
          mass: 1,
        }}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

// Fade transition for tab changes
export const FadeTransition = ({
  children,
  screenKey
}: { children: ReactNode; screenKey: string }) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={screenKey}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{
          duration: 0.2,
          ease: 'easeOut',
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

// List item stagger animation
export const StaggerList = ({
  children,
  className = ''
}: { children: ReactNode; className?: string }) => {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.05,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const StaggerItem = ({
  children,
  className = ''
}: { children: ReactNode; className?: string }) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            type: 'spring',
            stiffness: 300,
            damping: 24,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
