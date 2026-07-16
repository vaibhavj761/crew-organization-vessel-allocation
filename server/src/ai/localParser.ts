import type { AiDomain, AiStructuredAction } from './types.js'

export type AiScope = 'auto' | 'vessel_master' | 'organization_chart'

const emptyTarget = {
  crewDirectorName: null,
  crewOperationsManagerName: null,
  deputyManagerName: null,
  crewManagerName: null,
  assistantName: null,
  vesselName: null,
}

const emptyData = {
  name: null,
  newName: null,
  designation: null,
  newDesignation: null,
  vesselName: null,
  newVesselName: null,
  vesselType: null,
  assignmentCrewManagerName: null,
  parentCrewDirectorName: null,
  parentCrewOperationsManagerName: null,
  parentDeputyManagerName: null,
  parentCrewManagerName: null,
  newParentCrewDirectorName: null,
  newParentCrewOperationsManagerName: null,
  newParentDeputyManagerName: null,
  newParentCrewManagerName: null,
}

function clean(value: string | undefined) {
  return value?.trim().replace(/[.。]+$/, '') || null
}

function action(input: Partial<AiStructuredAction> & Pick<AiStructuredAction, 'domain' | 'action'>): AiStructuredAction {
  return {
    confidence: 0.95,
    target: { ...emptyTarget },
    data: { ...emptyData },
    clarifyingQuestion: null,
    reasoningSummary: input.summary || '',
    summary: '',
    warnings: [],
    ...input,
  }
}

export function detectPromptDomain(prompt: string): AiDomain | null {
  const text = prompt.toLowerCase()
  if (/\b(vessel|ship|bulk carrier|container|tanker|lng|lpg|assign(?:ment)?(?: it)? to|vessel type|handle|give to|should get)\b/.test(text)) return 'vessel_master'
  if (/\b(crew director|crew operations manager|operations manager|deputy manager|deputy crew manager|crew manager|assistant)\b/.test(text)) return 'organization_chart'
  return null
}

export function scopeMismatchMessage(scope: AiScope | undefined, detected: AiDomain | null) {
  if (!detected || !scope || scope === 'auto' || scope === detected) return null
  return detected === 'vessel_master'
    ? 'This looks like a Vessel Master update. Please switch scope to Vessel Master or Auto-detect.'
    : 'This looks like an Organization Chart update. Please switch scope to Organization Chart or Auto-detect.'
}

export function parseLocalAiInstruction(prompt: string): AiStructuredAction | null {
  const text = prompt.trim()
  if (!text) return null
  const blocked = /(user|role|password|permission|sql|database|environment|session|maritime infinity|delete all|remove all)/i
  if (blocked.test(text)) {
    return action({
      domain: 'unsupported',
      action: 'unsupported',
      confidence: 1,
      summary: 'I can help only with approved Vessel Master and Organization Chart updates in this version.',
    })
  }

  const deleteVessel = text.match(/^(?:delete|remove) vessel\s+(.+?)\.?$/i)
  if (deleteVessel) {
    return action({
      domain: 'unsupported',
      action: 'unsupported',
      confidence: 1,
      target: { ...emptyTarget, vesselName: clean(deleteVessel[1]) },
      summary: 'Deleting vessels through AI is not supported in this version. Please use the Vessel Master controls with confirmation.',
    })
  }

  const createCalledVessel = text.match(/^(?:please\s+)?(?:create|add)(?: one)?(?: new)?\s+(.+?)\s+called\s+(.+?)\s+(?:and\s+)?(?:give it to|assign(?: it)? to)\s+(.+?)\.?$/i)
  if (createCalledVessel && /vessel|bulk carrier|container|tanker|lng carrier|lpg carrier|general cargo|offshore vessel|chemical tanker|oil tanker|ro-ro|roro|car carrier|crew boat|supply vessel/i.test(createCalledVessel[1])) {
    const vesselType = clean(createCalledVessel[1].replace(/\b(?:vessel|ship)\b/ig, ''))
    const vesselName = clean(createCalledVessel[2])
    const crewManagerName = clean(createCalledVessel[3])
    return action({
      domain: 'vessel_master',
      action: 'create_vessel',
      target: { ...emptyTarget, vesselName },
      data: { ...emptyData, vesselName, vesselType, assignmentCrewManagerName: crewManagerName },
      summary: `Create vessel ${vesselName}.`,
    })
  }

  const addVesselUnder = text.match(/^(?:please\s+)?(?:add|create)\s+(.+?)\s+vessel\s+under\s+(.+?),?\s+(?:it is|type is|vessel type is)\s+(?:a\s+|an\s+)?(.+?)\.?$/i)
  if (addVesselUnder) {
    const vesselName = clean(addVesselUnder[1])
    const crewManagerName = clean(addVesselUnder[2])
    const vesselType = clean(addVesselUnder[3])
    return action({
      domain: 'vessel_master',
      action: 'create_vessel',
      target: { ...emptyTarget, vesselName },
      data: { ...emptyData, vesselName, vesselType, assignmentCrewManagerName: crewManagerName },
      summary: `Create vessel ${vesselName}.`,
    })
  }

  const addNewVesselUnderCrewManager = text.match(/^(?:please\s+)?(?:add|create)(?: new)? vessel\s+(.+?)\s+under\s+(?:crew manager\s+)?(.+?)\s+type\s+(.+?)\.?$/i)
  if (addNewVesselUnderCrewManager) {
    const vesselName = clean(addNewVesselUnderCrewManager[1])
    const crewManagerName = clean(addNewVesselUnderCrewManager[2])
    const vesselType = clean(addNewVesselUnderCrewManager[3])
    return action({
      domain: 'vessel_master',
      action: 'create_vessel',
      target: { ...emptyTarget, vesselName },
      data: { ...emptyData, vesselName, vesselType, assignmentCrewManagerName: crewManagerName },
      summary: `Create vessel ${vesselName}.`,
    })
  }

  const addVesselUnderCasual = text.match(/^(?:please\s+)?(?:add|create)(?: new)? vessel\s+(.+?)\s+under\s+(?:crew manager\s+)?(.+?)\s+((?:bulk carrier|container|tanker|lng carrier|lpg carrier|general cargo|offshore vessel|chemical tanker|oil tanker|ro-ro|roro|car carrier|crew boat|supply vessel))\.?$/i)
  if (addVesselUnderCasual) {
    const vesselName = clean(addVesselUnderCasual[1])
    const crewManagerName = clean(addVesselUnderCasual[2])
    const vesselType = clean(addVesselUnderCasual[3])
    return action({
      domain: 'vessel_master',
      action: 'create_vessel',
      target: { ...emptyTarget, vesselName },
      data: { ...emptyData, vesselName, vesselType, assignmentCrewManagerName: crewManagerName },
      summary: `Create vessel ${vesselName}.`,
    })
  }

  const addVesselAs = text.match(/^(?:add|create)(?: new)? vessel\s+(.+?)\s+as\s+(.+?)\.?\s+(?:assignment is with|assign(?: it)? to|to)\s+(.+?)\.?$/i)
  if (addVesselAs) {
    const vesselName = clean(addVesselAs[1])
    const vesselType = clean(addVesselAs[2])
    const crewManagerName = clean(addVesselAs[3])
    return action({
      domain: 'vessel_master',
      action: 'create_vessel',
      target: { ...emptyTarget, vesselName },
      data: { ...emptyData, vesselName, vesselType, assignmentCrewManagerName: crewManagerName },
      summary: `Create vessel ${vesselName}.`,
    })
  }

  const createVesselSentences = text.match(/^(?:add|create)(?: new)? vessel\s+(.+?)\.?\s+vessel type is\s+(.+?)\.?\s+assign(?: it)? to\s+(.+?)\.?$/i)
  if (createVesselSentences) {
    const vesselName = clean(createVesselSentences[1])
    const vesselType = clean(createVesselSentences[2])
    const crewManagerName = clean(createVesselSentences[3])
    return action({
      domain: 'vessel_master',
      action: 'create_vessel',
      target: { ...emptyTarget, vesselName },
      data: { ...emptyData, vesselName, vesselType, assignmentCrewManagerName: crewManagerName },
      summary: `Create vessel ${vesselName}.`,
    })
  }

  const addVesselCompact = text.match(/^(?:add|create)(?: new)? vessel\s+(.+?)\s+((?:bulk carrier|container|tanker|lng carrier|lpg carrier|general cargo|offshore vessel|chemical tanker|oil tanker|ro-ro|roro|car carrier|crew boat|supply vessel))\s+to\s+(.+?)\.?$/i)
  if (addVesselCompact) {
    const vesselName = clean(addVesselCompact[1])
    const vesselType = clean(addVesselCompact[2])
    const crewManagerName = clean(addVesselCompact[3])
    return action({
      domain: 'vessel_master',
      action: 'create_vessel',
      target: { ...emptyTarget, vesselName },
      data: { ...emptyData, vesselName, vesselType, assignmentCrewManagerName: crewManagerName },
      summary: `Create vessel ${vesselName}.`,
    })
  }

  const newVesselCompact = text.match(/^new\s+((?:bulk carrier|container|tanker|lng carrier|lpg carrier|general cargo|offshore vessel|chemical tanker|oil tanker|ro-ro|roro|car carrier|crew boat|supply vessel))\s+(.+?)\s+(?:give to|assign to|to)\s+(.+?)\.?$/i)
  if (newVesselCompact) {
    const vesselType = clean(newVesselCompact[1])
    const vesselName = clean(newVesselCompact[2])
    const crewManagerName = clean(newVesselCompact[3])
    return action({
      domain: 'vessel_master',
      action: 'create_vessel',
      target: { ...emptyTarget, vesselName },
      data: { ...emptyData, vesselName, vesselType, assignmentCrewManagerName: crewManagerName },
      summary: `Create vessel ${vesselName}.`,
    })
  }

  const renameVessel = text.match(/^rename vessel\s+(.+?)\s+to\s+(.+?)\.?$/i) || text.match(/^rename\s+(.+?)\s+to\s+(.+?)\.?$/i)
  if (renameVessel && !/^rename\s+crew\s+/i.test(text)) {
    return action({
      domain: 'vessel_master',
      action: 'update_vessel_name',
      target: { ...emptyTarget, vesselName: clean(renameVessel[1]) },
      data: { ...emptyData, vesselName: clean(renameVessel[1]), newVesselName: clean(renameVessel[2]) },
      summary: `Rename vessel ${clean(renameVessel[1])}.`,
    })
  }

  const changeVesselType = text.match(/^(?:change|update) vessel\s+(.+?)\s+type to\s+(.+?)\.?$/i) || text.match(/^(?:change|update)\s+(.+?)\s+vessel type to\s+(.+?)\.?$/i)
  if (changeVesselType) {
    return action({
      domain: 'vessel_master',
      action: 'update_vessel_type',
      target: { ...emptyTarget, vesselName: clean(changeVesselType[1]) },
      data: { ...emptyData, vesselName: clean(changeVesselType[1]), vesselType: clean(changeVesselType[2]) },
      summary: `Update vessel type for ${clean(changeVesselType[1])}.`,
    })
  }

  const assignVessel = text.match(/^assign vessel\s+(.+?)\s+to\s+(.+?)\.?$/i) || text.match(/^assign\s+(.+?)\s+to\s+(.+?)\.?$/i)
  if (assignVessel) {
    return action({
      domain: 'vessel_master',
      action: 'update_vessel_assignment',
      target: { ...emptyTarget, vesselName: clean(assignVessel[1]) },
      data: { ...emptyData, vesselName: clean(assignVessel[1]), assignmentCrewManagerName: clean(assignVessel[2]) },
      summary: `Assign vessel ${clean(assignVessel[1])}.`,
    })
  }

  const handleVessel = text.match(/^(.+?)\s+will handle\s+(.+?)\s+from now\.?$/i) || text.match(/^give\s+(.+?)\s+to\s+(.+?)\.?$/i)
  if (handleVessel) {
    const first = clean(handleVessel[1])
    const second = clean(handleVessel[2])
    const vesselName = /^give\s+/i.test(text) ? first : second
    const crewManagerName = /^give\s+/i.test(text) ? second : first
    return action({
      domain: 'vessel_master',
      action: 'update_vessel_assignment',
      target: { ...emptyTarget, vesselName },
      data: { ...emptyData, vesselName, assignmentCrewManagerName: crewManagerName },
      summary: `Assign vessel ${vesselName}.`,
    })
  }

  const shouldGetVessel = text.match(/^(.+?)\s+should get\s+(.+?)\s+vessel\.?$/i)
  if (shouldGetVessel) {
    const crewManagerName = clean(shouldGetVessel[1])
    const vesselName = clean(shouldGetVessel[2])
    return action({
      domain: 'vessel_master',
      action: 'update_vessel_assignment',
      target: { ...emptyTarget, vesselName },
      data: { ...emptyData, vesselName, assignmentCrewManagerName: crewManagerName },
      summary: `Assign vessel ${vesselName}.`,
    })
  }

  const createOps = text.match(/^add(?: one)? crew (?:operations|ops|operation) manager named\s+(.+?)\s+under\s+(.+?)\.?$/i) || text.match(/^add(?: one)? crew (?:operations|ops|operation) manager\s+(.+?)\s+under\s+(.+?)\.?$/i) || text.match(/^make one ops manager\s+(.+?)\s+below\s+(.+?)\.?$/i)
  if (createOps) {
    return action({
      domain: 'organization_chart',
      action: 'create_crew_operations_manager',
      data: { ...emptyData, name: clean(createOps[1]), parentCrewDirectorName: clean(createOps[2]) },
      summary: `Create Crew Operations Manager ${clean(createOps[1])}.`,
    })
  }

  const createDeputy = text.match(/^(?:add|create)(?: one)? (?:deputy manager|deputy crew manager)(?: named)?\s+(.+?)\s+(?:under|below)\s+(?:crew operations manager\s+)?(.+?)\.?$/i)
  if (createDeputy) {
    return action({
      domain: 'organization_chart',
      action: 'create_deputy_manager',
      data: { ...emptyData, name: clean(createDeputy[1]), parentCrewOperationsManagerName: clean(createDeputy[2]) },
      summary: `Create Deputy Manager ${clean(createDeputy[1])}.`,
    })
  }

  const updateDesignation = text.match(/^(?:change|update|set) (crew director|crew operations manager|operations manager|deputy manager|deputy crew manager|crew manager)\s+(.+?)\s+(?:designation|title)\s+to\s+(.+?)\.?$/i)
  if (updateDesignation) {
    const role = updateDesignation[1].toLowerCase()
    const personName = clean(updateDesignation[2])
    const newDesignation = clean(updateDesignation[3])
    if (role === 'crew director') return action({ domain: 'organization_chart', action: 'update_crew_director_designation', target: { ...emptyTarget, crewDirectorName: personName }, data: { ...emptyData, newDesignation }, summary: `Update the designation for ${personName}.` })
    if (role.includes('operations')) return action({ domain: 'organization_chart', action: 'update_crew_operations_manager_designation', target: { ...emptyTarget, crewOperationsManagerName: personName }, data: { ...emptyData, newDesignation }, summary: `Update the designation for ${personName}.` })
    if (role.includes('deputy')) return action({ domain: 'organization_chart', action: 'update_deputy_manager_designation', target: { ...emptyTarget, deputyManagerName: personName }, data: { ...emptyData, newDesignation }, summary: `Update the designation for ${personName}.` })
    return action({ domain: 'organization_chart', action: 'update_crew_manager_designation', target: { ...emptyTarget, crewManagerName: personName }, data: { ...emptyData, newDesignation }, summary: `Update the designation for ${personName}.` })
  }

  const renameDeputy = text.match(/^rename (?:deputy manager|deputy crew manager)\s+(.+?)\s+to\s+(.+?)\.?$/i)
  if (renameDeputy) {
    return action({
      domain: 'organization_chart',
      action: 'update_deputy_manager_name',
      target: { ...emptyTarget, deputyManagerName: clean(renameDeputy[1]) },
      data: { ...emptyData, newName: clean(renameDeputy[2]) },
      summary: `Rename Deputy Manager ${clean(renameDeputy[1])}.`,
    })
  }

  const createCrewManagerUnderDeputy = text.match(/^add crew manager\s+(.+?)\s+under (?:deputy manager\s+)?(.+?)\.?$/i)
  if (createCrewManagerUnderDeputy && !/crew operations manager/i.test(text)) {
    return action({
      domain: 'organization_chart',
      action: 'create_crew_manager',
      data: { ...emptyData, name: clean(createCrewManagerUnderDeputy[1]), parentDeputyManagerName: clean(createCrewManagerUnderDeputy[2]) },
      summary: `Create Crew Manager ${clean(createCrewManagerUnderDeputy[1])}.`,
    })
  }

  const createCrewManager = text.match(/^add crew manager\s+(.+?)\s+under crew operations manager\s+(.+?)\.?$/i)
  if (createCrewManager) {
    return action({
      domain: 'organization_chart',
      action: 'create_crew_manager',
      data: { ...emptyData, name: clean(createCrewManager[1]), parentCrewOperationsManagerName: clean(createCrewManager[2]) },
      summary: `Create Crew Manager ${clean(createCrewManager[1])}.`,
    })
  }

  const createCrewManagerCasual = text.match(/^(?:please\s+)?put\s+(.+?)\s+(?:below|under)\s+(.+?)\s+in (?:the )?crew manager section\.?$/i) || text.match(/^put\s+(.+?)\s+(?:below|under)\s+(.+?)\.?$/i) || text.match(/^i want a new crew manager called\s+(.+?)\s+under\s+(.+?)\.?$/i) || text.match(/^add\s+(.+?)\s+under\s+(.+?)\s+as crew manager\.?$/i)
  if (createCrewManagerCasual) {
    return action({
      domain: 'organization_chart',
      action: 'create_crew_manager',
      data: { ...emptyData, name: clean(createCrewManagerCasual[1]), parentCrewOperationsManagerName: clean(createCrewManagerCasual[2]) },
      summary: `Create Crew Manager ${clean(createCrewManagerCasual[1])}.`,
    })
  }

  const createAssistant = text.match(/^add assistant\s+(.+?)\s+under crew manager\s+(.+?)\.?$/i) || text.match(/^add assistant\s+(.+?)\s+for\s+(.+?)\.?$/i) || text.match(/^add\s+(.+?)\s+in\s+(.+?)\s+team\.?$/i) || text.match(/^add one assistant under\s+(.+?)\s+called\s+(.+?)\.?$/i)
  if (createAssistant) {
    const name = /^add one assistant under/i.test(text) ? clean(createAssistant[2]) : clean(createAssistant[1])
    const parent = /^add one assistant under/i.test(text) ? clean(createAssistant[1]) : clean(createAssistant[2])
    return action({
      domain: 'organization_chart',
      action: 'create_assistant',
      data: { ...emptyData, name, parentCrewManagerName: parent },
      summary: `Create Assistant ${name}.`,
    })
  }

  const ambiguousUnder = text.match(/^add\s+(.+?)\s+under\s+(.+?)\.?$/i)
  if (ambiguousUnder) {
    return action({
      domain: 'organization_chart',
      action: 'create_crew_manager',
      confidence: 0.45,
      data: { ...emptyData, name: clean(ambiguousUnder[1]), parentCrewOperationsManagerName: clean(ambiguousUnder[2]) },
      clarifyingQuestion: `Should ${clean(ambiguousUnder[1])} be added as a Crew Manager under Crew Operations Manager ${clean(ambiguousUnder[2])}?`,
      summary: 'This request needs clarification before any update can be prepared.',
    })
  }

  const renameCrewManager = text.match(/^rename crew manager\s+(.+?)\s+to\s+(.+?)\.?$/i)
  if (renameCrewManager) {
    return action({
      domain: 'organization_chart',
      action: 'update_crew_manager_name',
      target: { ...emptyTarget, crewManagerName: clean(renameCrewManager[1]) },
      data: { ...emptyData, newName: clean(renameCrewManager[2]) },
      summary: `Rename Crew Manager ${clean(renameCrewManager[1])}.`,
    })
  }

  const moveAssistant = text.match(/^move assistant\s+(.+?)(?:\s+from\s+.+?)?\s+under crew manager\s+(.+?)\.?$/i) || text.match(/^move assistant\s+(.+?)\s+to\s+(.+?)\.?$/i) || text.match(/^move\s+(.+?)\s+from\s+.+?\s+team\s+to\s+(.+?)\s+team\.?$/i)
  if (moveAssistant) {
    return action({
      domain: 'organization_chart',
      action: 'move_assistant',
      target: { ...emptyTarget, assistantName: clean(moveAssistant[1]) },
      data: { ...emptyData, newParentCrewManagerName: clean(moveAssistant[2]) },
      summary: `Move Assistant ${clean(moveAssistant[1])}.`,
    })
  }

  const removeAssistant = text.match(/^remove assistant\s+(.+?)\.?$/i) || text.match(/^remove\s+(.+?)\s+from\s+.+?\s+team\.?$/i)
  if (removeAssistant) {
    return action({
      domain: 'unsupported',
      action: 'unsupported',
      target: { ...emptyTarget, assistantName: clean(removeAssistant[1]) },
      summary: 'Removing organization records through AI is not supported. Use the manual editor and its confirmation controls.',
    })
  }

  return null
}

export function parseLocalAiInstructions(prompt: string): AiStructuredAction[] | null {
  const normalizedLines = prompt
    .split(/\r?\n|;/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
  if (normalizedLines.length <= 1) {
    const single = parseLocalAiInstruction(prompt)
    return single ? [single] : null
  }
  const actions = normalizedLines.slice(0, 50).map(parseLocalAiInstruction)
  return actions.every((item): item is AiStructuredAction => Boolean(item)) ? actions : null
}
