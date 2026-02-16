export interface WebviewRectInput {
  left: number
  top: number
  width: number
  height: number
  headerHeight: number
}

export interface WebviewBounds {
  x: number
  y: number
  width: number
  height: number
}

export function calculateEmbeddedWebviewBounds(input: WebviewRectInput): WebviewBounds {
  const y = Math.max(input.top, input.headerHeight)
  const overlap = Math.max(0, input.headerHeight - input.top)
  const height = Math.max(0, input.height - overlap)

  return {
    x: input.left,
    y,
    width: input.width,
    height,
  }
}

export function toLogicalPosition(bounds: WebviewBounds) {
  return { type: 'Logical' as const, x: bounds.x, y: bounds.y }
}

export function toLogicalSize(bounds: WebviewBounds) {
  return { type: 'Logical' as const, width: bounds.width, height: bounds.height }
}
