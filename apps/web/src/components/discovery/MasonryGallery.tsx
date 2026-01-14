/**
 * MasonryGallery - A high-performance, GSAP-powered Masonry layout component.
 * Adapted for app discovery cards.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'

/** Hook to handle media queries for responsive columns */
const useMedia = (queries: string[], values: number[], defaultValue: number): number => {
  const get = () => {
    if (typeof window === 'undefined') return defaultValue
    const match = queries.findIndex(q => window.matchMedia(q).matches)
    return values[match] !== undefined ? values[match] : defaultValue
  }

  const [value, setValue] = useState<number>(get)

  useEffect(() => {
    const handler = () => setValue(get)
    queries.forEach(q => window.matchMedia(q).addEventListener('change', handler))
    return () => queries.forEach(q => window.matchMedia(q).removeEventListener('change', handler))
  }, [queries])

  return value
}

/** Hook to measure element size via ResizeObserver */
const useMeasure = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  return [ref, size] as const
}

/** Utility to ensure images are loaded before layout/animation */
const preloadImages = async (urls: string[]): Promise<void> => {
  await Promise.all(
    urls.map(
      src =>
        new Promise<void>(resolve => {
          const img = new Image()
          img.src = src
          img.onload = img.onerror = () => resolve()
        })
    )
  )
}

export interface MasonryItem {
  id: string
  img: string
  height: number
  title?: string
  description?: string
  tokenSymbol?: string
  marketCap?: number
  creatorAddress?: string
  deploymentUrl?: string
  tokenAddress?: string
}

interface GridItem extends MasonryItem {
  x: number
  y: number
  w: number
  h: number
}

export interface MasonryGalleryProps {
  items: MasonryItem[]
  animateFrom?: 'bottom' | 'top' | 'left' | 'right' | 'center' | 'random'
  stagger?: number
  scaleOnHover?: boolean
  hoverScale?: number
  blurToFocus?: boolean
  className?: string
  onItemClick?: (item: MasonryItem) => void
}

export const MasonryGallery: React.FC<MasonryGalleryProps> = ({
  items,
  stagger = 0.05,
  animateFrom = 'bottom',
  scaleOnHover = true,
  hoverScale = 0.96,
  blurToFocus = true,
  className,
  onItemClick
}) => {
  const columns = useMedia(
    ['(min-width: 1200px)', '(min-width: 900px)', '(min-width: 600px)'],
    [3, 2, 2],
    1
  )

  const [containerRef, { width }] = useMeasure<HTMLDivElement>()
  const [imagesReady, setImagesReady] = useState(false)
  const hasMounted = useRef(false)

  const getInitialPosition = (item: GridItem) => {
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return { x: item.x, y: item.y }

    let direction = animateFrom
    if (animateFrom === 'random') {
      const dirs = ['top', 'bottom', 'left', 'right']
      direction = dirs[Math.floor(Math.random() * dirs.length)] as typeof animateFrom
    }

    switch (direction) {
      case 'top': return { x: item.x, y: -200 }
      case 'bottom': return { x: item.x, y: window.innerHeight + 200 }
      case 'left': return { x: -200, y: item.y }
      case 'right': return { x: window.innerWidth + 200, y: item.y }
      case 'center': return {
        x: containerRect.width / 2 - item.w / 2,
        y: containerRect.height / 2 - item.h / 2
      }
      default: return { x: item.x, y: item.y + 100 }
    }
  }

  useEffect(() => {
    preloadImages(items.map(i => i.img)).then(() => setImagesReady(true))
  }, [items])

  const { grid, containerHeight } = useMemo(() => {
    if (!width) return { grid: [] as GridItem[], containerHeight: 0 }

    const colHeights = new Array(columns).fill(0)
    const gap = 24
    const totalGaps = (columns - 1) * gap
    const columnWidth = (width - totalGaps) / columns

    const gridItems = items.map(child => {
      const col = colHeights.indexOf(Math.min(...colHeights))
      const x = col * (columnWidth + gap)
      const height = (child.height / 400) * columnWidth
      const y = colHeights[col]
      colHeights[col] += height + gap
      return { ...child, x, y, w: columnWidth, h: height }
    })

    return { grid: gridItems, containerHeight: Math.max(...colHeights) }
  }, [columns, items, width])

  useLayoutEffect(() => {
    if (!imagesReady || !grid.length) return

    grid.forEach((item, index) => {
      const element = document.querySelector(`[data-masonry-key="${item.id}"]`)
      if (!element) return

      const animProps = { x: item.x, y: item.y, width: item.w, height: item.h }

      if (!hasMounted.current) {
        const start = getInitialPosition(item)
        gsap.fromTo(
          element,
          {
            opacity: 0,
            x: start.x,
            y: start.y,
            width: item.w,
            height: item.h,
            ...(blurToFocus && { filter: 'blur(20px)' })
          },
          {
            opacity: 1,
            ...animProps,
            ...(blurToFocus && { filter: 'blur(0px)' }),
            duration: 1.2,
            ease: 'power3.out',
            delay: index * stagger
          }
        )
      } else {
        gsap.to(element, {
          ...animProps,
          duration: 0.6,
          ease: 'power3.out',
          overwrite: 'auto'
        })
      }
    })

    if (grid.length > 0) hasMounted.current = true
  }, [grid, imagesReady, stagger, animateFrom, blurToFocus])

  const handleMouseEnter = (element: HTMLElement) => {
    if (scaleOnHover) {
      gsap.to(element, {
        scale: hoverScale,
        duration: 0.4,
        ease: 'power2.out'
      })
    }
    const overlay = element.querySelector('.color-overlay')
    if (overlay) gsap.to(overlay, { opacity: 0.4, duration: 0.4 })
    const info = element.querySelector('.item-info')
    if (info) gsap.to(info, { opacity: 1, y: 0, duration: 0.3 })
  }

  const handleMouseLeave = (element: HTMLElement) => {
    if (scaleOnHover) {
      gsap.to(element, {
        scale: 1,
        duration: 0.4,
        ease: 'power2.out'
      })
    }
    const overlay = element.querySelector('.color-overlay')
    if (overlay) gsap.to(overlay, { opacity: 0, duration: 0.4 })
    const info = element.querySelector('.item-info')
    if (info) gsap.to(info, { opacity: 0, y: 10, duration: 0.3 })
  }

  const formatMarketCap = (mc: number) => {
    if (mc >= 1e6) return `$${(mc / 1e6).toFixed(2)}M`
    if (mc >= 1e3) return `$${(mc / 1e3).toFixed(2)}K`
    return `$${mc.toFixed(2)}`
  }

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className || ''}`}
      style={{ height: containerHeight, minHeight: '400px' }}
    >
      {grid.map(item => (
        <div
          key={item.id}
          data-masonry-key={item.id}
          className="absolute overflow-hidden cursor-pointer rounded-2xl group"
          style={{
            willChange: 'transform, width, height, opacity, filter',
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.3)'
          }}
          onClick={() => onItemClick?.(item)}
          onMouseEnter={e => handleMouseEnter(e.currentTarget)}
          onMouseLeave={e => handleMouseLeave(e.currentTarget)}
        >
          {/* Background Image */}
          <div
            className="w-full h-full bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${item.img})` }}
          >
            {/* Color Overlay */}
            <div className="color-overlay absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 pointer-events-none" />

            {/* Token Badge */}
            {item.tokenSymbol && (
              <div className="absolute top-4 left-4 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full">
                <span className="text-xs font-semibold text-black">${item.tokenSymbol}</span>
              </div>
            )}

            {/* Market Cap Badge */}
            {item.marketCap && (
              <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full">
                <span className="text-xs font-medium text-white">{formatMarketCap(item.marketCap)}</span>
              </div>
            )}

            {/* Info Panel */}
            <div
              className="item-info absolute bottom-0 left-0 right-0 p-5 opacity-0 translate-y-2"
              style={{ willChange: 'opacity, transform' }}
            >
              <h3 className="text-white text-lg font-semibold mb-1 tracking-tight">
                {item.title}
              </h3>
              {item.description && (
                <p className="text-white/70 text-sm line-clamp-2 mb-2">
                  {item.description}
                </p>
              )}
              {item.creatorAddress && (
                <p className="text-white/50 text-xs font-mono">
                  by {truncateAddress(item.creatorAddress)}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 mt-3">
                {item.deploymentUrl && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(item.deploymentUrl, '_blank')
                    }}
                    className="flex-1 px-3 py-2 bg-white text-black text-xs font-medium rounded-lg hover:bg-white/90 transition-colors"
                  >
                    Try App
                  </button>
                )}
                {item.tokenAddress && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(`https://sepolia.basescan.org/token/${item.tokenAddress}`, '_blank')
                    }}
                    className="flex-1 px-3 py-2 bg-white/20 text-white text-xs font-medium rounded-lg hover:bg-white/30 transition-colors"
                  >
                    Trade
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default MasonryGallery
