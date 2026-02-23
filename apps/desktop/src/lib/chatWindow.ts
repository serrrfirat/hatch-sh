import type { Message } from '../stores/chatStore'

export function windowMessages(messages: Message[], windowSize: number): Message[] {
  if (messages.length === 0) {
    return []
  }

  const firstMessage = messages[0]
  const isFirstMessageSystem = firstMessage.role === 'system'

  if (isFirstMessageSystem) {
    if (windowSize === 0) {
      return [firstMessage]
    }
    if (messages.length <= windowSize) {
      return messages
    }
    const remainingMessages = messages.slice(1)
    const windowedRemaining = remainingMessages.slice(-windowSize)
    return [firstMessage, ...windowedRemaining]
  }

  if (messages.length <= windowSize) {
    return messages
  }

  return messages.slice(-windowSize)
}

export function getDroppedMessages(messages: Message[], windowSize: number): Message[] {
  if (messages.length === 0) {
    return []
  }

  const firstMessage = messages[0]
  const isFirstMessageSystem = firstMessage.role === 'system'

  if (isFirstMessageSystem) {
    const remainingMessages = messages.slice(1)
    if (remainingMessages.length <= windowSize) {
      return []
    }
    return remainingMessages.slice(0, remainingMessages.length - windowSize)
  }

  if (messages.length <= windowSize) {
    return []
  }

  return messages.slice(0, messages.length - windowSize)
}
