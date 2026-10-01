import { Layers3, Pencil, Plus, Trash2, UserPlus } from 'lucide-react'
import type { CSSProperties, DragEvent, ReactNode } from 'react'
import type { ManagementHierarchyPositionNode, OperationsManagerNode } from '../types'

export function ManagementHierarchyTree({ positions, operationsManagers, canEdit, draggingOperationsManager, onAddLevel, onAddOperationsManager, onEdit, onRemove, onDropOperationsManager }: {
  positions: ManagementHierarchyPositionNode[]
  operationsManagers: OperationsManagerNode[]
  canEdit: boolean
  draggingOperationsManager: boolean
  onAddLevel: (parent: ManagementHierarchyPositionNode) => void
  onAddOperationsManager: (parent: ManagementHierarchyPositionNode) => void
  onEdit: (position: ManagementHierarchyPositionNode) => void
  onRemove: (position: ManagementHierarchyPositionNode, hasReports: boolean) => void
  onDropOperationsManager: (position: ManagementHierarchyPositionNode) => void
}) {
  const positionsByParent = new Map<string, ManagementHierarchyPositionNode[]>()
  const operationsByPosition = new Map<string, OperationsManagerNode[]>()
  for (const position of positions) {
    const key = position.parentPositionId || 'root'
    const siblings = positionsByParent.get(key) ?? []
    siblings.push(position)
    positionsByParent.set(key, siblings)
  }
  for (const siblings of positionsByParent.values()) siblings.sort((a, b) => a.sortOrder - b.sortOrder || a.person.name.localeCompare(b.person.name))
  for (const manager of operationsManagers) {
    if (!manager.managementHierarchyPositionId) continue
    const reports = operationsByPosition.get(manager.managementHierarchyPositionId) ?? []
    reports.push(manager)
    operationsByPosition.set(manager.managementHierarchyPositionId, reports)
  }

  const renderBranch = (position: ManagementHierarchyPositionNode, depth: number, visited: Set<string>): ReactNode => {
    if (visited.has(position.id)) return <div className="management-tree-warning" role="alert">Circular reporting line hidden</div>
    const nextVisited = new Set(visited).add(position.id)
    const children = positionsByParent.get(position.id) ?? []
    const directOperations = operationsByPosition.get(position.id) ?? []
    const hasReports = children.length > 0 || directOperations.length > 0
    return <div className="management-branch" key={position.id} style={{ '--management-depth': depth } as CSSProperties}>
      <article
        className={`management-position-card ${draggingOperationsManager ? 'management-position-card--drop-ready' : ''}`}
        onDragOver={(event: DragEvent) => { if (draggingOperationsManager) event.preventDefault() }}
        onDrop={(event: DragEvent) => { if (!draggingOperationsManager) return; event.preventDefault(); event.stopPropagation(); onDropOperationsManager(position) }}
      >
        <span className="management-position-card__level">{position.levelName}</span>
        <strong>{position.person.name}</strong>
        <small>{position.person.designation}</small>
        <span className="management-position-card__count">{children.length + directOperations.length} direct report{children.length + directOperations.length === 1 ? '' : 's'}</span>
        {canEdit ? <div className="management-position-card__actions">
          <button type="button" onClick={() => onEdit(position)} aria-label={`Edit ${position.person.name}`} title="Edit position"><Pencil size={13} /></button>
          <button type="button" onClick={() => onAddLevel(position)} aria-label={`Add management level under ${position.person.name}`} title="Add another reporting level"><Layers3 size={13} /><Plus size={10} /></button>
          <button type="button" onClick={() => onAddOperationsManager(position)} aria-label={`Add Operations Manager under ${position.person.name}`} title="Add Operations Manager"><UserPlus size={14} /></button>
          <button type="button" disabled={hasReports} onClick={() => onRemove(position, hasReports)} aria-label={`Remove ${position.person.name} from chart`} title={hasReports ? 'Move direct reports before removing this position' : 'Remove this position from the chart'}><Trash2 size={13} /></button>
        </div> : null}
        {directOperations.length ? <div className="management-position-card__reports" aria-label="Direct Operations Managers">{directOperations.map((manager) => <span key={manager.reportingLineId || manager.id}>{manager.person.name}</span>)}</div> : null}
      </article>
      {children.length ? <div className="management-children">{children.map((child) => renderBranch(child, depth + 1, nextVisited))}</div> : null}
    </div>
  }

  const roots = positionsByParent.get('root') ?? []
  return roots.length ? <div className="management-hierarchy-tree">{roots.map((position) => renderBranch(position, 0, new Set()))}</div> : null
}
