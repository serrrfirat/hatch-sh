import { motion } from 'framer-motion'
import { letterAnimation, letterContainer } from '@hatch/ui'
import { ArrowUpRight } from 'lucide-react'

interface WelcomeScreenProps {
  onSendMessage: (message: string) => void
}

const SUGGESTIONS = [
  {
    title: 'Todo App',
    prompt: 'Build a simple todo app with add, complete, and delete functionality',
    category: 'Productivity',
  },
  {
    title: 'Weather Widget',
    prompt: 'Create a weather widget that shows temperature and conditions',
    category: 'Utility',
  },
  {
    title: 'Countdown Timer',
    prompt: 'Make a countdown timer with start, pause, and reset buttons',
    category: 'Tool',
  },
  {
    title: 'Quote Generator',
    prompt: 'Build a random quote generator with a nice card design',
    category: 'Fun',
  },
]

function AnimatedTitle({ text }: { text: string }) {
  return (
    <h1 className="text-[12vw] md:text-[8vw] lg:text-[6vw] leading-none font-bold tracking-tighter mb-4 select-none flex justify-center overflow-hidden py-[1vw]">
      <motion.div
        variants={letterContainer}
        initial="initial"
        animate="animate"
        className="flex"
      >
        {text.split('').map((char, i) => (
          <motion.span
            key={i}
            variants={letterAnimation}
            className="inline-block relative"
          >
            {char === ' ' ? '\u00A0' : char}
          </motion.span>
        ))}
        <motion.span
          variants={letterAnimation}
          className="text-2xl align-top ml-2 font-normal inline-block mt-[2vw] text-neutral-500"
        >
          ®
        </motion.span>
      </motion.div>
    </h1>
  )
}

export function WelcomeScreen({ onSendMessage }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 overflow-hidden bg-neutral-950">
      <div className="text-center max-w-4xl">
        {/* Editorial Hero */}
        <div className="mb-16">
          <AnimatedTitle text="hatch.sh" />

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="text-xl md:text-2xl text-neutral-500 font-medium tracking-tight"
          >
            Describe your app. Launch your token. Own your creation.
          </motion.p>
        </div>

        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="flex items-end justify-between mb-10 border-b border-white/10 pb-6"
        >
          <h2 className="text-3xl md:text-5xl font-medium tracking-tighter text-white">
            Start <br className="md:hidden" />Building.
          </h2>
          <span className="hidden md:block font-mono text-sm text-neutral-600">( _04 )</span>
        </motion.div>

        {/* Suggestion cards - Editorial Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12"
        >
          {SUGGESTIONS.map((suggestion, i) => (
            <motion.div
              key={suggestion.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 + i * 0.1 }}
              onClick={() => onSendMessage(suggestion.prompt)}
              className="group cursor-pointer text-left"
            >
              <div className="border-t border-white/10 pt-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider mb-3">
                      {suggestion.category}
                    </p>
                    <h3 className="text-2xl font-medium text-white mb-2 tracking-tight group-hover:text-neutral-400 transition-colors">
                      {suggestion.title}
                    </h3>
                    <p className="text-sm text-neutral-500 line-clamp-2">
                      {suggestion.prompt}
                    </p>
                  </div>
                  <div className="bg-neutral-800 rounded-full p-2 opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                    <ArrowUpRight size={16} className="text-white" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
