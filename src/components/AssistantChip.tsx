import type { Assistant } from '../types'

export function AssistantChip({ assistant, allocation = false }: { assistant: Assistant; allocation?: boolean }) {
  return (
    <div className={`assistant-chip ${allocation ? 'allocation' : ''}`}>
      <span className="avatar">{assistant.name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'A'}</span>
      <span><strong>{assistant.name || 'Unnamed assistant'}</strong><small>{assistant.designation || 'Assistant'}</small></span>
    </div>
  )
}
