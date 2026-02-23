/**
 * Image attachment utilities for chat composer.
 * Pure functions for validation, conversion, and type definitions.
 */

/** Supported image file extensions */
export const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'] as const

/** Maximum image size in bytes (5MB) */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

/** Data structure for an image attachment */
export interface ImageAttachmentData {
  id: string
  fileName: string
  mimeType: string
  base64: string
  sizeBytes: number
  savedPath?: string
}

/**
 * Check if a filename has a supported image extension.
 * Case-insensitive. Handles paths with directories.
 */
export function isImageFile(filename: string): boolean {
  const lastDotIndex = filename.lastIndexOf('.')
  if (lastDotIndex === -1) return false
  const ext = filename.slice(lastDotIndex).toLowerCase()
  return (SUPPORTED_IMAGE_EXTENSIONS as readonly string[]).includes(ext)
}

/**
 * Check if a file size exceeds the maximum allowed (5MB).
 * Files exactly at the limit are NOT too large.
 */
export function isImageTooLarge(sizeBytes: number): boolean {
  return sizeBytes > MAX_IMAGE_SIZE_BYTES
}

/**
 * Convert a File object to a base64 data URL string.
 * Uses FileReader API.
 */
export function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('FileReader did not return a string'))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * Save an image attachment to the workspace .context/ directory via Tauri FS.
 * Returns the file path where the image was saved, or null on failure.
 */
export async function saveImageToWorkspace(
  image: ImageAttachmentData,
  workspacePath: string
): Promise<string | null> {
  try {
    const { exists, mkdir, writeFile } = await import('@tauri-apps/plugin-fs')
    const { join } = await import('@tauri-apps/api/path')

    const contextDir = await join(workspacePath, '.context')
    if (!(await exists(contextDir))) {
      await mkdir(contextDir, { recursive: true })
    }

    // Extract base64 data from data URL
    const matches = image.base64.match(/^data:image\/[\w+]+;base64,(.+)$/)
    if (!matches) {
      return null
    }

    const base64Data = matches[1]
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    const fileName = `${image.id}-${image.fileName}`
    const filePath = await join(contextDir, fileName)
    await writeFile(filePath, bytes)

    return filePath
  } catch {
    return null
  }
}