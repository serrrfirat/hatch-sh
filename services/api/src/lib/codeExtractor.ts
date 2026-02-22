export interface CodeBlock {
  filePath: string
  content: string
  language: string
}

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  tsx: '.tsx',
  ts: '.ts',
  typescript: '.ts',
  jsx: '.jsx',
  js: '.js',
  javascript: '.js',
  css: '.css',
  json: '.json',
  html: '.html',
}

export function extractCodeBlocks(response: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  const regex = /```(\w+)?(?::([^\n]+?)| ([^\n]+?))?\n([\s\S]*?)```/g
  let match: RegExpExecArray | null

  let blockIndex = 0
  while ((match = regex.exec(response)) !== null) {
    const language = match[1] || ''
    const colonPath = match[2]?.trim()
    const spacePath = match[3]?.trim()
    let content = match[4]

    if (!content || content.trim() === '') continue

    // Determine file path
    let filePath = colonPath || spacePath || ''

    // Check for // File: comment in content
    if (!filePath) {
      const fileComment = content.match(/^\/\/\s*File:\s*(.+)\n/)
      if (fileComment) {
        filePath = fileComment[1].trim()
        content = content.replace(fileComment[0], '')
      }
    }

    // Default naming
    if (!filePath) {
      if (blockIndex === 0) {
        const ext = LANGUAGE_EXTENSIONS[language] || '.tsx'
        filePath = `App${ext}`
      } else {
        const ext = LANGUAGE_EXTENSIONS[language] || '.tsx'
        filePath = `file-${blockIndex}${ext}`
      }
    }

    blocks.push({
      filePath,
      content: content.trimEnd(),
      language,
    })
    blockIndex++
  }

  return blocks
}
