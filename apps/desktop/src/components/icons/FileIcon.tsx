import {
  TypeScript,
  Js,
  Reactjs,
  Reactts,
  Markdown,
  XML,
  Sass,
  Rust,
  Python,
  Go,
  Java,
  Swift,
  Kotlin,
  Cplus,
  Yaml,
  Database,
  Shell,
  Git,
  NPM,
  PNPM,
  Yarn,
  Docker,
  Eslint,
  Prettier,
  Vite,
  Tailwind,
  SVG,
  Image,
  Video,
  Audio,
  Font,
  Lock,
  Folder,
  FolderOpen,
  Text,
  Tsconfig,
  CLang,
} from '@react-symbols/icons'

interface FileIconProps {
  filename: string
  isDirectory?: boolean
  isOpen?: boolean
  size?: number
  className?: string
}

// Get icon component based on filename
function getFileIcon(filename: string): React.ComponentType<{ className?: string }> {
  const name = filename.toLowerCase()
  const ext = name.split('.').pop() || ''

  // Special filenames first
  if (name === 'package.json') return NPM
  if (name === 'pnpm-lock.yaml' || name === 'pnpm-workspace.yaml') return PNPM
  if (name === 'yarn.lock') return Yarn
  if (name === 'dockerfile' || name.startsWith('docker-compose')) return Docker
  if (name === '.gitignore' || name === '.gitattributes') return Git
  if (name === '.eslintrc' || name.includes('eslint')) return Eslint
  if (name === '.prettierrc' || name.includes('prettier')) return Prettier
  if (name === 'vite.config.ts' || name === 'vite.config.js') return Vite
  if (name === 'tailwind.config.ts' || name === 'tailwind.config.js') return Tailwind
  if (name === 'tsconfig.json' || name.startsWith('tsconfig')) return Tsconfig
  if (name.startsWith('.env')) return Lock
  if (name.includes('lock') || name.endsWith('.lock')) return Lock

  // Extensions
  switch (ext) {
    // TypeScript/JavaScript
    case 'ts':
      return TypeScript
    case 'tsx':
      return Reactts
    case 'js':
      return Js
    case 'jsx':
      return Reactjs
    case 'mjs':
    case 'cjs':
      return Js

    // Web
    case 'html':
    case 'htm':
      return XML
    case 'css':
      return Sass
    case 'scss':
    case 'sass':
    case 'less':
      return Sass
    case 'svg':
      return SVG

    // Data formats
    case 'json':
    case 'jsonc':
      return Tsconfig
    case 'yaml':
    case 'yml':
      return Yaml
    case 'toml':
      return Text
    case 'md':
    case 'mdx':
      return Markdown
    case 'sql':
      return Database

    // Systems languages
    case 'rs':
      return Rust
    case 'go':
      return Go
    case 'c':
    case 'h':
      return CLang
    case 'cpp':
    case 'cc':
    case 'hpp':
      return Cplus

    // Other languages
    case 'py':
    case 'pyw':
      return Python
    case 'java':
      return Java
    case 'swift':
      return Swift
    case 'kt':
    case 'kts':
      return Kotlin
    case 'sh':
    case 'bash':
    case 'zsh':
      return Shell

    // Media
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'ico':
    case 'bmp':
      return Image
    case 'mp4':
    case 'webm':
    case 'mov':
    case 'avi':
      return Video
    case 'mp3':
    case 'wav':
    case 'ogg':
    case 'flac':
      return Audio
    case 'ttf':
    case 'otf':
    case 'woff':
    case 'woff2':
      return Font

    default:
      return Text
  }
}

export function FileIcon({ filename, isDirectory, isOpen, className }: FileIconProps) {
  if (isDirectory) {
    const IconComponent = isOpen ? FolderOpen : Folder
    return <IconComponent className={className} />
  }

  const IconComponent = getFileIcon(filename)
  return <IconComponent className={className} />
}

// Export for use in tabs
export function getFileIconForPath(filePath: string): React.ComponentType<{ className?: string }> {
  const filename = filePath.split('/').pop() || filePath
  return getFileIcon(filename)
}
