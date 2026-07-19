import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrgChartView } from '../src/components/OrgChartView'
import type { ChartData, CrewManagerNode, DeputyManagerNode } from '../src/types'

const { chartDataMock, saveHierarchyPersonMock, createHierarchyPersonMock } = vi.hoisted(() => ({
  chartDataMock: { current: null as ChartData | null },
  saveHierarchyPersonMock: vi.fn(),
  createHierarchyPersonMock: vi.fn(),
}))

vi.mock('../src/state/ChartContext', () => ({
  useChart: () => ({
    data: chartDataMock.current,
    saveHierarchyPerson: saveHierarchyPersonMock,
    createHierarchyPerson: createHierarchyPersonMock,
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
    saveHierarchyPersonMock.mockReset()
    createHierarchyPersonMock.mockReset()
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

  it('shows assigned vessel names from the crew-manager count in the organization chart', () => {
    chartDataMock.current = makeChartData(1)
    chartDataMock.current.vessels = [{
      id: 'vessel-qa',
      name: 'MV Quality Star',
      vesselType: 'Bulk Carrier',
      vesselDoc: '',
      deadweightTonnage: '',
      ownerPool: '',
      ownerName: '',
      vesselManager: '',
      crewManagerId: 'cm-1',
      assignedAssistantId: '',
      vesselStatus: 'IN_MANAGEMENT',
      managementType: 'CREW_MANAGED',
      notes: '',
      sortOrder: 1,
    }]

    render(<OrgChartView />)

    expect(screen.getByLabelText('Assigned vessels: MV Quality Star')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toHaveTextContent('MV Quality Star')
  })

  it('lets editors save a trimmed identity update directly from the chart', async () => {
    chartDataMock.current = makeChartData(1)
    saveHierarchyPersonMock.mockResolvedValue(undefined)
    render(<OrgChartView canEdit />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit QA Director' }))
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: '  Amit Kumar  ' } })
    fireEvent.change(screen.getByLabelText(/Designation/), { target: { value: '  Crew Director, Asia  ' } })
    fireEvent.click(screen.getByRole('button', { name: /Save to database/i }))

    await waitFor(() => expect(saveHierarchyPersonMock).toHaveBeenCalledTimes(1))
    expect(saveHierarchyPersonMock.mock.calls[0][0]).toEqual({ kind: 'crewDirector', id: 'director-qa' })
    expect(saveHierarchyPersonMock.mock.calls[0][1]).toMatchObject({ name: 'Amit Kumar', designation: 'Crew Director, Asia' })
  })

  it('does not expose inline edit actions in read-only mode', () => {
    chartDataMock.current = makeChartData(1)
    render(<OrgChartView />)
    expect(screen.queryByRole('button', { name: /Edit QA Director/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add Crew Operations Manager under/ })).not.toBeInTheDocument()
  })

  it('adds the correct direct-report role from a hierarchy card', async () => {
    chartDataMock.current = makeChartData(1)
    createHierarchyPersonMock.mockResolvedValue(undefined)
    render(<OrgChartView canEdit />)

    fireEvent.click(screen.getByRole('button', { name: 'Add Deputy Manager under QA Operations Manager' }))
    expect(screen.getByRole('dialog', { name: 'Add Deputy Manager' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'New Deputy' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Deputy Manager' }))

    await waitFor(() => expect(createHierarchyPersonMock).toHaveBeenCalledTimes(1))
    expect(createHierarchyPersonMock.mock.calls[0][0]).toEqual({ kind: 'deputyManager', operationsManagerId: 'ops-qa' })
    expect(createHierarchyPersonMock.mock.calls[0][1]).toMatchObject({ name: 'New Deputy', designation: 'Deputy Crew Manager', workflowRole: 'DEPUTY_MANAGER' })
  })
})
