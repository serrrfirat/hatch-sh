import { type Variants } from 'framer-motion'

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export const slideIn: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
}

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

export const glitch: Variants = {
  idle: { x: 0 },
  glitch: {
    x: [0, -2, 2, -2, 2, 0],
    transition: { duration: 0.3 },
  },
}

// Letter-by-letter animation for editorial headlines
export const letterAnimation: Variants = {
  initial: { y: '100%', opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
  },
}

export const letterContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.1,
    },
  },
}

// Marquee animation for sliders
export const marqueeContainer: Variants = {
  animate: {
    x: [0, '-50%'],
    transition: {
      x: {
        repeat: Infinity,
        repeatType: 'loop',
        duration: 30,
        ease: 'linear',
      },
    },
  },
}

// Card hover animation with grayscale transition
export const editorialCardHover: Variants = {
  initial: { scale: 1, filter: 'grayscale(100%)' },
  hover: {
    scale: 1.02,
    filter: 'grayscale(0%)',
    transition: { duration: 0.5 }
  },
}
