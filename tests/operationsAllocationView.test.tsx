import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OperationsAllocationView } from '../src/components/OperationsAllocationView'
import type { ChartData, CrewManagerNode, DeputyManagerNode } from '../src/types'

const { chartDataMock, assignVesselMock, unassignVesselMock, saveVesselMock } = vi.hoisted(() => ({
  chartDataMock: { current: null as ChartData | null },
  assignVesselMock: vi.fn().mockResolvedValue(undefined),
  unassignVesselMock: vi.fn().mockResolvedValue(undefined),
  saveVesselMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/state/ChartContext', () => ({
  useChart: () => ({
    data: chartDataMock.current,
    assignVesselFromChart: assignVesselMock,
    unassignVesselFromChart: unassignVesselMock,
    saveVesselFromChart: saveVesselMock,
  }),
}))

function crewManager(id: string, name: string): CrewManagerNode {
  return {
    id,
    reportingLineId: `${id}-reporting-line`,
    isPrimaryReportingLine: true,
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
    assignVesselMock.mockClear()
    unassignVesselMock.mockClear()
    saveVesselMock.mockClear()
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

  it('shows chart allocation controls only to an editor', () => {
    const data = makeChartData()
    data.vessels = [{ id: 'vessel-1', name: 'Ocean Test', vesselType: 'Bulk carrier', vesselDoc: '', deadweightTonnage: '', ownerPool: '', ownerName: '', vesselManager: '', crewManagerId: 'cm-one', assignedAssistantId: '', vesselStatus: 'IN_MANAGEMENT', managementType: 'FULL_MANAGED', notes: '', sortOrder: 1 }]
    chartDataMock.current = data
    const { rerender } = render(<OperationsAllocationView crewDirectorId="director-amit" operationsManagerId="ops-sidharth" deputyManagerId="" crewManagerId="" />)
    expect(screen.queryByText('Assign vessel')).not.toBeInTheDocument()

    rerender(<OperationsAllocationView crewDirectorId="director-amit" operationsManagerId="ops-sidharth" deputyManagerId="" crewManagerId="" canEdit />)
    expect(screen.getAllByText('Assign vessel').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Ocean Test' }))
    expect(screen.getByRole('dialog', { name: 'Review vessel details' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm vessel update' })).toBeInTheDocument()
  })

  it('confirms a dragged vessel reassignment without creating a duplicate vessel', async () => {
    const data = makeChartData()
    data.vessels = [{ id: 'vessel-1', name: 'Ocean Test', vesselType: 'Bulk carrier', vesselDoc: '', deadweightTonnage: '', ownerPool: '', ownerName: '', vesselManager: '', crewManagerId: 'cm-one', assignedAssistantId: '', vesselStatus: 'IN_MANAGEMENT', managementType: 'FULL_MANAGED', notes: '', sortOrder: 1 }]
    chartDataMock.current = data
    const { container } = render(<OperationsAllocationView crewDirectorId="director-amit" operationsManagerId="ops-sidharth" deputyManagerId="" crewManagerId="" canEdit />)
    const values = new Map<string, string>()
    const dataTransfer = {
      types: ['application/x-crew-vessel'],
      effectAllowed: 'all',
      dropEffect: 'move',
      setData: (type: string, value: string) => values.set(type, value),
      getData: (type: string) => values.get(type) || '',
    }

    fireEvent.dragStart(screen.getByTitle('Ocean Test'), { dataTransfer })
    const targetHeading = screen.getByText('Crew Manager Two')
    const targetCard = targetHeading.closest('article')
    expect(targetCard).not.toBeNull()
    fireEvent.dragOver(targetCard!, { dataTransfer })
    fireEvent.drop(targetCard!, { dataTransfer })

    expect(screen.getByRole('dialog', { name: 'Move vessel to Crew Manager Two' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm vessel move' }))
    await waitFor(() => expect(assignVesselMock).toHaveBeenCalledWith('vessel-1', 'cm-two', 'cm-two-reporting-line'))
    expect(container.querySelectorAll('.vessel-name-pill')).toHaveLength(1)
  })
})
