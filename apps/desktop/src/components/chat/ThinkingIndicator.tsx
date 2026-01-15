import { motion } from 'framer-motion'

// Editorial easing - smooth, elegant motion
const editorialEase = [0.16, 1, 0.3, 1] as const

interface ThinkingIndicatorProps {
  text?: string
}

// Letter animation for staggered reveals
const letterAnim = {
  initial: { y: "100%", opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { duration: 0.5, ease: editorialEase } }
}

const containerAnim = {
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.1,
    }
  }
}

export function ThinkingIndicator({ text = 'Processing' }: ThinkingIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: editorialEase }}
      className="flex items-center gap-4 py-6"
    >
      {/* Animated title with letter reveal */}
      <h3 className="text-xl font-medium tracking-tight flex overflow-hidden">
        <motion.span
          variants={containerAnim}
          initial="initial"
          animate="animate"
          className="flex text-white"
        >
          {text.split('').map((char, i) => (
            <motion.span key={i} variants={letterAnim} className="inline-block">
              {char === ' ' ? '\u00A0' : char}
            </motion.span>
          ))}
        </motion.span>
      </h3>

      {/* Pulsing dot */}
      <motion.div
        className="w-2 h-2 rounded-full bg-white"
        animate={{ opacity: [1, 0.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  )
}

/**
 * Animated thinking text with character reveal
 */
export function AnimatedThinkingText() {
  const text = 'Thinking'

  return (
    <motion.div className="flex items-center gap-1 overflow-hidden">
      <motion.span
        variants={containerAnim}
        initial="initial"
        animate="animate"
        className="flex text-white/60"
      >
        {text.split('').map((char, i) => (
          <motion.span
            key={i}
            variants={letterAnim}
            className="inline-block text-sm"
          >
            {char}
          </motion.span>
        ))}
      </motion.span>
      <motion.span
        className="text-sm text-white/60"
        animate={{ opacity: [0, 1, 0] }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        ...
      </motion.span>
    </motion.div>
  )
}

/**
 * Compact inline thinking indicator
 */
export function InlineThinkingIndicator() {
  return (
    <span className="inline-flex items-center gap-2 text-white/50">
      <motion.div
        className="w-1.5 h-1.5 rounded-full bg-white"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="text-xs font-mono uppercase tracking-wider">thinking</span>
    </span>
  )
}
