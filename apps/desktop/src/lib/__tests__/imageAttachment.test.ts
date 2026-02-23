import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  isImageFile,
  isImageTooLarge,
  imageToBase64,
  SUPPORTED_IMAGE_EXTENSIONS,
  MAX_IMAGE_SIZE_BYTES,
  type ImageAttachmentData,
} from '../imageAttachment'

describe('isImageFile', () => {
  it('returns true for .png files', () => {
    expect(isImageFile('screenshot.png')).toBe(true)
  })

  it('returns true for .jpg files', () => {
    expect(isImageFile('photo.jpg')).toBe(true)
  })

  it('returns true for .jpeg files', () => {
    expect(isImageFile('photo.jpeg')).toBe(true)
  })

  it('returns true for .gif files', () => {
    expect(isImageFile('animation.gif')).toBe(true)
  })

  it('returns true for .webp files', () => {
    expect(isImageFile('image.webp')).toBe(true)
  })

  it('returns true for .svg files', () => {
    expect(isImageFile('icon.svg')).toBe(true)
  })

  it('returns false for .pdf files', () => {
    expect(isImageFile('document.pdf')).toBe(false)
  })

  it('returns false for .txt files', () => {
    expect(isImageFile('readme.txt')).toBe(false)
  })

  it('returns false for .mp4 video files', () => {
    expect(isImageFile('video.mp4')).toBe(false)
  })

  it('returns false for files with no extension', () => {
    expect(isImageFile('Makefile')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isImageFile('PHOTO.PNG')).toBe(true)
    expect(isImageFile('image.JPG')).toBe(true)
    expect(isImageFile('icon.SVG')).toBe(true)
  })

  it('handles paths with directories', () => {
    expect(isImageFile('assets/images/logo.png')).toBe(true)
    expect(isImageFile('/home/user/photo.jpg')).toBe(true)
  })
})

describe('isImageTooLarge', () => {
  it('returns false for files under 5MB', () => {
    expect(isImageTooLarge(1024)).toBe(false) // 1KB
    expect(isImageTooLarge(1024 * 1024)).toBe(false) // 1MB
    expect(isImageTooLarge(4 * 1024 * 1024)).toBe(false) // 4MB
  })

  it('returns false for files exactly at 5MB', () => {
    expect(isImageTooLarge(5 * 1024 * 1024)).toBe(false)
  })

  it('returns true for files over 5MB', () => {
    expect(isImageTooLarge(5 * 1024 * 1024 + 1)).toBe(true)
    expect(isImageTooLarge(10 * 1024 * 1024)).toBe(true)
  })

  it('returns false for zero-byte files', () => {
    expect(isImageTooLarge(0)).toBe(false)
  })

  it('uses 5MB as the default limit', () => {
    expect(MAX_IMAGE_SIZE_BYTES).toBe(5 * 1024 * 1024)
  })
})

describe('imageToBase64', () => {
  // FileReader is browser-only; provide a minimal mock for Node test environment
  const originalFileReader = globalThis.FileReader

  beforeEach(() => {
    class MockFileReader {
      result: string | ArrayBuffer | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsDataURL(blob: Blob) {
        blob.arrayBuffer().then((buffer) => {
          const bytes = new Uint8Array(buffer)
          let binary = ''
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i])
          }
          const base64 = btoa(binary)
          const type = (blob as File).type || 'application/octet-stream'
          this.result = `data:${type};base64,${base64}`
          if (this.onload) this.onload()
        })
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader
  })

  afterEach(() => {
    if (originalFileReader) {
      globalThis.FileReader = originalFileReader
    }
  })

  it('converts a File to a base64 data URL', async () => {
    const content = new Uint8Array([137, 80, 78, 71]) // PNG magic bytes
    const file = new File([content], 'test.png', { type: 'image/png' })
    const result = await imageToBase64(file)
    expect(result).toMatch(/^data:image\/png;base64,/)
  })

  it('preserves the file MIME type', async () => {
    const content = new Uint8Array([0xff, 0xd8, 0xff]) // JPEG magic bytes
    const file = new File([content], 'photo.jpg', { type: 'image/jpeg' })
    const result = await imageToBase64(file)
    expect(result.startsWith('data:image/jpeg;base64,')).toBe(true)
  })

  it('returns non-empty base64 content', async () => {
    const content = new Uint8Array([71, 73, 70]) // GIF magic bytes
    const file = new File([content], 'anim.gif', { type: 'image/gif' })
    const result = await imageToBase64(file)
    const base64Part = result.split(',')[1]
    expect(base64Part.length).toBeGreaterThan(0)
  })
})

describe('SUPPORTED_IMAGE_EXTENSIONS', () => {
  it('contains exactly the 6 supported extensions', () => {
    expect(SUPPORTED_IMAGE_EXTENSIONS).toEqual(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])
  })
})

describe('ImageAttachmentData type', () => {
  it('can be constructed with required fields', () => {
    const attachment: ImageAttachmentData = {
      id: 'img-123',
      fileName: 'screenshot.png',
      mimeType: 'image/png',
      base64: 'data:image/png;base64,iVBOR...',
      sizeBytes: 1024,
    }
    expect(attachment.id).toBe('img-123')
    expect(attachment.fileName).toBe('screenshot.png')
    expect(attachment.mimeType).toBe('image/png')
    expect(attachment.base64).toContain('data:image/png')
    expect(attachment.sizeBytes).toBe(1024)
  })

  it('accepts optional savedPath field', () => {
    const attachment: ImageAttachmentData = {
      id: 'img-456',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      base64: 'data:image/jpeg;base64,/9j/4AAQ...',
      sizeBytes: 2048,
      savedPath: '/workspace/.context/photo.jpg',
    }
    expect(attachment.savedPath).toBe('/workspace/.context/photo.jpg')
  })
})
