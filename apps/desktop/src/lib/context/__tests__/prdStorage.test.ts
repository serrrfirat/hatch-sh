import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', () => ({
  mkdir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  BaseDirectory: { AppLocalData: 'AppLocalData' },
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { mkdir, readTextFile, writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { invoke } from '@tauri-apps/api/core'
import type { PRDDocument } from '../types'
import {
  savePRDToAppData,
  loadPRDFromAppData,
  copyPRDToWorkspace,
  loadPRDFromWorkspace,
} from '../prdStorage'

function makeSamplePRD(overrides: Partial<PRDDocument> = {}): PRDDocument {
  return {
    id: 'prd-123',
    version: 1,
    createdAt: '2026-02-24T00:00:00.000Z',
    updatedAt: '2026-02-24T00:00:00.000Z',
    plan: {
      type: 'plan',
      id: 'plan-1',
      summary: 'Test plan',
      requirements: ['req-1'],
      sourceIdeaIds: ['idea-1'],
    },
    dependencyGraph: [],
    contradictions: [],
    scopeExclusions: [],
    acceptanceCriteria: [],
    metadata: {
      sourceMoodboardId: 'mb-1',
      generatedFrom: 'plan-1',
      nodeCount: 5,
      connectionCount: 3,
    },
    ...overrides,
  }
}

describe('prdStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('savePRDToAppData', () => {
    it('calls mkdir and writeTextFile with correct path and JSON', async () => {
      const prd = makeSamplePRD()

      await savePRDToAppData('mb-1', prd)

      expect(vi.mocked(mkdir)).toHaveBeenCalledWith('idea-maze/prd', {
        baseDir: BaseDirectory.AppLocalData,
        recursive: true,
      })
      expect(vi.mocked(writeTextFile)).toHaveBeenCalledWith(
        'idea-maze/prd/mb-1.json',
        JSON.stringify(prd, null, 2),
        { baseDir: BaseDirectory.AppLocalData }
      )
    })
  })

  describe('loadPRDFromAppData', () => {
    it('returns parsed PRDDocument on success', async () => {
      const prd = makeSamplePRD()
      vi.mocked(readTextFile).mockResolvedValueOnce(JSON.stringify(prd))

      const result = await loadPRDFromAppData('mb-1')

      expect(vi.mocked(readTextFile)).toHaveBeenCalledWith('idea-maze/prd/mb-1.json', {
        baseDir: BaseDirectory.AppLocalData,
      })
      expect(result).toEqual(prd)
    })

    it('returns null when file not found', async () => {
      vi.mocked(readTextFile).mockRejectedValueOnce(new Error('File not found'))

      const result = await loadPRDFromAppData('nonexistent')

      expect(result).toBeNull()
    })

    it('returns null and warns when JSON is corrupted', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.mocked(readTextFile).mockResolvedValueOnce('{ invalid json !!!')

      const result = await loadPRDFromAppData('mb-corrupt')

      expect(result).toBeNull()
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to parse PRD'))
      warnSpy.mockRestore()
    })
  })

  describe('copyPRDToWorkspace', () => {
    it('calls invoke with correct args', async () => {
      const prd = makeSamplePRD()
      vi.mocked(invoke).mockResolvedValueOnce(undefined)

      await copyPRDToWorkspace(prd, '/workspace/path')

      expect(vi.mocked(invoke)).toHaveBeenCalledWith('write_project_files', {
        baseDir: '/workspace/path',
        files: [
          {
            path: '.hatch/context/prd.json',
            content: JSON.stringify(prd, null, 2),
          },
        ],
      })
    })
  })

  describe('loadPRDFromWorkspace', () => {
    it('returns parsed PRDDocument on success', async () => {
      const prd = makeSamplePRD()
      vi.mocked(invoke).mockResolvedValueOnce({ content: JSON.stringify(prd) })

      const result = await loadPRDFromWorkspace('/workspace/path')

      expect(vi.mocked(invoke)).toHaveBeenCalledWith('read_file', {
        filePath: '/workspace/path/.hatch/context/prd.json',
      })
      expect(result).toEqual(prd)
    })

    it('returns null on error', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('File not found'))

      const result = await loadPRDFromWorkspace('/workspace/path')

      expect(result).toBeNull()
    })
  })
})
