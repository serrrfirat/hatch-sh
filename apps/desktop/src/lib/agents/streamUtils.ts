import type { StreamEvent } from './types'

const STREAM_INTERRUPTED_SUFFIX = '[Stream interrupted — click Retry]'

export interface JsonParseResult {
  value: unknown | null
  errorEvent?: StreamEvent
}

export interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  shouldRetry?: (error: unknown) => boolean
  sleep?: (ms: number) => Promise<void>
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export function createLineBuffer() {
  let buffered = ''

  return {
    pushChunk(chunk: string): string[] {
      if (!chunk) return []

      const combined = buffered + chunk
      const lines = combined.split(/\r?\n/)
      buffered = lines.pop() ?? ''
      return lines.filter((line) => line.length > 0)
    },
    flush(): string[] {
      if (!buffered) return []
      const final = buffered
      buffered = ''
      return [final]
    },
  }
}

export function safeParseJsonLine(line: string, source: string): JsonParseResult {
  const trimmedLine = line.trim()
  if (!trimmedLine) {
    return { value: null }
  }

  try {
    const firstPass = JSON.parse(trimmedLine) as unknown

    if (typeof firstPass === 'string') {
      const wrapped = firstPass.trim()
      if (wrapped.startsWith('{') || wrapped.startsWith('[')) {
        try {
          return { value: JSON.parse(wrapped) as unknown }
        } catch { /* fall through to return firstPass as-is */ }
      }
    }

    return { value: firstPass }
  } catch {
    console.warn(`[${source}] Malformed JSON line:`, trimmedLine)
    return {
      value: null,
      errorEvent: {
        type: 'error',
        content: `${source} stream emitted malformed JSON`,
      },
    }
  }
}

export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3
  const baseDelayMs = options?.baseDelayMs ?? 1000
  const shouldRetry = options?.shouldRetry ?? (() => true)
  const sleep = options?.sleep ?? defaultSleep

  let attempt = 0

  while (attempt <= maxRetries) {
    try {
      return await operation()
    } catch (error) {
      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error
      }

      const delayMs = baseDelayMs * Math.pow(2, attempt)
      options?.onRetry?.(attempt + 1, delayMs, error)
      await sleep(delayMs)
      attempt += 1
    }
  }

  throw new Error('Retry loop terminated unexpectedly')
}

export function appendStreamInterruptedNotice(content: string): string {
  const trimmed = content.trimEnd()
  if (!trimmed) {
    return STREAM_INTERRUPTED_SUFFIX
  }

  if (trimmed.endsWith(STREAM_INTERRUPTED_SUFFIX)) {
    return trimmed
  }

  return `${trimmed}\n\n${STREAM_INTERRUPTED_SUFFIX}`
}
