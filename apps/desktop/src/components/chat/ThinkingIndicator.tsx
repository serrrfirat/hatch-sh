import { motion } from 'framer-motion'

interface ThinkingIndicatorProps {
  text?: string
}

export function ThinkingIndicator({ text = 'Thinking' }: ThinkingIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-2 text-purple-300"
    >
      <span className="font-mono text-sm">{text}</span>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 bg-purple-400 rounded-full"
            animate={{
              y: [0, -4, 0],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </motion.div>
  )
}

/**
 * Animated thinking text with character reveal
 */
export function AnimatedThinkingText() {
  const text = 'Thinking'

  return (
    <motion.div className="flex items-center gap-1">
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          className="font-mono text-sm text-purple-300"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: i * 0.05,
            duration: 0.2,
          }}
        >
          {char}
        </motion.span>
      ))}
      <motion.span
        className="font-mono text-sm text-purple-300"
        animate={{ opacity: [0, 1, 0] }}
        transition={{
          duration: 1,
          repeat: Infinity,
          repeatDelay: 0.2,
        }}
      >
        ...
      </motion.span>
    </motion.div>
  )
}
