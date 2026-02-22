export interface FileTreeNode {
  name: string
  path: string
  is_directory: boolean
  children?: FileTreeNode[]
}

const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'rs', 'go', 'py', 'rb', 'java', 'kt', 'swift', 'c', 'cpp', 'h', 'hpp',
  'lua', 'zig', 'nim', 'ex', 'exs', 'erl', 'hs',
  'sh', 'bash', 'zsh', 'fish',
  'php', 'pl', 'r', 'scala', 'clj', 'dart',
  'vue', 'svelte',
])

/**
 * Extract file extension from a filename.
 * Returns empty string if no extension.
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot <= 0) return ''
  return filename.slice(lastDot + 1)
}

/**
 * Determine icon type for a file: 'code' for source files, 'text' for everything else.
 */
export function getFileIconType(filename: string): 'code' | 'text' {
  const ext = getFileExtension(filename).toLowerCase()
  return CODE_EXTENSIONS.has(ext) ? 'code' : 'text'
}

/**
 * Given a file path, return the set of all parent directory paths.
 * Used to auto-expand ancestors when a file is selected.
 */
export function buildExpandedPathSet(filePath: string): Set<string> {
  const result = new Set<string>()
  if (!filePath) return result

  const parts = filePath.split('/')
  // Build each parent segment (exclude the file itself)
  for (let i = 1; i < parts.length; i++) {
    result.add(parts.slice(0, i).join('/'))
  }
  return result
}

/**
 * Sort tree nodes: directories first, then files, both alphabetically case-insensitive.
 */
export function sortTreeNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.is_directory && !b.is_directory) return -1
    if (!a.is_directory && b.is_directory) return 1
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  })
}