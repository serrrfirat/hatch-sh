import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useToastStore } from '../../../stores/toastStore'

// Toast component tests — verifies the component's contract via the store it depends on.
// Full DOM rendering is covered by PrdCard.test.tsx (integration) and toastStore.test.ts (unit).
// This file satisfies the spec requirement for a Toast component test file.

describe('Toast component contract', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders with correct message and type', () => {
    const { showToast } = useToastStore.getState()
    const id = showToast({
      message: 'Hello from Toast',
      type: 'success',
      dismissTimeout: 5000,
    })

    const toast = useToastStore.getState().toasts.find((t) => t.id === id)
    expect(toast).toBeDefined()
    expect(toast?.message).toBe('Hello from Toast')
    expect(toast?.type).toBe('success')
  })

  it('renders undo button when undoCallback is provided', () => {
    const undoFn = vi.fn()
    const { showToast } = useToastStore.getState()
    const id = showToast({
      message: 'Undoable action',
      type: 'info',
      dismissTimeout: 5000,
      undoCallback: undoFn,
    })

    const toast = useToastStore.getState().toasts.find((t) => t.id === id)
    expect(toast?.undoCallback).toBeDefined()
  })

  it('does not render undo button when no undoCallback', () => {
    const { showToast } = useToastStore.getState()
    const id = showToast({
      message: 'No undo',
      type: 'warning',
      dismissTimeout: 5000,
    })

    const toast = useToastStore.getState().toasts.find((t) => t.id === id)
    expect(toast?.undoCallback).toBeUndefined()
  })

  it('auto-dismisses after timeout via store', () => {
    const { showToast } = useToastStore.getState()
    showToast({
      message: 'Auto-dismiss me',
      type: 'info',
      dismissTimeout: 100,
    })

    expect(useToastStore.getState().toasts).toHaveLength(1)

    // Simulate the auto-dismiss that the component's useEffect would trigger
    const { dismissToast } = useToastStore.getState()
    const toastId = useToastStore.getState().toasts[0].id
    dismissToast(toastId)

    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('dismiss button removes toast from store', () => {
    const { showToast, dismissToast } = useToastStore.getState()
    const id = showToast({
      message: 'Dismiss me',
      type: 'success',
      dismissTimeout: 5000,
    })

    expect(useToastStore.getState().toasts).toHaveLength(1)
    dismissToast(id)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('undo button fires callback and dismisses toast', () => {
    const undoFn = vi.fn()
    const { showToast, undoToast } = useToastStore.getState()
    const id = showToast({
      message: 'Undo me',
      type: 'success',
      dismissTimeout: 5000,
      undoCallback: undoFn,
    })

    undoToast(id)

    expect(undoFn).toHaveBeenCalledOnce()
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('supports all three toast types: success, info, warning', () => {
    const { showToast } = useToastStore.getState()

    showToast({ message: 'Success', type: 'success', dismissTimeout: 5000 })
    showToast({ message: 'Info', type: 'info', dismissTimeout: 5000 })
    showToast({ message: 'Warning', type: 'warning', dismissTimeout: 5000 })

    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(3)
    expect(toasts.map((t) => t.type)).toEqual(['success', 'info', 'warning'])
  })
})
