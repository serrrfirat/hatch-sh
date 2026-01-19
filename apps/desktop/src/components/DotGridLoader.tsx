import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// 3x3 grid to fit in small spaces (12px)
const GRID_SIZE = 3;
const DOT_SIZE = 2;
const DOT_GAP = 1;

interface DotGridLoaderProps {
  className?: string;
}

export function DotGridLoader({ className }: DotGridLoaderProps) {
  const [activeDots, setActiveDots] = useState<number[]>([]);

  useEffect(() => {
    let frame = 0;
    const interval = setInterval(() => {
      const active: number[] = [];
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          const index = row * GRID_SIZE + col;
          const wave = (col + row + frame) % 5;
          if (wave < 2) {
            active.push(index);
          }
        }
      }
      setActiveDots(active);
      frame++;
    }, 150);

    return () => clearInterval(interval);
  }, []);

  const dots = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const index = row * GRID_SIZE + col;
      const isActive = activeDots.includes(index);

      dots.push(
        <motion.div
          key={index}
          className={isActive ? 'bg-neutral-400' : 'bg-neutral-600'}
          style={{
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: '50%',
          }}
          animate={{
            opacity: isActive ? 1 : 0.4,
            scale: isActive ? 1.1 : 1,
          }}
          transition={{ duration: 0.15 }}
        />
      );
    }
  }

  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${GRID_SIZE}, ${DOT_SIZE}px)`,
        gap: DOT_GAP,
        width: 12,
        height: 12,
        alignContent: 'center',
        justifyContent: 'center',
      }}
    >
      {dots}
    </div>
  );
}
