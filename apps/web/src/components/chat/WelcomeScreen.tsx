import { motion } from 'framer-motion'
import { Card, slideUp, staggerContainer } from '@vibed/ui'

interface WelcomeScreenProps {
  onSendMessage: (message: string) => void
}

const SUGGESTIONS = [
  {
    title: 'Todo App',
    prompt: 'Build a simple todo app with add, complete, and delete functionality',
  },
  {
    title: 'Weather Widget',
    prompt: 'Create a weather widget that shows temperature and conditions',
  },
  {
    title: 'Countdown Timer',
    prompt: 'Make a countdown timer with start, pause, and reset buttons',
  },
  {
    title: 'Quote Generator',
    prompt: 'Build a random quote generator with a nice card design',
  },
]

export function WelcomeScreen({ onSendMessage }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="text-center max-w-2xl"
      >
        <motion.h1
          variants={slideUp}
          className="text-4xl font-bold mb-2 text-gradient"
        >
          What do you want to build?
        </motion.h1>
        <motion.p
          variants={slideUp}
          className="text-gray-500 mb-8"
        >
          Describe your app and I'll generate the code. Then deploy and launch your token.
        </motion.p>

        {/* Suggestion cards */}
        <motion.div
          variants={slideUp}
          className="grid grid-cols-2 gap-3"
        >
          {SUGGESTIONS.map((suggestion) => (
            <Card
              key={suggestion.title}
              variant="bordered"
              hoverable
              onClick={() => onSendMessage(suggestion.prompt)}
              className="text-left cursor-pointer"
            >
              <h3 className="font-semibold text-white mb-1">{suggestion.title}</h3>
              <p className="text-sm text-gray-500 line-clamp-2">{suggestion.prompt}</p>
            </Card>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}
