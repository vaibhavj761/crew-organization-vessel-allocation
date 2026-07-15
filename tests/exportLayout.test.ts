import { describe, expect, it } from 'vitest'
import { choosePresentationColumns, EXPORT_ASPECT_RATIO, EXPORT_HEIGHT, EXPORT_WIDTH, fitToSlide, getPresentationDensity, splitEvenly } from '../src/utils/exportLayout'

describe('presentation export layout', () => {
  it('uses a native 16:9 presentation canvas', () => {
    expect(EXPORT_WIDTH).toBe(1920)
    expect(EXPORT_HEIGHT).toBe(1080)
    expect(EXPORT_WIDTH / EXPORT_HEIGHT).toBe(EXPORT_ASPECT_RATIO)
  })

  it('switches large datasets to compact and dense modes', () => {
    expect(getPresentationDensity({ operationsManagers: 2, deputyManagers: 3, crewManagers: 10, vessels: 50 })).toBe('compact')
    expect(getPresentationDensity({ operationsManagers: 5, deputyManagers: 10, crewManagers: 30, vessels: 150 })).toBe('dense')
    expect(choosePresentationColumns(12, 'dense')).toBe(5)
  })

  it('fits complete content to both available dimensions', () => {
    expect(fitToSlide(1800, 1500, 1800, 900)).toBe(.6)
    expect(fitToSlide(900, 450, 1800, 900)).toBe(1)
  })

  it('keeps every item when distributing content columns', () => {
    const values = Array.from({ length: 17 }, (_, index) => index)
    const columns = splitEvenly(values, 4)
    expect(columns.flat().sort((left, right) => left - right)).toEqual(values)
    expect(columns.map((column) => column[0])).toEqual([0, 1, 2, 3])
  })
})
