import { describe, expect, it } from 'vitest'
import { UndoManager } from '../undoManager'

describe('UndoManager', () => {
  it('undoes and redoes in correct order', () => {
    const manager = new UndoManager<{ value: number }>({ maxEntries: 5 })

    manager.push({ value: 1 })
    manager.push({ value: 2 })
    manager.setCurrent({ value: 3 })

    expect(manager.canUndo).toBe(true)
    expect(manager.undo()).toEqual({ value: 2 })
    expect(manager.undo()).toEqual({ value: 1 })
    expect(manager.undo()).toBeNull()

    expect(manager.canRedo).toBe(true)
    expect(manager.redo()).toEqual({ value: 2 })
    expect(manager.redo()).toEqual({ value: 3 })
    expect(manager.redo()).toBeNull()
  })

  it('clears redo stack when pushing after undo', () => {
    const manager = new UndoManager<{ value: number }>({ maxEntries: 5 })

    manager.push({ value: 1 })
    manager.push({ value: 2 })
    manager.undo()
    manager.push({ value: 3 })

    expect(manager.canRedo).toBe(false)
    expect(manager.redo()).toBeNull()
    expect(manager.undo()).toEqual({ value: 3 })
  })

  it('enforces fixed max history size', () => {
    const manager = new UndoManager<{ value: number }>({ maxEntries: 3 })

    manager.push({ value: 1 })
    manager.push({ value: 2 })
    manager.push({ value: 3 })
    manager.push({ value: 4 })

    expect(manager.undo()).toEqual({ value: 4 })
    expect(manager.undo()).toEqual({ value: 3 })
    expect(manager.undo()).toEqual({ value: 2 })
    expect(manager.undo()).toBeNull()
  })

  it('deep clones pushed states', () => {
    const manager = new UndoManager<{ nested: { value: number } }>({ maxEntries: 5 })
    const state = { nested: { value: 1 } }

    manager.push(state)
    state.nested.value = 99

    expect(manager.undo()).toEqual({ nested: { value: 1 } })
  })

  it('deep clones returned undo and redo states', () => {
    const manager = new UndoManager<{ nested: { value: number } }>({ maxEntries: 5 })

    manager.push({ nested: { value: 1 } })
    manager.setCurrent({ nested: { value: 2 } })

    const undone = manager.undo()
    expect(undone).not.toBeNull()
    if (!undone) return

    undone.nested.value = 42

    const redone = manager.redo()
    expect(redone).toEqual({ nested: { value: 2 } })
  })
})
