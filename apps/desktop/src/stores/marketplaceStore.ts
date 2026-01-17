import { create } from 'zustand'

export interface Skill {
  id: string
  name: string
  description: string
  author: string
  authorUrl?: string
  categories: string[]
  githubUrl: string
  stars: number
  installCommand: string
  skillMdUrl?: string
  skillMdContent?: string
  icon?: string
  trending?: boolean
  featured?: boolean
  repoPath?: string
}

export interface Category {
  id: string
  label: string
  count: number
}

// Cache configuration
const CACHE_KEY = 'hatch_skills_cache'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour in milliseconds

interface CachedData {
  skills: Skill[]
  timestamp: number
  complete: boolean
}

// Cache helpers
function getCachedSkills(): CachedData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null

    const data: CachedData = JSON.parse(cached)
    const age = Date.now() - data.timestamp

    // Return cache if not expired
    if (age < CACHE_TTL) {
      return data
    }

    // Cache expired, clear it
    localStorage.removeItem(CACHE_KEY)
    return null
  } catch {
    return null
  }
}

function setCachedSkills(skills: Skill[], complete: boolean): void {
  try {
    const data: CachedData = {
      skills,
      timestamp: Date.now(),
      complete,
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch (e) {
    // Storage quota exceeded or other error, ignore
    console.warn('Failed to cache skills:', e)
  }
}

export function clearSkillsCache(): void {
  localStorage.removeItem(CACHE_KEY)
}

interface MarketplaceState {
  // Data
  skills: Skill[]
  categories: Category[]

  // Search & Filters
  searchQuery: string
  semanticSearch: boolean
  activeCategory: string | null

  // Install options
  installLocation: 'local' | 'global'
  installingIds: Set<string>
  installedIds: Set<string>

  // UI state
  isLoading: boolean
  isSearching: boolean
  selectedSkill: Skill | null

  // Pagination & Cache state
  hasMore: boolean
  nextPageToken: string | null
  isLoadingMore: boolean
  isCached: boolean
  totalSkills: number

  // Ask Agent
  isAnalyzing: boolean
  suggestions: Skill[]

  // Actions
  setSkills: (skills: Skill[], options?: { hasMore?: boolean; nextPage?: string; total?: number; fromCache?: boolean }) => void
  appendSkills: (skills: Skill[], hasMore: boolean, nextPage: string | null) => void
  setCategories: (categories: Category[]) => void
  setSearchQuery: (query: string) => void
  setSemanticSearch: (enabled: boolean) => void
  setActiveCategory: (category: string | null) => void
  setInstallLocation: (location: 'local' | 'global') => void
  setIsLoading: (loading: boolean) => void
  setIsLoadingMore: (loading: boolean) => void
  setIsSearching: (searching: boolean) => void
  setSelectedSkill: (skill: Skill | null) => void
  setIsAnalyzing: (analyzing: boolean) => void
  setSuggestions: (suggestions: Skill[]) => void

  // Cache actions
  loadFromCache: () => boolean
  saveToCache: () => void
  clearCache: () => void

  // Install tracking
  startInstalling: (skillId: string) => void
  finishInstalling: (skillId: string, success: boolean) => void

  // Computed
  getFilteredSkills: () => Skill[]
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  // Initial state
  skills: [],
  categories: [],
  searchQuery: '',
  semanticSearch: false,
  activeCategory: null,
  installLocation: 'local',
  installingIds: new Set(),
  installedIds: new Set(),
  isLoading: true,
  isSearching: false,
  selectedSkill: null,
  isAnalyzing: false,
  suggestions: [],

  // Pagination & Cache state
  hasMore: false,
  nextPageToken: null,
  isLoadingMore: false,
  isCached: false,
  totalSkills: 0,

  // Setters
  setSkills: (skills, options = {}) => set({
    skills,
    hasMore: options.hasMore ?? false,
    nextPageToken: options.nextPage ?? null,
    totalSkills: options.total ?? skills.length,
    isCached: options.fromCache ?? false,
  }),

  appendSkills: (newSkills, hasMore, nextPage) => set((state) => ({
    skills: [...state.skills, ...newSkills],
    hasMore,
    nextPageToken: nextPage,
    totalSkills: state.totalSkills + newSkills.length,
  })),

  setCategories: (categories) => set({ categories }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSemanticSearch: (semanticSearch) => set({ semanticSearch }),
  setActiveCategory: (activeCategory) => set({ activeCategory }),
  setInstallLocation: (installLocation) => set({ installLocation }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsLoadingMore: (isLoadingMore) => set({ isLoadingMore }),
  setIsSearching: (isSearching) => set({ isSearching }),
  setSelectedSkill: (selectedSkill) => set({ selectedSkill }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setSuggestions: (suggestions) => set({ suggestions }),

  // Cache actions
  loadFromCache: () => {
    const cached = getCachedSkills()
    if (cached && cached.skills.length > 0) {
      set({
        skills: cached.skills,
        isCached: true,
        hasMore: !cached.complete,
        totalSkills: cached.skills.length,
      })
      return true
    }
    return false
  },

  saveToCache: () => {
    const { skills, hasMore } = get()
    if (skills.length > 0) {
      setCachedSkills(skills, !hasMore)
    }
  },

  clearCache: () => {
    clearSkillsCache()
    set({ isCached: false })
  },

  // Install tracking
  startInstalling: (skillId) => {
    set((state) => ({
      installingIds: new Set(state.installingIds).add(skillId),
    }))
  },

  finishInstalling: (skillId, success) => {
    set((state) => {
      const newInstallingIds = new Set(state.installingIds)
      newInstallingIds.delete(skillId)

      const newInstalledIds = success
        ? new Set(state.installedIds).add(skillId)
        : state.installedIds

      return {
        installingIds: newInstallingIds,
        installedIds: newInstalledIds,
      }
    })
  },

  // Computed
  getFilteredSkills: () => {
    const { skills, searchQuery, activeCategory } = get()
    let result = skills

    if (activeCategory) {
      result = result.filter((s) => s.categories.includes(activeCategory))
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.author.toLowerCase().includes(query) ||
          s.categories.some((c) => c.toLowerCase().includes(query))
      )
    }

    return result
  },
}))
