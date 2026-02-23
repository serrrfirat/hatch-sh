import { describe, expect, it } from 'vitest'
import type { Plugin } from 'esbuild-wasm'
import { createVirtualFsPlugin } from '../plugins'

interface ResolveArgs {
  path: string
  importer: string
}

interface ResolvedPath {
  path: string
  namespace: string
}

function toResolvedPath(result: unknown): ResolvedPath {
  if (!result || typeof result !== 'object') {
    throw new Error('Expected resolver to return an object')
  }

  const maybePath = (result as { path?: unknown }).path
  const maybeNamespace = (result as { namespace?: unknown }).namespace

  if (typeof maybePath !== 'string' || typeof maybeNamespace !== 'string') {
    throw new Error('Resolver returned invalid path payload')
  }

  return {
    path: maybePath,
    namespace: maybeNamespace,
  }
}

function createRelativeResolver(files: Record<string, string>) {
  const plugin = createVirtualFsPlugin(files)
  const resolveHandlers: Array<{
    filter: RegExp
    callback: (args: ResolveArgs) => unknown
  }> = []

  const build = {
    onResolve(
      options: { filter: RegExp; namespace?: string },
      callback: (args: ResolveArgs) => unknown
    ) {
      resolveHandlers.push({ filter: options.filter, callback })
    },
    onLoad() {
      return
    },
  }

  plugin.setup(build as unknown as Parameters<Plugin['setup']>[0])

  const relativeHandler = resolveHandlers.find((handler) => handler.filter.test('./local'))
  if (!relativeHandler) {
    throw new Error('Relative resolver was not registered')
  }

  return async (path: string, importer: string): Promise<ResolvedPath | null> => {
    const output = await Promise.resolve(relativeHandler.callback({ path, importer }))
    if (!output) {
      return null
    }
    return toResolvedPath(output)
  }
}

describe('createVirtualFsPlugin', () => {
  it('resolves extensionless relative imports to ts files', async () => {
    const resolve = createRelativeResolver({
      'src/App.tsx': 'export default function App() { return null }',
      'src/utils.ts': 'export const value = 1',
    })

    const result = await resolve('./utils', 'src/App.tsx')

    expect(result).toEqual({
      path: 'src/utils.ts',
      namespace: 'virtual',
    })
  })

  it('resolves directory imports to index.tsx files', async () => {
    const resolve = createRelativeResolver({
      'src/App.tsx': 'export default function App() { return null }',
      'src/components/index.tsx': 'export const Button = () => null',
    })

    const result = await resolve('./components', 'src/App.tsx')

    expect(result).toEqual({
      path: 'src/components/index.tsx',
      namespace: 'virtual',
    })
  })

  it('resolves css and json files through extension inference', async () => {
    const resolve = createRelativeResolver({
      'src/App.tsx': 'export default function App() { return null }',
      'src/theme.css': ':root { color: red; }',
      'src/data.json': '{"enabled": true}',
    })

    const cssResult = await resolve('./theme', 'src/App.tsx')
    const jsonResult = await resolve('./data', 'src/App.tsx')

    expect(cssResult).toEqual({
      path: 'src/theme.css',
      namespace: 'virtual',
    })
    expect(jsonResult).toEqual({
      path: 'src/data.json',
      namespace: 'virtual',
    })
  })
})
