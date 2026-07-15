import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrgChartView } from '../src/components/OrgChartView'
import type { ChartData, CrewManagerNode, DeputyManagerNode } from '../src/types'

const { chartDataMock } = vi.hoisted(() => ({
  chartDataMock: { current: null as ChartData | null },
}))

vi.mock('../src/state/ChartContext', () => ({
  useChart: () => ({
    data: chartDataMock.current,
  }),
}))

function crewManager(id: string, name: string): CrewManagerNode {
  return {
    id,
    sortOrder: 1,
    person: {
      id: `${id}-person`,
      name,
      designation: 'Crew Manager',
      workflowRole: 'CREW_MANAGER',
      email: '',
      phone: '',
      notes: '',
    },
    vesselIds: [],
  }
}

function deputyManager(operationsManagerId: string, managerCount: number): DeputyManagerNode {
  return {
    id: 'deputy-qa',
    operationsManagerId,
    sortOrder: 1,
    person: {
      id: 'person-deputy-qa',
      name: 'QA Deputy Manager',
      designation: 'Deputy Crew Manager',
      workflowRole: 'DEPUTY_MANAGER',
      email: '',
      phone: '',
      notes: '',
    },
    crewManagers: Array.from({ length: managerCount }, (_, index) => crewManager(`cm-${index + 1}`, `Crew Manager ${index + 1}`)),
  }
}

function makeChartData(managerCount: number): ChartData {
  const director = {
    id: 'director-qa',
    sortOrder: 1,
    person: {
      id: 'person-director-qa',
      name: 'QA Director',
      designation: 'Crew Director',
      workflowRole: 'CREW_DIRECTOR' as const,
      email: '',
      phone: '',
      notes: '',
    },
  }

  return {
    schemaVersion: 2,
    title: 'Crew Operations Organization Chart',
    organizationName: 'QA Maritime',
    effectiveDate: '2026-07-08',
    crewDirectors: [director],
    operationsManagers: [
      {
        id: 'ops-qa',
        crewDirectorId: director.id,
        sortOrder: 1,
        person: {
          id: 'person-ops-qa',
          name: 'QA Operations Manager',
          designation: 'Crew Operations Manager',
          workflowRole: 'OPERATIONS_MANAGER',
          email: '',
          phone: '',
          notes: '',
        },
        deputyManagers: [deputyManager('ops-qa', managerCount)],
      },
    ],
    vessels: [],
    footerText: 'Internal QA',
  }
}

describe('OrgChartView deterministic layout', () => {
  afterEach(() => {
    cleanup()
  })

  it('uses isolated org-chart grid classes for three crew managers', () => {
    chartDataMock.current = makeChartData(3)
    const { container } = render(<OrgChartView />)

    expect(container.querySelector('.chart-view--compact-top.org-chart')).toBeTruthy()
    expect(screen.getByText('QA Director')).toBeInTheDocument()
    expect(screen.getByText('QA Operations Manager')).toBeInTheDocument()
    expect(screen.getByText('QA Deputy Manager')).toBeInTheDocument()
    expect(screen.getByText('Crew Manager 1')).toBeInTheDocument()
    expect(screen.getByText('Crew Manager 2')).toBeInTheDocument()
    expect(screen.getByText('Crew Manager 3')).toBeInTheDocument()
    expect(container.querySelector('.org-crew-manager-grid.layout-many')).toBeTruthy()
    expect(container.querySelector('.overview-team-grid.layout-three')).toBeFalsy()
  })

  it('switches to the many-card wrapping layout for five or more crew managers', () => {
    chartDataMock.current = makeChartData(5)
    const { container } = render(<OrgChartView />)

    expect(screen.getByText('Crew Manager 5')).toBeInTheDocument()
    expect(container.querySelector('.org-crew-manager-grid.layout-many')).toBeTruthy()
  })

  it('shows an empty state instead of an empty or overlapping grid', () => {
    chartDataMock.current = makeChartData(0)
    render(<OrgChartView />)

    expect(screen.getByText('No Crew Managers assigned yet')).toBeInTheDocument()
  })
})
