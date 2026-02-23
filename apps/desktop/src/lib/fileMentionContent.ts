

/** Supported text file extensions for content injection */
export const SUPPORTED_TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.css',
  '.html',
  '.py',
  '.rs',
])

/** Known binary file extensions (content injection skipped) */
export const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.ico',
  '.svg',
  '.pdf',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.zip',
  '.tar',
  '.gz',
  '.bz2',
  '.7z',
  '.rar',
  '.mp4',
  '.mp3',
  '.wav',
  '.avi',
  '.mov',
  '.webm',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.bin',
  '.dat',
  '.o',
  '.a',
])

/** Default max file size in bytes (50KB) */
export const MAX_FILE_SIZE_BYTES = 51200

/** Result of building mention content */
export interface MentionContentResult {
  type: 'content' | 'too-large' | 'binary' | 'unsupported'
  text: string
  warning?: string
}


function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.')
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  if (lastDot <= lastSlash || lastDot === -1) return ''
  return filePath.slice(lastDot).toLowerCase()
}


export function isTextFile(filePath: string): boolean {
  const ext = getExtension(filePath)
  return SUPPORTED_TEXT_EXTENSIONS.has(ext)
}


export function isBinaryFile(filePath: string): boolean {
  const ext = getExtension(filePath)
  return BINARY_EXTENSIONS.has(ext)
}

/** Files at exactly maxBytes are NOT considered too large */
export function isFileTooLarge(sizeBytes: number, maxBytes: number = MAX_FILE_SIZE_BYTES): boolean {
  return sizeBytes > maxBytes
}


export function getLanguageForExtension(filePath: string): string {
  const ext = getExtension(filePath)
  const map: Record<string, string> = {
    '.ts': 'ts',
    '.tsx': 'tsx',
    '.js': 'js',
    '.jsx': 'jsx',
    '.json': 'json',
    '.md': 'md',
    '.css': 'css',
    '.html': 'html',
    '.py': 'python',
    '.rs': 'rust',
  }
  return map[ext] ?? ''
}


export function formatFileContentBlock(filePath: string, content: string): string {
  const lang = getLanguageForExtension(filePath)
  const trimmed = content.trimEnd()
  return `\n\n[File: ${filePath}]\n\`\`\`${lang}\n${trimmed}\n\`\`\``
}


export function buildMentionContent(
  filePath: string,
  content: string,
  sizeBytes: number
): MentionContentResult {
  if (isBinaryFile(filePath)) {
    return { type: 'binary', text: `@${filePath}` }
  }

  if (!isTextFile(filePath)) {
    return { type: 'unsupported', text: `@${filePath}` }
  }

  if (isFileTooLarge(sizeBytes)) {
    return {
      type: 'too-large',
      text: `@${filePath}`,
      warning: `File exceeds 50KB limit (${Math.round(sizeBytes / 1024)}KB). Content not injected.`,
    }
  }

  return {
    type: 'content',
    text: formatFileContentBlock(filePath, content),
  }
}
