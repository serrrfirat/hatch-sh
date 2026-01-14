import type { Plugin } from 'esbuild-wasm'

// React and ReactDOM as external dependencies loaded in iframe
const EXTERNALS: Record<string, string> = {
  react: 'React',
  'react-dom': 'ReactDOM',
  'react-dom/client': 'ReactDOM',
}

export function createUnpkgPlugin(): Plugin {
  return {
    name: 'unpkg',
    setup(build) {
      // Handle external packages (React, ReactDOM)
      build.onResolve({ filter: /^react(-dom)?(\/client)?$/ }, (args) => ({
        path: args.path,
        namespace: 'external',
      }))

      build.onLoad({ filter: /.*/, namespace: 'external' }, (args) => {
        const globalVar = EXTERNALS[args.path]
        if (!globalVar) {
          throw new Error(`Unknown external package: ${args.path}`)
        }
        return {
          contents: `module.exports = window.${globalVar}`,
          loader: 'js',
        }
      })

      // Handle other npm packages via unpkg
      build.onResolve({ filter: /^[^./]/ }, (args) => {
        // Skip external packages
        if (EXTERNALS[args.path]) {
          return { path: args.path, namespace: 'external' }
        }
        return {
          path: `https://unpkg.com/${args.path}`,
          namespace: 'unpkg',
        }
      })

      build.onLoad({ filter: /.*/, namespace: 'unpkg' }, async (args) => {
        try {
          const response = await fetch(args.path)
          if (!response.ok) {
            throw new Error(`Failed to fetch package from ${args.path} (status: ${response.status})`)
          }

          const contents = await response.text()

          // Determine loader based on file extension
          let loader: 'css' | 'js' | 'jsx' | 'ts' | 'tsx' = 'js'
          if (args.path.endsWith('.css')) {
            loader = 'css'
          } else if (args.path.endsWith('.tsx')) {
            loader = 'tsx'
          } else if (args.path.endsWith('.ts')) {
            loader = 'ts'
          } else if (args.path.endsWith('.jsx')) {
            loader = 'jsx'
          }

          return { contents, loader }
        } catch (error) {
          // Propagate the error so it's visible in the preview error UI
          const message = error instanceof Error ? error.message : `Failed to load: ${args.path}`
          throw new Error(message)
        }
      })
    },
  }
}

// Helper to normalize and resolve file paths
function resolvePath(basePath: string, relativePath: string): string {
  // Remove leading ./ from relative path
  const cleanRelative = relativePath.replace(/^\.\//, '')

  // Get directory of base path
  const baseDir = basePath.includes('/')
    ? basePath.substring(0, basePath.lastIndexOf('/'))
    : ''

  // Handle ../ in paths
  const parts = cleanRelative.split('/')
  const baseParts = baseDir ? baseDir.split('/') : []

  for (const part of parts) {
    if (part === '..') {
      baseParts.pop()
    } else if (part !== '.') {
      baseParts.push(part)
    }
  }

  return baseParts.join('/')
}

// Helper to find a file in the virtual filesystem with extension resolution
function findFile(files: Record<string, string>, path: string): string | null {
  const extensions = ['', '.tsx', '.ts', '.jsx', '.js']
  for (const ext of extensions) {
    const fullPath = path + ext
    if (files[fullPath] !== undefined) {
      return fullPath
    }
  }
  // Also check for index files
  for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
    const indexPath = `${path}/index${ext}`
    if (files[indexPath] !== undefined) {
      return indexPath
    }
  }
  return null
}

export function createVirtualFsPlugin(files: Record<string, string>): Plugin {
  return {
    name: 'virtual-fs',
    setup(build) {
      // Handle entry point
      build.onResolve({ filter: /^entry\.tsx$/ }, () => ({
        path: 'entry.tsx',
        namespace: 'virtual',
      }))

      // Resolve virtual files (relative imports)
      build.onResolve({ filter: /^\./ }, (args) => {
        // Resolve the path relative to the importer
        const resolvedPath = resolvePath(args.importer || '', args.path)
        const foundPath = findFile(files, resolvedPath)

        if (foundPath) {
          return { path: foundPath, namespace: 'virtual' }
        }
        return null
      })

      // Load virtual files
      build.onLoad({ filter: /.*/, namespace: 'virtual' }, (args) => {
        const content = files[args.path]

        if (content !== undefined) {
          const loader = args.path.endsWith('.css')
            ? 'css'
            : args.path.endsWith('.ts') && !args.path.endsWith('.tsx')
              ? 'ts'
              : 'tsx'
          return {
            contents: content,
            loader,
          }
        }

        throw new Error(`File not found in virtual filesystem: ${args.path}`)
      })
    },
  }
}
