import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@vibed/ui'
import { invoke } from '@tauri-apps/api/core'
import { homeDir } from '@tauri-apps/api/path'
import { useRepositoryStore } from '../../stores/repositoryStore'

// Response from the read_file Tauri command
interface FileContent {
  path: string
  content: string
  language: string
  size: number
}

type TabType = 'files' | 'skills' | 'agents'

interface FileEntry {
  name: string
  path: string
  is_directory: boolean
  children?: FileEntry[]
}

// Structure for installed_plugins.json
interface InstalledPlugin {
  scope: string
  installPath: string
  version: string
  installedAt: string
  lastUpdated: string
  gitCommitSha?: string
}

interface InstalledPluginsFile {
  version: number
  plugins: Record<string, InstalledPlugin[]>
}

interface MentionItem {
  id: string
  name: string
  description?: string
  icon?: string
  type: TabType
  path?: string
  isDirectory?: boolean
}

interface MentionPopoverProps {
  isOpen: boolean
  searchQuery: string
  onSelect: (item: MentionItem) => void
  onClose: () => void
  position?: { top: number; left: number }
}

// Compact file icon (12x12)
function FileIcon({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

// Compact folder icon (12x12)
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  )
}

// Compact skill icon (12x12)
function SkillIcon({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  )
}

// Compact agent icon (12x12)
function AgentIcon({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect width="18" height="10" x="3" y="11" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
    </svg>
  )
}

// Compact pill tab component
function TabPill({
  label,
  isActive,
  onClick,
}: {
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors',
        isActive
          ? 'bg-white/15 text-white'
          : 'text-white/40 hover:text-white/60 hover:bg-white/5'
      )}
    >
      {label}
    </button>
  )
}

// Compact list item - single line
function ListItem({
  item,
  isSelected,
  onClick,
}: {
  item: MentionItem
  isSelected: boolean
  onClick: () => void
}) {
  const getIcon = () => {
    switch (item.type) {
      case 'files':
        return item.isDirectory ? <FolderIcon className="text-yellow-400/70" /> : <FileIcon className="text-blue-400/70" />
      case 'skills':
        return <SkillIcon className="text-purple-400/70" />
      case 'agents':
        return <AgentIcon className="text-green-400/70" />
    }
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-1.5 px-2 py-1 text-left transition-colors',
        isSelected ? 'bg-blue-500/20 text-white' : 'text-white/80 hover:bg-white/5'
      )}
    >
      <span className="shrink-0">{getIcon()}</span>
      <span className="text-xs truncate flex-1">{item.name}</span>
      {item.description && (
        <span className="text-[10px] text-white/30 truncate max-w-[120px]">{item.description}</span>
      )}
    </button>
  )
}

export function MentionPopover({
  isOpen,
  searchQuery,
  onSelect,
  onClose,
}: MentionPopoverProps) {
  const [activeTab, setActiveTab] = useState<TabType>('files')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [files, setFiles] = useState<MentionItem[]>([])
  const [skills, setSkills] = useState<MentionItem[]>([])
  const [agents, setAgents] = useState<MentionItem[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const { currentWorkspace } = useRepositoryStore()

  // Load subagents from ~/.claude/agents/ (global) and .claude/agents/ (project)
  const loadAgents = useCallback(async () => {
    const agentItems: MentionItem[] = []

    try {
      // Get home directory for global agents
      const home = await homeDir()
      console.log('[MentionPopover] Home directory for agents:', home)

      if (!home) {
        console.error('[MentionPopover] homeDir() returned null/undefined')
        setAgents([])
        return
      }

      // Ensure path has trailing slash
      const homePath = home.endsWith('/') ? home : `${home}/`
      const globalAgentsPath = `${homePath}.claude/agents`
      console.log('[MentionPopover] Global agents path:', globalAgentsPath)

      // Try to load global agents
      try {
        const globalFiles = await invoke<FileEntry[]>('list_directory_files', {
          dirPath: globalAgentsPath,
          maxDepth: 1,
          showHidden: false,
        })

        for (const file of globalFiles) {
          if (file.name.endsWith('.md') && !file.is_directory) {
            const agentName = file.name.replace('.md', '')
            agentItems.push({
              id: `global-${agentName}`,
              name: agentName,
              description: 'Global',
              type: 'agents' as const,
            })
          }
        }
      } catch {
        // Global agents directory may not exist
      }

      // Try to load project-level agents
      if (currentWorkspace?.localPath) {
        const projectAgentsPath = `${currentWorkspace.localPath}/.claude/agents`
        try {
          const projectFiles = await invoke<FileEntry[]>('list_directory_files', {
            dirPath: projectAgentsPath,
            maxDepth: 1,
            showHidden: false,
          })

          for (const file of projectFiles) {
            if (file.name.endsWith('.md') && !file.is_directory) {
              const agentName = file.name.replace('.md', '')
              // Check if this agent already exists (project overrides global)
              const existingIndex = agentItems.findIndex(a => a.name === agentName)
              if (existingIndex >= 0) {
                // Replace global with project-level
                agentItems[existingIndex] = {
                  id: `project-${agentName}`,
                  name: agentName,
                  description: 'Project',
                  type: 'agents' as const,
                }
              } else {
                agentItems.push({
                  id: `project-${agentName}`,
                  name: agentName,
                  description: 'Project',
                  type: 'agents' as const,
                })
              }
            }
          }
        } catch {
          // Project agents directory may not exist
        }
      }

      setAgents(agentItems)
    } catch (error) {
      console.error('Failed to load agents:', error)
      setAgents([])
    }
  }, [currentWorkspace?.localPath])

  // Flatten file tree to list
  const flattenFileTree = (entries: FileEntry[], basePath = ''): MentionItem[] => {
    const items: MentionItem[] = []
    for (const entry of entries) {
      const fullPath = basePath ? `${basePath}/${entry.name}` : entry.name
      items.push({
        id: entry.path,
        name: entry.name,
        description: fullPath,
        type: 'files' as const,
        path: entry.path,
        isDirectory: entry.is_directory,
      })
      if (entry.children && entry.children.length > 0) {
        items.push(...flattenFileTree(entry.children, fullPath))
      }
    }
    return items
  }

  // Load files from workspace
  const loadFiles = useCallback(async () => {
    if (!currentWorkspace?.localPath) {
      setFiles([])
      return
    }

    setIsLoadingFiles(true)
    try {
      const result = await invoke<FileEntry[]>('list_directory_files', {
        dirPath: currentWorkspace.localPath,
        maxDepth: 3,
        showHidden: false,
      })

      const fileItems = flattenFileTree(result)
      // Limit to 100 items for performance
      setFiles(fileItems.slice(0, 100))
    } catch (error) {
      console.error('Failed to load files:', error)
      setFiles([])
    } finally {
      setIsLoadingFiles(false)
    }
  }, [currentWorkspace?.localPath])

  // Load skills from ~/.claude/skills (global), .claude/skills (local), and installed plugins
  // Skills can be either directories containing SKILL.md or standalone .md files
  const loadSkills = useCallback(async () => {
    const skillItems: MentionItem[] = []

    try {
      // Get home directory for global skills
      const home = await homeDir()
      console.log('[MentionPopover] Home directory for skills:', home)

      if (!home) {
        console.error('[MentionPopover] homeDir() returned null/undefined for skills')
        setSkills([])
        return
      }

      // Ensure path has trailing slash
      const homePath = home.endsWith('/') ? home : `${home}/`
      const globalSkillsPath = `${homePath}.claude/skills`

      console.log('[MentionPopover] Loading skills from:', globalSkillsPath)

      // Try to load global skills
      try {
        const globalFiles = await invoke<FileEntry[]>('list_directory_files', {
          dirPath: globalSkillsPath,
          maxDepth: 1,
          showHidden: false,
        })

        console.log('[MentionPopover] Raw files from Tauri:', globalFiles)
        console.log('[MentionPopover] Number of files:', globalFiles.length)

        for (const file of globalFiles) {
          // Skills can be directories (containing SKILL.md) or .md files directly
          if (file.is_directory) {
            skillItems.push({
              id: `global-${file.name}`,
              name: `/${file.name}`,
              description: 'Global',
              type: 'skills' as const,
            })
          } else if (file.name.endsWith('.md')) {
            const skillName = file.name.replace('.md', '')
            skillItems.push({
              id: `global-${skillName}`,
              name: `/${skillName}`,
              description: 'Global',
              type: 'skills' as const,
            })
          }
        }
        console.log('[MentionPopover] Skill items after global:', skillItems.length)
      } catch (err) {
        console.error('[MentionPopover] Error loading global skills:', err)
        // Global skills directory may not exist
      }

      // Try to load skills from installed plugins
      try {
        const pluginsJsonPath = `${homePath}.claude/plugins/installed_plugins.json`
        console.log('[MentionPopover] Checking for plugins at:', pluginsJsonPath)

        // Use the read_file Tauri command instead of FS plugin (avoids scope issues)
        const fileResult = await invoke<FileContent>('read_file', { filePath: pluginsJsonPath })
        console.log('[MentionPopover] Plugins JSON loaded, length:', fileResult.content.length)

        const pluginsData: InstalledPluginsFile = JSON.parse(fileResult.content)
        const pluginKeys = Object.keys(pluginsData.plugins)
        console.log('[MentionPopover] Found installed plugins:', pluginKeys.length, pluginKeys.slice(0, 5))

        // Iterate through all installed plugins
        for (const [pluginKey, installations] of Object.entries(pluginsData.plugins)) {
          // Get the first (usually only) installation
          const installation = installations[0]
          if (!installation?.installPath) {
            console.log('[MentionPopover] Skipping plugin without installPath:', pluginKey)
            continue
          }

          // Check for skills directory in the plugin
          const pluginSkillsPath = `${installation.installPath}/skills`
          console.log('[MentionPopover] Checking plugin skills at:', pluginSkillsPath)

          try {
            const skillDirs = await invoke<FileEntry[]>('list_directory_files', {
              dirPath: pluginSkillsPath,
              maxDepth: 1,
              showHidden: false,
            })

            console.log('[MentionPopover] Found skills in plugin', pluginKey, ':', skillDirs.length)

            // Extract plugin name from the key (format: "plugin-name@marketplace")
            const pluginName = pluginKey.split('@')[0]

            for (const skillDir of skillDirs) {
              if (skillDir.is_directory) {
                // Use format: plugin-name:skill-name for namespaced skills
                const fullSkillName = `${pluginName}:${skillDir.name}`
                // Avoid duplicates
                if (!skillItems.find(s => s.name === `/${fullSkillName}`)) {
                  skillItems.push({
                    id: `plugin-${pluginName}-${skillDir.name}`,
                    name: `/${fullSkillName}`,
                    description: 'Plugin',
                    type: 'skills' as const,
                  })
                }
              }
            }
          } catch (pluginErr) {
            // Plugin may not have a skills directory - this is normal
            console.log('[MentionPopover] No skills dir for:', pluginKey)
          }
        }
        console.log('[MentionPopover] Skill items after plugins:', skillItems.length)
      } catch (err) {
        console.error('[MentionPopover] Error loading plugin skills:', err)
        // Plugins file may not exist or couldn't be read
      }

      // Try to load project-level skills
      if (currentWorkspace?.localPath) {
        const projectSkillsPath = `${currentWorkspace.localPath}/.claude/skills`
        try {
          const projectFiles = await invoke<FileEntry[]>('list_directory_files', {
            dirPath: projectSkillsPath,
            maxDepth: 1,
            showHidden: false,
          })

          for (const file of projectFiles) {
            const skillName = file.is_directory ? file.name : file.name.replace('.md', '')
            if (!file.is_directory && !file.name.endsWith('.md')) continue

            // Check if this skill already exists (project overrides global)
            const existingIndex = skillItems.findIndex(s => s.name === `/${skillName}`)
            if (existingIndex >= 0) {
              // Replace global with project-level
              skillItems[existingIndex] = {
                id: `project-${skillName}`,
                name: `/${skillName}`,
                description: 'Project',
                type: 'skills' as const,
              }
            } else {
              skillItems.push({
                id: `project-${skillName}`,
                name: `/${skillName}`,
                description: 'Project',
                type: 'skills' as const,
              })
            }
          }
        } catch {
          // Project skills directory may not exist
        }
      }

      console.log('[MentionPopover] Final skills to set:', skillItems.length, skillItems.map(s => s.name))
      setSkills(skillItems)
    } catch (error) {
      console.error('Failed to load skills:', error)
      setSkills([])
    }
  }, [currentWorkspace?.localPath])

  // Load data when popover opens
  useEffect(() => {
    if (isOpen) {
      loadFiles()
      loadSkills()
      loadAgents()
    }
  }, [isOpen, loadFiles, loadSkills, loadAgents])

  // Filter items based on search query
  const getFilteredItems = (): MentionItem[] => {
    const query = searchQuery.toLowerCase()
    let items: MentionItem[] = []

    switch (activeTab) {
      case 'files':
        items = files
        break
      case 'skills':
        items = skills
        break
      case 'agents':
        items = agents
        break
    }

    if (!query) return items

    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
    )
  }

  const filteredItems = getFilteredItems()

  // Reset selection when tab or query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [activeTab, searchQuery])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Tab':
          e.preventDefault()
          const tabs: TabType[] = ['files', 'skills', 'agents']
          const currentIndex = tabs.indexOf(activeTab)
          const nextIndex = e.shiftKey
            ? (currentIndex - 1 + tabs.length) % tabs.length
            : (currentIndex + 1) % tabs.length
          setActiveTab(tabs[nextIndex])
          break
        case 'Enter':
          e.preventDefault()
          if (filteredItems[selectedIndex]) {
            onSelect(filteredItems[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredItems, selectedIndex, activeTab, onSelect, onClose])

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.1 }}
          className={cn(
            'absolute bottom-full left-0 right-0 mb-1 z-50',
            'bg-neutral-900/95 backdrop-blur-sm border border-white/10 rounded-lg shadow-xl',
            'overflow-hidden'
          )}
        >
          {/* Compact pill tabs */}
          <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-white/5">
            <TabPill
              label="Files"
              isActive={activeTab === 'files'}
              onClick={() => setActiveTab('files')}
            />
            <TabPill
              label="Skills"
              isActive={activeTab === 'skills'}
              onClick={() => setActiveTab('skills')}
            />
            <TabPill
              label="Agents"
              isActive={activeTab === 'agents'}
              onClick={() => setActiveTab('agents')}
            />
            <span className="ml-auto text-[9px] text-white/20">Tab to switch</span>
          </div>

          {/* Compact items list */}
          <div className="max-h-[200px] overflow-y-auto">
            {isLoadingFiles && activeTab === 'files' ? (
              <div className="flex items-center justify-center py-3 text-white/40 text-xs">
                Loading...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex items-center justify-center py-3 text-white/40 text-xs">
                {searchQuery ? `No matches` : `Empty`}
              </div>
            ) : (
              <div>
                {filteredItems.slice(0, 8).map((item, index) => (
                  <ListItem
                    key={item.id}
                    item={item}
                    isSelected={index === selectedIndex}
                    onClick={() => onSelect(item)}
                  />
                ))}
                {filteredItems.length > 8 && (
                  <div className="px-2 py-1 text-[10px] text-white/30 text-center">
                    +{filteredItems.length - 8} more
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export type { MentionItem }
