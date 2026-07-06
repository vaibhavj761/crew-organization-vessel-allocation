import { ChevronDown, FileImage, FileType2 } from 'lucide-react'
import { useState } from 'react'
import { useChart } from '../state/ChartContext'
import type { ViewMode } from '../types'
import { exportPng, exportSvg } from '../utils/exportImage'
import type { ExportTarget } from '../utils/exportSvg'

function markRequested(kind: 'png' | 'svg') {
  document.documentElement.dataset.exportStatus = 'preparing'
  document.documentElement.dataset.exportFilename = kind === 'png' ? 'pending.png' : 'pending.svg'
  document.documentElement.dataset.exportError = ''
}

export function ExportToolbar({
  viewMode,
  selectedOperationsManagerId,
  selectedCrewDirectorId,
}: {
  viewMode: ViewMode
  selectedOperationsManagerId: string
  selectedCrewDirectorId: string
}) {
  const { data } = useChart()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const target: ExportTarget = viewMode === 'overview' && selectedCrewDirectorId
    ? { kind: 'director', directorId: selectedCrewDirectorId }
    : viewMode === 'detail' && selectedOperationsManagerId
      ? { kind: 'operations', operationsManagerId: selectedOperationsManagerId }
      : { kind: 'full' }

  const full: ExportTarget = { kind: 'full' }
  const operations: ExportTarget = selectedOperationsManagerId
    ? { kind: 'operations', operationsManagerId: selectedOperationsManagerId }
    : full
  const director: ExportTarget = selectedCrewDirectorId
    ? { kind: 'director', directorId: selectedCrewDirectorId }
    : full

  const run = async (nextTarget: ExportTarget, kind: 'png' | 'svg') => {
    setBusy(true)
    markRequested(kind)
    try {
      if (kind === 'png') await exportPng(data, nextTarget)
      else exportSvg(data, nextTarget)
    } catch (error) {
      document.documentElement.dataset.exportStatus = 'error'
      document.documentElement.dataset.exportFilename = kind === 'png' ? 'pending.png' : 'pending.svg'
      document.documentElement.dataset.exportError = error instanceof Error ? error.message : 'Export failed'
      console.error(error)
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <div className="export-menu">
      <button className="button export-button" onClick={() => setOpen((value) => !value)}>
        {busy ? 'Preparing…' : 'Export'}
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="export-popover">
          <div>
            <strong>Export current presentation</strong>
            <small>16:9 layout · editing controls excluded</small>
          </div>

          <button onClick={() => void run(target, 'svg')}>
            <FileType2 size={17} />
            <span>
              <strong>SVG vector</strong>
              <small>Current export scope</small>
            </span>
          </button>

          <button onClick={() => void run(target, 'png')} disabled={busy}>
            <FileImage size={17} />
            <span>
              <strong>High-resolution PNG</strong>
              <small>Current export scope</small>
            </span>
          </button>

          {viewMode === 'overview' && (
            <>
              <button onClick={() => void run(full, 'png')} disabled={busy}>
                <FileImage size={17} />
                <span>
                  <strong>Full chart PNG</strong>
                  <small>All crew directors</small>
                </span>
              </button>

              <button onClick={() => void run(director, 'png')} disabled={busy}>
                <FileImage size={17} />
                <span>
                  <strong>Crew Director team PNG</strong>
                  <small>Selected crew director</small>
                </span>
              </button>
            </>
          )}

          {viewMode === 'detail' && (
            <button onClick={() => void run(operations, 'png')} disabled={busy}>
              <FileImage size={17} />
              <span>
                <strong>Operations Manager team PNG</strong>
                <small>Selected operations manager</small>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
