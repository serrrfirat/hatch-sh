import { useState, useEffect, useCallback, useRef } from 'react'
import { listDirectoryFiles, type FileEntry } from '../lib/git/bridge'

interface UseFileTreeReturn {
  tree: FileEntry[]
  isLoading: boolean
  error: string | null
  expandedPaths: Set<string>
  selectedPath: string | null
  toggleExpanded: (path: string) => void
  selectFile: (path: string) => void
  refresh: () => void
}

export function useFileTree(workspacePath: string | undefined): UseFileTreeReturn {
  const [tree, setTree] = useState<FileEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const currentPathRef = useRef(workspacePath)

  const fetchTree = useCallback(async (path: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const entries = await listDirectoryFiles(path, 10, false)
      // Only update if this is still the current workspace
      if (currentPathRef.current === path) {
        setTree(entries)
      }
    } catch (err) {
      if (currentPathRef.current === path) {
        setError(err instanceof Error ? err.message : 'Failed to load file tree')
        setTree([])
      }
    } finally {
      if (currentPathRef.current === path) {
        setIsLoading(false)
      }
    }
  }, [])

  // Fetch tree when workspace changes
  useEffect(() => {
    currentPathRef.current = workspacePath
    if (workspacePath) {
      // Reset state on workspace change
      setExpandedPaths(new Set())
      setSelectedPath(null)
      fetchTree(workspacePath)
    } else {
      setTree([])
      setIsLoading(false)
      setError(null)
      setExpandedPaths(new Set())
      setSelectedPath(null)
    }
  }, [workspacePath, fetchTree])

  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const selectFile = useCallback((path: string) => {
    setSelectedPath(path)
  }, [])

  const refresh = useCallback(() => {
    if (workspacePath) {
      fetchTree(workspacePath)
    }
  }, [workspacePath, fetchTree])

  return {
    tree,
    isLoading,
    error,
    expandedPaths,
    selectedPath,
    toggleExpanded,
    selectFile,
    refresh,
  }
}