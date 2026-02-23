// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatStore } from '../chatStore'

vi.mock('zustand/middleware', () => ({
  persist: <T>(fn: T) => fn,
}))

describe('chatStore workspace routing', () => {
  beforeEach(() => {
    useChatStore.setState({
      messagesByWorkspace: {},
      currentWorkspaceId: null,
      isLoading: false,
      currentProjectId: null,
      pendingOpenPR: null,
      contextWindowSize: 20,
    })
  })

  it('routes addMessage to provided workspace id', () => {
    const state = useChatStore.getState()

    Reflect.apply(state.addMessage, state, [
      {
        role: 'user',
        content: 'workspace-one',
      },
      'ws-1',
    ])

    expect(useChatStore.getState().messagesByWorkspace['ws-1']).toHaveLength(1)
    expect(useChatStore.getState().messagesByWorkspace['ws-1'][0]?.content).toBe('workspace-one')
  })

  it('routes streaming updates to provided workspace id after switching workspace', () => {
    const state = useChatStore.getState()

    Reflect.apply(state.addMessage, state, [
      {
        role: 'assistant',
        content: '',
        isStreaming: true,
      },
      'ws-1',
    ])

    const messageId = useChatStore.getState().messagesByWorkspace['ws-1'][0]?.id
    expect(messageId).toBeTruthy()

    state.setWorkspaceId('ws-2')
    Reflect.apply(state.updateMessage, state, [messageId, 'stream chunk', true, 'ws-1'])

    expect(useChatStore.getState().messagesByWorkspace['ws-1'][0]?.content).toBe('stream chunk')
    expect(useChatStore.getState().messagesByWorkspace['ws-1'][0]?.isStreaming).toBe(true)
  })

  it('tracks active streaming workspaces independently', () => {
    const state = useChatStore.getState()

    Reflect.apply(state.addMessage, state, [
      {
        role: 'assistant',
        content: '',
        isStreaming: true,
      },
      'ws-1',
    ])
    Reflect.apply(state.addMessage, state, [
      {
        role: 'assistant',
        content: '',
        isStreaming: true,
      },
      'ws-2',
    ])

    const ws1MessageId = useChatStore.getState().messagesByWorkspace['ws-1'][0]?.id
    const ws2MessageId = useChatStore.getState().messagesByWorkspace['ws-2'][0]?.id

    Reflect.apply(state.updateMessage, state, [ws1MessageId, 'ws1 streaming', true, 'ws-1'])
    Reflect.apply(state.updateMessage, state, [ws2MessageId, 'ws2 streaming', true, 'ws-2'])

    const afterStart = useChatStore.getState()
    const activeAfterStart = Reflect.get(afterStart, 'activeStreamingWorkspaces') as Set<string>
    expect(activeAfterStart.has('ws-1')).toBe(true)
    expect(activeAfterStart.has('ws-2')).toBe(true)

    Reflect.apply(state.updateMessage, state, [ws1MessageId, 'ws1 done', false, 'ws-1'])

    const afterWs1Complete = useChatStore.getState()
    const activeAfterWs1Complete = Reflect.get(
      afterWs1Complete,
      'activeStreamingWorkspaces'
    ) as Set<string>
    expect(activeAfterWs1Complete.has('ws-1')).toBe(false)
    expect(activeAfterWs1Complete.has('ws-2')).toBe(true)
  })
})
