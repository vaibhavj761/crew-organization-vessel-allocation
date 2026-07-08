import { describe, expect, it } from 'vitest'
import { getCrewManagerLayoutMode, getViewportVesselColumnCount } from '../src/utils/chartLayout'

describe('chart layout helpers', () => {
  it('centers one crew manager layout', () => {
    expect(getCrewManagerLayoutMode(1)).toBe('one')
  })

  it('uses balanced side-by-side layout for two managers', () => {
    expect(getCrewManagerLayoutMode(2)).toBe('two')
  })

  it('uses wrap-friendly layout for three managers', () => {
    expect(getCrewManagerLayoutMode(3)).toBe('three')
  })

  it('uses 2x2-friendly layout for four managers', () => {
    expect(getCrewManagerLayoutMode(4)).toBe('four')
  })

  it('uses responsive many-team layout for five or more managers', () => {
    expect(getCrewManagerLayoutMode(5)).toBe('many')
    expect(getCrewManagerLayoutMode(7)).toBe('many')
  })

  it('uses adaptive vessel columns for readable team cards', () => {
    expect(getViewportVesselColumnCount(3)).toBe(1)
    expect(getViewportVesselColumnCount(12)).toBe(2)
    expect(getViewportVesselColumnCount(18)).toBe(3)
  })
})
