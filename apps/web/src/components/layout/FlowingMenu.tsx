/**
 * FlowingMenu Component
 * A sophisticated menu with infinite marquee hover effects and directional transitions.
 * Adapted for project selection sidebar.
 */

import React, { useRef, useEffect, useState } from 'react'
import { gsap } from 'gsap'

export interface MenuItemData {
  id: string
  text: string
  status?: string
  isActive?: boolean
}

export interface FlowingMenuProps {
  items: MenuItemData[]
  onSelect: (id: string) => void
  speed?: number
  textColor?: string
  bgColor?: string
  marqueeBgColor?: string
  marqueeTextColor?: string
  borderColor?: string
}

interface MenuItemProps extends MenuItemData {
  onSelect: (id: string) => void
  speed: number
  textColor: string
  marqueeBgColor: string
  marqueeTextColor: string
  borderColor: string
  isFirst: boolean
}

export const FlowingMenu: React.FC<FlowingMenuProps> = ({
  items = [],
  onSelect,
  speed = 12,
  textColor = '#ffffff',
  bgColor = 'transparent',
  marqueeBgColor = '#ffffff',
  marqueeTextColor = '#000000',
  borderColor = 'rgba(255,255,255,0.1)'
}) => {
  return (
    <div className="w-full h-full overflow-hidden" style={{ backgroundColor: bgColor }}>
      <nav className="flex flex-col h-full m-0 p-0">
        {items.map((item, idx) => (
          <MenuItem
            key={item.id}
            {...item}
            onSelect={onSelect}
            speed={speed}
            textColor={textColor}
            marqueeBgColor={marqueeBgColor}
            marqueeTextColor={marqueeTextColor}
            borderColor={borderColor}
            isFirst={idx === 0}
          />
        ))}
      </nav>
    </div>
  )
}

const MenuItem: React.FC<MenuItemProps> = ({
  id,
  text,
  status,
  isActive,
  onSelect,
  speed,
  textColor,
  marqueeBgColor,
  marqueeTextColor,
  borderColor,
  isFirst
}) => {
  const itemRef = useRef<HTMLDivElement>(null)
  const marqueeRef = useRef<HTMLDivElement>(null)
  const marqueeInnerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<gsap.core.Tween | null>(null)
  const [repetitions, setRepetitions] = useState(6)
  const animationDefaults = { duration: 0.5, ease: 'expo.out' }

  const findClosestEdge = (mouseX: number, mouseY: number, width: number, height: number): 'top' | 'bottom' => {
    const topEdgeDist = Math.pow(mouseX - width / 2, 2) + Math.pow(mouseY, 2)
    const bottomEdgeDist = Math.pow(mouseX - width / 2, 2) + Math.pow(mouseY - height, 2)
    return topEdgeDist < bottomEdgeDist ? 'top' : 'bottom'
  }

  useEffect(() => {
    const calculateRepetitions = () => {
      if (!marqueeInnerRef.current) return
      const marqueeContent = marqueeInnerRef.current.querySelector('.marquee-part') as HTMLElement
      if (!marqueeContent) return
      const contentWidth = marqueeContent.offsetWidth
      const containerWidth = itemRef.current?.offsetWidth || 300
      const needed = Math.ceil(containerWidth / (contentWidth || 100)) + 3
      setRepetitions(Math.max(6, needed))
    }

    calculateRepetitions()
    window.addEventListener('resize', calculateRepetitions)
    return () => window.removeEventListener('resize', calculateRepetitions)
  }, [text])

  useEffect(() => {
    const setupMarquee = () => {
      if (!marqueeInnerRef.current) return
      const marqueeContent = marqueeInnerRef.current.querySelector('.marquee-part') as HTMLElement
      if (!marqueeContent) return
      const contentWidth = marqueeContent.offsetWidth
      if (contentWidth === 0) return

      if (animationRef.current) {
        animationRef.current.kill()
      }

      animationRef.current = gsap.to(marqueeInnerRef.current, {
        x: -contentWidth,
        duration: speed,
        ease: 'none',
        repeat: -1
      })
    }

    const timer = setTimeout(setupMarquee, 100)
    return () => {
      clearTimeout(timer)
      if (animationRef.current) {
        animationRef.current.kill()
      }
    }
  }, [text, repetitions, speed])

  const handleMouseEnter = (ev: React.MouseEvent<HTMLButtonElement>) => {
    if (!itemRef.current || !marqueeRef.current || !marqueeInnerRef.current) return
    const rect = itemRef.current.getBoundingClientRect()
    const edge = findClosestEdge(ev.clientX - rect.left, ev.clientY - rect.top, rect.width, rect.height)

    gsap.timeline({ defaults: animationDefaults })
      .set(marqueeRef.current, { y: edge === 'top' ? '-101%' : '101%' }, 0)
      .set(marqueeInnerRef.current, { y: edge === 'top' ? '101%' : '-101%' }, 0)
      .to([marqueeRef.current, marqueeInnerRef.current], { y: '0%' }, 0)
  }

  const handleMouseLeave = (ev: React.MouseEvent<HTMLButtonElement>) => {
    if (!itemRef.current || !marqueeRef.current || !marqueeInnerRef.current) return
    const rect = itemRef.current.getBoundingClientRect()
    const edge = findClosestEdge(ev.clientX - rect.left, ev.clientY - rect.top, rect.width, rect.height)

    gsap.timeline({ defaults: animationDefaults })
      .to(marqueeRef.current, { y: edge === 'top' ? '-101%' : '101%' }, 0)
      .to(marqueeInnerRef.current, { y: edge === 'top' ? '101%' : '-101%' }, 0)
  }

  return (
    <div
      className="relative overflow-hidden text-center"
      ref={itemRef}
      style={{
        borderTop: isFirst ? 'none' : `1px solid ${borderColor}`,
        minHeight: '60px'
      }}
    >
      <button
        className={`
          flex items-center justify-between w-full h-full px-4 py-4 relative cursor-pointer
          text-left font-medium text-sm transition-opacity
          ${isActive ? 'opacity-100' : 'opacity-70 hover:opacity-0'}
        `}
        onClick={() => onSelect(id)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ color: isActive ? marqueeBgColor : textColor }}
      >
        <span className="truncate">{text}</span>
        {status && (
          <span className="text-xs font-mono text-neutral-500 uppercase ml-2">
            {status}
          </span>
        )}
      </button>

      {/* Marquee overlay */}
      <div
        className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none translate-y-[101%]"
        ref={marqueeRef}
        style={{ backgroundColor: marqueeBgColor }}
      >
        <div className="h-full w-fit flex items-center" ref={marqueeInnerRef}>
          {[...Array(repetitions)].map((_, idx) => (
            <div
              className="marquee-part flex items-center flex-shrink-0 h-full"
              key={idx}
              style={{ color: marqueeTextColor }}
            >
              <span className="whitespace-nowrap font-medium text-sm px-4">{text}</span>
              <span className="text-neutral-400 px-2">•</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default FlowingMenu
