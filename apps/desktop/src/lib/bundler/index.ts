import { initEsbuild, esbuild } from './esbuild'
import { createUnpkgPlugin, createVirtualFsPlugin } from './plugins'

export interface BundleResult {
  code: string
  error?: string
}

const ENTRY_POINT_CANDIDATES = [
  'App.tsx',
  'App.jsx',
  'index.tsx',
  'index.jsx',
  'main.tsx',
  'main.jsx',
]

function normalizeFilePath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
}

function hasDefaultExport(code: string): boolean {
  return /export\s+default/.test(code)
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
      var PREVIEW_SOURCE = 'hatch-preview';
      var originalError = console.error;
      console.error = function() {
        var args = Array.prototype.slice.call(arguments);
        window.parent.postMessage({ type: 'error', source: PREVIEW_SOURCE, message: args.join(' ') }, '*');
        originalError.apply(console, args);
      };
      window.onerror = function(msg, src, line, col, error) {
        window.parent.postMessage({
          type: 'error',
          source: PREVIEW_SOURCE,
          message: msg,
          file: src,
          line: line,
          col: col
        }, '*');
      };
    })();

    try {
      ${bundledCode}
    } catch (error) {
      var errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'color: red; padding: 20px;';
      var heading = document.createElement('h2');
      heading.textContent = 'Error';
      var pre = document.createElement('pre');
      pre.textContent = error.message;
      errorDiv.appendChild(heading);
      errorDiv.appendChild(pre);
      document.getElementById('root').innerHTML = '';
      document.getElementById('root').appendChild(errorDiv);
      window.parent.postMessage({ type: 'error', source: 'hatch-preview', message: error.message }, '*');
    }
  </script>
</body>
</html>
`
}

// Entry point wrapper
function createEntryPoint(code: string): string {
  if (hasDefaultExport(code)) {
    // Use a wrapper module approach that imports the default export
    // This works regardless of what the component is named
    return `
import DefaultComponent from './user-code';
import { createRoot } from 'react-dom/client';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(React.createElement(DefaultComponent));
}
`
  }

  // If no default export, assume code renders itself
  return code
}

// Get the user's code separately for the virtual filesystem
function getUserCode(code: string): string | null {
  return hasDefaultExport(code) ? code : null
}

function createModuleEntryPoint(modulePath: string, moduleCode: string): string {
  const normalizedPath = normalizeFilePath(modulePath)

  if (hasDefaultExport(moduleCode)) {
    return `
import DefaultComponent from './${normalizedPath}';
import { createRoot } from 'react-dom/client';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(React.createElement(DefaultComponent));
}
`
  }

  return `import './${normalizedPath}'`
}

function normalizeFiles(files: Record<string, string>): Record<string, string> {
  const normalizedFiles: Record<string, string> = {}

  for (const [filePath, content] of Object.entries(files)) {
    const normalizedPath = normalizeFilePath(filePath)
    if (!normalizedPath) {
      continue
    }
    normalizedFiles[normalizedPath] = content
  }

  return normalizedFiles
}

function findCandidateEntryPoint(files: Record<string, string>): string | null {
  const filePaths = Object.keys(files)

  for (const candidate of ENTRY_POINT_CANDIDATES) {
    if (files[candidate] !== undefined) {
      return candidate
    }

    const nestedMatches = filePaths.filter((filePath) => filePath.endsWith(`/${candidate}`))
    if (nestedMatches.length > 0) {
      nestedMatches.sort(
        (first, second) => first.length - second.length || first.localeCompare(second)
      )
      return nestedMatches[0] || null
    }
  }

  return null
}

function resolveEntryPoint(files: Record<string, string>, entryPoint?: string): string | null {
  if (entryPoint) {
    const normalizedEntryPoint = normalizeFilePath(entryPoint)
    return files[normalizedEntryPoint] !== undefined ? normalizedEntryPoint : null
  }

  return findCandidateEntryPoint(files)
}

async function bundleSingleFile(code: string): Promise<BundleResult> {
  await initEsbuild()

  const entryCode = createEntryPoint(code)
  const userCode = getUserCode(code)

  const virtualFiles: Record<string, string> = {
    'entry.tsx': entryCode,
  }

  if (userCode) {
    virtualFiles['user-code.tsx'] = userCode
  }

  const result = await esbuild.build({
    entryPoints: ['entry.tsx'],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2020',
    jsx: 'automatic',
    jsxImportSource: 'react',
    plugins: [createUnpkgPlugin(), createVirtualFsPlugin(virtualFiles)],
    define: {
      'process.env.NODE_ENV': '"development"',
    },
  })

  const bundledCode = result.outputFiles?.[0]?.text || ''

  return { code: bundledCode }
}

export async function bundleMultiFile(
  files: Record<string, string>,
  entryPoint?: string
): Promise<BundleResult> {
  try {
    await initEsbuild()

    const normalizedFiles = normalizeFiles(files)
    if (Object.keys(normalizedFiles).length === 0) {
      return {
        code: '',
        error: 'No files provided for bundling',
      }
    }

    const selectedEntryPoint = resolveEntryPoint(normalizedFiles, entryPoint)
    if (!selectedEntryPoint) {
      return {
        code: '',
        error: `Entry point not found. Expected one of: ${ENTRY_POINT_CANDIDATES.join(', ')}`,
      }
    }

    const selectedEntryCode = normalizedFiles[selectedEntryPoint]
    if (selectedEntryCode === undefined) {
      return {
        code: '',
        error: `Entry point file not found: ${selectedEntryPoint}`,
      }
    }

    const virtualFiles: Record<string, string> = {
      ...normalizedFiles,
      'entry.tsx': createModuleEntryPoint(selectedEntryPoint, selectedEntryCode),
    }

    const result = await esbuild.build({
      entryPoints: ['entry.tsx'],
      bundle: true,
      write: false,
      format: 'iife',
      target: 'es2020',
      jsx: 'automatic',
      jsxImportSource: 'react',
      plugins: [createUnpkgPlugin(), createVirtualFsPlugin(virtualFiles)],
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

export async function bundleCode(code: string): Promise<BundleResult>
export async function bundleCode(files: Record<string, string>): Promise<BundleResult>
export async function bundleCode(input: string | Record<string, string>): Promise<BundleResult> {
  try {
    if (typeof input === 'string') {
      return await bundleSingleFile(input)
    }

    return await bundleMultiFile(input)
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
