import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useToastStore } from '../toastStore'

describe('toastStore', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('showToast adds a toast to the store', () => {
    const { showToast } = useToastStore.getState()
    const id = showToast({
      message: 'Test message',
      type: 'info',
      dismissTimeout: 5000,
    })

    const updatedToasts = useToastStore.getState().toasts

    expect(id).toBeDefined()
    expect(updatedToasts).toHaveLength(1)
    expect(updatedToasts[0].message).toBe('Test message')
    expect(updatedToasts[0].type).toBe('info')
    expect(updatedToasts[0].id).toBe(id)
  })

  it('dismissToast removes a toast from the store', () => {
    const { showToast, dismissToast } = useToastStore.getState()
    const id = showToast({
      message: 'Test message',
      type: 'success',
      dismissTimeout: 5000,
    })

    expect(useToastStore.getState().toasts).toHaveLength(1)

    dismissToast(id)

    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('undoToast calls the undoCallback and removes the toast', () => {
    const undoCallback = vi.fn()
    const { showToast, undoToast } = useToastStore.getState()

    const id = showToast({
      message: 'Action performed',
      type: 'success',
      dismissTimeout: 5000,
      undoCallback,
    })

    expect(useToastStore.getState().toasts).toHaveLength(1)

    undoToast(id)

    expect(undoCallback).toHaveBeenCalled()
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('multiple toasts can coexist in the store', () => {
    const { showToast, dismissToast } = useToastStore.getState()

    const id1 = showToast({
      message: 'First toast',
      type: 'info',
      dismissTimeout: 5000,
    })

    const id2 = showToast({
      message: 'Second toast',
      type: 'success',
      dismissTimeout: 5000,
    })

    const id3 = showToast({
      message: 'Third toast',
      type: 'warning',
      dismissTimeout: 5000,
    })

    expect(useToastStore.getState().toasts).toHaveLength(3)
    expect(useToastStore.getState().toasts[0].id).toBe(id1)
    expect(useToastStore.getState().toasts[1].id).toBe(id2)
    expect(useToastStore.getState().toasts[2].id).toBe(id3)

    dismissToast(id2)

    expect(useToastStore.getState().toasts).toHaveLength(2)
    expect(useToastStore.getState().toasts.map((t) => t.id)).toEqual([id1, id3])
  })
})
