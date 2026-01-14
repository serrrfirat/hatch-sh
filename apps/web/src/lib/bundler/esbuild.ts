import * as esbuild from 'esbuild-wasm'

let initPromise: Promise<void> | null = null

export async function initEsbuild() {
  if (!initPromise) {
    initPromise = esbuild.initialize({
      wasmURL: 'https://unpkg.com/esbuild-wasm@0.27.2/esbuild.wasm',
    })
  }
  return initPromise
}

export { esbuild }
