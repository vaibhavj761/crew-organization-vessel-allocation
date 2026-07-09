import { describe, expect, it } from 'vitest'
import type { Vessel } from '../src/types'
import { getBlockingVesselValidationMessage, getVesselBlockingMessage, validateVesselMasterFields } from '../src/utils/vesselValidation'

const validVessel: Vessel = {
  id: 'vessel-1',
  name: 'MV Northern Star',
  vesselType: 'Bulk Carrier',
  vesselDoc: '',
  deadweightTonnage: '',
  ownerPool: '',
  ownerName: '',
  vesselManager: '',
  crewManagerId: 'cm-1',
  assignedAssistantId: '',
  vesselStatus: 'IN_MANAGEMENT',
  managementType: 'FULL_MANAGED',
  notes: '',
  sortOrder: 1,
}

describe('vessel validation', () => {
  it('requires vessel name', () => {
    expect(validateVesselMasterFields({ ...validVessel, name: '   ' }).name).toBe('Vessel name is required.')
  })

  it('requires vessel type', () => {
    expect(validateVesselMasterFields({ ...validVessel, vesselType: '   ' }).vesselType).toBe('Vessel type is required.')
  })

  it('requires assignment', () => {
    expect(validateVesselMasterFields({ ...validVessel, crewManagerId: '   ' }).assignment).toBe('Assignment is required.')
  })

  it('accepts a valid vessel', () => {
    expect(getVesselBlockingMessage(validVessel)).toBe('')
    expect(getBlockingVesselValidationMessage([validVessel])).toBe('')
  })
})
