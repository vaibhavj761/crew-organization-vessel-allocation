import { z } from 'zod'
const role = z.enum(['CREW_DIRECTOR','OPERATIONS_MANAGER','CREW_MANAGER','ASSISTANT'])
const person = z.object({ id:z.string().min(1), name:z.string(), designation:z.string(), workflowRole:role, email:z.string(), phone:z.string(), notes:z.string() })
const assistant = person.extend({ workflowRole:z.literal('ASSISTANT'), sortOrder:z.number().int().positive() })
const crewDirector = z.object({ id:z.string().min(1), sortOrder:z.number().int().positive(), person:person.extend({workflowRole:z.literal('CREW_DIRECTOR')}) })
const crewManager = z.object({ id:z.string().min(1), sortOrder:z.number().int().positive(), person:person.extend({workflowRole:z.literal('CREW_MANAGER')}), assistants:z.array(assistant), vesselIds:z.array(z.string()) })
const operationsManager = z.object({ id:z.string().min(1), crewDirectorId:z.string().min(1), sortOrder:z.number().int().positive(), person:person.extend({workflowRole:z.literal('OPERATIONS_MANAGER')}), crewManagers:z.array(crewManager) })
const vessel = z.object({ id:z.string().min(1), name:z.string(), vesselType:z.string(), vesselDoc:z.string(), deadweightTonnage:z.string(), ownerPool:z.string(), ownerName:z.string(), vesselManager:z.string(), crewManagerId:z.string(), assignedAssistantId:z.string(), vesselStatus:z.enum(['IN_MANAGEMENT','UPCOMING','OUT_OF_MANAGEMENT']), managementType:z.enum(['FULL_MANAGED','CREW_MANAGED']), notes:z.string(), sortOrder:z.number().int().positive() })
export const chartDataSchema = z.object({ schemaVersion:z.literal(2), title:z.string(), organizationName:z.string(), effectiveDate:z.string(), crewDirectors:z.array(crewDirector), operationsManagers:z.array(operationsManager), vessels:z.array(vessel), footerText:z.string() }).superRefine((data,ctx)=>{
  const directorIds = new Set(data.crewDirectors.map(d => d.id))
  const managers = new Map(data.operationsManagers.flatMap(op=>op.crewManagers.map(cm=>[cm.person.id,cm] as const)))
  data.operationsManagers.forEach((op, i) => { if(!directorIds.has(op.crewDirectorId)) ctx.addIssue({code:'custom',message:'Crew Director not found',path:['operationsManagers',i,'crewDirectorId']}) })
  data.vessels.forEach((v,i)=>{ const cm=managers.get(v.crewManagerId); if(v.crewManagerId&&!cm) ctx.addIssue({code:'custom',message:'Crew Manager not found',path:['vessels',i,'crewManagerId']}); if(v.assignedAssistantId&&!cm?.assistants.some(a=>a.id===v.assignedAssistantId)) ctx.addIssue({code:'custom',message:'Assistant must belong to selected Crew Manager',path:['vessels',i,'assignedAssistantId']}) })
})
