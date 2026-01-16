import { useEffect, useRef } from 'react'
import { createChart, ColorType, AreaSeries, type IChartApi, type UTCTimestamp } from 'lightweight-charts'

interface TokenChartProps {
  tokenAddress: string
}

export function TokenChart({ tokenAddress }: TokenChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#888888',
      },
      grid: {
        vertLines: { color: '#2a2a2a' },
        horzLines: { color: '#2a2a2a' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 120,
      rightPriceScale: {
        visible: false,
      },
      timeScale: {
        visible: false,
      },
      crosshair: {
        horzLine: { visible: false },
        vertLine: { visible: false },
      },
    })

    chartRef.current = chart

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#00ff88',
      topColor: 'rgba(0, 255, 136, 0.4)',
      bottomColor: 'rgba(0, 255, 136, 0.0)',
      lineWidth: 2,
    })

    // Generate mock price data
    const mockData = generateMockPriceData()
    areaSeries.setData(mockData)

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [tokenAddress])

  return <div ref={chartContainerRef} className="w-full h-full" />
}

function generateMockPriceData() {
  const data: { time: UTCTimestamp; value: number }[] = []
  const now = Math.floor(Date.now() / 1000) as UTCTimestamp
  let price = 0.00001

  for (let i = 0; i < 50; i++) {
    price += (Math.random() - 0.3) * 0.000005 // Slight upward bias
    if (price < 0.000001) price = 0.000001
    data.push({
      time: (now - (50 - i) * 3600) as UTCTimestamp,
      value: price,
    })
  }

  return data
}
