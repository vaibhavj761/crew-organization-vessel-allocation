import { afterEach, describe, expect, it, vi } from 'vitest'
import { sampleData } from '../src/data/sampleData'
import { exportPng } from '../src/utils/exportImage'

describe('PNG browser export reliability', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(URL, 'createObjectURL')
    Reflect.deleteProperty(URL, 'revokeObjectURL')
  })

  it('falls back to a self-contained data image when blob image rendering is blocked', async () => {
    const loadedSources: string[] = []
    class MockImage {
      decoding = 'async'
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      decode = vi.fn().mockResolvedValue(undefined)
      set src(value: string) {
        loadedSources.push(value)
        queueMicrotask(() => value.startsWith('blob:blocked') ? this.onerror?.() : this.onload?.())
      }
    }
    vi.stubGlobal('Image', MockImage)
    const createObjectUrl = vi.fn()
      .mockReturnValueOnce('blob:blocked-svg')
      .mockReturnValueOnce('blob:download-png')
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png'], { type: 'image/png' })))

    await exportPng(sampleData, { kind: 'full' })

    expect(loadedSources[0]).toBe('blob:blocked-svg')
    expect(loadedSources[1]).toMatch(/^data:image\/svg\+xml/)
    expect(document.documentElement.dataset.exportStatus).toBe('ready')
    expect(document.documentElement.dataset.exportFilename).toBe('crew-org-full-chart.png')
  })
})
