import type { ChartData, CrewDirectorNode, CrewManagerNode, DeputyManagerNode, OperationsManagerNode, Vessel } from '../types'

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
 | {type:'addDeputyManager';operationsManagerId:string;value:DeputyManagerNode}
 | {type:'updateDeputyManager';operationsManagerId:string;id:string;value:DeputyManagerNode['person']}
 | {type:'deleteDeputyManager';operationsManagerId:string;id:string}
 | {type:'moveDeputyManager';fromOperationsManagerId:string;toOperationsManagerId:string;id:string}
 | {type:'addCrewManager';deputyManagerId:string;value:CrewManagerNode}
 | {type:'updateCrewManager';deputyManagerId:string;id:string;value:CrewManagerNode['person']}
 | {type:'deleteCrewManager';deputyManagerId:string;id:string}
 | {type:'moveCrewManager';fromDeputyManagerId:string;toDeputyManagerId:string;id:string}
 | {type:'addVessel';value:Vessel}
 | {type:'updateVessel';value:Vessel}
 | {type:'deleteVessel';id:string}

const order=<T extends {sortOrder:number}>(a:T[])=>a.map((x,i)=>({...x,sortOrder:i+1}))
const reorder=<T extends {id:string;sortOrder:number}>(a:T[],active:string,over:string)=>{const f=a.findIndex(x=>x.id===active),t=a.findIndex(x=>x.id===over);if(f<0||t<0)return a;const n=[...a],[x]=n.splice(f,1);n.splice(t,0,x);return order(n)}
const matchesCrewManager = (vesselCrewManagerId: string, cm: CrewManagerNode) => vesselCrewManagerId === cm.id || vesselCrewManagerId === cm.person.id
const allCrewManagers = (ops: OperationsManagerNode[]) => ops.flatMap(op => op.deputyManagers.flatMap(deputy => deputy.crewManagers))
const syncVesselIds=(ops:OperationsManagerNode[], vessels:Vessel[])=>ops.map(op=>({...op,deputyManagers:op.deputyManagers.map(deputy=>({...deputy,crewManagers:deputy.crewManagers.map(cm=>({...cm,vesselIds:vessels.filter(v=>matchesCrewManager(v.crewManagerId,cm)).sort((a,b)=>a.sortOrder-b.sortOrder).map(v=>v.id)}))}))}))

function mapDeputies(state: ChartData, fn: (deputy: DeputyManagerNode, op: OperationsManagerNode) => DeputyManagerNode) {
  return state.operationsManagers.map(op => ({ ...op, deputyManagers: op.deputyManagers.map(deputy => fn(deputy, op)) }))
}

export function chartReducer(state:ChartData,a:ChartAction):ChartData{
 switch(a.type){
  case'replace':return a.data
  case'updateMeta':return{...state,[a.field]:a.value}
  case'addCrewDirector':return{...state,crewDirectors:[...state.crewDirectors,a.value]}
  case'updateCrewDirector':return{...state,crewDirectors:state.crewDirectors.map(d=>d.id===a.id?{...d,person:a.value}:d)}
  case'deleteCrewDirector':{
    const opIds=new Set(state.operationsManagers.filter(op=>op.crewDirectorId===a.id).map(op=>op.id))
    const cmIds=new Set(state.operationsManagers.filter(op=>op.crewDirectorId===a.id).flatMap(op=>op.deputyManagers.flatMap(deputy=>deputy.crewManagers.flatMap(cm=>[cm.id,cm.person.id]))))
    const vessels=state.vessels.map(v=>cmIds.has(v.crewManagerId)?{...v,crewManagerId:'',assignedAssistantId:''}:v)
    return{...state,crewDirectors:order(state.crewDirectors.filter(d=>d.id!==a.id)),operationsManagers:order(state.operationsManagers.filter(op=>!opIds.has(op.id))),vessels}
  }
  case'reorderCrewDirectors':return{...state,crewDirectors:reorder(state.crewDirectors,a.activeId,a.overId)}
  case'addOperationsManager':return{...state,operationsManagers:[...state.operationsManagers,a.value]}
  case'updateOperationsManager':return{...state,operationsManagers:state.operationsManagers.map(op=>op.id===a.id?{...op,person:a.value}:op)}
  case'moveOperationsManager':return{...state,operationsManagers:state.operationsManagers.map(op=>op.id===a.id?{...op,crewDirectorId:a.crewDirectorId}:op)}
  case'deleteOperationsManager':{
    const cms=new Set(state.operationsManagers.find(op=>op.id===a.id)?.deputyManagers.flatMap(deputy=>deputy.crewManagers.flatMap(cm=>[cm.id,cm.person.id]))||[])
    const vessels=state.vessels.map(v=>cms.has(v.crewManagerId)?{...v,crewManagerId:'',assignedAssistantId:''}:v)
    return{...state,operationsManagers:order(state.operationsManagers.filter(op=>op.id!==a.id)),vessels}
  }
  case'reorderOperationsManagers':{
    const group=state.operationsManagers.filter(op=>op.crewDirectorId===a.crewDirectorId)
    const other=state.operationsManagers.filter(op=>op.crewDirectorId!==a.crewDirectorId)
    return{...state,operationsManagers:[...other,...reorder(group,a.activeId,a.overId)]}
  }
  case'addDeputyManager':return{...state,operationsManagers:state.operationsManagers.map(op=>op.id===a.operationsManagerId?{...op,deputyManagers:[...op.deputyManagers,a.value]}:op)}
  case'updateDeputyManager':return{...state,operationsManagers:state.operationsManagers.map(op=>op.id===a.operationsManagerId?{...op,deputyManagers:op.deputyManagers.map(deputy=>deputy.id===a.id?{...deputy,person:a.value}:deputy)}:op)}
  case'deleteDeputyManager':{
    const deputy=state.operationsManagers.flatMap(op=>op.deputyManagers).find(item=>item.id===a.id)
    const cmIds=new Set((deputy?.crewManagers||[]).flatMap(cm=>[cm.id,cm.person.id]))
    const vessels=state.vessels.map(v=>cmIds.has(v.crewManagerId)?{...v,crewManagerId:'',assignedAssistantId:''}:v)
    return{...state,operationsManagers:state.operationsManagers.map(op=>op.id===a.operationsManagerId?{...op,deputyManagers:order(op.deputyManagers.filter(item=>item.id!==a.id))}:op),vessels}
  }
  case'moveDeputyManager':{
    const deputy=state.operationsManagers.find(op=>op.id===a.fromOperationsManagerId)?.deputyManagers.find(item=>item.id===a.id)
    if(!deputy)return state
    return{...state,operationsManagers:state.operationsManagers.map(op=>op.id===a.fromOperationsManagerId?{...op,deputyManagers:order(op.deputyManagers.filter(x=>x.id!==a.id))}:op.id===a.toOperationsManagerId?{...op,deputyManagers:[...op.deputyManagers,{...deputy,operationsManagerId:op.id,sortOrder:op.deputyManagers.length+1}]}:op)}
  }
  case'addCrewManager':return{...state,operationsManagers:mapDeputies(state,(deputy)=>deputy.id===a.deputyManagerId?{...deputy,crewManagers:[...deputy.crewManagers,a.value]}:deputy)}
  case'updateCrewManager':return{...state,operationsManagers:mapDeputies(state,(deputy)=>deputy.id===a.deputyManagerId?{...deputy,crewManagers:deputy.crewManagers.map(cm=>cm.id===a.id?{...cm,person:a.value}:cm)}:deputy)}
  case'deleteCrewManager':{
    const target=allCrewManagers(state.operationsManagers).find(cm=>cm.id===a.id)
    const vessels=state.vessels.map(v=>v.crewManagerId===a.id||v.crewManagerId===target?.person.id?{...v,crewManagerId:'',assignedAssistantId:''}:v)
    return{...state,operationsManagers:mapDeputies(state,(deputy)=>deputy.id===a.deputyManagerId?{...deputy,crewManagers:order(deputy.crewManagers.filter(cm=>cm.id!==a.id))}:deputy),vessels}
  }
  case'moveCrewManager':{
    const cm=state.operationsManagers.flatMap(op=>op.deputyManagers).find(deputy=>deputy.id===a.fromDeputyManagerId)?.crewManagers.find(item=>item.id===a.id)
    if(!cm)return state
    return{...state,operationsManagers:mapDeputies(state,(deputy)=>deputy.id===a.fromDeputyManagerId?{...deputy,crewManagers:order(deputy.crewManagers.filter(x=>x.id!==a.id))}:deputy.id===a.toDeputyManagerId?{...deputy,crewManagers:[...deputy.crewManagers,{...cm,sortOrder:deputy.crewManagers.length+1}]}:deputy)}
  }
  case'addVessel':{const vessels=[...state.vessels,{...a.value,assignedAssistantId:''}];return{...state,vessels,operationsManagers:syncVesselIds(state.operationsManagers,vessels)}}
  case'updateVessel':{
    const cm=allCrewManagers(state.operationsManagers).find(item=>item.id===a.value.crewManagerId||item.person.id===a.value.crewManagerId)
    const value={...a.value,crewManagerId:cm?a.value.crewManagerId:'',assignedAssistantId:''}
    const vessels=state.vessels.map(v=>v.id===value.id?value:v)
    return{...state,vessels,operationsManagers:syncVesselIds(state.operationsManagers,vessels)}
  }
  case'deleteVessel':{const vessels=order(state.vessels.filter(v=>v.id!==a.id));return{...state,vessels,operationsManagers:syncVesselIds(state.operationsManagers,vessels)}}
 }
}
