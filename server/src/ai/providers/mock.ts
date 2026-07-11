import type { AiReferenceData } from '../reference.js'
import type { AiStructuredAction } from '../types.js'
import { parseLocalAiInstruction } from '../localParser.js'
import { unsupportedAction } from './shared.js'

export async function interpretWithMock(prompt: string, reference: AiReferenceData): Promise<AiStructuredAction> {
  void reference
  return parseLocalAiInstruction(prompt) || unsupportedAction()
}
