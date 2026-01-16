import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

interface Category {
  id: string
  label: string
  count: number
}

interface CategoryPillsProps {
  categories: Category[]
  activeCategory: string | null
  onCategoryChange: (categoryId: string | null) => void
  className?: string
}

// Category color mapping
const categoryColors: Record<string, string> = {
  documentation: 'bg-violet-400/10 text-violet-400 border-violet-400/20',
  testing: 'bg-pink-400/10 text-pink-400 border-pink-400/20',
  git: 'bg-orange-400/10 text-orange-400 border-orange-400/20',
  database: 'bg-sky-400/10 text-sky-400 border-sky-400/20',
  api: 'bg-green-400/10 text-green-400 border-green-400/20',
  devops: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  research: 'bg-indigo-400/10 text-indigo-400 border-indigo-400/20',
  automation: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20',
  development: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  productivity: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  'api-backend': 'bg-green-400/10 text-green-400 border-green-400/20',
  frontend: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  security: 'bg-red-400/10 text-red-400 border-red-400/20',
  ai: 'bg-purple-400/10 text-purple-400 border-purple-400/20',
}

const defaultColor = 'bg-neutral-800 text-neutral-400 border-neutral-700'

export function CategoryPills({
  categories,
  activeCategory,
  onCategoryChange,
  className = '',
}: CategoryPillsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showMore, setShowMore] = useState(false)
  const visibleCount = 8

  const visibleCategories = categories.slice(0, visibleCount)
  const hiddenCategories = categories.slice(visibleCount)

  return (
    <div className={`relative flex items-center gap-2 ${className}`}>
      {/* All button */}
      <button
        onClick={() => onCategoryChange(null)}
        className={`relative flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
          activeCategory === null
            ? 'bg-white text-black border-white'
            : 'bg-transparent text-neutral-400 border-neutral-700 hover:text-white hover:border-neutral-500'
        }`}
      >
        All
      </button>

      {/* Scrollable pills container */}
      <div
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto scrollbar-none"
      >
        {visibleCategories.map((category) => {
          const colorClasses = categoryColors[category.id] || defaultColor
          const isActive = activeCategory === category.id

          return (
            <motion.button
              key={category.id}
              onClick={() => onCategoryChange(isActive ? null : category.id)}
              className={`relative flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                isActive
                  ? colorClasses
                  : 'bg-transparent text-neutral-500 border-neutral-800 hover:text-neutral-300 hover:border-neutral-600'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span>{category.label}</span>
              <span
                className={`text-xs opacity-60 ${isActive ? '' : 'text-neutral-600'}`}
              >
                {category.count}
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* More dropdown */}
      {hiddenCategories.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowMore(!showMore)}
            className="flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium text-neutral-500 border border-neutral-800 hover:text-neutral-300 hover:border-neutral-600 transition-colors"
          >
            <span>+{hiddenCategories.length}</span>
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${showMore ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {showMore && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full mt-2 right-0 z-50 p-2 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl min-w-[200px]"
              >
                {hiddenCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      onCategoryChange(category.id)
                      setShowMore(false)
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                  >
                    <span>{category.label}</span>
                    <span className="text-xs text-neutral-600">{category.count}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
