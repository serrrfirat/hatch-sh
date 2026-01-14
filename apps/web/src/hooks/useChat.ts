import { useCallback, useRef } from 'react'
import { useChatStore } from '../stores/chatStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

export function useChat() {
  const {
    messages,
    isLoading,
    currentProjectId,
    addMessage,
    updateMessage,
    setLoading,
  } = useChatStore()

  const abortControllerRef = useRef<AbortController | null>(null)
  const streamingMessageIdRef = useRef<string | null>(null)

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return

    if (!currentProjectId) {
      console.error('No project selected')
      addMessage({
        role: 'assistant',
        content: 'Please select a project before sending messages.',
      })
      return
    }

    // Add user message
    addMessage({ role: 'user', content })

    // Create placeholder for assistant response
    const assistantMessageId = addMessage({
      role: 'assistant',
      content: '',
      isStreaming: true,
    })
    streamingMessageIdRef.current = assistantMessageId

    setLoading(true)

    try {
      abortControllerRef.current = new AbortController()

      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProjectId,
          message: content,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) throw new Error('Chat request failed')
      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let streamComplete = false

      while (!streamComplete) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.text) {
                fullContent += data.text
                updateMessage(assistantMessageId, fullContent, true)
              }
              if (data.done) {
                streamComplete = true
                break
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      // Mark streaming as complete
      updateMessage(assistantMessageId, fullContent, false)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Keep the partial content but mark as not streaming
        const currentMessages = useChatStore.getState().messages
        const streamingMsg = currentMessages.find(m => m.id === assistantMessageId)
        if (streamingMsg) {
          updateMessage(assistantMessageId, streamingMsg.content || 'Generation stopped.', false)
        }
        return
      }
      updateMessage(assistantMessageId, 'Sorry, an error occurred. Please try again.', false)
      console.error('Chat error:', error)
    } finally {
      setLoading(false)
      streamingMessageIdRef.current = null
    }
  }, [currentProjectId, addMessage, updateMessage, setLoading])

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort()

    // Update the streaming message to mark it as complete
    if (streamingMessageIdRef.current) {
      const currentMessages = useChatStore.getState().messages
      const streamingMsg = currentMessages.find(m => m.id === streamingMessageIdRef.current)
      if (streamingMsg) {
        updateMessage(streamingMessageIdRef.current, streamingMsg.content || 'Generation stopped.', false)
      }
      streamingMessageIdRef.current = null
    }

    setLoading(false)
  }, [setLoading, updateMessage])

  return {
    messages,
    isLoading,
    sendMessage,
    stopGeneration,
  }
}
