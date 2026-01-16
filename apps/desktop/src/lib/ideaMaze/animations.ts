// Premium Animation Configurations for Idea Maze
// Midnight Editorial Style

import type { Transition, Variants } from 'framer-motion'

/** Premium easing curve - smooth deceleration */
export const PREMIUM_EASING = [0.22, 1, 0.36, 1] as const

/** Spring configurations */
export const SPRING_SMOOTH: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 25,
  mass: 0.5,
}

export const SPRING_BOUNCY: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 20,
  mass: 0.5,
}

export const SPRING_SNAPPY: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
  mass: 0.5,
}

/** Duration-based transitions */
export const TRANSITION_FAST: Transition = {
  duration: 0.15,
  ease: PREMIUM_EASING,
}

export const TRANSITION_NORMAL: Transition = {
  duration: 0.25,
  ease: PREMIUM_EASING,
}

export const TRANSITION_SLOW: Transition = {
  duration: 0.4,
  ease: PREMIUM_EASING,
}

export const TRANSITION_ENTRANCE: Transition = {
  duration: 0.6,
  ease: PREMIUM_EASING,
}

/** Card variants */
export const cardVariants: Variants = {
  initial: {
    opacity: 0,
    y: 50,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: TRANSITION_ENTRANCE,
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: TRANSITION_FAST,
  },
  hover: {
    y: -4,
    transition: SPRING_SMOOTH,
  },
  selected: {
    boxShadow: '0 0 0 2px #FF6B50',
    transition: TRANSITION_FAST,
  },
}

/** Parallax hover effect for cards */
export const PARALLAX_INTENSITY = {
  rotation: 1.5,
  elevation: 6,
}

/** Connection line variants */
export const connectionVariants: Variants = {
  initial: {
    pathLength: 0,
    opacity: 0,
  },
  animate: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 0.5, ease: PREMIUM_EASING },
      opacity: { duration: 0.2 },
    },
  },
  exit: {
    pathLength: 0,
    opacity: 0,
    transition: TRANSITION_FAST,
  },
  hover: {
    strokeWidth: 3,
    transition: TRANSITION_FAST,
  },
}

/** AI suggestion glow variants */
export const aiSuggestionVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.9,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: TRANSITION_ENTRANCE,
  },
  pulse: {
    opacity: [0.7, 1, 0.7],
    scale: [0.98, 1, 0.98],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

/** Toolbar button variants */
export const toolbarButtonVariants: Variants = {
  initial: {
    scale: 1,
  },
  hover: {
    scale: 1.1,
    transition: SPRING_SNAPPY,
  },
  tap: {
    scale: 0.95,
    transition: SPRING_SNAPPY,
  },
  active: {
    scale: 1,
    backgroundColor: 'rgba(255, 107, 80, 0.15)',
  },
}

/** Background orb animation */
export const orbVariants: Variants = {
  animate: {
    x: [0, 20, -10, 15, 0],
    y: [0, -15, 10, -5, 0],
    scale: [1, 1.1, 0.95, 1.05, 1],
    opacity: [0.4, 0.6, 0.5, 0.55, 0.4],
    transition: {
      duration: 25,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

/** Minimap variants */
export const minimapVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.8,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: SPRING_SMOOTH,
  },
}

/** Sidebar panel variants */
export const sidebarVariants: Variants = {
  collapsed: {
    width: 0,
    opacity: 0,
    transition: TRANSITION_NORMAL,
  },
  expanded: {
    width: 320,
    opacity: 1,
    transition: TRANSITION_NORMAL,
  },
}

/** Selection rectangle variants */
export const selectionRectVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: { duration: 0.1 },
  },
}

/** Stagger children animation */
export const staggerContainerVariants: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}

export const staggerItemVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: PREMIUM_EASING },
  },
}

/** Tooltip variants */
export const tooltipVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 5,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: TRANSITION_FAST,
  },
}

/** Midnight Editorial Card Style */
export const GLASS_STYLE = {
  background: '#111111',
  border: '1px solid #333333',
  boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
  borderRadius: '24px',
}

export const GLASS_HOVER_STYLE = {
  boxShadow: '0 12px 40px rgba(255, 107, 80, 0.1), 0 0 0 1px rgba(255, 107, 80, 0.3)',
}

/** Midnight Editorial Color Palette */
export const COLORS = {
  // Backgrounds
  background: '#050505',
  backgroundAlt: '#111111',
  surface: '#1a1a1a',

  // Borders
  border: '#333333',
  borderLight: '#222222',

  // Text
  text: '#ffffff',
  textMuted: '#888888',
  textDim: '#666666',
  textFaint: '#444444',

  // Primary accent - Coral
  primary: '#FF6B50',
  primaryHover: '#E55A40',
  primaryGlow: 'rgba(255, 107, 80, 0.2)',

  // AI/Success - keeping green for AI suggestions
  aiSuggestion: '#22c55e',
  aiSuggestionGlow: 'rgba(34, 197, 94, 0.2)',

  // Connection relationship colors
  connection: {
    related: '#FF6B50',
    'depends-on': '#4F46E5',
    contradicts: '#ef4444',
    extends: '#22c55e',
    alternative: '#f59e0b',
  },
} as const
