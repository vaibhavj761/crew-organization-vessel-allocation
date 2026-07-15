import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OperationsAllocationView } from '../src/components/OperationsAllocationView'
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

function deputyManager(id: string, operationsManagerId: string, crewManagers: CrewManagerNode[]): DeputyManagerNode {
  return {
    id,
    operationsManagerId,
    sortOrder: 1,
    person: {
      id: `${id}-person`,
      name: id === 'deputy-one' ? 'Deputy One' : 'Deputy Two',
      designation: 'Deputy Crew Manager',
      workflowRole: 'DEPUTY_MANAGER',
      email: '',
      phone: '',
      notes: '',
    },
    crewManagers,
  }
}

function makeChartData(): ChartData {
  const director = {
    id: 'director-amit',
    sortOrder: 1,
    person: {
      id: 'person-amit',
      name: 'Amit Kumar',
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
        id: 'ops-sidharth',
        crewDirectorId: director.id,
        sortOrder: 1,
        person: {
          id: 'person-sidharth',
          name: 'Sidharth Bajaj',
          designation: 'Crew Operations Manager',
          workflowRole: 'OPERATIONS_MANAGER',
          email: '',
          phone: '',
          notes: '',
        },
        deputyManagers: [
          deputyManager('deputy-one', 'ops-sidharth', [
            crewManager('cm-one', 'Crew Manager One'),
            crewManager('cm-two', 'Crew Manager Two'),
            crewManager('cm-three', 'Crew Manager Three'),
          ]),
        ],
      },
      {
        id: 'ops-namrata',
        crewDirectorId: director.id,
        sortOrder: 2,
        person: {
          id: 'person-namrata',
          name: 'Namrata Joshi',
          designation: 'Crew Operations Manager',
          workflowRole: 'OPERATIONS_MANAGER',
          email: '',
          phone: '',
          notes: '',
        },
        deputyManagers: [],
      },
    ],
    vessels: [],
    footerText: 'Internal',
  }
}

describe('OperationsAllocationView blank-canvas protection', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows all three Sidharth-style crew manager cards', () => {
    chartDataMock.current = makeChartData()
    const { container } = render(<OperationsAllocationView crewDirectorId="director-amit" operationsManagerId="ops-sidharth" deputyManagerId="" crewManagerId="" />)

    expect(container.querySelector('.chart-view--compact-top.operations-allocation-view')).toBeTruthy()
    expect(screen.getAllByText('Sidharth Bajaj').length).toBeGreaterThan(0)
    expect(screen.getByText('Crew Manager One')).toBeInTheDocument()
    expect(screen.getByText('Crew Manager Two')).toBeInTheDocument()
    expect(screen.getByText('Crew Manager Three')).toBeInTheDocument()
  })

  it('shows a professional empty state for a Namrata-style operations manager with no teams', () => {
    chartDataMock.current = makeChartData()
    render(<OperationsAllocationView crewDirectorId="director-amit" operationsManagerId="ops-namrata" deputyManagerId="" crewManagerId="" />)

    expect(screen.getAllByText('Namrata Joshi').length).toBeGreaterThan(0)
    expect(screen.getByText('No Deputy Managers found under this Crew Operations Manager.')).toBeInTheDocument()
  })

  it('shows a helpful no-match state instead of a blank canvas for stale filters', () => {
    chartDataMock.current = makeChartData()
    render(<OperationsAllocationView crewDirectorId="director-amit" operationsManagerId="missing-ops" deputyManagerId="" crewManagerId="" />)

    expect(screen.getByText('No matching team found for the selected filters.')).toBeInTheDocument()
  })
})
