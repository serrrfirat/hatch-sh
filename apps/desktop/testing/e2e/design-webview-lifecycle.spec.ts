import { describe, expect, it } from 'vitest'
import {
  calculateEmbeddedWebviewBounds,
  toLogicalPosition,
  toLogicalSize,
} from '../../src/lib/design/webviewLifecycle'

describe('design webview lifecycle suite', () => {
  it('positions webview below app header when container starts under header', () => {
    const bounds = calculateEmbeddedWebviewBounds({
      left: 24,
      top: 12,
      width: 1280,
      height: 720,
      headerHeight: 40,
    })

    expect(bounds).toEqual({ x: 24, y: 40, width: 1280, height: 692 })
  })

  it('does not alter bounds when container is already below header', () => {
    const bounds = calculateEmbeddedWebviewBounds({
      left: 12,
      top: 120,
      width: 800,
      height: 600,
      headerHeight: 40,
    })

    expect(bounds).toEqual({ x: 12, y: 120, width: 800, height: 600 })
  })

  it('clamps height to zero if header fully covers the container', () => {
    const bounds = calculateEmbeddedWebviewBounds({
      left: 0,
      top: 0,
      width: 500,
      height: 20,
      headerHeight: 40,
    })

    expect(bounds).toEqual({ x: 0, y: 40, width: 500, height: 0 })
  })

  it('converts bounds to tauri logical payloads used by setPosition/setSize', () => {
    const bounds = { x: 10, y: 50, width: 1000, height: 700 }

    expect(toLogicalPosition(bounds)).toEqual({ type: 'Logical', x: 10, y: 50 })
    expect(toLogicalSize(bounds)).toEqual({ type: 'Logical', width: 1000, height: 700 })
  })
})
