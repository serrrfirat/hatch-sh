import { useEffect, useMemo, useCallback, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { letterAnimation, letterContainer } from '@hatch/ui'
import { X, CheckCircle, AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
import { MarketplaceSearchBar } from '../components/marketplace/MarketplaceSearchBar'
import { CategoryPills } from '../components/marketplace/CategoryPills'
import { SkillGrid } from '../components/marketplace/SkillGrid'
import { InstallLocationToggle } from '../components/marketplace/InstallLocationToggle'
import { AskAgentPanel } from '../components/marketplace/AskAgentPanel'
import { SkillDetailModal } from '../components/marketplace/SkillDetailModal'
import {
  useMarketplaceStore,
  type Skill,
  type Category,
} from '../stores/marketplaceStore'
import { installSkill, isTauri } from '../services/skillsService'

// Use our backend proxy to avoid CORS issues
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

// How many skills to fetch per page
const PAGE_SIZE = 100

// Demo skills for development/fallback
const DEMO_SKILLS: Skill[] = [
  {
    id: 'skill-writer',
    name: 'skill-writer',
    description:
      'Guide users through creating Agent Skills for Claude Code. Use when the user wants to create, write, author, or design a new Skill.',
    author: 'anthropic',
    categories: ['documentation', 'development'],
    githubUrl: 'https://github.com/anthropics/skill-writer',
    stars: 234,
    installCommand: 'claude skill install anthropics/skill-writer',
    trending: true,
  },
  {
    id: 'smart-push',
    name: 'smart-push',
    description:
      'Smart git add, commit with AI-generated message, and push. Analyzes staged changes to create meaningful commit messages.',
    author: 'hatch',
    categories: ['git', 'automation'],
    githubUrl: 'https://github.com/hatch-sh/smart-push',
    stars: 156,
    installCommand: 'claude skill install hatch-sh/smart-push',
  },
  {
    id: 'researcher',
    name: 'researcher',
    description:
      'Conduct comprehensive research on any topic using web search and structured analysis. Produces organized markdown reports with sources.',
    author: 'anthropic',
    categories: ['research', 'productivity'],
    githubUrl: 'https://github.com/anthropics/researcher',
    stars: 412,
    installCommand: 'claude skill install anthropics/researcher',
    featured: true,
  },
  {
    id: 'api-designer',
    name: 'api-designer',
    description:
      'Design REST APIs with OpenAPI specifications. Generates documentation, client SDKs, and server stubs.',
    author: 'openapi',
    categories: ['api-backend', 'documentation'],
    githubUrl: 'https://github.com/openapi/api-designer',
    stars: 289,
    installCommand: 'claude skill install openapi/api-designer',
  },
  {
    id: 'test-generator',
    name: 'test-generator',
    description:
      'Automatically generate unit tests for your codebase. Supports Jest, Vitest, pytest, and more.',
    author: 'testing-lab',
    categories: ['testing', 'automation'],
    githubUrl: 'https://github.com/testing-lab/test-generator',
    stars: 567,
    installCommand: 'claude skill install testing-lab/test-generator',
    trending: true,
  },
  {
    id: 'db-migrator',
    name: 'db-migrator',
    description:
      'Database migration assistant. Generates and reviews migration files for Prisma, Drizzle, and raw SQL.',
    author: 'dbtools',
    categories: ['database', 'devops'],
    githubUrl: 'https://github.com/dbtools/db-migrator',
    stars: 198,
    installCommand: 'claude skill install dbtools/db-migrator',
  },
  {
    id: 'security-scanner',
    name: 'security-scanner',
    description:
      'Scan your codebase for common security vulnerabilities. OWASP Top 10 coverage with remediation suggestions.',
    author: 'securityfirst',
    categories: ['security', 'automation'],
    githubUrl: 'https://github.com/securityfirst/security-scanner',
    stars: 723,
    installCommand: 'claude skill install securityfirst/security-scanner',
    featured: true,
  },
  {
    id: 'react-component',
    name: 'react-component',
    description:
      'Generate React components with TypeScript, Tailwind CSS, and best practices. Includes tests and stories.',
    author: 'reacttools',
    categories: ['frontend', 'development'],
    githubUrl: 'https://github.com/reacttools/react-component',
    stars: 445,
    installCommand: 'claude skill install reacttools/react-component',
  },
  {
    id: 'ai-prompt-eng',
    name: 'ai-prompt-eng',
    description:
      'Prompt engineering assistant. Helps craft, test, and optimize prompts for various LLM use cases.',
    author: 'promptlab',
    categories: ['ai', 'productivity'],
    githubUrl: 'https://github.com/promptlab/ai-prompt-eng',
    stars: 892,
    installCommand: 'claude skill install promptlab/ai-prompt-eng',
    trending: true,
  },
]

// Animated title component matching DiscoverPage
function AnimatedTitle({ text }: { text: string }) {
  return (
    <h1 className="text-[10vw] md:text-[7vw] lg:text-[5vw] leading-none font-bold tracking-tighter select-none flex overflow-hidden py-[1vw]">
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
      </motion.div>
    </h1>
  )
}

export function MarketplacePage() {
  // Store state
  const {
    skills,
    searchQuery,
    semanticSearch,
    activeCategory,
    installLocation,
    installingIds,
    installedIds,
    isLoading,
    isSearching,
    selectedSkill,
    isAnalyzing,
    suggestions,
    hasMore,
    nextPageToken,
    isLoadingMore,
    isCached,
    setSkills,
    appendSkills,
    setSearchQuery,
    setSemanticSearch,
    setActiveCategory,
    setInstallLocation,
    setIsLoading,
    setIsLoadingMore,
    setIsSearching,
    setSelectedSkill,
    setIsAnalyzing,
    setSuggestions,
    startInstalling,
    finishInstalling,
    getFilteredSkills,
    loadFromCache,
    saveToCache,
    clearCache,
  } = useMarketplaceStore()

  // Ref for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const isFetchingRef = useRef(false)

  // Derived state
  const filteredSkills = getFilteredSkills()

  // Derive categories from skills
  const categories = useMemo<Category[]>(() => {
    const catMap = new Map<string, number>()
    skills.forEach((skill) => {
      skill.categories.forEach((cat) => {
        catMap.set(cat, (catMap.get(cat) || 0) + 1)
      })
    })
    return Array.from(catMap.entries())
      .map(([id, count]) => ({
        id,
        label: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '),
        count,
      }))
      .sort((a, b) => b.count - a.count)
  }, [skills])

  // Fetch skills on mount - try cache first
  useEffect(() => {
    const loadSkills = async () => {
      // Try to load from cache first
      const cachedLoaded = loadFromCache()
      if (cachedLoaded) {
        setIsLoading(false)
        // Optionally refresh in background
        fetchSkillsInBackground()
        return
      }

      // No cache, fetch fresh
      await fetchSkills()
    }

    loadSkills()
  }, [])

  // Debounced semantic search
  useEffect(() => {
    if (!semanticSearch || !searchQuery) return

    const timer = setTimeout(() => {
      performSemanticSearch(searchQuery)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery, semanticSearch])

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isFetchingRef.current) {
          loadMoreSkills()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, nextPageToken])

  const fetchSkills = async () => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    setIsLoading(true)

    try {
      // Fetch first page from our backend proxy
      const response = await fetch(`${API_URL}/api/skillsmp/skills?limit=${PAGE_SIZE}`)
      if (response.ok) {
        const data = await response.json()
        const fetchedSkills = data.skills || []

        if (fetchedSkills.length > 0) {
          setSkills(fetchedSkills, {
            hasMore: data.has_more || false,
            nextPage: data.next_page,
            total: data.total || fetchedSkills.length,
            fromCache: false,
          })
          // Save to cache
          saveToCache()
        } else {
          // Fallback to demo skills
          setSkills(DEMO_SKILLS, { hasMore: false, total: DEMO_SKILLS.length })
        }
      } else {
        setSkills(DEMO_SKILLS, { hasMore: false, total: DEMO_SKILLS.length })
      }
    } catch (error) {
      setSkills(DEMO_SKILLS, { hasMore: false, total: DEMO_SKILLS.length })
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }

  const fetchSkillsInBackground = async () => {
    // Silently refresh skills in background without showing loading state
    try {
      const response = await fetch(`${API_URL}/api/skillsmp/skills?limit=${PAGE_SIZE}`)
      if (response.ok) {
        const data = await response.json()
        const fetchedSkills = data.skills || []
        if (fetchedSkills.length > 0) {
          setSkills(fetchedSkills, {
            hasMore: data.has_more || false,
            nextPage: data.next_page,
            total: data.total || fetchedSkills.length,
            fromCache: false,
          })
          saveToCache()
        }
      }
    } catch (error) {
    }
  }

  const loadMoreSkills = async () => {
    if (!hasMore || !nextPageToken || isLoadingMore || isFetchingRef.current) return

    isFetchingRef.current = true
    setIsLoadingMore(true)

    try {
      const response = await fetch(
        `${API_URL}/api/skillsmp/skills?limit=${PAGE_SIZE}&next_page=${encodeURIComponent(nextPageToken)}`
      )
      if (response.ok) {
        const data = await response.json()
        const newSkills = data.skills || []

        if (newSkills.length > 0) {
          appendSkills(newSkills, data.has_more || false, data.next_page || null)
          // Update cache with new skills
          saveToCache()
        }
      }
    } catch (error) {
    } finally {
      setIsLoadingMore(false)
      isFetchingRef.current = false
    }
  }

  const handleRefresh = async () => {
    clearCache()
    await fetchSkills()
  }

  const performSemanticSearch = async (query: string) => {
    setIsSearching(true)
    try {
      // Use our backend proxy for semantic search
      const response = await fetch(
        `${API_URL}/api/skillsmp/skills/search?q=${encodeURIComponent(query)}`
      )
      if (response.ok) {
        const data = await response.json()
        const searchResults = data.skills || []
        if (searchResults.length > 0) {
          setSkills(searchResults, { hasMore: false })
        }
      }
    } catch (error) {
    } finally {
      setIsSearching(false)
    }
  }

  // Toast notification state
  const [toast, setToast] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const handleInstall = useCallback(
    async (skill: Skill, location: 'local' | 'global') => {
      startInstalling(skill.id)

      try {
        // Check if we're in Tauri environment
        if (!isTauri()) {
          // Show manual installation instructions for web
          setToast({
            type: 'error',
            message: `To install "${skill.name}", run: ${skill.installCommand}`,
          })
          finishInstalling(skill.id, false)
          return
        }

        // Real installation via Tauri
        const result = await installSkill(skill, location === 'global')

        if (result.success) {
          finishInstalling(skill.id, true)
          setToast({
            type: 'success',
            message: `Successfully installed "${skill.name}" to ${result.path || (location === 'global' ? '~/.claude/skills/' : '.claude/skills/')}`,
          })
        } else {
          finishInstalling(skill.id, false)
          setToast({
            type: 'error',
            message: result.message || `Failed to install "${skill.name}"`,
          })
        }
      } catch (error) {
        finishInstalling(skill.id, false)
        setToast({
          type: 'error',
          message: `Failed to install "${skill.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
      }
    },
    [startInstalling, finishInstalling]
  )

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    try {
      // Simulate codebase analysis
      // In a real implementation, this would:
      // 1. Read package.json, README, etc.
      // 2. Analyze the tech stack
      // 3. Query the API for relevant skills

      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Return some suggestions based on common patterns
      const suggestedSkills = skills.filter(
        (s) =>
          s.categories.includes('testing') ||
          s.categories.includes('documentation') ||
          s.trending
      )
      setSuggestions(suggestedSkills.slice(0, 3))
    } catch (error) {
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleClearSuggestions = () => {
    setSuggestions([])
  }

  return (
    <div className="h-full overflow-auto bg-neutral-950">
      {/* Hero Section */}
      <section className="relative min-h-[25vh] flex flex-col justify-center px-6 md:px-12 pt-8">
        <div className="flex items-end justify-between">
          <div>
            <AnimatedTitle text="Marketplace" />
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="text-lg md:text-xl text-neutral-500 font-medium tracking-tight mt-4 max-w-xl"
            >
              Agent skills to supercharge your development workflow.
            </motion.p>
          </div>
          <div className="hidden md:flex items-center gap-3">
            {isCached && (
              <button
                onClick={handleRefresh}
                className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/10 transition-colors"
                title="Refresh skills"
              >
                <RefreshCw size={16} />
              </button>
            )}
            <span className="font-mono text-sm text-neutral-600">
              ( _{skills.length.toLocaleString()}{hasMore ? '+' : ''} )
            </span>
          </div>
        </div>
      </section>

      {/* Search and Filters */}
      <section className="px-6 md:px-12 py-6 space-y-4">
        <MarketplaceSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          semanticEnabled={semanticSearch}
          onSemanticToggle={setSemanticSearch}
          isSearching={isSearching}
          placeholder="Search skills..."
        />

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CategoryPills
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            className="flex-1 min-w-0"
          />

          <InstallLocationToggle
            value={installLocation}
            onChange={setInstallLocation}
          />
        </div>
      </section>

      {/* Skills Grid */}
      <section className="px-6 md:px-12 pb-32">
        <SkillGrid
          skills={filteredSkills}
          installLocation={installLocation}
          onInstall={handleInstall}
          onViewDetails={setSelectedSkill}
          installingIds={installingIds}
          installedIds={installedIds}
          isLoading={isLoading}
        />

        {/* Load More / Infinite Scroll Trigger */}
        {!isLoading && hasMore && (
          <div
            ref={loadMoreRef}
            className="flex flex-col items-center justify-center py-8 mt-8"
          >
            {isLoadingMore ? (
              <div className="flex items-center gap-3 text-neutral-500">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Loading more skills...</span>
              </div>
            ) : (
              <button
                onClick={loadMoreSkills}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-neutral-900 border border-white/10 text-neutral-400 hover:text-white hover:border-white/20 transition-colors"
              >
                <span>Load more skills</span>
                <span className="text-xs text-neutral-600">
                  ({skills.length.toLocaleString()} loaded)
                </span>
              </button>
            )}
          </div>
        )}

        {/* End of list indicator */}
        {!isLoading && !hasMore && skills.length > 0 && (
          <div className="text-center py-8 text-neutral-600 text-sm">
            Showing all {skills.length.toLocaleString()} skills
          </div>
        )}
      </section>

      {/* Ask Agent Floating Panel */}
      <AskAgentPanel
        onAnalyze={handleAnalyze}
        isAnalyzing={isAnalyzing}
        suggestions={suggestions}
        onInstallSuggestion={(skill) => handleInstall(skill, installLocation)}
        onClearSuggestions={handleClearSuggestions}
      />

      {/* Skill Detail Modal */}
      <SkillDetailModal
        skill={selectedSkill}
        isOpen={!!selectedSkill}
        onClose={() => setSelectedSkill(null)}
        onInstall={handleInstall}
        installLocation={installLocation}
        onInstallLocationChange={setInstallLocation}
        isInstalling={selectedSkill ? installingIds.has(selectedSkill.id) : false}
        isInstalled={selectedSkill ? installedIds.has(selectedSkill.id) : false}
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-6 left-1/2 z-50 max-w-lg"
          >
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl ${
                toast.type === 'success'
                  ? 'bg-[#00ff88]/10 border-[#00ff88]/30 text-[#00ff88]'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle size={18} />
              ) : (
                <AlertCircle size={18} />
              )}
              <p className="text-sm font-medium flex-1">{toast.message}</p>
              <button
                onClick={() => setToast(null)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
