// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  estimateRateUsage,
  getRateLimitColor,
  shouldShowWarning,
  estimateAgentMemoryMB,
  shouldShowMemoryWarning,
  formatRateLabel,
  TIER_2_RATE_LIMIT,
  EST_TOKENS_PER_ACTIVE_AGENT,
  EST_TOKENS_PER_MESSAGE,
  EST_MEMORY_PER_AGENT_MB,
  MEMORY_WARNING_THRESHOLD_MB,
} from '../RateLimitMeter'



describe('estimateRateUsage', () => {
  it('returns 0 when no agents are active', () => {
    expect(estimateRateUsage(0, 0)).toBe(0)
  })

  it('returns 0 for negative agent count', () => {
    expect(estimateRateUsage(-1, 5)).toBe(0)
  })

  it('returns percentage based on agent count and messages', () => {
    // 1 agent * 15000 + 0 messages * 4000 = 15000 / 90000 ≈ 17%
    expect(estimateRateUsage(1, 0)).toBe(17)
  })

  it('adds message contribution to estimate', () => {
    // 1 agent * 15000 + 5 messages * 4000 = 35000 / 90000 ≈ 39%
    expect(estimateRateUsage(1, 5)).toBe(39)
  })

  it('caps at 100 for very high usage', () => {
    expect(estimateRateUsage(5, 50)).toBe(100)
  })

  it('scales linearly with agent count', () => {
    const oneAgent = estimateRateUsage(1, 0)
    const twoAgents = estimateRateUsage(2, 0)
    expect(twoAgents).toBeGreaterThan(oneAgent)
    // 2 * 15000 / 90000 ≈ 33%
    expect(twoAgents).toBe(33)
  })

  it('returns 0 for zero agents even with messages', () => {
    expect(estimateRateUsage(0, 10)).toBe(0)
  })

  it('handles fractional agents by treating as zero', () => {
    // 0.5 agents rounds to floor behavior in multiplication
    const result = estimateRateUsage(0.5, 0)
    // 0.5 * 15000 = 7500 / 90000 ≈ 8%
    expect(result).toBe(8)
  })
})



describe('getRateLimitColor', () => {
  it('returns green for 0%', () => {
    expect(getRateLimitColor(0)).toBe('green')
  })

  it('returns green for 49%', () => {
    expect(getRateLimitColor(49)).toBe('green')
  })

  it('returns yellow for 50%', () => {
    expect(getRateLimitColor(50)).toBe('yellow')
  })

  it('returns yellow for 79%', () => {
    expect(getRateLimitColor(79)).toBe('yellow')
  })

  it('returns red for 80%', () => {
    expect(getRateLimitColor(80)).toBe('red')
  })

  it('returns red for 100%', () => {
    expect(getRateLimitColor(100)).toBe('red')
  })
})



describe('shouldShowWarning', () => {
  it('returns false for 0%', () => {
    expect(shouldShowWarning(0)).toBe(false)
  })

  it('returns false for 79%', () => {
    expect(shouldShowWarning(79)).toBe(false)
  })

  it('returns false for 80%', () => {
    expect(shouldShowWarning(80)).toBe(false)
  })

  it('returns true for 81%', () => {
    expect(shouldShowWarning(81)).toBe(true)
  })

  it('returns true for 100%', () => {
    expect(shouldShowWarning(100)).toBe(true)
  })
})



describe('estimateAgentMemoryMB', () => {
  it('returns 0 for 0 agents', () => {
    expect(estimateAgentMemoryMB(0)).toBe(0)
  })

  it('returns ~300MB for 1 agent', () => {
    expect(estimateAgentMemoryMB(1)).toBe(EST_MEMORY_PER_AGENT_MB)
  })

  it('scales linearly with agents', () => {
    expect(estimateAgentMemoryMB(3)).toBe(3 * EST_MEMORY_PER_AGENT_MB)
  })

  it('returns 0 for negative agent count', () => {
    expect(estimateAgentMemoryMB(-1)).toBe(0)
  })
})



describe('shouldShowMemoryWarning', () => {
  it('returns true when available memory is below 1GB', () => {
    expect(shouldShowMemoryWarning(512)).toBe(true)
  })

  it('returns false when available memory is above 1GB', () => {
    expect(shouldShowMemoryWarning(2048)).toBe(false)
  })

  it('returns false when available memory is exactly 1GB', () => {
    expect(shouldShowMemoryWarning(MEMORY_WARNING_THRESHOLD_MB)).toBe(false)
  })

  it('returns true when available memory is 0', () => {
    expect(shouldShowMemoryWarning(0)).toBe(true)
  })
})



describe('formatRateLabel', () => {
  it('formats 0% usage', () => {
    expect(formatRateLabel(0)).toBe('API: ~0% of rate limit')
  })

  it('formats 60% usage', () => {
    expect(formatRateLabel(60)).toBe('API: ~60% of rate limit')
  })

  it('formats 100% usage', () => {
    expect(formatRateLabel(100)).toBe('API: ~100% of rate limit')
  })
})



describe('constants', () => {
  it('TIER_2_RATE_LIMIT is 90000 tokens/min', () => {
    expect(TIER_2_RATE_LIMIT).toBe(90_000)
  })

  it('EST_TOKENS_PER_ACTIVE_AGENT is 15000', () => {
    expect(EST_TOKENS_PER_ACTIVE_AGENT).toBe(15_000)
  })

  it('EST_TOKENS_PER_MESSAGE is 4000', () => {
    expect(EST_TOKENS_PER_MESSAGE).toBe(4_000)
  })

  it('EST_MEMORY_PER_AGENT_MB is 300', () => {
    expect(EST_MEMORY_PER_AGENT_MB).toBe(300)
  })

  it('MEMORY_WARNING_THRESHOLD_MB is 1024', () => {
    expect(MEMORY_WARNING_THRESHOLD_MB).toBe(1024)
  })
})
