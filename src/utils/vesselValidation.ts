import type { Vessel } from '../types'

type VesselValidationTarget = Pick<Vessel, 'name' | 'vesselType' | 'crewManagerId'>

function trimmed(value: string) {
  return value.trim()
}

export function validateVesselMasterFields(vessel: VesselValidationTarget) {
  const name = trimmed(vessel.name)
  const vesselType = trimmed(vessel.vesselType)
  const assignment = trimmed(vessel.crewManagerId)

  return {
    name: name ? '' : 'Vessel name is required.',
    vesselType: vesselType ? '' : 'Vessel type is required.',
    assignment: assignment ? '' : 'Assignment is required.',
  }
}

export function getVesselBlockingMessage(vessel: VesselValidationTarget) {
  const errors = validateVesselMasterFields(vessel)
  return errors.name || errors.vesselType || errors.assignment || ''
}

export function getBlockingVesselValidationMessage(vessels: VesselValidationTarget[]) {
  return vessels.map(getVesselBlockingMessage).find(Boolean) || ''
}

export function normalizeVesselTextFields(vessel: Vessel) {
  return {
    ...vessel,
    name: vessel.name.trim(),
    vesselType: vessel.vesselType.trim(),
    vesselDoc: vessel.vesselDoc.trim(),
    deadweightTonnage: vessel.deadweightTonnage.trim(),
    ownerPool: vessel.ownerPool.trim(),
    ownerName: vessel.ownerName.trim(),
    vesselManager: vessel.vesselManager.trim(),
    crewManagerId: vessel.crewManagerId.trim(),
    assignedAssistantId: vessel.assignedAssistantId.trim(),
    notes: vessel.notes.trim(),
  }
}
