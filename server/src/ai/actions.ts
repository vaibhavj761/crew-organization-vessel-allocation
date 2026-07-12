import type { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma.js'
import { writeAuditLog } from '../services/audit.js'
import type { AiPreviewChange, AiPreviewRecord, AiPreviewResponse, AiStructuredAction } from './types.js'
import type { AiReferenceData } from './reference.js'

type Matchable = { id: string; person?: { name: string }; name?: string }
type BuildResult = Omit<AiPreviewResponse, 'previewId' | 'providerUsed' | 'fallbackUsed' | 'fallbackReason'> & { resolvedIds: Record<string, string | null> }

const blockedUnsupported = 'I can help only with approved Vessel Master and Organization Chart updates in this version.'

function text(value: string | null | undefined) {
  return value?.trim() || ''
}

function normalized(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ')
}

function displayName(item: Matchable) {
  return item.person?.name || item.name || ''
}

function change(entity: string, field: string, oldValue: string | null, newValue: string | null): AiPreviewChange {
  return { entity, field, oldValue, newValue }
}

function response(status: BuildResult['status'], action: AiStructuredAction, summary: string, changes: AiPreviewChange[] = [], warnings: string[] = [], clarifyingQuestion: string | null = null): BuildResult {
  return {
    status,
    domain: action.domain,
    action: action.action,
    summary,
    confidence: action.confidence,
    reasoningSummary: action.reasoningSummary || action.summary || summary,
    changes,
    warnings,
    clarifyingQuestion,
    requiresConfirmation: status === 'ready',
    resolvedIds: {},
  }
}

function candidateList<T extends Matchable>(items: T[]) {
  return items.map(displayName).filter(Boolean).slice(0, 6).join(', ')
}

function ambiguousMessage<T extends Matchable>(items: T[], name: string, label: string) {
  const candidates = candidateList(items)
  return `Multiple ${label}s matched "${name}". Please specify the correct ${label}${candidates ? `: ${candidates}` : ''}.`
}

function findByName<T extends Matchable>(items: T[], name: string, label: string) {
  const needle = normalized(name)
  if (!needle) return { status: 'missing' as const, message: `${label} is required.` }
  const exact = items.filter((item) => normalized(displayName(item)) === needle)
  if (exact.length === 1) return { status: 'ready' as const, item: exact[0] }
  if (exact.length > 1) return { status: 'ambiguous' as const, message: ambiguousMessage(exact, name, label) }
  const firstName = items.filter((item) => normalized(displayName(item)).split(' ')[0] === needle)
  if (firstName.length === 1) return { status: 'ready' as const, item: firstName[0] }
  if (firstName.length > 1) return { status: 'ambiguous' as const, message: ambiguousMessage(firstName, name, label) }
  const startsWith = items.filter((item) => normalized(displayName(item)).startsWith(needle))
  if (startsWith.length === 1) return { status: 'ready' as const, item: startsWith[0] }
  if (startsWith.length > 1) return { status: 'ambiguous' as const, message: ambiguousMessage(startsWith, name, label) }
  const partial = items.filter((item) => normalized(displayName(item)).includes(needle))
  if (partial.length === 1) return { status: 'ready' as const, item: partial[0] }
  if (partial.length > 1) return { status: 'ambiguous' as const, message: ambiguousMessage(partial, name, label) }
  return { status: 'missing' as const, message: `I could not find ${label} "${name}". Please check the name or create the ${label} first.` }
}

function duplicateUnderParent<T extends Matchable>(items: T[], parentId: string, parentKey: keyof T, name: string) {
  const needle = normalized(name)
  return items.some((item) => normalized(displayName(item)) === needle && item[parentKey] === parentId)
}

function entityDetails(responseSummary: string, type: string, id: string | null) {
  return { responseSummary, affectedEntityType: type, affectedEntityId: id }
}

export function buildAiPreview(action: AiStructuredAction, reference: AiReferenceData): BuildResult & { affectedEntityType: string; affectedEntityId: string | null } {
  if (action.domain === 'unsupported' || action.action === 'unsupported') {
    return { ...response('blocked', action, blockedUnsupported), ...entityDetails(blockedUnsupported, 'Unsupported', null) }
  }
  if (action.action.startsWith('remove_')) {
    const summary = 'Removing organization records through AI is not supported. Use the manual editor and its confirmation controls.'
    return { ...response('blocked', action, summary), ...entityDetails(summary, 'Unsupported', null) }
  }
  if (action.confidence < 0.65) {
    const question = action.clarifyingQuestion || 'I am not fully sure what you want to update. Please clarify.'
    return { ...response('needs_clarification', action, question, [], action.warnings, question), ...entityDetails(question, 'Clarification', null) }
  }
  if (action.clarifyingQuestion) {
    return { ...response('needs_clarification', action, action.clarifyingQuestion, [], action.warnings, action.clarifyingQuestion), ...entityDetails(action.clarifyingQuestion, 'Clarification', null) }
  }
  if (!reference.organization) {
    return { ...response('blocked', action, 'Organization is not configured yet.'), ...entityDetails('Organization is not configured yet.', 'Organization', null) }
  }

  const name = text(action.data.name)
  const vesselName = text(action.data.vesselName || action.target.vesselName)
  const newVesselName = text(action.data.newVesselName || action.data.newName)
  const vesselType = text(action.data.vesselType)
  const assignmentName = text(action.data.assignmentCrewManagerName)

  switch (action.action) {
    case 'create_vessel': {
      if (!vesselName) return { ...response('needs_clarification', action, 'Vessel name is required.', [], [], 'What is the vessel name?'), ...entityDetails('', 'Vessel', null) }
      if (!vesselType) return { ...response('needs_clarification', action, 'Vessel type is required.', [], [], 'What is the vessel type?'), ...entityDetails('', 'Vessel', null) }
      const crewManager = findByName(reference.crewManagers, assignmentName, 'Crew Manager')
      if (crewManager.status !== 'ready') return { ...response('needs_clarification', action, crewManager.message, [], [], crewManager.message), ...entityDetails('', 'Vessel', null) }
      if (reference.vessels.some((item) => normalized(item.name) === normalized(vesselName))) {
        return { ...response('blocked', action, `Vessel "${vesselName}" already exists.`), ...entityDetails('', 'Vessel', null) }
      }
      return {
        ...response('ready', action, `Create vessel ${vesselName} assigned to ${crewManager.item.person.name}.`, [
          change('Vessel', 'Name', null, vesselName),
          change('Vessel', 'Vessel Type', null, vesselType),
          change('Vessel', 'Assignment', null, crewManager.item.person.name),
        ]),
        resolvedIds: { crewManagerId: crewManager.item.id },
        ...entityDetails('', 'Vessel', null),
      }
    }
    case 'update_vessel_name':
    case 'update_vessel_type':
    case 'update_vessel_assignment': {
      const vessel = findByName(reference.vessels, vesselName, 'Vessel')
      if (vessel.status !== 'ready') return { ...response('needs_clarification', action, vessel.message, [], [], vessel.message), ...entityDetails('', 'Vessel', null) }
      if (action.action === 'update_vessel_name') {
        if (!newVesselName) return { ...response('needs_clarification', action, 'New vessel name is required.', [], [], 'What should the new vessel name be?'), ...entityDetails('', 'Vessel', vessel.item.id) }
        if (reference.vessels.some((item) => item.id !== vessel.item.id && normalized(item.name) === normalized(newVesselName))) return { ...response('blocked', action, `Vessel "${newVesselName}" already exists.`), ...entityDetails('', 'Vessel', vessel.item.id) }
        return { ...response('ready', action, `Rename vessel ${vessel.item.name} to ${newVesselName}.`, [change('Vessel', 'Name', vessel.item.name, newVesselName)]), resolvedIds: { vesselId: vessel.item.id }, ...entityDetails('', 'Vessel', vessel.item.id) }
      }
      if (action.action === 'update_vessel_type') {
        if (!vesselType) return { ...response('needs_clarification', action, 'Vessel type is required.', [], [], 'What vessel type should be saved?'), ...entityDetails('', 'Vessel', vessel.item.id) }
        return { ...response('ready', action, `Update vessel type for ${vessel.item.name}.`, [change('Vessel', 'Vessel Type', vessel.item.vesselType || null, vesselType)]), resolvedIds: { vesselId: vessel.item.id }, ...entityDetails('', 'Vessel', vessel.item.id) }
      }
      const crewManager = findByName(reference.crewManagers, assignmentName, 'Crew Manager')
      if (crewManager.status !== 'ready') return { ...response('needs_clarification', action, crewManager.message, [], [], crewManager.message), ...entityDetails('', 'Vessel', vessel.item.id) }
      const currentAllocation = vessel.item.vesselAllocations[0]
      const oldManager = reference.crewManagers.find((item) => item.id === currentAllocation?.crewManagerId)
      return { ...response('ready', action, `Assign ${vessel.item.name} to ${crewManager.item.person.name}.`, [change('Vessel', 'Assignment', oldManager?.person.name || null, crewManager.item.person.name)]), resolvedIds: { vesselId: vessel.item.id, crewManagerId: crewManager.item.id }, ...entityDetails('', 'Vessel', vessel.item.id) }
    }
    case 'create_crew_director': {
      if (!name) return { ...response('needs_clarification', action, 'Crew Director name is required.', [], [], 'What is the Crew Director name?'), ...entityDetails('', 'CrewDirector', null) }
      if (reference.crewDirectors.some((item) => normalized(item.person.name) === normalized(name))) return { ...response('blocked', action, `Crew Director "${name}" already exists.`), ...entityDetails('', 'CrewDirector', null) }
      return { ...response('ready', action, `Create Crew Director ${name}.`, [change('Crew Director', 'Name', null, name)]), ...entityDetails('', 'CrewDirector', null) }
    }
    case 'create_crew_operations_manager': {
      const parent = findByName(reference.crewDirectors, text(action.data.parentCrewDirectorName || action.target.crewDirectorName), 'Crew Director')
      if (!name) return { ...response('needs_clarification', action, 'Crew Operations Manager name is required.', [], [], 'What is the Crew Operations Manager name?'), ...entityDetails('', 'OperationsManager', null) }
      if (parent.status !== 'ready') return { ...response('needs_clarification', action, parent.message, [], [], parent.message), ...entityDetails('', 'OperationsManager', null) }
      if (duplicateUnderParent(reference.operationsManagers, parent.item.id, 'crewDirectorId', name)) return { ...response('blocked', action, `Crew Operations Manager "${name}" already exists under ${parent.item.person.name}.`), ...entityDetails('', 'OperationsManager', null) }
      return { ...response('ready', action, `Create Crew Operations Manager ${name} under ${parent.item.person.name}.`, [change('Crew Operations Manager', 'Name', null, name), change('Crew Operations Manager', 'Parent Crew Director', null, parent.item.person.name)]), resolvedIds: { crewDirectorId: parent.item.id }, ...entityDetails('', 'OperationsManager', null) }
    }
    case 'create_crew_manager': {
      const parent = findByName(reference.operationsManagers, text(action.data.parentCrewOperationsManagerName || action.target.crewOperationsManagerName), 'Crew Operations Manager')
      if (!name) return { ...response('needs_clarification', action, 'Crew Manager name is required.', [], [], 'What is the Crew Manager name?'), ...entityDetails('', 'CrewManager', null) }
      if (parent.status !== 'ready') return { ...response('needs_clarification', action, parent.message, [], [], parent.message), ...entityDetails('', 'CrewManager', null) }
      if (duplicateUnderParent(reference.crewManagers, parent.item.id, 'operationsManagerId', name)) return { ...response('blocked', action, `Crew Manager "${name}" already exists under ${parent.item.person.name}.`), ...entityDetails('', 'CrewManager', null) }
      return { ...response('ready', action, `Create Crew Manager ${name} under ${parent.item.person.name}.`, [change('Crew Manager', 'Name', null, name), change('Crew Manager', 'Parent Crew Operations Manager', null, parent.item.person.name)]), resolvedIds: { operationsManagerId: parent.item.id }, ...entityDetails('', 'CrewManager', null) }
    }
    case 'create_assistant': {
      const parent = findByName(reference.crewManagers, text(action.data.parentCrewManagerName || action.target.crewManagerName), 'Crew Manager')
      if (!name) return { ...response('needs_clarification', action, 'Assistant name is required.', [], [], 'What is the Assistant name?'), ...entityDetails('', 'Assistant', null) }
      if (parent.status !== 'ready') return { ...response('needs_clarification', action, parent.message, [], [], parent.message), ...entityDetails('', 'Assistant', null) }
      if (duplicateUnderParent(reference.assistants, parent.item.id, 'crewManagerId', name)) return { ...response('blocked', action, `Assistant "${name}" already exists under ${parent.item.person.name}.`), ...entityDetails('', 'Assistant', null) }
      return { ...response('ready', action, `Create Assistant ${name} under ${parent.item.person.name}.`, [change('Assistant', 'Name', null, name), change('Assistant', 'Parent Crew Manager', null, parent.item.person.name)]), resolvedIds: { crewManagerId: parent.item.id }, ...entityDetails('', 'Assistant', null) }
    }
    default:
      return buildUpdateMoveRemovePreview(action, reference)
  }
}

function buildUpdateMoveRemovePreview(action: AiStructuredAction, reference: AiReferenceData): BuildResult & { affectedEntityType: string; affectedEntityId: string | null } {
  const targetName = text(action.target.crewDirectorName || action.target.crewOperationsManagerName || action.target.crewManagerName || action.target.assistantName || action.data.name)
  const newName = text(action.data.newName)

  if (action.action.includes('crew_director')) {
    const item = findByName(reference.crewDirectors, targetName, 'Crew Director')
    if (item.status !== 'ready') return { ...response('needs_clarification', action, item.message, [], [], item.message), ...entityDetails('', 'CrewDirector', null) }
    if (action.action === 'update_crew_director_name') {
      if (!newName) return { ...response('needs_clarification', action, 'New Crew Director name is required.', [], [], 'What should the new name be?'), ...entityDetails('', 'CrewDirector', item.item.id) }
      return { ...response('ready', action, `Rename Crew Director ${item.item.person.name} to ${newName}.`, [change('Crew Director', 'Name', item.item.person.name, newName)]), resolvedIds: { crewDirectorId: item.item.id }, ...entityDetails('', 'CrewDirector', item.item.id) }
    }
    if (item.item.operationsManagers.length) return { ...response('blocked', action, `Crew Director ${item.item.person.name} has Crew Operations Managers linked. Remove or move them first.`), ...entityDetails('', 'CrewDirector', item.item.id) }
    return { ...response('ready', action, `Remove Crew Director ${item.item.person.name}.`, [change('Crew Director', 'Name', item.item.person.name, null)]), resolvedIds: { crewDirectorId: item.item.id }, ...entityDetails('', 'CrewDirector', item.item.id) }
  }

  if (action.action.includes('crew_operations_manager')) {
    const item = findByName(reference.operationsManagers, targetName, 'Crew Operations Manager')
    if (item.status !== 'ready') return { ...response('needs_clarification', action, item.message, [], [], item.message), ...entityDetails('', 'OperationsManager', null) }
    if (action.action === 'update_crew_operations_manager_name') {
      if (!newName) return { ...response('needs_clarification', action, 'New Crew Operations Manager name is required.', [], [], 'What should the new name be?'), ...entityDetails('', 'OperationsManager', item.item.id) }
      return { ...response('ready', action, `Rename Crew Operations Manager ${item.item.person.name} to ${newName}.`, [change('Crew Operations Manager', 'Name', item.item.person.name, newName)]), resolvedIds: { operationsManagerId: item.item.id }, ...entityDetails('', 'OperationsManager', item.item.id) }
    }
    if (action.action === 'move_crew_operations_manager') {
      const parent = findByName(reference.crewDirectors, text(action.data.newParentCrewDirectorName), 'Crew Director')
      if (parent.status !== 'ready') return { ...response('needs_clarification', action, parent.message, [], [], parent.message), ...entityDetails('', 'OperationsManager', item.item.id) }
      const oldParent = reference.crewDirectors.find((director) => director.id === item.item.crewDirectorId)
      return { ...response('ready', action, `Move ${item.item.person.name} under ${parent.item.person.name}.`, [change('Crew Operations Manager', 'Parent Crew Director', oldParent?.person.name || null, parent.item.person.name)]), resolvedIds: { operationsManagerId: item.item.id, crewDirectorId: parent.item.id }, ...entityDetails('', 'OperationsManager', item.item.id) }
    }
    if (item.item.crewManagers.length) return { ...response('blocked', action, `Crew Operations Manager ${item.item.person.name} has Crew Managers linked. Remove or move them first.`), ...entityDetails('', 'OperationsManager', item.item.id) }
    return { ...response('ready', action, `Remove Crew Operations Manager ${item.item.person.name}.`, [change('Crew Operations Manager', 'Name', item.item.person.name, null)]), resolvedIds: { operationsManagerId: item.item.id }, ...entityDetails('', 'OperationsManager', item.item.id) }
  }

  if (action.action.includes('crew_manager')) {
    const item = findByName(reference.crewManagers, targetName, 'Crew Manager')
    if (item.status !== 'ready') return { ...response('needs_clarification', action, item.message, [], [], item.message), ...entityDetails('', 'CrewManager', null) }
    if (action.action === 'update_crew_manager_name') {
      if (!newName) return { ...response('needs_clarification', action, 'New Crew Manager name is required.', [], [], 'What should the new name be?'), ...entityDetails('', 'CrewManager', item.item.id) }
      return { ...response('ready', action, `Rename Crew Manager ${item.item.person.name} to ${newName}.`, [change('Crew Manager', 'Name', item.item.person.name, newName)]), resolvedIds: { crewManagerId: item.item.id }, ...entityDetails('', 'CrewManager', item.item.id) }
    }
    if (action.action === 'move_crew_manager') {
      const parent = findByName(reference.operationsManagers, text(action.data.newParentCrewOperationsManagerName), 'Crew Operations Manager')
      if (parent.status !== 'ready') return { ...response('needs_clarification', action, parent.message, [], [], parent.message), ...entityDetails('', 'CrewManager', item.item.id) }
      const oldParent = reference.operationsManagers.find((op) => op.id === item.item.operationsManagerId)
      return { ...response('ready', action, `Move ${item.item.person.name} under ${parent.item.person.name}.`, [change('Crew Manager', 'Parent Crew Operations Manager', oldParent?.person.name || null, parent.item.person.name)]), resolvedIds: { crewManagerId: item.item.id, operationsManagerId: parent.item.id }, ...entityDetails('', 'CrewManager', item.item.id) }
    }
    if (item.item.assistants.length || item.item.vesselAllocations.length) return { ...response('blocked', action, `Crew Manager ${item.item.person.name} has Assistants or Vessels linked. Remove or move them first.`), ...entityDetails('', 'CrewManager', item.item.id) }
    return { ...response('ready', action, `Remove Crew Manager ${item.item.person.name}.`, [change('Crew Manager', 'Name', item.item.person.name, null)]), resolvedIds: { crewManagerId: item.item.id }, ...entityDetails('', 'CrewManager', item.item.id) }
  }

  const assistant = findByName(reference.assistants, targetName, 'Assistant')
  if (assistant.status !== 'ready') return { ...response('needs_clarification', action, assistant.message, [], [], assistant.message), ...entityDetails('', 'Assistant', null) }
  if (action.action === 'update_assistant_name') {
    if (!newName) return { ...response('needs_clarification', action, 'New Assistant name is required.', [], [], 'What should the new name be?'), ...entityDetails('', 'Assistant', assistant.item.id) }
    return { ...response('ready', action, `Rename Assistant ${assistant.item.person.name} to ${newName}.`, [change('Assistant', 'Name', assistant.item.person.name, newName)]), resolvedIds: { assistantId: assistant.item.id }, ...entityDetails('', 'Assistant', assistant.item.id) }
  }
  if (action.action === 'move_assistant') {
    const parent = findByName(reference.crewManagers, text(action.data.newParentCrewManagerName), 'Crew Manager')
    if (parent.status !== 'ready') return { ...response('needs_clarification', action, parent.message, [], [], parent.message), ...entityDetails('', 'Assistant', assistant.item.id) }
    const oldParent = reference.crewManagers.find((cm) => cm.id === assistant.item.crewManagerId)
    return { ...response('ready', action, `Move ${assistant.item.person.name} under ${parent.item.person.name}.`, [change('Assistant', 'Parent Crew Manager', oldParent?.person.name || null, parent.item.person.name)]), resolvedIds: { assistantId: assistant.item.id, crewManagerId: parent.item.id }, ...entityDetails('', 'Assistant', assistant.item.id) }
  }
  return { ...response('ready', action, `Remove Assistant ${assistant.item.person.name}.`, [change('Assistant', 'Name', assistant.item.person.name, null)]), resolvedIds: { assistantId: assistant.item.id }, ...entityDetails('', 'Assistant', assistant.item.id) }
}

export async function applyAiPreview(preview: AiPreviewRecord, organizationId: string, userId: string, ipAddress: string | null) {
  const action = preview.structuredAction
  const data = action.data
  const target = action.target
  const ids = preview.resolvedIds
  let updatedEntity: { type: string; id: string; name: string }
  const before = await snapshotAffected(preview.affectedEntityType, preview.affectedEntityId)

  await prisma.$transaction(async (tx) => {
    switch (action.action) {
      case 'create_vessel': {
        const crewManager = await tx.crewManager.findUniqueOrThrow({ where: { id: ids.crewManagerId || '' }, include: { person: true } })
        const vessel = await tx.vessel.create({ data: { organizationId, name: text(data.vesselName || target.vesselName), vesselType: text(data.vesselType), vesselStatus: 'UPCOMING', managementType: 'FULL_MANAGED', sortOrder: 0 } })
        await tx.vesselAllocation.create({ data: { vesselId: vessel.id, crewManagerId: crewManager.id } })
        updatedEntity = { type: 'Vessel', id: vessel.id, name: vessel.name }
        break
      }
      case 'update_vessel_name':
      case 'update_vessel_type':
      case 'update_vessel_assignment': {
        const vessel = await tx.vessel.findUniqueOrThrow({ where: { id: ids.vesselId || '' } })
        if (action.action === 'update_vessel_name') await tx.vessel.update({ where: { id: vessel.id }, data: { name: text(data.newVesselName || data.newName) } })
        if (action.action === 'update_vessel_type') await tx.vessel.update({ where: { id: vessel.id }, data: { vesselType: text(data.vesselType) } })
        if (action.action === 'update_vessel_assignment') {
          const crewManager = await tx.crewManager.findUniqueOrThrow({ where: { id: ids.crewManagerId || '' } })
          await tx.vesselAllocation.upsert({ where: { vesselId: vessel.id }, create: { vesselId: vessel.id, crewManagerId: crewManager.id }, update: { crewManagerId: crewManager.id, assignedAssistantId: null, allocatedAt: new Date() } })
        }
        updatedEntity = { type: 'Vessel', id: vessel.id, name: action.action === 'update_vessel_name' ? text(data.newVesselName || data.newName) : vessel.name }
        break
      }
      case 'create_crew_director': {
        const person = await tx.person.create({ data: { organizationId, name: text(data.name), designation: 'Crew Director', workflowRole: 'CREW_DIRECTOR' } })
        const director = await tx.crewDirector.create({ data: { organizationId, personId: person.id, sortOrder: 0 } })
        updatedEntity = { type: 'Crew Director', id: director.id, name: person.name }
        break
      }
      case 'create_crew_operations_manager': {
        const parent = await tx.crewDirector.findUniqueOrThrow({ where: { id: ids.crewDirectorId || '' } })
        const person = await tx.person.create({ data: { organizationId, name: text(data.name), designation: 'Crew Operations Manager', workflowRole: 'OPERATIONS_MANAGER' } })
        const op = await tx.operationsManager.create({ data: { organizationId, crewDirectorId: parent.id, personId: person.id, sortOrder: 0 } })
        updatedEntity = { type: 'Crew Operations Manager', id: op.id, name: person.name }
        break
      }
      case 'create_crew_manager': {
        const parent = await tx.operationsManager.findUniqueOrThrow({ where: { id: ids.operationsManagerId || '' } })
        const person = await tx.person.create({ data: { organizationId, name: text(data.name), designation: 'Crew Manager', workflowRole: 'CREW_MANAGER' } })
        const cm = await tx.crewManager.create({ data: { organizationId, operationsManagerId: parent.id, personId: person.id, sortOrder: 0 } })
        updatedEntity = { type: 'Crew Manager', id: cm.id, name: person.name }
        break
      }
      case 'create_assistant': {
        const parent = await tx.crewManager.findUniqueOrThrow({ where: { id: ids.crewManagerId || '' } })
        const person = await tx.person.create({ data: { organizationId, name: text(data.name), designation: 'Assistant Crew Manager', workflowRole: 'ASSISTANT' } })
        const assistant = await tx.assistant.create({ data: { organizationId, crewManagerId: parent.id, personId: person.id, sortOrder: 0 } })
        updatedEntity = { type: 'Assistant', id: assistant.id, name: person.name }
        break
      }
      default:
        updatedEntity = await applyUpdateMoveRemove(tx, action, ids)
    }
  })

  const after = await snapshotAffected(updatedEntity!.type.replaceAll(' ', ''), updatedEntity!.id)
  await writeAuditLog({
    userId,
    action: `ai.${preview.action}`,
    entityType: updatedEntity!.type,
    entityId: updatedEntity!.id,
    beforeJson: { prompt: preview.prompt, previewSummary: preview.summary, before },
    afterJson: { prompt: preview.prompt, previewSummary: preview.summary, after },
    ipAddress,
  })
  return updatedEntity!
}

async function applyUpdateMoveRemove(tx: Prisma.TransactionClient, action: AiStructuredAction, ids: Record<string, string | null>) {
  const newName = text(action.data.newName)
  if (action.action.includes('crew_director')) {
    const item = await tx.crewDirector.findUniqueOrThrow({ where: { id: ids.crewDirectorId || '' }, include: { person: true } })
    if (action.action === 'update_crew_director_name') await tx.person.update({ where: { id: item.personId }, data: { name: newName } })
    if (action.action === 'remove_crew_director') await tx.crewDirector.delete({ where: { id: item.id } })
    return { type: 'Crew Director', id: item.id, name: newName || item.person.name }
  }
  if (action.action.includes('crew_operations_manager')) {
    const item = await tx.operationsManager.findUniqueOrThrow({ where: { id: ids.operationsManagerId || '' }, include: { person: true } })
    if (action.action === 'update_crew_operations_manager_name') await tx.person.update({ where: { id: item.personId }, data: { name: newName } })
    if (action.action === 'move_crew_operations_manager') {
      const parent = await tx.crewDirector.findUniqueOrThrow({ where: { id: ids.crewDirectorId || '' } })
      await tx.operationsManager.update({ where: { id: item.id }, data: { crewDirectorId: parent.id } })
    }
    if (action.action === 'remove_crew_operations_manager') await tx.operationsManager.delete({ where: { id: item.id } })
    return { type: 'Crew Operations Manager', id: item.id, name: newName || item.person.name }
  }
  if (action.action.includes('crew_manager')) {
    const item = await tx.crewManager.findUniqueOrThrow({ where: { id: ids.crewManagerId || '' }, include: { person: true } })
    if (action.action === 'update_crew_manager_name') await tx.person.update({ where: { id: item.personId }, data: { name: newName } })
    if (action.action === 'move_crew_manager') {
      const parent = await tx.operationsManager.findUniqueOrThrow({ where: { id: ids.operationsManagerId || '' } })
      await tx.crewManager.update({ where: { id: item.id }, data: { operationsManagerId: parent.id } })
    }
    if (action.action === 'remove_crew_manager') await tx.crewManager.delete({ where: { id: item.id } })
    return { type: 'Crew Manager', id: item.id, name: newName || item.person.name }
  }
  const item = await tx.assistant.findUniqueOrThrow({ where: { id: ids.assistantId || '' }, include: { person: true } })
  if (action.action === 'update_assistant_name') await tx.person.update({ where: { id: item.personId }, data: { name: newName } })
  if (action.action === 'move_assistant') {
    const parent = await tx.crewManager.findUniqueOrThrow({ where: { id: ids.crewManagerId || '' } })
    await tx.assistant.update({ where: { id: item.id }, data: { crewManagerId: parent.id } })
  }
  if (action.action === 'remove_assistant') await tx.assistant.delete({ where: { id: item.id } })
  return { type: 'Assistant', id: item.id, name: newName || item.person.name }
}

async function snapshotAffected(type: string, id: string | null) {
  if (!id) return null
  if (type.includes('Vessel')) return prisma.vessel.findUnique({ where: { id }, include: { vesselAllocations: true } })
  if (type.includes('CrewDirector')) return prisma.crewDirector.findUnique({ where: { id }, include: { person: true, operationsManagers: true } })
  if (type.includes('OperationsManager')) return prisma.operationsManager.findUnique({ where: { id }, include: { person: true, crewManagers: true } })
  if (type.includes('CrewManager')) return prisma.crewManager.findUnique({ where: { id }, include: { person: true, assistants: true, vesselAllocations: true } })
  if (type.includes('Assistant')) return prisma.assistant.findUnique({ where: { id }, include: { person: true } })
  return null
}
