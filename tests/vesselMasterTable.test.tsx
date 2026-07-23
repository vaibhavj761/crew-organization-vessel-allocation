import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VesselMasterTable } from '../src/components/VesselMasterTable'
import type { ChartData } from '../src/types'
import { sampleData } from '../src/data/sampleData'

const { chartDataMock, createVesselRecordMock, dispatchMock } = vi.hoisted(() => ({
  chartDataMock: { current: null as ChartData | null },
  createVesselRecordMock: vi.fn(),
  dispatchMock: vi.fn(),
}))

vi.mock('../src/state/ChartContext', () => ({
  useChart: () => ({
    data: chartDataMock.current,
    dispatch: dispatchMock,
    loadState: 'ready',
    createVesselRecord: createVesselRecordMock,
  }),
}))

describe('VesselMasterTable validation', () => {
  afterEach(() => {
    cleanup()
    createVesselRecordMock.mockReset()
    dispatchMock.mockReset()
  })

  it('shows inline validation for required vessel fields when editing', () => {
    chartDataMock.current = {
      ...sampleData,
      vessels: [{
        ...sampleData.vessels[0],
        id: 'invalid-vessel',
        name: '   ',
        vesselType: '   ',
        crewManagerId: '',
      }],
    }

    render(<VesselMasterTable canEdit />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByText('Vessel name is required.')).toBeInTheDocument()
    expect(screen.getByText('Vessel type is required.')).toBeInTheDocument()
    expect(screen.getByText('Assignment is required.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finish editing' })).toBeDisabled()
  })

  it('still loads the existing vessel list normally', () => {
    chartDataMock.current = sampleData

    render(<VesselMasterTable canEdit={false} />)

    expect(screen.getByText('MV Northern Star')).toBeInTheDocument()
    expect(screen.getByText('MT Meridian')).toBeInTheDocument()
  })

  it('opens a modal for a new vessel and blocks missing required fields', () => {
    chartDataMock.current = sampleData
    render(<VesselMasterTable canEdit />)

    fireEvent.click(screen.getByRole('button', { name: 'Add vessel' }))
    expect(screen.getByRole('dialog', { name: 'Add new vessel' })).toBeInTheDocument()
    expect(dispatchMock).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'addVessel' }))

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Add new vessel' })).getByRole('button', { name: 'Add vessel' }))
    expect(screen.getByText('Vessel name is required.')).toBeInTheDocument()
    expect(screen.getByText('Vessel type is required.')).toBeInTheDocument()
    expect(screen.getByText('Assignment is required.')).toBeInTheDocument()
    expect(createVesselRecordMock).not.toHaveBeenCalled()
  })

  it('saves a valid new vessel through the direct API-backed action', async () => {
    chartDataMock.current = sampleData
    createVesselRecordMock.mockResolvedValue(undefined)
    render(<VesselMasterTable canEdit />)

    fireEvent.click(screen.getByRole('button', { name: 'Add vessel' }))
    fireEvent.change(screen.getByLabelText(/Vessel name/), { target: { value: '  MV Modal Test  ' } })
    fireEvent.change(screen.getByLabelText(/Vessel type/), { target: { value: 'Bulk Carrier' } })
    fireEvent.change(screen.getByLabelText(/Crew Manager/), { target: { value: 'team-manager-1' } })
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Add new vessel' })).getByRole('button', { name: 'Add vessel' }))

    await waitFor(() => expect(createVesselRecordMock).toHaveBeenCalledTimes(1))
    expect(createVesselRecordMock.mock.calls[0][0]).toMatchObject({
      name: '  MV Modal Test  ',
      vesselType: 'Bulk Carrier',
      crewManagerId: 'team-manager-1',
      crewManagerReportingLineId: 'crew-line-manager-1',
      deputyManagerId: 'deputy-node-deputy-1',
      operationsManagerId: 'ops-node-ops-1',
      vesselStatus: 'IN_MANAGEMENT',
    })
  })
})
