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
import { formatPlanAsMarkdown } from '../lib/ideaMaze/planExporter'
import { UndoManager } from '../lib/ideaMaze/undoManager'
import type { Snapshot } from '../lib/ideaMaze/snapshots'
import { useRepositoryStore } from './repositoryStore'
import { useChatStore } from './chatStore'
import { useSettingsStore } from './settingsStore'
import type { PRDDocument } from '../lib/context/types'

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

interface HistorySnapshot {
  nodes: IdeaNode[]
  connections: IdeaConnection[]
}

const undoManager = new UndoManager<HistorySnapshot>({ maxEntries: 50 })

function moodboardToHistorySnapshot(moodboard: Moodboard): HistorySnapshot {
  return {
    nodes: moodboard.nodes,
    connections: moodboard.connections,
  }
}

function startTrackedChange(moodboard: Moodboard): void {
  undoManager.push(moodboardToHistorySnapshot(moodboard))
}

function finishTrackedChange(moodboard: Moodboard): Pick<IdeaMazeState, 'canUndo' | 'canRedo'> {
  undoManager.setCurrent(moodboardToHistorySnapshot(moodboard))
  return {
    canUndo: undoManager.canUndo,
    canRedo: undoManager.canRedo,
  }
}

function resetHistory(moodboard: Moodboard | null): Pick<IdeaMazeState, 'canUndo' | 'canRedo'> {
  undoManager.clear()
  if (moodboard) {
    undoManager.setCurrent(moodboardToHistorySnapshot(moodboard))
  }
  return {
    canUndo: false,
    canRedo: false,
  }
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

  // PRD state
  currentPRD: PRDDocument | null

  // Chat state (per moodboard)
  chatMessagesByMoodboard: Record<string, ChatMessage[]>

  // UI state
  isSidebarOpen: boolean
  isMinimapVisible: boolean
  canUndo: boolean
  canRedo: boolean
  // Save status
  saveStatus: 'saved' | 'saving' | 'unsaved'

  // Actions - Storage
  initializeStore: () => Promise<void>

  // Actions - Moodboard
  createNewMoodboard: (name: string, workspaceId?: string) => void
  loadMoodboard: (id: string) => void
  deleteMoodboard: (id: string) => void
  updateMoodboardName: (id: string, name: string) => void
  setCurrentMoodboard: (moodboard: Moodboard | null) => void
  restoreSnapshot: (snapshot: Snapshot) => void

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
  addConnection: (
    sourceId: string,
    targetId: string,
    relationship?: ConnectionRelationship
  ) => IdeaConnection | null
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
  setCurrentPRD: (prd: PRDDocument | null) => void

  // Actions - Chat
  addChatMessage: (moodboardId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => string
  updateChatMessage: (
    moodboardId: string,
    messageId: string,
    content: string,
    isStreaming: boolean
  ) => void

  // Actions - Build handoff
  buildFromPlan: (planNodeId: string) => Promise<void>

  // Actions - UI
  toggleSidebar: () => void
  toggleMinimap: () => void

  // Actions - History
  undo: () => void
  redo: () => void

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
        // Auto-saved moodboard
      } catch (error) {
        // Failed to auto-save
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
      // Flushing pending save
      await saveMoodboard(pendingMoodboard)
      pendingMoodboard = null
      // Flush save complete
    } catch (error) {
      // Flush save failed
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
    currentPRD: null,
    chatMessagesByMoodboard: {},
    isSidebarOpen: true,
    isMinimapVisible: false,
    canUndo: false,
    canRedo: false,
    saveStatus: 'saved' as const,

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

        const initialMoodboard = moodboards[0] || null
        set({
          moodboards,
          currentMoodboard: initialMoodboard,
          viewport: initialMoodboard?.viewport || { ...DEFAULT_VIEWPORT },
          isStorageInitialized: true,
          isLoading: false,
          ...resetHistory(initialMoodboard),
        })

        // Initialized with moodboards
      } catch (error) {
        // Initialization failed
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
        ...resetHistory(moodboard),
      }))
      // Save immediately for new moodboards
      saveMoodboard(moodboard).catch(() => {
        // Failed to save new moodboard
      })
    },

    loadMoodboard: (id) => {
      const moodboard = get().moodboards.find((m) => m.id === id)
      if (moodboard) {
        set({
          currentMoodboard: moodboard,
          viewport: moodboard.viewport,
          selection: { nodeIds: [], connectionIds: [] },
          aiSuggestions: [],
          ...resetHistory(moodboard),
        })
      }
    },

    deleteMoodboard: (id) => {
      set((state) => {
        const moodboards = state.moodboards.filter((m) => m.id !== id)
        const currentMoodboard = state.currentMoodboard?.id === id ? null : state.currentMoodboard
        return {
          moodboards,
          currentMoodboard,
          ...(state.currentMoodboard?.id === id ? resetHistory(null) : null),
        }
      })
      // Delete from file system
      deleteMoodboardFromStorage(id).catch(() => {
        // Failed to delete moodboard from storage
      })
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

    setCurrentMoodboard: (moodboard) =>
      set({
        currentMoodboard: moodboard,
        ...resetHistory(moodboard),
      }),

    restoreSnapshot: (snapshot) => {
      set((state) => {
        if (!state.currentMoodboard || state.currentMoodboard.id !== snapshot.moodboardId) {
          return state
        }

        startTrackedChange(state.currentMoodboard)
        const updatedMoodboard: Moodboard = {
          ...state.currentMoodboard,
          nodes: structuredClone(snapshot.nodes),
          connections: structuredClone(snapshot.connections),
          updatedAt: new Date(),
        }

        debouncedSave(updatedMoodboard)

        return {
          currentMoodboard: updatedMoodboard,
          moodboards: state.moodboards.map((m) =>
            m.id === updatedMoodboard.id ? updatedMoodboard : m
          ),
          selection: { nodeIds: [], connectionIds: [] },
          ...finishTrackedChange(updatedMoodboard),
        }
      })
    },

    // Node actions
    addNode: (position, content, title) => {
      const node = createNode(position, content, title)
      set((state) => {
        if (!state.currentMoodboard) return state
        startTrackedChange(state.currentMoodboard)
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
          ...finishTrackedChange(updatedMoodboard),
        }
      })
      return node
    },

    updateNode: (nodeId, updates) => {
      set((state) => {
        if (!state.currentMoodboard) return state
        const nodeExists = state.currentMoodboard.nodes.some((n) => n.id === nodeId)
        if (!nodeExists) return state
        startTrackedChange(state.currentMoodboard)
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
          ...finishTrackedChange(updatedMoodboard),
        }
      })
    },

    deleteNode: (nodeId) => {
      set((state) => {
        if (!state.currentMoodboard) return state
        const nodeExists = state.currentMoodboard.nodes.some((n) => n.id === nodeId)
        if (!nodeExists) return state
        startTrackedChange(state.currentMoodboard)
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
          ...finishTrackedChange(updatedMoodboard),
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
        const nodeExists = state.currentMoodboard.nodes.some((n) => n.id === nodeId)
        if (!nodeExists) return state
        startTrackedChange(state.currentMoodboard)
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
          ...finishTrackedChange(updatedMoodboard),
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
        startTrackedChange(state.currentMoodboard)
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
          ...finishTrackedChange(updatedMoodboard),
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
        const connectionExists = state.currentMoodboard.connections.some(
          (c) => c.id === connectionId
        )
        if (!connectionExists) return state
        startTrackedChange(state.currentMoodboard)
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
          ...finishTrackedChange(updatedMoodboard),
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
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity

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
      const zoom = Math.min(Math.min(canvasWidth / width, canvasHeight / height), MAX_ZOOM)

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

      set((state) => {
        if (!state.currentMoodboard) return state

        let updatedMoodboard = state.currentMoodboard
        if (suggestion.type === 'connection') {
          const exists = state.currentMoodboard.connections.some(
            (c) =>
              (c.sourceId === suggestion.data.sourceId &&
                c.targetId === suggestion.data.targetId) ||
              (c.sourceId === suggestion.data.targetId && c.targetId === suggestion.data.sourceId)
          )

          if (!exists && suggestion.data.sourceId !== suggestion.data.targetId) {
            const connection = createConnection(
              suggestion.data.sourceId,
              suggestion.data.targetId,
              suggestion.data.relationship
            )
            updatedMoodboard = {
              ...state.currentMoodboard,
              connections: [
                ...state.currentMoodboard.connections,
                {
                  ...connection,
                  aiSuggested: true,
                  confidence: suggestion.data.confidence,
                  reasoning: suggestion.data.reasoning,
                },
              ],
              updatedAt: new Date(),
            }
          }
        } else if (suggestion.type === 'node') {
          const maxZ = Math.max(0, ...state.currentMoodboard.nodes.map((n) => n.zIndex))
          const node = createNode(
            suggestion.data.position,
            [{ type: 'text', id: crypto.randomUUID(), text: suggestion.data.content }],
            suggestion.data.title
          )
          node.zIndex = maxZ + 1
          const aiNode: IdeaNode = { ...node, aiGenerated: true }

          let connections = state.currentMoodboard.connections
          if (suggestion.data.relatedToNodeId) {
            const connectionExists = connections.some(
              (c) =>
                (c.sourceId === suggestion.data.relatedToNodeId && c.targetId === aiNode.id) ||
                (c.sourceId === aiNode.id && c.targetId === suggestion.data.relatedToNodeId)
            )
            if (!connectionExists) {
              connections = [
                ...connections,
                createConnection(suggestion.data.relatedToNodeId, aiNode.id, 'extends'),
              ]
            }
          }

          updatedMoodboard = {
            ...state.currentMoodboard,
            nodes: [...state.currentMoodboard.nodes, aiNode],
            connections,
            updatedAt: new Date(),
          }
        } else if (suggestion.type === 'critique') {
          updatedMoodboard = {
            ...state.currentMoodboard,
            nodes: state.currentMoodboard.nodes.map((n) =>
              n.id === suggestion.data.nodeId
                ? {
                    ...n,
                    critiques: [
                      ...(n.critiques || []),
                      {
                        id: crypto.randomUUID(),
                        critique: suggestion.data.critique,
                        suggestions: suggestion.data.suggestions,
                        severity: suggestion.data.severity,
                        createdAt: new Date(),
                      },
                    ],
                    updatedAt: new Date(),
                  }
                : n
            ),
            updatedAt: new Date(),
          }
        }

        if (updatedMoodboard !== state.currentMoodboard) {
          debouncedSave(updatedMoodboard)
        }

        return {
          currentMoodboard: updatedMoodboard,
          moodboards: state.moodboards.map((m) =>
            m.id === updatedMoodboard.id ? updatedMoodboard : m
          ),
          aiSuggestions: state.aiSuggestions.filter((s) => {
            if (s.type === 'connection') return s.data.id !== suggestionId
            if (s.type === 'node') return s.data.id !== suggestionId
            if (s.type === 'critique') return s.data.id !== suggestionId
            return true
          }),
        }
      })
    },

    clearAISuggestions: () => set({ aiSuggestions: [] }),

    setAIProcessing: (processing) => set({ isAIProcessing: processing }),

    setCurrentPRD: (prd) => set({ currentPRD: prd }),

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
              msg.id === messageId ? { ...msg, content: msg.content + content, isStreaming } : msg
            ),
          },
        }
      })
    },

    // Build handoff action
    buildFromPlan: async (planNodeId: string) => {
      const moodboard = get().currentMoodboard
      if (!moodboard) throw new Error('No moodboard loaded')

      const node = moodboard.nodes.find((n) => n.id === planNodeId)
      if (!node) throw new Error('Node not found')

      const planContent = node.content.find((c) => c.type === 'plan')
      if (!planContent || planContent.type !== 'plan')
        throw new Error('Node does not contain a plan')

      // Get current repository
      const repoStore = useRepositoryStore.getState()
      const repo = repoStore.currentRepository
      if (!repo) throw new Error('No repository selected')

      // Create workspace
      const workspace = await repoStore.createWorkspace(repo.id)

      // Update workspace with plan reference
      const workspaces = useRepositoryStore
        .getState()
        .workspaces.map((w) =>
          w.id === workspace.id ? { ...w, sourcePlan: planContent, sourcePlanId: planNodeId } : w
        )
      const updatedWorkspace = workspaces.find((w) => w.id === workspace.id)!
      useRepositoryStore.setState({
        workspaces,
        currentWorkspace: updatedWorkspace,
      })

      // Format plan as markdown and seed chat
      const markdown = formatPlanAsMarkdown(planContent)
      useChatStore.getState().addMessage({
        role: 'user',
        content: `## Build from Plan\n\n${markdown}`,
      })

      // Switch to Build tab
      useSettingsStore.getState().setCurrentPage('byoa')
    },

    // UI actions
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

    toggleMinimap: () => set((state) => ({ isMinimapVisible: !state.isMinimapVisible })),

    undo: () => {
      set((state) => {
        if (!state.currentMoodboard) return state
        undoManager.setCurrent(moodboardToHistorySnapshot(state.currentMoodboard))
        const previous = undoManager.undo()
        if (!previous) {
          return {
            canUndo: undoManager.canUndo,
            canRedo: undoManager.canRedo,
          }
        }

        const updatedMoodboard: Moodboard = {
          ...state.currentMoodboard,
          nodes: previous.nodes,
          connections: previous.connections,
          updatedAt: new Date(),
        }

        debouncedSave(updatedMoodboard)

        return {
          currentMoodboard: updatedMoodboard,
          moodboards: state.moodboards.map((m) =>
            m.id === updatedMoodboard.id ? updatedMoodboard : m
          ),
          selection: { nodeIds: [], connectionIds: [] },
          canUndo: undoManager.canUndo,
          canRedo: undoManager.canRedo,
        }
      })
    },

    redo: () => {
      set((state) => {
        if (!state.currentMoodboard) return state
        undoManager.setCurrent(moodboardToHistorySnapshot(state.currentMoodboard))
        const next = undoManager.redo()
        if (!next) {
          return {
            canUndo: undoManager.canUndo,
            canRedo: undoManager.canRedo,
          }
        }

        const updatedMoodboard: Moodboard = {
          ...state.currentMoodboard,
          nodes: next.nodes,
          connections: next.connections,
          updatedAt: new Date(),
        }

        debouncedSave(updatedMoodboard)

        return {
          currentMoodboard: updatedMoodboard,
          moodboards: state.moodboards.map((m) =>
            m.id === updatedMoodboard.id ? updatedMoodboard : m
          ),
          selection: { nodeIds: [], connectionIds: [] },
          canUndo: undoManager.canUndo,
          canRedo: undoManager.canRedo,
        }
      })
    },

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
  const canUseLocalStorage =
    typeof localStorage !== 'undefined' &&
    typeof localStorage.getItem === 'function' &&
    typeof localStorage.setItem === 'function'

  // Load UI preferences from localStorage on init
  if (canUseLocalStorage) {
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
      // Failed to load UI preferences
    }
  }

  // Subscribe to UI preference changes and save to localStorage
  useIdeaMazeStore.subscribe(
    (state) => ({ isSidebarOpen: state.isSidebarOpen, isMinimapVisible: state.isMinimapVisible }),
    (prefs) => {
      if (canUseLocalStorage) {
        try {
          localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs))
        } catch (e) {
          // Failed to save UI preferences
        }
      }
    }
  )
}
