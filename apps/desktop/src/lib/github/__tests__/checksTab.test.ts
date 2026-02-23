import { describe, it, expect } from 'vitest'
import { buildRerunCommand, getStatusIcon, parseWorkflowRuns } from '../checks'

describe('parseWorkflowRuns', () => {
  it('parses valid gh run list output', () => {
    const json = JSON.stringify([
      {
        name: 'CI',
        status: 'completed',
        conclusion: 'success',
        databaseId: 101,
        headBranch: 'feature/checks-tab',
      },
      {
        name: 'Lint',
        status: 'in_progress',
        conclusion: null,
        databaseId: 102,
        headBranch: 'feature/checks-tab',
      },
    ])

    expect(parseWorkflowRuns(json)).toEqual([
      {
        name: 'CI',
        status: 'completed',
        conclusion: 'success',
        databaseId: 101,
        headBranch: 'feature/checks-tab',
      },
      {
        name: 'Lint',
        status: 'in_progress',
        conclusion: null,
        databaseId: 102,
        headBranch: 'feature/checks-tab',
      },
    ])
  })

  it('returns empty array for invalid JSON', () => {
    expect(parseWorkflowRuns('not-json')).toEqual([])
  })

  it('filters out malformed runs', () => {
    const json = JSON.stringify([
      {
        name: 'Valid Run',
        status: 'queued',
        conclusion: null,
        databaseId: 777,
        headBranch: 'main',
      },
      {
        name: 'Missing ID',
        status: 'completed',
        conclusion: 'success',
        headBranch: 'main',
      },
      {
        name: 123,
        status: 'completed',
        conclusion: 'failure',
        databaseId: 778,
        headBranch: 'main',
      },
    ])

    expect(parseWorkflowRuns(json)).toEqual([
      {
        name: 'Valid Run',
        status: 'queued',
        conclusion: null,
        databaseId: 777,
        headBranch: 'main',
      },
    ])
  })
})

describe('getStatusIcon', () => {
  it('returns success icon for completed successful runs', () => {
    expect(getStatusIcon('completed', 'success')).toBe('✅')
  })

  it('returns failure icon for completed failed runs', () => {
    expect(getStatusIcon('completed', 'failure')).toBe('❌')
    expect(getStatusIcon('completed', 'timed_out')).toBe('❌')
    expect(getStatusIcon('completed', 'cancelled')).toBe('❌')
  })

  it('returns in-progress icon for active runs', () => {
    expect(getStatusIcon('in_progress', null)).toBe('🔄')
  })

  it('returns queued icon for queued runs', () => {
    expect(getStatusIcon('queued', null)).toBe('⏸')
  })

  it('falls back to in-progress icon for unknown state', () => {
    expect(getStatusIcon('waiting', null)).toBe('🔄')
  })
})

describe('buildRerunCommand', () => {
  it('builds gh rerun command with the run id', () => {
    expect(buildRerunCommand(12345)).toBe('gh run rerun 12345')
  })
})
