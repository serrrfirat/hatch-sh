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

    let filePath = colonPath || spacePath || ''

    if (!filePath) {
      const fileComment = content.match(/^\/\/\s*File:\s*(.+)\n/)
      if (fileComment) {
        filePath = fileComment[1].trim()
        content = content.replace(fileComment[0], '')
      }
    }

    if (!filePath) {
      const ext = LANGUAGE_EXTENSIONS[language] || '.tsx'
      filePath = blockIndex === 0 ? `App${ext}` : `file-${blockIndex}${ext}`
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
