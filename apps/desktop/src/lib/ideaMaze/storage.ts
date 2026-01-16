/**
 * Idea Maze File System Storage Service
 *
 * Handles persistent storage of moodboards and images using Tauri's file system API.
 * Data is stored in the app's data directory: ~/.local/share/fun.vibed.desktop/idea-maze/
 */

import {
  exists,
  mkdir,
  readDir,
  readTextFile,
  writeTextFile,
  remove,
  readFile,
  writeFile,
  BaseDirectory,
} from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import type { Moodboard, IdeaNode, NodeContent, ImageContent } from './types'

// Storage directory names
const IDEA_MAZE_DIR = 'idea-maze'
const MOODBOARDS_DIR = 'moodboards'
const IMAGES_DIR = 'images'

// File extension
const MOODBOARD_EXT = '.json'

// Storage version for future migrations
const STORAGE_VERSION = 1

interface StoredMoodboard extends Omit<Moodboard, 'createdAt' | 'updatedAt'> {
  createdAt: string // ISO date string
  updatedAt: string // ISO date string
  storageVersion: number
}

interface StorageIndex {
  version: number
  moodboards: { id: string; name: string; updatedAt: string }[]
}

/**
 * Initialize the storage directory structure
 */
export async function initializeStorage(): Promise<void> {
  try {
    const appData = await appDataDir()
    const ideaMazePath = await join(appData, IDEA_MAZE_DIR)
    const moodboardsPath = await join(ideaMazePath, MOODBOARDS_DIR)
    const imagesPath = await join(ideaMazePath, IMAGES_DIR)

    // Create directories if they don't exist
    if (!(await exists(ideaMazePath))) {
      await mkdir(ideaMazePath, { recursive: true })
    }
    if (!(await exists(moodboardsPath))) {
      await mkdir(moodboardsPath, { recursive: true })
    }
    if (!(await exists(imagesPath))) {
      await mkdir(imagesPath, { recursive: true })
    }

    console.log('[IdeaMaze Storage] Initialized at:', ideaMazePath)
  } catch (error) {
    console.error('[IdeaMaze Storage] Failed to initialize:', error)
    throw error
  }
}

/**
 * Get the path to the moodboards directory
 */
async function getMoodboardsPath(): Promise<string> {
  const appData = await appDataDir()
  return join(appData, IDEA_MAZE_DIR, MOODBOARDS_DIR)
}

/**
 * Get the path to the images directory
 */
async function getImagesPath(): Promise<string> {
  const appData = await appDataDir()
  return join(appData, IDEA_MAZE_DIR, IMAGES_DIR)
}

/**
 * Save a moodboard to the file system
 */
export async function saveMoodboard(moodboard: Moodboard): Promise<void> {
  try {
    const moodboardsPath = await getMoodboardsPath()
    const filePath = await join(moodboardsPath, `${moodboard.id}${MOODBOARD_EXT}`)

    // Process nodes to extract and save images
    const processedNodes = await Promise.all(
      moodboard.nodes.map(async (node) => {
        const processedContent = await Promise.all(
          node.content.map(async (content) => {
            if (content.type === 'image' && isDataUrl(content.url)) {
              // Save image to file and replace data URL with file path
              const imagePath = await saveImage(content.url, content.id)
              return { ...content, url: imagePath } as ImageContent
            }
            return content
          })
        )
        return { ...node, content: processedContent }
      })
    )

    const storedMoodboard: StoredMoodboard = {
      ...moodboard,
      nodes: processedNodes,
      createdAt: moodboard.createdAt.toISOString(),
      updatedAt: moodboard.updatedAt.toISOString(),
      storageVersion: STORAGE_VERSION,
    }

    await writeTextFile(filePath, JSON.stringify(storedMoodboard, null, 2))
    console.log('[IdeaMaze Storage] Saved moodboard:', moodboard.id)
  } catch (error) {
    console.error('[IdeaMaze Storage] Failed to save moodboard:', error)
    throw error
  }
}

/**
 * Load a moodboard from the file system
 */
export async function loadMoodboard(id: string): Promise<Moodboard | null> {
  try {
    const moodboardsPath = await getMoodboardsPath()
    const filePath = await join(moodboardsPath, `${id}${MOODBOARD_EXT}`)

    if (!(await exists(filePath))) {
      return null
    }

    const content = await readTextFile(filePath)
    const stored: StoredMoodboard = JSON.parse(content)

    // Process nodes to load images as data URLs for display
    const processedNodes = await Promise.all(
      stored.nodes.map(async (node) => {
        const processedContent = await Promise.all(
          node.content.map(async (content) => {
            if (content.type === 'image' && !isDataUrl(content.url)) {
              // Load image from file and convert to data URL
              try {
                const dataUrl = await loadImage(content.url)
                return { ...content, url: dataUrl } as ImageContent
              } catch {
                // If image can't be loaded, keep the path (will show broken image)
                console.warn('[IdeaMaze Storage] Failed to load image:', content.url)
                return content
              }
            }
            return content
          })
        )
        return { ...node, content: processedContent } as IdeaNode
      })
    )

    const moodboard: Moodboard = {
      ...stored,
      nodes: processedNodes,
      createdAt: new Date(stored.createdAt),
      updatedAt: new Date(stored.updatedAt),
    }

    console.log('[IdeaMaze Storage] Loaded moodboard:', id)
    return moodboard
  } catch (error) {
    console.error('[IdeaMaze Storage] Failed to load moodboard:', error)
    return null
  }
}

/**
 * Load all moodboards from the file system
 */
export async function loadAllMoodboards(): Promise<Moodboard[]> {
  try {
    const moodboardsPath = await getMoodboardsPath()

    if (!(await exists(moodboardsPath))) {
      return []
    }

    const entries = await readDir(moodboardsPath)
    const moodboards: Moodboard[] = []

    for (const entry of entries) {
      if (entry.name?.endsWith(MOODBOARD_EXT)) {
        const id = entry.name.replace(MOODBOARD_EXT, '')
        const moodboard = await loadMoodboard(id)
        if (moodboard) {
          moodboards.push(moodboard)
        }
      }
    }

    console.log('[IdeaMaze Storage] Loaded', moodboards.length, 'moodboards')
    return moodboards
  } catch (error) {
    console.error('[IdeaMaze Storage] Failed to load moodboards:', error)
    return []
  }
}

/**
 * Delete a moodboard from the file system
 */
export async function deleteMoodboard(id: string): Promise<void> {
  try {
    const moodboardsPath = await getMoodboardsPath()
    const filePath = await join(moodboardsPath, `${id}${MOODBOARD_EXT}`)

    if (await exists(filePath)) {
      await remove(filePath)
      console.log('[IdeaMaze Storage] Deleted moodboard:', id)
    }

    // Note: We don't delete associated images here to avoid orphaning
    // images that might be used by other moodboards or for undo functionality.
    // Consider implementing a garbage collection mechanism for orphaned images.
  } catch (error) {
    console.error('[IdeaMaze Storage] Failed to delete moodboard:', error)
    throw error
  }
}

/**
 * Save an image to the file system
 * @param dataUrl The data URL of the image
 * @param imageId The unique ID for the image
 * @returns The file path where the image was saved
 */
async function saveImage(dataUrl: string, imageId: string): Promise<string> {
  try {
    const imagesPath = await getImagesPath()

    // Extract the base64 data and mime type
    const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!matches) {
      throw new Error('Invalid data URL format')
    }

    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1]
    const base64Data = matches[2]
    const fileName = `${imageId}.${extension}`
    const filePath = await join(imagesPath, fileName)

    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    await writeFile(filePath, bytes)
    console.log('[IdeaMaze Storage] Saved image:', fileName)

    return filePath
  } catch (error) {
    console.error('[IdeaMaze Storage] Failed to save image:', error)
    throw error
  }
}

/**
 * Load an image from the file system and return as data URL
 * @param filePath The path to the image file
 * @returns The image as a data URL
 */
async function loadImage(filePath: string): Promise<string> {
  try {
    const bytes = await readFile(filePath)

    // Determine MIME type from extension
    const extension = filePath.split('.').pop()?.toLowerCase()
    const mimeType =
      extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : extension === 'png'
        ? 'image/png'
        : extension === 'gif'
        ? 'image/gif'
        : extension === 'webp'
        ? 'image/webp'
        : 'image/png'

    // Convert to base64
    let binary = ''
    const len = bytes.length
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)

    return `data:${mimeType};base64,${base64}`
  } catch (error) {
    console.error('[IdeaMaze Storage] Failed to load image:', error)
    throw error
  }
}

/**
 * Check if a URL is a data URL
 */
function isDataUrl(url: string): boolean {
  return url.startsWith('data:')
}

/**
 * Export a moodboard to a standalone JSON file (for sharing/backup)
 * Images are embedded as data URLs
 */
export async function exportMoodboard(moodboard: Moodboard): Promise<string> {
  // Moodboard should already have data URLs loaded, so just serialize
  const exportData = {
    ...moodboard,
    createdAt: moodboard.createdAt.toISOString(),
    updatedAt: moodboard.updatedAt.toISOString(),
    exportVersion: STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
  }

  return JSON.stringify(exportData, null, 2)
}

/**
 * Import a moodboard from a JSON string
 */
export async function importMoodboard(jsonString: string): Promise<Moodboard> {
  try {
    const data = JSON.parse(jsonString)

    // Generate new ID to avoid conflicts
    const newId = crypto.randomUUID()

    const moodboard: Moodboard = {
      ...data,
      id: newId,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(),
    }

    return moodboard
  } catch (error) {
    console.error('[IdeaMaze Storage] Failed to import moodboard:', error)
    throw new Error('Invalid moodboard file format')
  }
}

/**
 * Migrate data from localStorage to file system storage
 * Call this once during app initialization
 */
export async function migrateFromLocalStorage(): Promise<Moodboard[]> {
  try {
    const localStorageKey = 'vibed-idea-maze'
    const stored = localStorage.getItem(localStorageKey)

    if (!stored) {
      console.log('[IdeaMaze Storage] No localStorage data to migrate')
      return []
    }

    const data = JSON.parse(stored)
    const moodboards = data.state?.moodboards || []

    if (moodboards.length === 0) {
      console.log('[IdeaMaze Storage] No moodboards to migrate')
      return []
    }

    console.log('[IdeaMaze Storage] Migrating', moodboards.length, 'moodboards from localStorage')

    const migratedMoodboards: Moodboard[] = []

    for (const stored of moodboards) {
      const moodboard: Moodboard = {
        ...stored,
        createdAt: new Date(stored.createdAt),
        updatedAt: new Date(stored.updatedAt),
      }

      // Save to file system
      await saveMoodboard(moodboard)
      migratedMoodboards.push(moodboard)
    }

    // Clear localStorage after successful migration
    // Comment this out if you want to keep localStorage as backup
    // localStorage.removeItem(localStorageKey)

    console.log('[IdeaMaze Storage] Migration complete')
    return migratedMoodboards
  } catch (error) {
    console.error('[IdeaMaze Storage] Migration failed:', error)
    return []
  }
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  moodboardCount: number
  imageCount: number
  totalSizeEstimate: string
}> {
  try {
    const moodboardsPath = await getMoodboardsPath()
    const imagesPath = await getImagesPath()

    let moodboardCount = 0
    let imageCount = 0

    if (await exists(moodboardsPath)) {
      const moodboardEntries = await readDir(moodboardsPath)
      moodboardCount = moodboardEntries.filter((e) => e.name?.endsWith(MOODBOARD_EXT)).length
    }

    if (await exists(imagesPath)) {
      const imageEntries = await readDir(imagesPath)
      imageCount = imageEntries.length
    }

    return {
      moodboardCount,
      imageCount,
      totalSizeEstimate: 'Unknown', // Would need to sum file sizes
    }
  } catch (error) {
    console.error('[IdeaMaze Storage] Failed to get stats:', error)
    return { moodboardCount: 0, imageCount: 0, totalSizeEstimate: 'Error' }
  }
}
