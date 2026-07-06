import { writeFileSync } from 'node:fs'
import { sampleData } from '../src/data/sampleData'
import type { ChartData, CrewManagerTeam } from '../src/types'
import { generateChartSvg } from '../src/utils/exportSvg'

const person = (id: string, name: string, designation: string) => ({ id, name, designation, email: '', phone: '', notes: '' })

function scenario(managerCount: number, assistantCount: number, vesselCount: number, longNames = false): ChartData {
  const data = structuredClone(sampleData)
  data.crewManagerTeams = Array.from({ length: managerCount }, (_, teamIndex): CrewManagerTeam => {
    const assistants = Array.from({ length: assistantCount }, (_, assistantIndex) => ({
      ...person(`assistant-${teamIndex}-${assistantIndex}`, `Assistant ${teamIndex + 1}.${assistantIndex + 1}`, 'Assistant Crew Manager'),
      sortOrder: assistantIndex + 1,
    }))
    return {
      id: `team-${teamIndex}`,
      sortOrder: teamIndex + 1,
      manager: person(
        `manager-${teamIndex}`,
        longNames ? `Alexandria Montgomery-Wellington ${teamIndex + 1}` : `Crew Manager ${teamIndex + 1}`,
        'Senior Crew Manager',
      ),
      assistants,
      vessels: Array.from({ length: vesselCount }, (_, vesselIndex) => ({
        id: `vessel-${teamIndex}-${vesselIndex}`,
        name: longNames ? `MV International Maritime Endeavour ${teamIndex + 1}-${vesselIndex + 1}` : `MV Horizon ${teamIndex + 1}-${vesselIndex + 1}`,
        vesselType: vesselIndex % 2 ? '' : 'Bulk Carrier',
        fleet: vesselIndex % 3 ? 'Dry Fleet' : '',
        status: vesselIndex % 4 ? 'Active' : '',
        assignedAssistantId: vesselIndex % 2 === 0 ? assistants[0]?.id ?? '' : '',
        notes: '',
        sortOrder: vesselIndex + 1,
      })),
    }
  })
  return data
}

const cases = [
  ['one-manager', scenario(1, 1, 3)],
  ['three-managers', scenario(3, 2, 6)],
  ['six-managers', scenario(6, 2, 10)],
  ['long-names', scenario(3, 2, 6, true)],
] as const

for (const [name, data] of cases) {
  writeFileSync(`work/${name}-org.svg`, generateChartSvg(data, 'org'))
  writeFileSync(`work/${name}-allocation.svg`, generateChartSvg(data, 'allocation'))
}
