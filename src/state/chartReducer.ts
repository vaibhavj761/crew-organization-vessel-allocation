import type { Assistant, ChartData, CrewDirectorNode, CrewManagerNode, OperationsManagerNode, Vessel } from '../types'

export type ChartAction =
 | {type:'replace';data:ChartData}
 | {type:'updateMeta';field:'title'|'organizationName'|'effectiveDate'|'footerText';value:string}
 | {type:'addCrewDirector';value:CrewDirectorNode}
 | {type:'updateCrewDirector';id:string;value:CrewDirectorNode['person']}
 | {type:'deleteCrewDirector';id:string}
 | {type:'reorderCrewDirectors';activeId:string;overId:string}
 | {type:'addOperationsManager';value:OperationsManagerNode}
 | {type:'updateOperationsManager';id:string;value:OperationsManagerNode['person']}
 | {type:'moveOperationsManager';id:string;crewDirectorId:string}
 | {type:'deleteOperationsManager';id:string}
 | {type:'reorderOperationsManagers';crewDirectorId:string;activeId:string;overId:string}
 | {type:'addCrewManager';operationsManagerId:string;value:CrewManagerNode}
 | {type:'updateCrewManager';operationsManagerId:string;id:string;value:CrewManagerNode['person']}
 | {type:'deleteCrewManager';operationsManagerId:string;id:string}
 | {type:'moveCrewManager';fromOperationsManagerId:string;toOperationsManagerId:string;id:string}
 | {type:'addAssistant';crewManagerId:string;value:Assistant}
 | {type:'updateAssistant';crewManagerId:string;value:Assistant}
 | {type:'deleteAssistant';crewManagerId:string;assistantId:string}
 | {type:'addVessel';value:Vessel}
 | {type:'updateVessel';value:Vessel}
 | {type:'deleteVessel';id:string}

const order=<T extends {sortOrder:number}>(a:T[])=>a.map((x,i)=>({...x,sortOrder:i+1}))
const reorder=<T extends {id:string;sortOrder:number}>(a:T[],active:string,over:string)=>{const f=a.findIndex(x=>x.id===active),t=a.findIndex(x=>x.id===over);if(f<0||t<0)return a;const n=[...a],[x]=n.splice(f,1);n.splice(t,0,x);return order(n)}
const mapManagers=(state:ChartData, fn:(cm:CrewManagerNode)=>CrewManagerNode)=>state.operationsManagers.map(op=>({...op,crewManagers:op.crewManagers.map(fn)}))
const matchesCrewManager = (vesselCrewManagerId: string, cm: CrewManagerNode) => vesselCrewManagerId === cm.id || vesselCrewManagerId === cm.person.id
const syncVesselIds=(ops:OperationsManagerNode[], vessels:Vessel[])=>ops.map(op=>({...op,crewManagers:op.crewManagers.map(cm=>({...cm,vesselIds:vessels.filter(v=>matchesCrewManager(v.crewManagerId,cm)).sort((a,b)=>a.sortOrder-b.sortOrder).map(v=>v.id)}))}))

export function chartReducer(state:ChartData,a:ChartAction):ChartData{
 switch(a.type){
  case'replace':return a.data
  case'updateMeta':return{...state,[a.field]:a.value}
  case'addCrewDirector':return{...state,crewDirectors:[...state.crewDirectors,a.value]}
  case'updateCrewDirector':return{...state,crewDirectors:state.crewDirectors.map(d=>d.id===a.id?{...d,person:a.value}:d)}
  case'deleteCrewDirector':{
    const opIds=new Set(state.operationsManagers.filter(op=>op.crewDirectorId===a.id).map(op=>op.id))
    const cmIds=new Set(state.operationsManagers.filter(op=>op.crewDirectorId===a.id).flatMap(op=>op.crewManagers.flatMap(cm=>[cm.id,cm.person.id])))
    const vessels=state.vessels.map(v=>cmIds.has(v.crewManagerId)?{...v,crewManagerId:'',assignedAssistantId:''}:v)
    return{...state,crewDirectors:order(state.crewDirectors.filter(d=>d.id!==a.id)),operationsManagers:order(state.operationsManagers.filter(op=>!opIds.has(op.id))),vessels}
  }
  case'reorderCrewDirectors':return{...state,crewDirectors:reorder(state.crewDirectors,a.activeId,a.overId)}
  case'addOperationsManager':return{...state,operationsManagers:[...state.operationsManagers,a.value]}
  case'updateOperationsManager':return{...state,operationsManagers:state.operationsManagers.map(op=>op.id===a.id?{...op,person:a.value}:op)}
  case'moveOperationsManager':return{...state,operationsManagers:state.operationsManagers.map(op=>op.id===a.id?{...op,crewDirectorId:a.crewDirectorId}:op)}
  case'deleteOperationsManager':{
    const cms=new Set(state.operationsManagers.find(op=>op.id===a.id)?.crewManagers.flatMap(cm=>[cm.id,cm.person.id]))
    const vessels=state.vessels.map(v=>cms.has(v.crewManagerId)?{...v,crewManagerId:'',assignedAssistantId:''}:v)
    return{...state,operationsManagers:order(state.operationsManagers.filter(op=>op.id!==a.id)),vessels}
  }
  case'reorderOperationsManagers':{
    const group=state.operationsManagers.filter(op=>op.crewDirectorId===a.crewDirectorId)
    const other=state.operationsManagers.filter(op=>op.crewDirectorId!==a.crewDirectorId)
    return{...state,operationsManagers:[...other,...reorder(group,a.activeId,a.overId)]}
  }
  case'addCrewManager':return{...state,operationsManagers:state.operationsManagers.map(op=>op.id===a.operationsManagerId?{...op,crewManagers:[...op.crewManagers,a.value]}:op)}
  case'updateCrewManager':return{...state,operationsManagers:state.operationsManagers.map(op=>op.id===a.operationsManagerId?{...op,crewManagers:op.crewManagers.map(cm=>cm.id===a.id?{...cm,person:a.value}:cm)}:op)}
  case'deleteCrewManager':{
    const vessels=state.vessels.map(v=>v.crewManagerId===a.id||v.crewManagerId===state.operationsManagers.flatMap(op=>op.crewManagers).find(cm=>cm.id===a.id)?.person.id?{...v,crewManagerId:'',assignedAssistantId:''}:v)
    return{...state,operationsManagers:state.operationsManagers.map(op=>op.id===a.operationsManagerId?{...op,crewManagers:order(op.crewManagers.filter(cm=>cm.id!==a.id))}:op),vessels}
  }
  case'moveCrewManager':{
    const cm=state.operationsManagers.find(op=>op.id===a.fromOperationsManagerId)?.crewManagers.find(cm=>cm.id===a.id)
    if(!cm)return state
    return{...state,operationsManagers:state.operationsManagers.map(op=>op.id===a.fromOperationsManagerId?{...op,crewManagers:order(op.crewManagers.filter(x=>x.id!==a.id))}:op.id===a.toOperationsManagerId?{...op,crewManagers:[...op.crewManagers,{...cm,sortOrder:op.crewManagers.length+1}]}:op)}
  }
  case'addAssistant':return{...state,operationsManagers:mapManagers(state,cm=>cm.id===a.crewManagerId||cm.person.id===a.crewManagerId?{...cm,assistants:[...cm.assistants,a.value]}:cm)}
  case'updateAssistant':return{...state,operationsManagers:mapManagers(state,cm=>cm.id===a.crewManagerId||cm.person.id===a.crewManagerId?{...cm,assistants:cm.assistants.map(x=>x.id===a.value.id?a.value:x)}:cm)}
  case'deleteAssistant':return{...state,operationsManagers:mapManagers(state,cm=>cm.id===a.crewManagerId||cm.person.id===a.crewManagerId?{...cm,assistants:order(cm.assistants.filter(x=>x.id!==a.assistantId))}:cm),vessels:state.vessels.map(v=>v.assignedAssistantId===a.assistantId?{...v,assignedAssistantId:''}:v)}
  case'addVessel':{const vessels=[...state.vessels,a.value];return{...state,vessels,operationsManagers:syncVesselIds(state.operationsManagers,vessels)}}
  case'updateVessel':{
    const cm=state.operationsManagers.flatMap(op=>op.crewManagers).find(cm=>cm.id===a.value.crewManagerId||cm.person.id===a.value.crewManagerId)
    const value=cm?.assistants.some(x=>x.id===a.value.assignedAssistantId)?a.value:{...a.value,assignedAssistantId:''}
    const vessels=state.vessels.map(v=>v.id===value.id?value:v)
    return{...state,vessels,operationsManagers:syncVesselIds(state.operationsManagers,vessels)}
  }
  case'deleteVessel':{const vessels=order(state.vessels.filter(v=>v.id!==a.id));return{...state,vessels,operationsManagers:syncVesselIds(state.operationsManagers,vessels)}}
 }
}
