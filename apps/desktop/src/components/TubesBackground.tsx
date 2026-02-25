import { useEffect, useRef } from 'react'
import { Mesh, Program, Renderer, Triangle } from 'ogl'

interface TubesBackgroundProps {
  className?: string
  enableClickInteraction?: boolean
}

const toRgb = (hex: string): [number, number, number] => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!match) return [1, 0.42, 0.18]
  return [parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255]
}

const randomColor = (): string => {
  const value = Math.floor(Math.random() * 0xffffff)
  return `#${value.toString(16).padStart(6, '0')}`
}

const createPalette = (): [string, string, string] => [randomColor(), randomColor(), randomColor()]

const vertex = `#version 300 es
precision highp float;
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`

const fragment = `#version 300 es
precision highp float;

uniform vec2 iResolution;
uniform float iTime;
uniform vec2 uMouse;
uniform float uMouseStrength;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uOpacity;

out vec4 fragColor;

float tubeField(vec2 uv, float time, float idx, vec2 mouseUv) {
  float phase = idx * 1.17;
  float amplitude = 0.16 + 0.03 * sin(idx * 1.33 + time * 0.5);
  float baseY =
    amplitude * sin(uv.x * (2.4 + idx * 0.22) + time * (0.9 + idx * 0.06) + phase) +
    0.08 * cos(uv.x * 1.6 - time * 0.6 + phase * 0.8);

  float mouseDist = distance(vec2(uv.x, baseY), mouseUv);
  float bend = exp(-mouseDist * 5.0) * (mouseUv.y - baseY) * uMouseStrength;
  baseY += bend;

  float distToTube = abs(uv.y - baseY);
  float core = exp(-distToTube * 46.0);
  float glow = exp(-distToTube * 9.5) * 0.45;
  return core + glow;
}

void main() {
  vec2 uv = (gl_FragCoord.xy / iResolution.xy) * 2.0 - 1.0;
  float aspect = iResolution.x / max(iResolution.y, 1.0);
  uv.x *= aspect;

  vec2 mouseUv = (uMouse / iResolution) * 2.0 - 1.0;
  mouseUv.x *= aspect;

  vec3 color = vec3(0.01, 0.015, 0.02);
  float time = iTime;

  for (int i = 0; i < 7; i++) {
    float idx = float(i);
    float intensity = tubeField(uv, time, idx, mouseUv);
    float blendA = fract(idx * 0.37 + sin(time * 0.12 + idx));
    float blendB = fract(idx * 0.63 + cos(time * 0.17 + idx * 0.5));
    vec3 tubeColor = mix(uColorA, uColorB, blendA);
    tubeColor = mix(tubeColor, uColorC, blendB * 0.75);
    color += tubeColor * intensity;
  }

  vec2 vignetteUv = gl_FragCoord.xy / iResolution.xy;
  float vignette = smoothstep(1.2, 0.3, distance(vignetteUv, vec2(0.5)));
  color *= mix(0.35, 1.0, vignette);

  color = pow(color, vec3(0.9));
  fragColor = vec4(color, uOpacity);
}`

export function TubesBackground({
  className,
  enableClickInteraction = true,
}: TubesBackgroundProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const paletteRef = useRef<[string, string, string]>(['#ff7a38', '#54e38e', '#3f8cff'])
  const programRef = useRef<Program | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const root = containerRef.current

    const renderer = new Renderer({
      webgl: 2,
      alpha: true,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    })

    const gl = renderer.gl
    const canvas = gl.canvas as HTMLCanvasElement
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    root.appendChild(canvas)

    const [a, b, c] = paletteRef.current.map(toRgb)
    const geometry = new Triangle(gl)
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uMouse: { value: new Float32Array([0, 0]) },
        uMouseStrength: { value: 0.22 },
        uColorA: { value: new Float32Array(a) },
        uColorB: { value: new Float32Array(b) },
        uColorC: { value: new Float32Array(c) },
        uOpacity: { value: 1.0 },
      },
    })
    programRef.current = program

    const mesh = new Mesh(gl, { geometry, program })

    const resize = () => {
      if (!containerRef.current || !programRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const width = Math.max(1, Math.floor(rect.width))
      const height = Math.max(1, Math.floor(rect.height))
      renderer.setSize(width, height)
      const resolution = programRef.current.uniforms.iResolution.value as Float32Array
      resolution[0] = gl.drawingBufferWidth
      resolution[1] = gl.drawingBufferHeight
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!containerRef.current || !programRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      mouseRef.current.x = event.clientX - rect.left
      mouseRef.current.y = rect.height - (event.clientY - rect.top)
      const mouse = programRef.current.uniforms.uMouse.value as Float32Array
      mouse[0] = mouseRef.current.x
      mouse[1] = mouseRef.current.y
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(root)
    root.addEventListener('pointermove', handlePointerMove)
    resize()

    let rafId = 0
    const start = performance.now()
    const render = (timestamp: number) => {
      if (programRef.current) {
        ;(programRef.current.uniforms.iTime as { value: number }).value =
          (timestamp - start) * 0.001
      }
      renderer.render({ scene: mesh })
      rafId = requestAnimationFrame(render)
    }
    rafId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      root.removeEventListener('pointermove', handlePointerMove)
      programRef.current = null
      if (canvas.parentNode === root) {
        root.removeChild(canvas)
      }
    }
  }, [])

  const handleClick = () => {
    if (!enableClickInteraction || !programRef.current) return
    paletteRef.current = createPalette()
    const [a, b, c] = paletteRef.current.map(toRgb)

    const colorA = programRef.current.uniforms.uColorA.value as Float32Array
    const colorB = programRef.current.uniforms.uColorB.value as Float32Array
    const colorC = programRef.current.uniforms.uColorC.value as Float32Array

    colorA.set(a)
    colorB.set(b)
    colorC.set(c)
  }

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={`relative h-full w-full overflow-hidden bg-black ${className ?? ''}`}
    />
  )
}

export default TubesBackground
