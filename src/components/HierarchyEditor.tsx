import { Plus, Trash2 } from 'lucide-react'
import { useChart } from '../state/ChartContext'
import type { Assistant, CrewDirectorNode, CrewManagerNode, OperationsManagerNode } from '../types'
import { createId } from '../utils/createId'
import { PersonFields, TextField } from './FormFields'

const id = () => createId()
const person = <R extends 'CREW_DIRECTOR' | 'OPERATIONS_MANAGER' | 'CREW_MANAGER'>(role: R) => ({
  id: id(),
  name: role === 'CREW_DIRECTOR' ? 'New Crew Director' : role === 'OPERATIONS_MANAGER' ? 'New Operations Manager' : 'New Crew Manager',
  designation: '',
  workflowRole: role,
  email: '',
  phone: '',
  notes: '',
} as const)

export function HierarchyEditor() {
  const { data, dispatch, loadState } = useChart()
  const addDirector = () => {
    if (loadState !== 'ready') return
    const value: CrewDirectorNode = { id: id(), sortOrder: data.crewDirectors.length + 1, person: person('CREW_DIRECTOR') }
    dispatch({ type: 'addCrewDirector', value })
  }

  return (
    <div className="hierarchy-editor">
      {data.crewDirectors.map((director) => {
        const directorOps = data.operationsManagers.filter((op) => op.crewDirectorId === director.id)
        return (
          <details className="ops-editor" key={director.id} open>
            <summary><strong>{director.person.name}</strong><span>{directorOps.length} operations managers</span></summary>
            <div className="ops-editor-body">
              <PersonFields person={director.person} onChange={(v) => dispatch({ type: 'updateCrewDirector', id: director.id, value: v as typeof director.person })} />
              <div className="subsection-heading spaced">
                <h4>Operations Managers</h4>
                <button type="button" className="mini-add" disabled={loadState !== 'ready'} onClick={() => dispatch({ type: 'addOperationsManager', value: { id: id(), crewDirectorId: director.id, sortOrder: directorOps.length + 1, person: person('OPERATIONS_MANAGER'), crewManagers: [] } })}><Plus size={13} /> Add</button>
              </div>
              {directorOps.length ? directorOps.map((op) => <OperationsManagerEditor key={op.id} op={op} />) : <div className="editor-empty">Select or add a Crew Director to create Operations Managers.</div>}
              <button type="button" className="button ghost danger-text" onClick={() => confirm('Delete this Crew Director? Operations Manager hierarchy under it must already be empty.') && dispatch({ type: 'deleteCrewDirector', id: director.id })}><Trash2 size={13} /> Delete Crew Director</button>
            </div>
          </details>
        )
      })}
      {!data.crewDirectors.length && <div className="editor-empty">No Crew Directors added yet.</div>}
      <button type="button" className="button add-team" onClick={addDirector} disabled={loadState !== 'ready'}><Plus size={14} /> Add Crew Director</button>
    </div>
  )
}

function OperationsManagerEditor({ op }: { op: OperationsManagerNode }) {
  const { data, dispatch, loadState } = useChart()
  return (
    <details className="nested-editor" open>
      <summary><span><strong>{op.person.name}</strong><small>{op.crewManagers.length} crew managers</small></span></summary>
      <div className="nested-form">
        <p className="helper-copy">Adding Crew Manager under Operations Manager: {op.person.name}</p>
        <PersonFields person={op.person} onChange={(v) => dispatch({ type: 'updateOperationsManager', id: op.id, value: v as typeof op.person })} />
        <label className="field">
          <span>Parent Crew Director</span>
          <select value={op.crewDirectorId} onChange={(e) => dispatch({ type: 'moveOperationsManager', id: op.id, crewDirectorId: e.target.value })}>
            {data.crewDirectors.map((item) => <option key={item.id} value={item.id}>{item.person.name}</option>)}
          </select>
        </label>
        <div className="subsection-heading spaced">
          <h4>Crew Managers</h4>
          <button type="button" className="mini-add" disabled={loadState !== 'ready'} onClick={() => dispatch({ type: 'addCrewManager', operationsManagerId: op.id, value: { id: id(), sortOrder: op.crewManagers.length + 1, person: person('CREW_MANAGER'), assistants: [], vesselIds: [] } })}><Plus size={13} /> Add</button>
        </div>
        {op.crewManagers.length ? op.crewManagers.map((cm) => <CrewManagerEditor key={cm.id} op={op} cm={cm} />) : <div className="editor-empty">Select an Operations Manager to add Crew Managers.</div>}
        <button type="button" className="button ghost danger-text" onClick={() => confirm(`Delete Operations Manager ${op.person.name}? Crew Manager vessel assignments must already be cleared.`) && dispatch({ type: 'deleteOperationsManager', id: op.id })}><Trash2 size={13} /> Delete Operations Manager</button>
      </div>
    </details>
  )
}

function CrewManagerEditor({ op, cm }: { op: OperationsManagerNode; cm: CrewManagerNode }) {
  const { data, dispatch, loadState } = useChart()
  const addAssistant = () => {
    if (loadState !== 'ready') return
    const value: Assistant = { id: id(), name: 'New Assistant', designation: '', workflowRole: 'ASSISTANT', email: '', phone: '', notes: '', sortOrder: cm.assistants.length + 1 }
    dispatch({ type: 'addAssistant', crewManagerId: cm.id, value })
  }
  return (
    <details className="nested-editor">
      <summary><span><strong>{cm.person.name}</strong><small>{cm.assistants.length} assistants · {cm.vesselIds.length} vessels</small></span></summary>
      <div className="nested-form">
        <p className="helper-copy">Adding Assistant under Crew Manager: {cm.person.name}</p>
        <PersonFields person={cm.person} onChange={(v) => dispatch({ type: 'updateCrewManager', operationsManagerId: op.id, id: cm.id, value: v as typeof cm.person })} />
        <label className="field">
          <span>Move to Operations Manager</span>
          <select value={op.id} onChange={e=>dispatch({type:'moveCrewManager',fromOperationsManagerId:op.id,toOperationsManagerId:e.target.value,id:cm.id})}>
            {data.operationsManagers.map(x=><option key={x.id} value={x.id}>{x.person.name}</option>)}
          </select>
        </label>
        <div className="subsection-heading spaced">
          <h4>Assistants</h4>
          <button type="button" className="mini-add" onClick={addAssistant} disabled={loadState !== 'ready'}><Plus size={13}/> Add</button>
        </div>
        {cm.assistants.map(a=><div className="assistant-editor-row" key={a.id}><TextField label="Name" value={a.name} onChange={name=>dispatch({type:'updateAssistant',crewManagerId:cm.id,value:{...a,name}})}/><TextField label="Designation" value={a.designation} onChange={designation=>dispatch({type:'updateAssistant',crewManagerId:cm.id,value:{...a,designation}})}/><button type="button" className="tiny-icon danger-text" onClick={()=>confirm('Delete this assistant? Vessel responsibility links will be cleared.')&&dispatch({type:'deleteAssistant',crewManagerId:cm.id,assistantId:a.id})}><Trash2 size={13}/></button></div>)}
        {!cm.assistants.length && <div className="editor-empty">No assistants added yet.</div>}
        <button type="button" className="button ghost danger-text" onClick={()=>confirm('Delete this Crew Manager? Vessel assignments will be cleared.')&&dispatch({type:'deleteCrewManager',operationsManagerId:op.id,id:cm.id})}><Trash2 size={13}/> Delete Crew Manager</button>
      </div>
    </details>
  )
}
