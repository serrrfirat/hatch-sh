import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bundleCode, bundleMultiFile } from '../index'
import { esbuild, initEsbuild } from '../esbuild'
import { createVirtualFsPlugin } from '../plugins'

vi.mock('../esbuild', () => ({
  initEsbuild: vi.fn(),
  esbuild: {
    build: vi.fn(),
  },
}))

vi.mock('../plugins', () => ({
  createUnpkgPlugin: vi.fn(() => ({
    name: 'unpkg',
    setup() {
      return
    },
  })),
  createVirtualFsPlugin: vi.fn(() => ({
    name: 'virtual-fs',
    setup() {
      return
    },
  })),
}))

function getVirtualFilesFromFirstCall(): Record<string, string> {
  const firstCall = vi.mocked(createVirtualFsPlugin).mock.calls[0]
  if (!firstCall) {
    throw new Error('createVirtualFsPlugin was not called')
  }
  return firstCall[0]
}

describe('bundleMultiFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(initEsbuild).mockResolvedValue(undefined)
    vi.mocked(esbuild.build).mockResolvedValue({
      outputFiles: [{ text: 'compiled-output' }],
    } as unknown as Awaited<ReturnType<typeof esbuild.build>>)
  })

  it('auto-detects src/App.tsx as entry point and creates wrapper entry file', async () => {
    const files: Record<string, string> = {
      'src/components/Button.tsx': 'export function Button() { return <button>Click</button> }',
      'src/App.tsx': 'export default function App() { return <div><Button /></div> }',
    }

    const result = await bundleMultiFile(files)

    expect(result.error).toBeUndefined()
    expect(result.code).toBe('compiled-output')

    const virtualFiles = getVirtualFilesFromFirstCall()
    expect(virtualFiles['src/App.tsx']).toBe(files['src/App.tsx'])
    expect(virtualFiles['src/components/Button.tsx']).toBe(files['src/components/Button.tsx'])
    expect(virtualFiles['entry.tsx']).toContain("import DefaultComponent from './src/App.tsx';")
  })

  it('uses explicit entryPoint when provided', async () => {
    const files: Record<string, string> = {
      'src/App.tsx': 'export default function App() { return <div>App</div> }',
      'src/main.tsx': 'export default function Main() { return <div>Main</div> }',
    }

    await bundleMultiFile(files, 'src/main.tsx')

    const virtualFiles = getVirtualFilesFromFirstCall()
    expect(virtualFiles['entry.tsx']).toContain("import DefaultComponent from './src/main.tsx';")
  })

  it('accepts a multi-file map through bundleCode for backward compatibility', async () => {
    const files: Record<string, string> = {
      'src/index.tsx': 'export default function App() { return <div>hello</div> }',
    }

    const result = await bundleCode(files)

    expect(result.error).toBeUndefined()
    expect(result.code).toBe('compiled-output')

    const virtualFiles = getVirtualFilesFromFirstCall()
    expect(virtualFiles['entry.tsx']).toContain("import DefaultComponent from './src/index.tsx';")
  })
})
