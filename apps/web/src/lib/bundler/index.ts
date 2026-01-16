import { initEsbuild, esbuild } from './esbuild'
import { createUnpkgPlugin, createVirtualFsPlugin } from './plugins'

export interface BundleResult {
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
      var PREVIEW_SOURCE = 'vibed-preview';
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
      window.parent.postMessage({ type: 'error', source: 'vibed-preview', message: error.message }, '*');
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
  const hasDefaultExport = /export\s+default/.test(code)
  return hasDefaultExport ? code : null
}

export async function bundleCode(code: string): Promise<BundleResult> {
  try {
    await initEsbuild()

    // Wrap code with entry point
    const entryCode = createEntryPoint(code)
    const userCode = getUserCode(code)

    // Build virtual filesystem with entry point and optionally user code
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
      plugins: [
        createUnpkgPlugin(),
        createVirtualFsPlugin(virtualFiles),
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
