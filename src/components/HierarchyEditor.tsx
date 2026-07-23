import { Plus, Trash2 } from 'lucide-react'
import { useChart } from '../state/ChartContext'
import type { CrewDirectorNode, CrewManagerNode, DeputyManagerNode, OperationsManagerNode } from '../types'
import { createId } from '../utils/createId'
import { PersonFields } from './FormFields'

const id = () => createId()
const person = <R extends 'CREW_DIRECTOR' | 'OPERATIONS_MANAGER' | 'DEPUTY_MANAGER' | 'CREW_MANAGER'>(role: R) => ({
  id: id(),
  name: role === 'CREW_DIRECTOR' ? 'New Crew Director' : role === 'OPERATIONS_MANAGER' ? 'New Operations Manager' : role === 'DEPUTY_MANAGER' ? 'New Deputy Manager' : 'New Crew Manager',
  designation: role === 'DEPUTY_MANAGER' ? 'Deputy Crew Manager' : '',
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
                <button type="button" className="mini-add" disabled={loadState !== 'ready'} onClick={() => dispatch({ type: 'addOperationsManager', value: { id: id(), crewDirectorId: director.id, sortOrder: directorOps.length + 1, person: person('OPERATIONS_MANAGER'), deputyManagers: [] } })}><Plus size={13} /> Add</button>
              </div>
              {directorOps.length ? directorOps.map((op) => <OperationsManagerEditor key={op.reportingLineId || op.id} op={op} />) : <div className="editor-empty">Add a Crew Operations Manager under this Crew Director.</div>}
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
      <summary><span><strong>{op.person.name}</strong><small>{op.deputyManagers.length} deputy managers</small></span></summary>
      <div className="nested-form">
        <p className="helper-copy">Deputy Managers report to this Crew Operations Manager.</p>
        <PersonFields person={op.person} onChange={(v) => dispatch({ type: 'updateOperationsManager', id: op.id, value: v as typeof op.person })} />
        <label className="field">
          <span>Parent Crew Director</span>
          <select value={op.crewDirectorId} onChange={(e) => dispatch({ type: 'moveOperationsManager', id: op.id, crewDirectorId: e.target.value })}>
            {data.crewDirectors.map((item) => <option key={item.id} value={item.id}>{item.person.name}</option>)}
          </select>
        </label>
        <div className="subsection-heading spaced">
          <h4>Deputy Managers</h4>
          <button type="button" className="mini-add" disabled={loadState !== 'ready'} onClick={() => dispatch({ type: 'addDeputyManager', operationsManagerId: op.id, value: { id: id(), operationsManagerId: op.id, sortOrder: op.deputyManagers.length + 1, person: person('DEPUTY_MANAGER'), crewManagers: [] } })}><Plus size={13} /> Add</button>
        </div>
        {op.deputyManagers.length ? op.deputyManagers.map((deputy) => <DeputyManagerEditor key={deputy.reportingLineId || deputy.id} op={op} deputy={deputy} />) : <div className="editor-empty">Add a Deputy Manager before adding Crew Managers.</div>}
        <button type="button" className="button ghost danger-text" onClick={() => confirm(`Delete Operations Manager ${op.person.name}? Deputy Managers below it must already be removed.`) && dispatch({ type: 'deleteOperationsManager', id: op.id })}><Trash2 size={13} /> Delete Operations Manager</button>
      </div>
    </details>
  )
}

function DeputyManagerEditor({ op, deputy }: { op: OperationsManagerNode; deputy: DeputyManagerNode }) {
  const { data, dispatch, loadState } = useChart()
  return (
    <details className="nested-editor">
      <summary><span><strong>{deputy.person.name}</strong><small>{deputy.crewManagers.length} crew managers</small></span></summary>
      <div className="nested-form">
        <p className="helper-copy">Crew Managers report to this Deputy Manager.</p>
        <PersonFields person={deputy.person} onChange={(v) => dispatch({ type: 'updateDeputyManager', operationsManagerId: op.id, id: deputy.id, value: v as typeof deputy.person })} />
        <label className="field">
          <span>Move to Crew Operations Manager</span>
          <select value={op.id} onChange={e=>dispatch({type:'moveDeputyManager',fromOperationsManagerId:op.id,toOperationsManagerId:e.target.value,id:deputy.id})}>
            {data.operationsManagers.map(x=><option key={x.id} value={x.id}>{x.person.name}</option>)}
          </select>
        </label>
        <div className="subsection-heading spaced">
          <h4>Crew Managers</h4>
          <button type="button" className="mini-add" disabled={loadState !== 'ready'} onClick={() => dispatch({ type: 'addCrewManager', deputyManagerId: deputy.id, value: { id: id(), sortOrder: deputy.crewManagers.length + 1, person: person('CREW_MANAGER'), vesselIds: [] } })}><Plus size={13} /> Add</button>
        </div>
        {deputy.crewManagers.length ? deputy.crewManagers.map((cm) => <CrewManagerEditor key={cm.reportingLineId || cm.id} deputy={deputy} cm={cm} />) : <div className="editor-empty">Add Crew Managers under this Deputy Manager.</div>}
        <button type="button" className="button ghost danger-text" onClick={()=>confirm('Delete this Deputy Manager? Crew Managers below it must already be removed.')&&dispatch({type:'deleteDeputyManager',operationsManagerId:op.id,id:deputy.id})}><Trash2 size={13}/> Delete Deputy Manager</button>
      </div>
    </details>
  )
}

function CrewManagerEditor({ deputy, cm }: { deputy: DeputyManagerNode; cm: CrewManagerNode }) {
  const { data, dispatch } = useChart()
  const deputyManagers = data.operationsManagers.flatMap((op) => op.deputyManagers)
  return (
    <details className="nested-editor">
      <summary><span><strong>{cm.person.name}</strong><small>{cm.vesselIds.length} vessels</small></span></summary>
      <div className="nested-form">
        <p className="helper-copy">Vessels are assigned directly to Crew Managers in the Vessel Master list.</p>
        <PersonFields person={cm.person} onChange={(v) => dispatch({ type: 'updateCrewManager', deputyManagerId: deputy.id, id: cm.id, value: v as typeof cm.person })} />
        <label className="field">
          <span>Move to Deputy Manager</span>
          <select value={deputy.id} onChange={e=>dispatch({type:'moveCrewManager',fromDeputyManagerId:deputy.id,toDeputyManagerId:e.target.value,id:cm.id})}>
            {deputyManagers.map(x=><option key={x.id} value={x.id}>{x.person.name}</option>)}
          </select>
        </label>
        <button type="button" className="button ghost danger-text" onClick={()=>confirm('Delete this Crew Manager? Vessel assignments will be cleared.')&&dispatch({type:'deleteCrewManager',deputyManagerId:deputy.id,id:cm.id})}><Trash2 size={13}/> Delete Crew Manager</button>
      </div>
    </details>
  )
}
