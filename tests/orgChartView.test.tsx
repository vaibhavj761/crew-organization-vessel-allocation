import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrgChartView } from '../src/components/OrgChartView'
import type { ChartData, CrewManagerNode, DeputyManagerNode } from '../src/types'

const { chartDataMock, saveHierarchyPersonMock, createHierarchyPersonMock, updateHierarchyPlacementMock, assignVesselMock, createVesselRecordMock } = vi.hoisted(() => ({
  chartDataMock: { current: null as ChartData | null },
  saveHierarchyPersonMock: vi.fn(),
  createHierarchyPersonMock: vi.fn(),
  updateHierarchyPlacementMock: vi.fn(),
  assignVesselMock: vi.fn(),
  createVesselRecordMock: vi.fn(),
}))

vi.mock('../src/state/ChartContext', () => ({
  useChart: () => ({
    data: chartDataMock.current,
    saveHierarchyPerson: saveHierarchyPersonMock,
    createHierarchyPerson: createHierarchyPersonMock,
    updateHierarchyPlacement: updateHierarchyPlacementMock,
    assignVesselFromChart: assignVesselMock,
    createVesselRecord: createVesselRecordMock,
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
    updateHierarchyPlacementMock.mockReset()
    assignVesselMock.mockReset()
    createVesselRecordMock.mockReset()
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

  it('searches Vessel Master names and highlights the exact Crew Manager placement', () => {
    chartDataMock.current = makeChartData(1)
    const manager = chartDataMock.current.operationsManagers[0].deputyManagers[0].crewManagers[0]
    chartDataMock.current.vessels = [{
      id: 'vessel-blue-neptune',
      name: 'BLUE NEPTUNE',
      vesselType: 'Bulk Carrier',
      vesselDoc: '',
      deadweightTonnage: '',
      ownerPool: '',
      ownerName: '',
      vesselManager: '',
      crewManagerId: manager.id,
      crewManagerReportingLineId: manager.reportingLineId,
      assignedAssistantId: '',
      vesselStatus: 'IN_MANAGEMENT',
      managementType: 'FULL_MANAGED',
      notes: '',
      sortOrder: 1,
    }]

    const { container } = render(<OrgChartView />)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Vessel Master' }), { target: { value: 'blue nep' } })

    expect(screen.getAllByText('BLUE NEPTUNE').length).toBeGreaterThan(0)
    expect(screen.getByText(/Crew Manager 1 · QA Deputy Manager · QA Operations Manager/)).toBeInTheDocument()
    expect(container.querySelector('.team-card--search-match')).toBeTruthy()
  })

  it('opens unassigned vessels and confirms a drag assignment to the exact reporting placement', async () => {
    chartDataMock.current = makeChartData(1)
    chartDataMock.current.vessels = [{
      id: 'vessel-unassigned',
      name: 'BLUE NEPTUNE',
      vesselType: 'Bulk Carrier',
      vesselDoc: '',
      deadweightTonnage: '',
      ownerPool: '',
      ownerName: '',
      vesselManager: '',
      crewManagerId: '',
      assignedAssistantId: '',
      vesselStatus: 'IN_MANAGEMENT',
      managementType: 'FULL_MANAGED',
      notes: '',
      sortOrder: 1,
    }]
    assignVesselMock.mockResolvedValue(undefined)
    const { container } = render(<OrgChartView canEdit />)

    fireEvent.click(screen.getByRole('button', { name: /Unassigned vessels/ }))
    const vessel = screen.getByText('BLUE NEPTUNE').closest('.org-unassigned-vessel')
    const target = container.querySelector('.team-card')
    expect(vessel).not.toBeNull()
    expect(target).not.toBeNull()
    const values = new Map<string, string>()
    const dataTransfer = {
      types: ['application/x-crew-vessel'],
      effectAllowed: 'all',
      dropEffect: 'move',
      setData: (type: string, value: string) => values.set(type, value),
      getData: (type: string) => values.get(type) || '',
    }
    fireEvent.dragStart(vessel!, { dataTransfer })
    fireEvent.dragOver(target!, { dataTransfer })
    fireEvent.drop(target!, { dataTransfer })

    expect(screen.getByRole('dialog', { name: 'Assign vessel to Crew Manager 1' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm assignment' }))
    await waitFor(() => expect(assignVesselMock).toHaveBeenCalledWith('vessel-unassigned', 'cm-1', 'cm-1-reporting-line'))
  })

  it('counts a shared Crew Manager vessels only in the allocation-owning placement', () => {
    chartDataMock.current = makeChartData(1)
    const primaryManager = chartDataMock.current.operationsManagers[0].deputyManagers[0].crewManagers[0]
    primaryManager.isPrimaryReportingLine = true
    primaryManager.person.notes = '7'
    chartDataMock.current.vessels = [{
      id: 'vessel-primary-placement',
      name: 'MV Placement Star',
      vesselType: 'Bulk Carrier',
      vesselDoc: '',
      deadweightTonnage: '',
      ownerPool: '',
      ownerName: '',
      vesselManager: '',
      crewManagerId: primaryManager.id,
      crewManagerReportingLineId: primaryManager.reportingLineId,
      assignedAssistantId: '',
      vesselStatus: 'IN_MANAGEMENT',
      managementType: 'CREW_MANAGED',
      notes: '',
      sortOrder: 1,
    }]
    const secondaryManager = {
      ...primaryManager,
      reportingLineId: 'crew-line-secondary',
      isPrimaryReportingLine: false,
      person: { ...primaryManager.person },
      vesselIds: [],
    }
    chartDataMock.current.operationsManagers.push({
      ...chartDataMock.current.operationsManagers[0],
      id: 'ops-secondary',
      reportingLineId: 'ops-line-secondary',
      crewDirectorId: 'director-qa',
      person: {
        ...chartDataMock.current.operationsManagers[0].person,
        id: 'person-ops-secondary',
        name: 'Irka Operations',
      },
      deputyManagers: [{
        ...chartDataMock.current.operationsManagers[0].deputyManagers[0],
        id: 'deputy-secondary-placement',
        reportingLineId: 'deputy-line-secondary',
        operationsManagerId: 'ops-secondary',
        person: {
          ...chartDataMock.current.operationsManagers[0].deputyManagers[0].person,
          id: 'person-deputy-secondary-placement',
          name: 'Shared Deputy',
        },
        crewManagers: [secondaryManager],
      }],
    })

    const { container, rerender } = render(<OrgChartView />)
    const managerCards = screen.getAllByText('Crew Manager 1').map((name) => name.closest('.team-card'))
    expect(managerCards).toHaveLength(2)
    expect(managerCards[0]?.querySelector('.vessel-count')).toHaveTextContent('1')
    expect(managerCards[1]?.querySelector('.vessel-count')).toBeNull()
    expect(container).not.toHaveTextContent('7')

    chartDataMock.current.vessels[0].crewManagerReportingLineId = 'crew-line-secondary'
    rerender(<OrgChartView />)
    const movedCards = screen.getAllByText('Crew Manager 1').map((name) => name.closest('.team-card'))
    expect(movedCards[0]?.querySelector('.vessel-count')).toBeNull()
    expect(movedCards[1]?.querySelector('.vessel-count')).toHaveTextContent('1')
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

  it('asks whether to move or add a reporting line after a valid crew-manager drop', async () => {
    chartDataMock.current = makeChartData(1)
    const secondDeputy = deputyManager('ops-qa', 0)
    secondDeputy.id = 'deputy-secondary'
    secondDeputy.reportingLineId = 'deputy-placement-secondary'
    secondDeputy.person = { ...secondDeputy.person, id: 'person-deputy-secondary', name: 'Secondary Deputy' }
    chartDataMock.current.operationsManagers[0].deputyManagers.push(secondDeputy)
    updateHierarchyPlacementMock.mockResolvedValue(undefined)
    render(<OrgChartView canEdit />)

    const values = new Map<string, string>()
    const dataTransfer = {
      effectAllowed: 'all',
      dropEffect: 'move',
      setData: (type: string, value: string) => values.set(type, value),
      getData: (type: string) => values.get(type) || '',
    }
    fireEvent.dragStart(screen.getByTitle('Drag this Crew Manager to another Deputy Manager'), { dataTransfer })
    const target = screen.getByText('Secondary Deputy').closest('section')
    expect(target).not.toBeNull()
    fireEvent.dragOver(target!, { dataTransfer })
    fireEvent.drop(target!, { dataTransfer })

    expect(screen.getByRole('dialog', { name: 'What would you like to move?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Add Crew Manager only/ }))
    await waitFor(() => expect(updateHierarchyPlacementMock).toHaveBeenCalledWith({
      entityType: 'CREW_MANAGER',
      entityId: 'cm-1',
      parentId: 'deputy-secondary',
      parentPlacementId: 'deputy-placement-secondary',
      action: 'COPY',
    }))
  })
})
