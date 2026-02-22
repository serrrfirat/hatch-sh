interface UndoManagerOptions {
  maxEntries?: number
}

export class UndoManager<T> {
  private readonly maxEntries: number
  private undoStack: T[] = []
  private redoStack: T[] = []
  private currentState: T | null = null

  constructor(options: UndoManagerOptions = {}) {
    this.maxEntries = options.maxEntries ?? 50
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  push(state: T): void {
    this.undoStack.push(this.clone(state))
    if (this.undoStack.length > this.maxEntries) {
      this.undoStack.shift()
    }
    this.redoStack = []
  }

  setCurrent(state: T | null): void {
    this.currentState = state ? this.clone(state) : null
  }

  undo(): T | null {
    if (!this.canUndo) return null

    if (this.currentState) {
      this.redoStack.push(this.clone(this.currentState))
      if (this.redoStack.length > this.maxEntries) {
        this.redoStack.shift()
      }
    }

    const previous = this.undoStack.pop()
    if (!previous) return null

    this.currentState = this.clone(previous)
    return this.clone(previous)
  }

  redo(): T | null {
    if (!this.canRedo) return null

    if (this.currentState) {
      this.undoStack.push(this.clone(this.currentState))
      if (this.undoStack.length > this.maxEntries) {
        this.undoStack.shift()
      }
    }

    const next = this.redoStack.pop()
    if (!next) return null

    this.currentState = this.clone(next)
    return this.clone(next)
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.currentState = null
  }

  private clone(value: T): T {
    return structuredClone(value)
  }
}
