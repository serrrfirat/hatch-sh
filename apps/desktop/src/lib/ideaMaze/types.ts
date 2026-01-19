// Idea Maze Type Definitions

/** Content types for idea nodes */
export interface TextContent {
  type: 'text'
  id: string
  text: string
  format?: 'plain' | 'markdown'
}

export interface ImageContent {
  type: 'image'
  id: string
  url: string
  alt?: string
  width?: number
  height?: number
}

export interface UrlContent {
  type: 'url'
  id: string
  url: string
  title?: string
  description?: string
  image?: string
  favicon?: string
}

/** Plan content - structured PRD generated from interview */
export interface PlanContent {
  type: 'plan'
  id: string
  summary: string
  requirements: string[]
  designNotes?: string
  technicalApproach?: string
  sourceIdeaIds: string[]  // IDs of the ideas this plan was created from
}

export type NodeContent = TextContent | ImageContent | UrlContent | PlanContent

/** Position and dimensions for nodes */
export interface Position {
  x: number
  y: number
}

export interface Dimensions {
  width: number
  height: number
}

/** Idea node - the main content container */
export interface IdeaNode {
  id: string
  position: Position
  dimensions: Dimensions
  content: NodeContent[]
  title?: string
  tags: string[]
  aiGenerated?: boolean
  zIndex: number
  critiques?: NodeCritique[]
  createdAt: Date
  updatedAt: Date
}

/** Connection relationship types */
export type ConnectionRelationship =
  | 'related'
  | 'depends-on'
  | 'contradicts'
  | 'extends'
  | 'alternative'

/** Connection between idea nodes */
export interface IdeaConnection {
  id: string
  sourceId: string
  targetId: string
  type: 'solid' | 'dashed'
  relationship: ConnectionRelationship
  label?: string
  aiSuggested?: boolean
  confidence?: number
  reasoning?: string
}

/** Viewport state for the canvas */
export interface Viewport {
  x: number
  y: number
  zoom: number
}

/** Moodboard - collection of nodes and connections */
export interface Moodboard {
  id: string
  name: string
  nodes: IdeaNode[]
  connections: IdeaConnection[]
  viewport: Viewport
  workspaceId?: string
  createdAt: Date
  updatedAt: Date
}

/** Tool mode for the canvas */
export type ToolMode = 'select' | 'pan' | 'connect'

/** Selection state */
export interface SelectionState {
  nodeIds: string[]
  connectionIds: string[]
}

/** AI suggestion types */
export interface ConnectionSuggestion {
  id: string
  sourceId: string
  targetId: string
  relationship: ConnectionRelationship
  confidence: number
  reasoning: string
}

export interface NodeSuggestion {
  id: string
  position: Position
  title: string
  content: string
  relatedToNodeId?: string
  confidence: number
  reasoning: string
}

export interface CritiqueSuggestion {
  id: string
  nodeId: string
  critique: string
  suggestions: string[]
  severity: 'info' | 'warning' | 'critical'
}

/** Critique attached to a node - persisted with the node */
export interface NodeCritique {
  id: string
  critique: string
  suggestions: string[]
  severity: 'info' | 'warning' | 'critical'
  createdAt: Date
  dismissed?: boolean
}

export type AISuggestion =
  | { type: 'connection'; data: ConnectionSuggestion }
  | { type: 'node'; data: NodeSuggestion }
  | { type: 'critique'; data: CritiqueSuggestion }

/** Canvas gesture state */
export interface GestureState {
  isPanning: boolean
  isDragging: boolean
  isConnecting: boolean
  isSelecting: boolean
  startPosition: Position | null
  currentPosition: Position | null
}

/** Default values */
export const DEFAULT_NODE_DIMENSIONS: Dimensions = {
  width: 280,
  height: 160,
}

export const DEFAULT_VIEWPORT: Viewport = {
  x: 0,
  y: 0,
  zoom: 1,
}

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 2
export const ZOOM_STEP = 0.1

export const MIN_NODE_WIDTH = 200
export const MAX_NODE_WIDTH = 600
export const MIN_NODE_HEIGHT = 100
export const MAX_NODE_HEIGHT = 800

/** Helper to calculate node dimensions based on text content */
export function calculateNodeDimensions(text: string): Dimensions {
  // Estimate based on character count and line breaks
  const lines = text.split('\n')
  const maxLineLength = Math.max(...lines.map(l => l.length))

  // Calculate width based on longest line (roughly 7px per character at 14px font)
  const estimatedWidth = Math.min(
    MAX_NODE_WIDTH,
    Math.max(MIN_NODE_WIDTH, Math.min(maxLineLength * 7.5 + 48, 450)) // 48px for padding
  )

  // Calculate height based on line count and wrapped lines
  // Estimate ~20px per line, with some for padding and header
  const charsPerLine = Math.floor((estimatedWidth - 48) / 7.5)
  const wrappedLines = lines.reduce((acc, line) => {
    return acc + Math.max(1, Math.ceil(line.length / charsPerLine))
  }, 0)

  const estimatedHeight = Math.min(
    MAX_NODE_HEIGHT,
    Math.max(MIN_NODE_HEIGHT, wrappedLines * 22 + 80) // 80px for header, padding, etc.
  )

  return {
    width: estimatedWidth,
    height: estimatedHeight,
  }
}

/** Helper to create a new node */
export function createNode(
  position: Position,
  content?: NodeContent[],
  title?: string,
  dimensions?: Dimensions
): IdeaNode {
  const now = new Date()

  // If no dimensions provided but content has text, calculate dimensions
  let nodeDimensions = dimensions || { ...DEFAULT_NODE_DIMENSIONS }
  if (!dimensions && content && content.length > 0) {
    const textContent = content.find(c => c.type === 'text')
    if (textContent && textContent.type === 'text' && textContent.text) {
      nodeDimensions = calculateNodeDimensions(textContent.text)
    }
  }

  return {
    id: crypto.randomUUID(),
    position,
    dimensions: nodeDimensions,
    content: content || [],
    title,
    tags: [],
    zIndex: 1,
    createdAt: now,
    updatedAt: now,
  }
}

/** Helper to create a new connection */
export function createConnection(
  sourceId: string,
  targetId: string,
  relationship: ConnectionRelationship = 'related'
): IdeaConnection {
  return {
    id: crypto.randomUUID(),
    sourceId,
    targetId,
    type: 'solid',
    relationship,
  }
}

/** Helper to create a new moodboard */
export function createMoodboard(name: string, workspaceId?: string): Moodboard {
  const now = new Date()
  return {
    id: crypto.randomUUID(),
    name,
    nodes: [],
    connections: [],
    viewport: { ...DEFAULT_VIEWPORT },
    workspaceId,
    createdAt: now,
    updatedAt: now,
  }
}

/** Helper to create a Plan node from interview results */
export function createPlanNode(
  position: Position,
  plan: {
    summary: string
    requirements: string[]
    designNotes?: string
    technicalApproach?: string
    sourceIdeaIds: string[]
  },
  title?: string
): IdeaNode {
  const now = new Date()
  const planContent: PlanContent = {
    type: 'plan',
    id: crypto.randomUUID(),
    summary: plan.summary,
    requirements: plan.requirements,
    designNotes: plan.designNotes,
    technicalApproach: plan.technicalApproach,
    sourceIdeaIds: plan.sourceIdeaIds,
  }

  // Plan nodes are slightly larger to accommodate structured content
  const dimensions: Dimensions = {
    width: 320,
    height: 240,
  }

  return {
    id: crypto.randomUUID(),
    position,
    dimensions,
    content: [planContent],
    title: title || 'Plan',
    tags: ['plan'],
    zIndex: 1,
    createdAt: now,
    updatedAt: now,
  }
}
