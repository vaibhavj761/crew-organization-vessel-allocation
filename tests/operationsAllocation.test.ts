import { describe, expect, it } from 'vitest'
import { sampleData } from '../src/data/sampleData'
import { getCrewManagersForOperationsManager, getOperationsManagersForDirector, getVesselColumnCount } from '../src/utils/operationsAllocation'

describe('operations allocation helpers', () => {
  it('filters operations managers by crew director', () => {
    const director = sampleData.crewDirectors[0]
    const operationsManagers = getOperationsManagersForDirector(sampleData, director.id)

    expect(operationsManagers).toHaveLength(1)
    expect(operationsManagers[0].person.name).toBe('Marcus Pereira')
  })

  it('returns all crew managers by default and preserves focused manager filtering', () => {
    const operationsManager = sampleData.operationsManagers[0]

    expect(getCrewManagersForOperationsManager(operationsManager)).toHaveLength(2)
    expect(getCrewManagersForOperationsManager(operationsManager, operationsManager.crewManagers[1].id).map((item) => item.person.name)).toEqual(['Vikram Menon'])
  })

  it('uses one, two, or three vessel columns based on count', () => {
    expect(getVesselColumnCount(3)).toBe(1)
    expect(getVesselColumnCount(10)).toBe(2)
    expect(getVesselColumnCount(18)).toBe(3)
  })
})
