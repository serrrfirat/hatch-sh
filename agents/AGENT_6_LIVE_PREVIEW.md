# Agent Task: Live Preview System

## Priority: HIGH - Core feature (complex)
## Depends on: Module 1 (Foundation), Module 4 (AI Integration)
## Estimated Time: 5-6 hours

## Objective
Build a browser-based code execution system that previews generated React apps in real-time. The preview updates as AI generates code, with hot reload capability.

## Approach Options

### Option A: esbuild-wasm + iframe blob URLs (Recommended)
- Bundle code in browser using esbuild-wasm
- Create blob URL from bundled output
- Render in sandboxed iframe
- Pros: No external dependencies, fast, works offline
- Cons: Setup complexity

### Option B: WebContainers (Stackblitz)
- Use @webcontainer/api
- Full Node.js runtime in browser
- Pros: Most powerful, supports npm packages
- Cons: Memory heavy, licensing considerations

### Option C: CodeSandbox SDK
- Use CodeSandbox embed API
- Pros: Easy setup
- Cons: External dependency, branding

**This task uses Option A** - esbuild-wasm for maximum control and performance.

## Tasks

### 1. Install Dependencies
```bash
cd apps/web
pnpm add esbuild-wasm
```

### 2. Initialize esbuild WASM
Create `apps/web/src/lib/bundler/esbuild.ts`:
```typescript
import * as esbuild from 'esbuild-wasm'

let initialized = false

export async function initEsbuild() {
  if (initialized) return

  await esbuild.initialize({
    wasmURL: 'https://unpkg.com/esbuild-wasm@0.20.2/esbuild.wasm',
  })

  initialized = true
}

export { esbuild }
```

### 3. Create Virtual File System Plugin
Create `apps/web/src/lib/bundler/plugins.ts`:
```typescript
import type { Plugin } from 'esbuild-wasm'

// React and ReactDOM as external dependencies loaded in iframe
const EXTERNALS = {
  react: 'React',
  'react-dom': 'ReactDOM',
  'react-dom/client': 'ReactDOM',
}

// Base imports that are available in preview
const AVAILABLE_IMPORTS = `
import React from 'react';
import { createRoot } from 'react-dom/client';
`

export function createUnpkgPlugin(): Plugin {
  return {
    name: 'unpkg',
    setup(build) {
      // Handle external packages
      build.onResolve({ filter: /^react(-dom)?/ }, (args) => ({
        path: args.path,
        namespace: 'external',
      }))

      build.onLoad({ filter: /.*/, namespace: 'external' }, (args) => ({
        contents: `module.exports = window.${EXTERNALS[args.path as keyof typeof EXTERNALS]}`,
        loader: 'js',
      }))

      // Handle other npm packages via unpkg
      build.onResolve({ filter: /^[^./]/ }, (args) => ({
        path: `https://unpkg.com/${args.path}`,
        namespace: 'unpkg',
      }))

      build.onLoad({ filter: /.*/, namespace: 'unpkg' }, async (args) => {
        try {
          const response = await fetch(args.path)
          if (!response.ok) throw new Error(`Failed to fetch ${args.path}`)

          let contents = await response.text()

          // Handle CSS imports in packages
          if (args.path.endsWith('.css')) {
            return { contents, loader: 'css' }
          }

          return { contents, loader: 'jsx' }
        } catch (error) {
          return {
            contents: `console.warn('Failed to load: ${args.path}')`,
            loader: 'js',
          }
        }
      })
    },
  }
}

export function createVirtualFsPlugin(files: Record<string, string>): Plugin {
  return {
    name: 'virtual-fs',
    setup(build) {
      // Resolve virtual files
      build.onResolve({ filter: /^\./ }, (args) => {
        const path = args.path.replace(/^\.\//, '')
        if (files[path] || files[`${path}.tsx`] || files[`${path}.ts`]) {
          return { path, namespace: 'virtual' }
        }
        return null
      })

      // Load virtual files
      build.onLoad({ filter: /.*/, namespace: 'virtual' }, (args) => {
        const content = files[args.path] ||
          files[`${args.path}.tsx`] ||
          files[`${args.path}.ts`]

        if (content) {
          return {
            contents: content,
            loader: args.path.endsWith('.css') ? 'css' : 'tsx',
          }
        }

        return { contents: '', loader: 'tsx' }
      })
    },
  }
}
```

### 4. Create Bundler Service
Create `apps/web/src/lib/bundler/index.ts`:
```typescript
import { initEsbuild, esbuild } from './esbuild'
import { createUnpkgPlugin, createVirtualFsPlugin } from './plugins'

interface BundleResult {
  code: string
  error?: string
}

// HTML template for the preview iframe
function createPreviewHtml(bundledCode: string, styles: string = ''): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; }
    ${styles}
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    (function() {
      const originalError = console.error;
      console.error = (...args) => {
        window.parent.postMessage({ type: 'error', message: args.join(' ') }, '*');
        originalError.apply(console, args);
      };
      window.onerror = (msg, source, line, col, error) => {
        window.parent.postMessage({
          type: 'error',
          message: msg,
          source,
          line,
          col
        }, '*');
      };
    })();

    try {
      ${bundledCode}
    } catch (error) {
      document.getElementById('root').innerHTML =
        '<div style="color: red; padding: 20px;">' +
        '<h2>Error</h2><pre>' + error.message + '</pre></div>';
      window.parent.postMessage({ type: 'error', message: error.message }, '*');
    }
  </script>
</body>
</html>
`
}

// Entry point wrapper
function createEntryPoint(code: string): string {
  // Check if code exports default component
  const hasDefaultExport = /export\s+default/.test(code)

  if (hasDefaultExport) {
    return `
${code}

import { createRoot } from 'react-dom/client';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(React.createElement(App));
}
`
  }

  // If no default export, assume code renders itself
  return code
}

export async function bundleCode(code: string): Promise<BundleResult> {
  try {
    await initEsbuild()

    // Wrap code with entry point
    const entryCode = createEntryPoint(code)

    const result = await esbuild.build({
      entryPoints: ['entry.tsx'],
      bundle: true,
      write: false,
      format: 'iife',
      target: 'es2020',
      jsx: 'automatic',
      jsxImportSource: 'react',
      plugins: [
        createUnpkgPlugin(),
        createVirtualFsPlugin({
          'entry.tsx': entryCode,
        }),
      ],
      define: {
        'process.env.NODE_ENV': '"development"',
      },
    })

    const bundledCode = result.outputFiles?.[0]?.text || ''

    return { code: bundledCode }
  } catch (error) {
    return {
      code: '',
      error: error instanceof Error ? error.message : 'Bundle failed',
    }
  }
}

export function createPreviewBlobUrl(code: string, styles?: string): string {
  const html = createPreviewHtml(code, styles)
  const blob = new Blob([html], { type: 'text/html' })
  return URL.createObjectURL(blob)
}
```

### 5. Create usePreview Hook
Create `apps/web/src/hooks/usePreview.ts`:
```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import { bundleCode, createPreviewBlobUrl } from '../lib/bundler'

interface PreviewState {
  url: string | null
  error: string | null
  isLoading: boolean
}

interface PreviewError {
  type: 'error'
  message: string
  source?: string
  line?: number
}

export function usePreview(code: string | undefined) {
  const [state, setState] = useState<PreviewState>({
    url: null,
    error: null,
    isLoading: false,
  })

  const previousUrlRef = useRef<string | null>(null)
  const debounceTimerRef = useRef<number>()

  // Listen for errors from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent<PreviewError>) => {
      if (event.data?.type === 'error') {
        setState((prev) => ({
          ...prev,
          error: event.data.message,
        }))
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Bundle and create preview URL
  const updatePreview = useCallback(async (sourceCode: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const result = await bundleCode(sourceCode)

      if (result.error) {
        setState({
          url: null,
          error: result.error,
          isLoading: false,
        })
        return
      }

      // Revoke previous blob URL
      if (previousUrlRef.current) {
        URL.revokeObjectURL(previousUrlRef.current)
      }

      const url = createPreviewBlobUrl(result.code)
      previousUrlRef.current = url

      setState({
        url,
        error: null,
        isLoading: false,
      })
    } catch (error) {
      setState({
        url: null,
        error: error instanceof Error ? error.message : 'Failed to build preview',
        isLoading: false,
      })
    }
  }, [])

  // Debounced code update
  useEffect(() => {
    if (!code) {
      setState({ url: null, error: null, isLoading: false })
      return
    }

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Debounce to avoid rebuilding on every keystroke
    debounceTimerRef.current = window.setTimeout(() => {
      updatePreview(code)
    }, 500)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [code, updatePreview])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previousUrlRef.current) {
        URL.revokeObjectURL(previousUrlRef.current)
      }
    }
  }, [])

  const refresh = useCallback(() => {
    if (code) {
      updatePreview(code)
    }
  }, [code, updatePreview])

  return {
    ...state,
    refresh,
  }
}
```

### 6. Create Preview Frame Component
Create `apps/web/src/components/preview/PreviewFrame.tsx`:
```typescript
import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@hatch/ui'

interface PreviewFrameProps {
  url: string
  className?: string
}

export function PreviewFrame({ url, className }: PreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Force reload when URL changes
  useEffect(() => {
    if (iframeRef.current && url) {
      iframeRef.current.src = url
    }
  }, [url])

  return (
    <motion.iframe
      ref={iframeRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      src={url}
      title="App Preview"
      sandbox="allow-scripts allow-modals"
      className={cn(
        'w-full h-full bg-white rounded-lg',
        className
      )}
    />
  )
}
```

### 7. Create Preview Error Component
Create `apps/web/src/components/preview/PreviewError.tsx`:
```typescript
import { cn } from '@hatch/ui'

interface PreviewErrorProps {
  error: string
  className?: string
}

export function PreviewError({ error, className }: PreviewErrorProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center h-full p-6 text-center',
      className
    )}>
      <div className="w-12 h-12 rounded-full bg-accent-red/10 flex items-center justify-center mb-4">
        <span className="text-2xl">⚠️</span>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Preview Error</h3>
      <pre className="text-sm text-accent-red bg-bg-tertiary rounded-lg p-4 max-w-full overflow-x-auto whitespace-pre-wrap">
        {error}
      </pre>
    </div>
  )
}
```

### 8. Create Preview Loading Component
Create `apps/web/src/components/preview/PreviewLoading.tsx`:
```typescript
import { motion } from 'framer-motion'

export function PreviewLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full"
      />
      <p className="mt-4 text-gray-500 text-sm">Building preview...</p>
    </div>
  )
}
```

### 9. Create Preview Panel Component
Create `apps/web/src/components/preview/PreviewPanel.tsx`:
```typescript
import { Button, Badge, Panel, PanelHeader, PanelContent } from '@hatch/ui'
import { usePreview } from '../../hooks/usePreview'
import { useProjectStore } from '../../stores/projectStore'
import { PreviewFrame } from './PreviewFrame'
import { PreviewError } from './PreviewError'
import { PreviewLoading } from './PreviewLoading'

export function PreviewPanel() {
  const { currentProject } = useProjectStore()
  const { url, error, isLoading, refresh } = usePreview(currentProject?.code)

  const handleOpenInNewTab = () => {
    if (url) {
      window.open(url, '_blank')
    }
  }

  return (
    <Panel className="h-full border-l">
      <PanelHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-400">Preview</h3>
          {isLoading && (
            <Badge variant="info" size="sm">Building...</Badge>
          )}
          {url && !isLoading && !error && (
            <Badge variant="success" size="sm">Live</Badge>
          )}
          {error && (
            <Badge variant="danger" size="sm">Error</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refresh} disabled={isLoading}>
            ↻
          </Button>
          <Button variant="ghost" size="sm" onClick={handleOpenInNewTab} disabled={!url}>
            ↗
          </Button>
        </div>
      </PanelHeader>

      <PanelContent className="bg-bg-primary">
        {!currentProject?.code ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            Generate some code to see the preview
          </div>
        ) : isLoading ? (
          <PreviewLoading />
        ) : error ? (
          <PreviewError error={error} />
        ) : url ? (
          <PreviewFrame url={url} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            No preview available
          </div>
        )}
      </PanelContent>
    </Panel>
  )
}
```

### 10. Create Project Store (for code state)
Create `apps/web/src/stores/projectStore.ts`:
```typescript
import { create } from 'zustand'

interface Project {
  id: string
  name: string
  code?: string
  deploymentUrl?: string
  tokenAddress?: string
  status: 'draft' | 'deployed' | 'launched'
}

interface ProjectState {
  currentProject: Project | null
  projects: Project[]
  setCurrentProject: (project: Project | null) => void
  updateProjectCode: (code: string) => void
  addProject: (project: Project) => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  projects: [],

  setCurrentProject: (currentProject) => set({ currentProject }),

  updateProjectCode: (code) => {
    const { currentProject } = get()
    if (currentProject) {
      set({
        currentProject: { ...currentProject, code },
      })
    }
  },

  addProject: (project) => {
    set((state) => ({
      projects: [...state.projects, project],
    }))
  },
}))
```

## Directory Structure
```
apps/web/src/
├── lib/
│   └── bundler/
│       ├── index.ts
│       ├── esbuild.ts
│       └── plugins.ts
├── components/
│   └── preview/
│       ├── PreviewPanel.tsx
│       ├── PreviewFrame.tsx
│       ├── PreviewError.tsx
│       └── PreviewLoading.tsx
├── hooks/
│   └── usePreview.ts
└── stores/
    └── projectStore.ts
```

## Definition of Done
- [ ] esbuild-wasm initialized and working
- [ ] Generated React code compiles successfully
- [ ] Preview renders in iframe
- [ ] Hot reload works (updates within ~500ms of code change)
- [ ] Errors display gracefully
- [ ] Refresh button works
- [ ] Open in new tab works
- [ ] Performance acceptable (<2s for initial build)

## Technical Notes

### Supported Features
- React 18 functional components
- Hooks (useState, useEffect, etc.)
- TailwindCSS (loaded via CDN in iframe)
- Basic npm packages via unpkg

### Limitations
- No server-side code (API routes, database)
- Limited npm package support (must be ESM compatible)
- No file system access

### Performance Optimization
- Debounce code changes (500ms)
- Cache esbuild WASM initialization
- Reuse blob URLs when possible
- Consider Web Workers for bundling (future)

## Testing
```typescript
// Test code samples
const todoApp = `
export default function App() {
  const [todos, setTodos] = React.useState([]);
  const [input, setInput] = React.useState('');

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, { id: Date.now(), text: input }]);
      setInput('');
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Todo App</h1>
      <div className="flex gap-2 mb-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 border rounded px-3 py-2"
          placeholder="Add todo..."
        />
        <button onClick={addTodo} className="bg-blue-500 text-white px-4 py-2 rounded">
          Add
        </button>
      </div>
      <ul className="space-y-2">
        {todos.map((todo) => (
          <li key={todo.id} className="p-2 bg-gray-100 rounded">{todo.text}</li>
        ))}
      </ul>
    </div>
  );
}
`;
```
