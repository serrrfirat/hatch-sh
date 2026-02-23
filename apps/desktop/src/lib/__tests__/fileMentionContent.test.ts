import { describe, it, expect } from 'vitest'
import {
  isTextFile,
  isBinaryFile,
  isFileTooLarge,
  getLanguageForExtension,
  formatFileContentBlock,
  buildMentionContent,
  SUPPORTED_TEXT_EXTENSIONS,
  BINARY_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from '../fileMentionContent'

describe('isTextFile', () => {
  it('returns true for supported text extensions', () => {
    const files = [
      'app.ts',
      'comp.tsx',
      'utils.js',
      'page.jsx',
      'config.json',
      'README.md',
      'style.css',
      'index.html',
      'main.py',
      'lib.rs',
    ]
    for (const f of files) {
      expect(isTextFile(f)).toBe(true)
    }
  })

  it('returns false for unsupported extensions', () => {
    expect(isTextFile('image.png')).toBe(false)
    expect(isTextFile('photo.jpg')).toBe(false)
    expect(isTextFile('doc.pdf')).toBe(false)
    expect(isTextFile('archive.zip')).toBe(false)
  })

  it('returns false for files with no extension', () => {
    expect(isTextFile('Makefile')).toBe(false)
    expect(isTextFile('Dockerfile')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isTextFile('App.TS')).toBe(true)
    expect(isTextFile('README.MD')).toBe(true)
    expect(isTextFile('style.CSS')).toBe(true)
  })

  it('handles paths with directories', () => {
    expect(isTextFile('/home/user/project/src/index.ts')).toBe(true)
    expect(isTextFile('src/components/App.tsx')).toBe(true)
  })
})

describe('isBinaryFile', () => {
  it('returns true for common binary extensions', () => {
    const files = [
      'photo.png',
      'image.jpg',
      'pic.jpeg',
      'anim.gif',
      'icon.bmp',
      'favicon.ico',
      'doc.pdf',
      'app.exe',
      'lib.dll',
      'archive.zip',
      'bundle.tar',
      'file.gz',
      'video.mp4',
      'sound.mp3',
      'font.woff',
      'font.woff2',
    ]
    for (const f of files) {
      expect(isBinaryFile(f)).toBe(true)
    }
  })

  it('returns false for text files', () => {
    expect(isBinaryFile('index.ts')).toBe(false)
    expect(isBinaryFile('README.md')).toBe(false)
  })

  it('returns false for unknown extensions', () => {
    expect(isBinaryFile('file.xyz')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isBinaryFile('photo.PNG')).toBe(true)
    expect(isBinaryFile('image.JPG')).toBe(true)
  })
})

describe('isFileTooLarge', () => {
  it('returns false for files under the limit', () => {
    expect(isFileTooLarge(1000)).toBe(false)
    expect(isFileTooLarge(0)).toBe(false)
    expect(isFileTooLarge(51199)).toBe(false)
  })

  it('returns false for files exactly at the limit', () => {
    expect(isFileTooLarge(51200)).toBe(false)
  })

  it('returns true for files over the limit', () => {
    expect(isFileTooLarge(51201)).toBe(true)
    expect(isFileTooLarge(100000)).toBe(true)
  })

  it('accepts a custom maxBytes parameter', () => {
    expect(isFileTooLarge(5000, 4000)).toBe(true)
    expect(isFileTooLarge(3000, 4000)).toBe(false)
  })

  it('exports the default max size constant', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(51200)
  })
})

describe('getLanguageForExtension', () => {
  it('returns correct language for TypeScript files', () => {
    expect(getLanguageForExtension('file.ts')).toBe('ts')
    expect(getLanguageForExtension('file.tsx')).toBe('tsx')
  })

  it('returns correct language for JavaScript files', () => {
    expect(getLanguageForExtension('file.js')).toBe('js')
    expect(getLanguageForExtension('file.jsx')).toBe('jsx')
  })

  it('returns correct language for other supported types', () => {
    expect(getLanguageForExtension('file.json')).toBe('json')
    expect(getLanguageForExtension('file.md')).toBe('md')
    expect(getLanguageForExtension('file.css')).toBe('css')
    expect(getLanguageForExtension('file.html')).toBe('html')
    expect(getLanguageForExtension('file.py')).toBe('python')
    expect(getLanguageForExtension('file.rs')).toBe('rust')
  })

  it('returns empty string for unknown extensions', () => {
    expect(getLanguageForExtension('file.xyz')).toBe('')
    expect(getLanguageForExtension('Makefile')).toBe('')
  })

  it('is case-insensitive', () => {
    expect(getLanguageForExtension('file.TS')).toBe('ts')
    expect(getLanguageForExtension('file.PY')).toBe('python')
  })

  it('handles full file paths', () => {
    expect(getLanguageForExtension('/src/components/App.tsx')).toBe('tsx')
  })
})

describe('formatFileContentBlock', () => {
  it('formats file content as a labeled code block', () => {
    const result = formatFileContentBlock('src/index.ts', 'const x = 1;')
    expect(result).toBe('\n\n[File: src/index.ts]\n```ts\nconst x = 1;\n```')
  })

  it('uses the correct language from the extension', () => {
    const result = formatFileContentBlock('style.css', 'body { color: red; }')
    expect(result).toBe('\n\n[File: style.css]\n```css\nbody { color: red; }\n```')
  })

  it('handles files with no recognized language', () => {
    const result = formatFileContentBlock('config.toml', 'key = "value"')
    expect(result).toBe('\n\n[File: config.toml]\n```\nkey = "value"\n```')
  })

  it('trims trailing whitespace from content', () => {
    const result = formatFileContentBlock('file.ts', 'const x = 1;\n\n')
    expect(result).toBe('\n\n[File: file.ts]\n```ts\nconst x = 1;\n```')
  })

  it('preserves internal whitespace and newlines', () => {
    const content = 'function foo() {\n  return 1;\n}'
    const result = formatFileContentBlock('file.js', content)
    expect(result).toBe('\n\n[File: file.js]\n```js\nfunction foo() {\n  return 1;\n}\n```')
  })
})

describe('buildMentionContent', () => {
  it('returns formatted content block for a normal text file', () => {
    const result = buildMentionContent('src/index.ts', 'const x = 1;', 100)
    expect(result).toEqual({
      type: 'content',
      text: '\n\n[File: src/index.ts]\n```ts\nconst x = 1;\n```',
    })
  })

  it('returns path-only with warning for files over size limit', () => {
    const result = buildMentionContent('src/big.ts', 'x'.repeat(60000), 60000)
    expect(result).toEqual({
      type: 'too-large',
      text: '@src/big.ts',
      warning: expect.stringContaining('50KB'),
    })
  })

  it('returns path-only for binary files', () => {
    const result = buildMentionContent('image.png', '', 1000)
    expect(result).toEqual({
      type: 'binary',
      text: '@image.png',
    })
  })

  it('returns path-only for directories (no extension)', () => {
    const result = buildMentionContent('src/components', '', 0)
    expect(result).toEqual({
      type: 'unsupported',
      text: '@src/components',
    })
  })

  it('returns content for files exactly at the size limit', () => {
    const content = 'x'.repeat(100)
    const result = buildMentionContent('file.ts', content, 51200)
    expect(result.type).toBe('content')
  })

  it('handles empty content for text files', () => {
    const result = buildMentionContent('empty.ts', '', 0)
    expect(result).toEqual({
      type: 'content',
      text: '\n\n[File: empty.ts]\n```ts\n\n```',
    })
  })
})

describe('constants', () => {
  it('SUPPORTED_TEXT_EXTENSIONS contains all required extensions', () => {
    const required = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html', '.py', '.rs']
    for (const ext of required) {
      expect(SUPPORTED_TEXT_EXTENSIONS.has(ext)).toBe(true)
    }
  })

  it('BINARY_EXTENSIONS contains common binary types', () => {
    const required = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.exe', '.zip']
    for (const ext of required) {
      expect(BINARY_EXTENSIONS.has(ext)).toBe(true)
    }
  })
})
