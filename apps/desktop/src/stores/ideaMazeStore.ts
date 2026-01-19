/* =============================================================================
 * IDEA MAZE STORE - File System Storage Implementation
 * =============================================================================
 *
 * CURRENT STATE: Data is stored using Tauri's file system API.
 * - Moodboards are saved as JSON files in: ~/.local/share/sh.hatch.desktop/idea-maze/moodboards/
 * - Images are stored separately in: ~/.local/share/sh.hatch.desktop/idea-maze/images/
 * - Auto-save with 1 second debounce prevents excessive writes
 * - UI preferences (sidebar/minimap) are stored in localStorage (lightweight)
 *
 * FEATURES IMPLEMENTED:
 * ✅ File system storage via Tauri FS plugin
 * ✅ Automatic migration from localStorage on first run
 * ✅ Image extraction and separate storage
 * ✅ Debounced auto-save (1 second)
 * ✅ Loading/error states in UI
 *
 * TODO - WORKSPACE INTEGRATION:
 * - The Moodboard type has a `workspaceId` field - implement filtering
 * - Consider storing workspace-specific moodboards in workspace directories
 * - Add workspace selector to sidebar
 *
 * TODO - ADDITIONAL FEATURES:
 * - Export/import moodboards (exportMoodboard/importMoodboard functions exist in storage.ts)
 * - Implement garbage collection for orphaned images
 * - Add version field for future migrations
 * - Sync across devices (cloud storage integration)
 *
 * ============================================================================= */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  type IdeaNode,
  type IdeaConnection,
  type Moodboard,
  type Viewport,
  type ToolMode,
  type SelectionState,
  type NodeContent,
  type AISuggestion,
  type ConnectionRelationship,
  type Position,
  type NodeCritique,
  createNode,
  createConnection,
  createMoodboard,
  DEFAULT_VIEWPORT,
  MIN_ZOOM,
  MAX_ZOOM,
} from '../lib/ideaMaze/types'
import {
  initializeStorage,
  saveMoodboard,
  loadAllMoodboards,
  deleteMoodboard as deleteMoodboardFromStorage,
  migrateFromLocalStorage,
} from '../lib/ideaMaze/storage'

// Debounce timer for auto-save
let saveTimeout: ReturnType<typeof setTimeout> | null = null
const SAVE_DEBOUNCE_MS = 1000

// Track pending save for flush on app close
let pendingMoodboard: Moodboard | null = null
let isSaving = false

// Chat message type
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  timestamp: Date
}

// Connection filter state
export interface ConnectionFilters {
  related: boolean
  'depends-on': boolean
  contradicts: boolean
  extends: boolean
  alternative: boolean
  showAISuggested: boolean
}

const DEFAULT_CONNECTION_FILTERS: ConnectionFilters = {
  related: true,
  'depends-on': true,
  contradicts: true,
  extends: true,
  alternative: true,
  showAISuggested: true,
}

interface IdeaMazeState {
  // Storage state
  isStorageInitialized: boolean
  isLoading: boolean
  storageError: string | null

  // Current moodboard
  currentMoodboard: Moodboard | null
  moodboards: Moodboard[]

  // Canvas state
  viewport: Viewport
  toolMode: ToolMode
  selection: SelectionState

  // Connection filter state
  connectionFilters: ConnectionFilters
  focusMode: boolean

  // AI state
  aiSuggestions: AISuggestion[]
  isAIProcessing: boolean

  // Chat state (per moodboard)
  chatMessagesByMoodboard: Record<string, ChatMessage[]>

  // UI state
  isSidebarOpen: boolean
  isMinimapVisible: boolean

  // Actions - Storage
  initializeStore: () => Promise<void>

  // Actions - Moodboard
  createNewMoodboard: (name: string, workspaceId?: string) => void
  loadMoodboard: (id: string) => void
  deleteMoodboard: (id: string) => void
  updateMoodboardName: (id: string, name: string) => void
  setCurrentMoodboard: (moodboard: Moodboard | null) => void

  // Actions - Nodes
  addNode: (position: Position, content?: NodeContent[], title?: string) => IdeaNode
  updateNode: (nodeId: string, updates: Partial<IdeaNode>) => void
  deleteNode: (nodeId: string) => void
  moveNode: (nodeId: string, position: Position) => void
  resizeNode: (nodeId: string, width: number, height: number) => void
  addContentToNode: (nodeId: string, content: NodeContent) => void
  removeContentFromNode: (nodeId: string, contentId: string) => void
  bringNodeToFront: (nodeId: string) => void

  // Actions - Node Critiques
  addCritiqueToNode: (nodeId: string, critique: Omit<NodeCritique, 'id' | 'createdAt'>) => void
  dismissCritique: (nodeId: string, critiqueId: string) => void
  undismissCritique: (nodeId: string, critiqueId: string) => void
  clearNodeCritiques: (nodeId: string) => void

  // Actions - Connections
  addConnection: (sourceId: string, targetId: string, relationship?: ConnectionRelationship) => IdeaConnection | null
  updateConnection: (connectionId: string, updates: Partial<IdeaConnection>) => void
  deleteConnection: (connectionId: string) => void

  // Actions - Viewport
  setViewport: (viewport: Viewport) => void
  pan: (deltaX: number, deltaY: number) => void
  zoom: (delta: number, center?: Position) => void
  zoomToFit: () => void
  resetViewport: () => void

  // Actions - Tools & Selection
  setToolMode: (mode: ToolMode) => void
  selectNode: (nodeId: string, addToSelection?: boolean) => void
  selectConnection: (connectionId: string, addToSelection?: boolean) => void
  selectAll: () => void
  clearSelection: () => void
  deleteSelection: () => void
  duplicateSelection: () => void

  // Actions - AI
  addAISuggestion: (suggestion: AISuggestion) => void
  removeAISuggestion: (suggestionId: string) => void
  acceptAISuggestion: (suggestionId: string) => void
  clearAISuggestions: () => void
  setAIProcessing: (processing: boolean) => void

  // Actions - Chat
  addChatMessage: (moodboardId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => string
  updateChatMessage: (moodboardId: string, messageId: string, content: string, isStreaming: boolean) => void

  // Actions - UI
  toggleSidebar: () => void
  toggleMinimap: () => void

  // Actions - Connection Filters
  setConnectionFilter: (key: keyof ConnectionFilters, value: boolean) => void
  toggleFocusMode: () => void
  resetConnectionFilters: () => void
}

// Helper function to trigger debounced save
function debouncedSave(moodboard: Moodboard | null) {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  if (moodboard) {
    pendingMoodboard = moodboard
    saveTimeout = setTimeout(async () => {
      try {
        isSaving = true
        await saveMoodboard(moodboard)
        pendingMoodboard = null
        console.log('[IdeaMaze Store] Auto-saved moodboard:', moodboard.id)
      } catch (error) {
        console.error('[IdeaMaze Store] Failed to auto-save:', error)
        // Keep pendingMoodboard so it can be retried
      } finally {
        isSaving = false
      }
    }, SAVE_DEBOUNCE_MS)
  }
}

// Force save any pending changes immediately (call on app close)
export async function flushPendingSave(): Promise<void> {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  if (pendingMoodboard && !isSaving) {
    try {
      isSaving = true
      console.log('[IdeaMaze Store] Flushing pending save:', pendingMoodboard.id)
      await saveMoodboard(pendingMoodboard)
      pendingMoodboard = null
      console.log('[IdeaMaze Store] Flush save complete')
    } catch (error) {
      console.error('[IdeaMaze Store] Flush save failed:', error)
    } finally {
      isSaving = false
    }
  }
}

// Check if there are unsaved changes
export function hasUnsavedChanges(): boolean {
  return pendingMoodboard !== null || saveTimeout !== null
}

export const useIdeaMazeStore = create<IdeaMazeState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isStorageInitialized: false,
    isLoading: true,
    storageError: null,
    currentMoodboard: null,
    moodboards: [],
    viewport: { ...DEFAULT_VIEWPORT },
    toolMode: 'select',
    selection: { nodeIds: [], connectionIds: [] },
    connectionFilters: { ...DEFAULT_CONNECTION_FILTERS },
    focusMode: false,
    aiSuggestions: [],
    isAIProcessing: false,
    chatMessagesByMoodboard: {},
    isSidebarOpen: true,
    isMinimapVisible: false,

    // Storage initialization
    initializeStore: async () => {
      if (get().isStorageInitialized) return

      try {
        set({ isLoading: true, storageError: null })

        // Initialize storage directories
        await initializeStorage()

        // Try to migrate from localStorage first
        const migratedMoodboards = await migrateFromLocalStorage()

        // Load all moodboards from file system
        let moodboards = await loadAllMoodboards()

        // If migration happened and we have new moodboards, merge them
        if (migratedMoodboards.length > 0) {
          const existingIds = new Set(moodboards.map((m) => m.id))
          const newMoodboards = migratedMoodboards.filter((m) => !existingIds.has(m.id))
          moodboards = [...moodboards, ...newMoodboards]
        }

        // Sort by updatedAt descending
        moodboards.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

        set({
          moodboards,
          currentMoodboard: moodboards[0] || null,
          viewport: moodboards[0]?.viewport || { ...DEFAULT_VIEWPORT },
          isStorageInitialized: true,
          isLoading: false,
        })

        console.log('[IdeaMaze Store] Initialized with', moodboards.length, 'moodboards')
      } catch (error) {
        console.error('[IdeaMaze Store] Initialization failed:', error)
        set({
          storageError: error instanceof Error ? error.message : 'Failed to initialize storage',
          isLoading: false,
          isStorageInitialized: true, // Mark as initialized to prevent retry loop
        })
      }
    },

    // Moodboard actions
    createNewMoodboard: (name, workspaceId) => {
      const moodboard = createMoodboard(name, workspaceId)
      set((state) => ({
        moodboards: [...state.moodboards, moodboard],
        currentMoodboard: moodboard,
        viewport: { ...DEFAULT_VIEWPORT },
        selection: { nodeIds: [], connectionIds: [] },
        aiSuggestions: [],
      }))
      // Save immediately for new moodboards
      saveMoodboard(moodboard).catch((err) =>
        console.error('[IdeaMaze Store] Failed to save new moodboard:', err)
      )
    },

    loadMoodboard: (id) => {
      const moodboard = get().moodboards.find((m) => m.id === id)
      if (moodboard) {
        set({
          currentMoodboard: moodboard,
          viewport: moodboard.viewport,
          selection: { nodeIds: [], connectionIds: [] },
          aiSuggestions: [],
        })
      }
    },

    deleteMoodboard: (id) => {
      set((state) => ({
        moodboards: state.moodboards.filter((m) => m.id !== id),
        currentMoodboard: state.currentMoodboard?.id === id ? null : state.currentMoodboard,
      }))
      // Delete from file system
      deleteMoodboardFromStorage(id).catch((err) =>
        console.error('[IdeaMaze Store] Failed to delete moodboard from storage:', err)
      )
    },

    updateMoodboardName: (id, name) => {
      set((state) => {
        const updatedMoodboard = state.moodboards.find((m) => m.id === id)
        if (!updatedMoodboard) return state

        const updated = { ...updatedMoodboard, name, updatedAt: new Date() }
        // Trigger debounced save
        debouncedSave(updated)
        return {
          moodboards: state.moodboards.map((m) => (m.id === id ? updated : m)),
          currentMoodboard: state.currentMoodboard?.id === id ? updated : state.currentMoodboard,
        }
      })
    },

    setCurrentMoodboard: (moodboard) => set({ currentMoodboard: moodboard }),

    // Node actions
    addNode: (position, content, title) => {
      const node = createNode(position, content, title)
      set((state) => {
        if (!state.currentMoodboard) return state
        const maxZ = Math.max(0, ...state.currentMoodboard.nodes.map((n) => n.zIndex))
        node.zIndex = maxZ + 1
        const updatedMoodboard = {
          ...state.currentMoodboard,
          nodes: [...state.currentMoodboard.nodes, node],
          updatedAt: new Date(),
        }
        // Trigger debounced save
        debouncedSave(updatedMoodboard)
        return {
          currentMoodboard: updatedMoodboard,
          moodboards: state.moodboards.map((m) =>
            m.id === updatedMoodboard.id ? updatedMoodboard : m
          ),
          selection: { nodeIds: [node.id], connectionIds: [] },
        }
      })
      return node
    },

    updateNode: (nodeId, updates) => {
      set((state) => {
        if (!state.currentMoodboard) return state
        const updatedMoodboard = {
          ...state.currentMoodboard,
          nodes: state.currentMoodboard.nodes.map((n) =>
            n.id === nodeId ? { ...n, ...updates, updatedAt: new Date() } : n
          ),
          updatedAt: new Date(),
        }
        // Trigger debounced save
        debouncedSave(updatedMoodboard)
        return {
          currentMoodboard: updatedMoodboard,
          moodboards: state.moodboards.map((m) =>
            m.id === updatedMoodboard.id ? updatedMoodboard : m
          ),
        }
        })
      },

    deleteNode: (nodeId) => {
      set((state) => {
        if (!state.currentMoodboard) return state
        const updatedMoodboard = {
          ...state.currentMoodboard,
          nodes: state.currentMoodboard.nodes.filter((n) => n.id !== nodeId),
          connections: state.currentMoodboard.connections.filter(
            (c) => c.sourceId !== nodeId && c.targetId !== nodeId
          ),
          updatedAt: new Date(),
        }
        // Trigger debounced save
        debouncedSave(updatedMoodboard)
        return {
          currentMoodboard: updatedMoodboard,
          moodboards: state.moodboards.map((m) =>
            m.id === updatedMoodboard.id ? updatedMoodboard : m
          ),
          selection: {
            nodeIds: state.selection.nodeIds.filter((id) => id !== nodeId),
            connectionIds: state.selection.connectionIds,
          },
        }
      })
    },

    moveNode: (nodeId, position) => {
      get().updateNode(nodeId, { position })
    },

    resizeNode: (nodeId, width, height) => {
      get().updateNode(nodeId, { dimensions: { width, height } })
    },

    addContentToNode: (nodeId, content) => {
      const node = get().currentMoodboard?.nodes.find((n) => n.id === nodeId)
      if (node) {
        get().updateNode(nodeId, { content: [...node.content, content] })
      }
    },

    removeContentFromNode: (nodeId, contentId) => {
      const node = get().currentMoodboard?.nodes.find((n) => n.id === nodeId)
      if (node) {
        get().updateNode(nodeId, {
          content: node.content.filter((c) => c.id !== contentId),
        })
      }
    },

    bringNodeToFront: (nodeId) => {
      set((state) => {
        if (!state.currentMoodboard) return state
        const maxZ = Math.max(0, ...state.currentMoodboard.nodes.map((n) => n.zIndex))
        const updatedMoodboard = {
          ...state.currentMoodboard,
          nodes: state.currentMoodboard.nodes.map((n) =>
            n.id === nodeId ? { ...n, zIndex: maxZ + 1 } : n
          ),
          updatedAt: new Date(),
        }
        // Trigger debounced save
        debouncedSave(updatedMoodboard)
        return {
          currentMoodboard: updatedMoodboard,
          moodboards: state.moodboards.map((m) =>
            m.id === updatedMoodboard.id ? updatedMoodboard : m
          ),
        }
      })
    },

    // Node critique actions
    addCritiqueToNode: (nodeId, critique) => {
      set((state) => {
        if (!state.currentMoodboard) return state
        const node = state.currentMoodboard.nodes.find((n) => n.id === nodeId)
        if (!node) return state

        const newCritique: NodeCritique = {
          ...critique,
          id: crypto.randomUUID(),
          createdAt: new Date(),
        }

        const updatedMoodboard = {
          ...state.currentMoodboard,
          nodes: state.currentMoodboard.nodes.map((n) =>
            n.id === nodeId
              ? { ...n, critiques: [...(n.critiques || []), newCritique], updatedAt: new Date() }
              : n
          ),
          updatedAt: new Date(),
        }
        debouncedSave(updatedMoodboard)
        return {
          currentMoodboard: updatedMoodboard,
          moodboards: state.moodboards.map((m) =>
            m.id === updatedMoodboard.id ? updatedMoodboard : m
          ),
        }
      })
    },

    dismissCritique: (nodeId, critiqueId) => {
      set((state) => {
        if (!state.currentMoodboard) return state
        const updatedMoodboard = {
          ...state.currentMoodboard,
          nodes: state.currentMoodboard.nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  critiques: (n.critiques || []).map((c) =>
                    c.id === critiqueId ? { ...c, dismissed: true } : c
                  ),
                  updatedAt: new Date(),
                }
              : n
          ),
          updatedAt: new Date(),
        }
        debouncedSave(updatedMoodboard)
        return {
          currentMoodboard: updatedMoodboard,
          moodboards: state.moodboards.map((m) =>
            m.id === updatedMoodboard.id ? updatedMoodboard : m
          ),
        }
      })
    },

    undismissCritique: (nodeId, critiqueId) => {
      set((state) => {
        if (!state.currentMoodboard) return state
        const updatedMoodboard = {
          ...state.currentMoodboard,
          nodes: state.currentMoodboard.nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  critiques: (n.critiques || []).map((c) =>
                    c.id === critiqueId ? { ...c, dismissed: false } : c
                  ),
                  updatedAt: new Date(),
                }
              : n
          ),
          updatedAt: new Date(),
        }
        debouncedSave(updatedMoodboard)
        return {
          currentMoodboard: updatedMoodboard,
          moodboards: state.moodboards.map((m) =>
            m.id === updatedMoodboard.id ? updatedMoodboard : m
          ),
        }
      })
    },

    clearNodeCritiques: (nodeId) => {
      set((state) => {
        if (!state.currentMoodboard) return state
        const updatedMoodboard = {
          ...state.currentMoodboard,
          nodes: state.currentMoodboard.nodes.map((n) =>
            n.id === nodeId ? { ...n, critiques: [], updatedAt: new Date() } : n
          ),
          updatedAt: new Date(),
        }
        debouncedSave(updatedMoodboard)
        return {
          currentMoodboard: updatedMoodboard,
          moodboards: state.moodboards.map((m) =>
            m.id === updatedMoodboard.id ? updatedMoodboard : m
          ),
        }
      })
    },

    // Connection actions
    addConnection: (sourceId, targetId, relationship = 'related') => {
      const state = get()
      if (!state.currentMoodboard) return null

      // Don't allow self-connections or duplicates
      const exists = state.currentMoodboard.connections.some(
        (c) =>
          (c.sourceId === sourceId && c.targetId === targetId) ||
          (c.sourceId === targetId && c.targetId === sourceId)
      )
      if (sourceId === targetId || exists) return null

      const connection = createConnection(sourceId, targetId, relationship)
      set((state) => {
        if (!state.currentMoodboard) return state
        const updatedMoodboard = {
          ...state.currentMoodboard,
          connections: [...state.currentMoodboard.connections, connection],
          updatedAt: new Date(),
        }
        // Trigger debounced save
        debouncedSave(updatedMoodboard)
        return {
          currentMoodboard: updatedMoodboard,
          moodboards: state.moodboards.map((m) =>
            m.id === updatedMoodboard.id ? updatedMoodboard : m
          ),
        }
      })
        return connection
      },

    updateConnection: (connectionId, updates) => {
      set((state) => {
        if (!state.currentMoodboard) return state
        const updatedMoodboard = {
          ...state.currentMoodboard,
          connections: state.currentMoodboard.connections.map((c) =>
            c.id === connectionId ? { ...c, ...updates } : c
          ),
          updatedAt: new Date(),
        }
        // Trigger debounced save
        debouncedSave(updatedMoodboard)
        return {
          currentMoodboard: updatedMoodboard,
          moodboards: state.moodboards.map((m) =>
            m.id === updatedMoodboard.id ? updatedMoodboard : m
          ),
        }
      })
    },

    deleteConnection: (connectionId) => {
      set((state) => {
        if (!state.currentMoodboard) return state
        const updatedMoodboard = {
          ...state.currentMoodboard,
          connections: state.currentMoodboard.connections.filter((c) => c.id !== connectionId),
          updatedAt: new Date(),
        }
        // Trigger debounced save
        debouncedSave(updatedMoodboard)
        return {
          currentMoodboard: updatedMoodboard,
          moodboards: state.moodboards.map((m) =>
            m.id === updatedMoodboard.id ? updatedMoodboard : m
          ),
          selection: {
            nodeIds: state.selection.nodeIds,
            connectionIds: state.selection.connectionIds.filter((id) => id !== connectionId),
          },
        }
      })
    },

    // Viewport actions
    setViewport: (viewport) => {
      set((state) => {
        if (state.currentMoodboard) {
          const updatedMoodboard = { ...state.currentMoodboard, viewport }
          // Trigger debounced save (viewport changes are frequent, so debounce is important)
          debouncedSave(updatedMoodboard)
          return {
            viewport,
            currentMoodboard: updatedMoodboard,
            moodboards: state.moodboards.map((m) =>
              m.id === updatedMoodboard.id ? updatedMoodboard : m
            ),
          }
        }
        return { viewport }
      })
    },

      pan: (deltaX, deltaY) => {
        const { viewport } = get()
        get().setViewport({
          ...viewport,
          x: viewport.x + deltaX,
          y: viewport.y + deltaY,
        })
      },

      zoom: (delta, center) => {
        const { viewport } = get()
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom + delta))

        if (center) {
          // Zoom towards the center point
          const zoomRatio = newZoom / viewport.zoom
          get().setViewport({
            x: center.x - (center.x - viewport.x) * zoomRatio,
            y: center.y - (center.y - viewport.y) * zoomRatio,
            zoom: newZoom,
          })
        } else {
          get().setViewport({ ...viewport, zoom: newZoom })
        }
      },

      zoomToFit: () => {
        const moodboard = get().currentMoodboard
        if (!moodboard || moodboard.nodes.length === 0) {
          get().resetViewport()
          return
        }

        // Calculate bounding box of all nodes
        const padding = 50
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

        for (const node of moodboard.nodes) {
          minX = Math.min(minX, node.position.x)
          minY = Math.min(minY, node.position.y)
          maxX = Math.max(maxX, node.position.x + node.dimensions.width)
          maxY = Math.max(maxY, node.position.y + node.dimensions.height)
        }

        const width = maxX - minX + padding * 2
        const height = maxY - minY + padding * 2

        // Assume canvas is roughly 1200x800 (will be updated in component)
        const canvasWidth = 1200
        const canvasHeight = 800
        const zoom = Math.min(
          Math.min(canvasWidth / width, canvasHeight / height),
          MAX_ZOOM
        )

        const centerX = (minX + maxX) / 2
        const centerY = (minY + maxY) / 2

        get().setViewport({
          x: canvasWidth / 2 - centerX * zoom,
          y: canvasHeight / 2 - centerY * zoom,
          zoom: Math.max(MIN_ZOOM, zoom),
        })
      },

      resetViewport: () => {
        get().setViewport({ ...DEFAULT_VIEWPORT })
      },

      // Tool & Selection actions
      setToolMode: (mode) => set({ toolMode: mode }),

      selectNode: (nodeId, addToSelection = false) => {
        set((state) => ({
          selection: {
            nodeIds: addToSelection
              ? state.selection.nodeIds.includes(nodeId)
                ? state.selection.nodeIds.filter((id) => id !== nodeId)
                : [...state.selection.nodeIds, nodeId]
              : [nodeId],
            connectionIds: addToSelection ? state.selection.connectionIds : [],
          },
        }))
      },

      selectConnection: (connectionId, addToSelection = false) => {
        set((state) => ({
          selection: {
            nodeIds: addToSelection ? state.selection.nodeIds : [],
            connectionIds: addToSelection
              ? state.selection.connectionIds.includes(connectionId)
                ? state.selection.connectionIds.filter((id) => id !== connectionId)
                : [...state.selection.connectionIds, connectionId]
              : [connectionId],
          },
        }))
      },

      selectAll: () => {
        const moodboard = get().currentMoodboard
        if (!moodboard) return
        set({
          selection: {
            nodeIds: moodboard.nodes.map((n) => n.id),
            connectionIds: moodboard.connections.map((c) => c.id),
          },
        })
      },

      clearSelection: () => {
        set({ selection: { nodeIds: [], connectionIds: [] } })
      },

      deleteSelection: () => {
        const { selection, deleteNode, deleteConnection } = get()
        selection.connectionIds.forEach((id) => deleteConnection(id))
        selection.nodeIds.forEach((id) => deleteNode(id))
      },

      duplicateSelection: () => {
        const state = get()
        if (!state.currentMoodboard) return

        const offset = 30
        const nodeIdMap = new Map<string, string>()
        const newNodeIds: string[] = []

        // Duplicate nodes
        for (const nodeId of state.selection.nodeIds) {
          const node = state.currentMoodboard.nodes.find((n) => n.id === nodeId)
          if (node) {
            const newNode = get().addNode(
              { x: node.position.x + offset, y: node.position.y + offset },
              [...node.content],
              node.title
            )
            nodeIdMap.set(node.id, newNode.id)
            newNodeIds.push(newNode.id)
          }
        }

        // Duplicate connections between selected nodes
        for (const conn of state.currentMoodboard.connections) {
          const newSourceId = nodeIdMap.get(conn.sourceId)
          const newTargetId = nodeIdMap.get(conn.targetId)
          if (newSourceId && newTargetId) {
            get().addConnection(newSourceId, newTargetId, conn.relationship)
          }
        }

        // Select the duplicated nodes
        set({ selection: { nodeIds: newNodeIds, connectionIds: [] } })
      },

      // AI actions
      addAISuggestion: (suggestion) => {
        set((state) => ({
          aiSuggestions: [...state.aiSuggestions, suggestion],
        }))
      },

      removeAISuggestion: (suggestionId) => {
        set((state) => ({
          aiSuggestions: state.aiSuggestions.filter((s) => {
            if (s.type === 'connection') return s.data.id !== suggestionId
            if (s.type === 'node') return s.data.id !== suggestionId
            if (s.type === 'critique') return s.data.id !== suggestionId
            return true
          }),
        }))
      },

      acceptAISuggestion: (suggestionId) => {
        const suggestion = get().aiSuggestions.find((s) => {
          if (s.type === 'connection') return s.data.id === suggestionId
          if (s.type === 'node') return s.data.id === suggestionId
          if (s.type === 'critique') return s.data.id === suggestionId
          return false
        })

        if (!suggestion) return

        if (suggestion.type === 'connection') {
          const conn = get().addConnection(
            suggestion.data.sourceId,
            suggestion.data.targetId,
            suggestion.data.relationship
          )
          if (conn) {
            get().updateConnection(conn.id, {
              aiSuggested: true,
              confidence: suggestion.data.confidence,
              reasoning: suggestion.data.reasoning,
            })
          }
        } else if (suggestion.type === 'node') {
          const node = get().addNode(
            suggestion.data.position,
            [{ type: 'text', id: crypto.randomUUID(), text: suggestion.data.content }],
            suggestion.data.title
          )
          get().updateNode(node.id, { aiGenerated: true })

          // If related to another node, create connection
          if (suggestion.data.relatedToNodeId) {
            get().addConnection(suggestion.data.relatedToNodeId, node.id, 'extends')
          }
        } else if (suggestion.type === 'critique') {
          // Add critique to the target node
          get().addCritiqueToNode(suggestion.data.nodeId, {
            critique: suggestion.data.critique,
            suggestions: suggestion.data.suggestions,
            severity: suggestion.data.severity,
          })
        }

        get().removeAISuggestion(suggestionId)
      },

    clearAISuggestions: () => set({ aiSuggestions: [] }),

    setAIProcessing: (processing) => set({ isAIProcessing: processing }),

    // Chat actions
    addChatMessage: (moodboardId, message) => {
      const id = crypto.randomUUID()
      const fullMessage: ChatMessage = {
        ...message,
        id,
        timestamp: new Date(),
      }
      set((state) => ({
        chatMessagesByMoodboard: {
          ...state.chatMessagesByMoodboard,
          [moodboardId]: [...(state.chatMessagesByMoodboard[moodboardId] || []), fullMessage],
        },
      }))
      return id
    },

    updateChatMessage: (moodboardId, messageId, content, isStreaming) => {
      set((state) => {
        const messages = state.chatMessagesByMoodboard[moodboardId] || []
        return {
          chatMessagesByMoodboard: {
            ...state.chatMessagesByMoodboard,
            [moodboardId]: messages.map((msg) =>
              msg.id === messageId
                ? { ...msg, content: msg.content + content, isStreaming }
                : msg
            ),
          },
        }
      })
    },

    // UI actions
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

    toggleMinimap: () => set((state) => ({ isMinimapVisible: !state.isMinimapVisible })),

    // Connection filter actions
    setConnectionFilter: (key, value) => {
      set((state) => ({
        connectionFilters: {
          ...state.connectionFilters,
          [key]: value,
        },
      }))
    },

    toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),

    resetConnectionFilters: () =>
      set({
        connectionFilters: { ...DEFAULT_CONNECTION_FILTERS },
        focusMode: false,
      }),
  }))
)

// Initialize store subscription to auto-save UI preferences to localStorage
// (lightweight settings that don't need file system storage)
if (typeof window !== 'undefined') {
  const UI_PREFS_KEY = 'hatch-idea-maze-ui-prefs'

  // Load UI preferences from localStorage on init
  try {
    const stored = localStorage.getItem(UI_PREFS_KEY)
    if (stored) {
      const prefs = JSON.parse(stored)
      useIdeaMazeStore.setState({
        isSidebarOpen: prefs.isSidebarOpen ?? true,
        isMinimapVisible: prefs.isMinimapVisible ?? false,
      })
    }
  } catch (e) {
    console.warn('[IdeaMaze Store] Failed to load UI preferences:', e)
  }

  // Subscribe to UI preference changes and save to localStorage
  useIdeaMazeStore.subscribe(
    (state) => ({ isSidebarOpen: state.isSidebarOpen, isMinimapVisible: state.isMinimapVisible }),
    (prefs) => {
      try {
        localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs))
      } catch (e) {
        console.warn('[IdeaMaze Store] Failed to save UI preferences:', e)
      }
    }
  )
}
