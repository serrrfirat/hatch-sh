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

  // Ask Agent
  isAnalyzing: boolean
  suggestions: Skill[]

  // Actions
  setSkills: (skills: Skill[]) => void
  setCategories: (categories: Category[]) => void
  setSearchQuery: (query: string) => void
  setSemanticSearch: (enabled: boolean) => void
  setActiveCategory: (category: string | null) => void
  setInstallLocation: (location: 'local' | 'global') => void
  setIsLoading: (loading: boolean) => void
  setIsSearching: (searching: boolean) => void
  setSelectedSkill: (skill: Skill | null) => void
  setIsAnalyzing: (analyzing: boolean) => void
  setSuggestions: (suggestions: Skill[]) => void

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

  // Setters
  setSkills: (skills) => set({ skills }),
  setCategories: (categories) => set({ categories }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSemanticSearch: (semanticSearch) => set({ semanticSearch }),
  setActiveCategory: (activeCategory) => set({ activeCategory }),
  setInstallLocation: (installLocation) => set({ installLocation }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsSearching: (isSearching) => set({ isSearching }),
  setSelectedSkill: (selectedSkill) => set({ selectedSkill }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setSuggestions: (suggestions) => set({ suggestions }),

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
