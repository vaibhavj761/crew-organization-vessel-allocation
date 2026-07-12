import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VesselMasterTable } from '../src/components/VesselMasterTable'
import type { ChartData } from '../src/types'
import { sampleData } from '../src/data/sampleData'

const { chartDataMock } = vi.hoisted(() => ({
  chartDataMock: { current: null as ChartData | null },
}))

vi.mock('../src/state/ChartContext', () => ({
  useChart: () => ({
    data: chartDataMock.current,
    dispatch: vi.fn(),
    loadState: 'ready',
  }),
}))

describe('VesselMasterTable validation', () => {
  afterEach(() => {
    cleanup()
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
})
