import { ChevronDown, FileImage, FileType2 } from 'lucide-react'
import { useMemo, useState } from 'react'
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
  selectedCrewManagerId,
}: {
  viewMode: ViewMode
  selectedOperationsManagerId: string
  selectedCrewDirectorId: string
  selectedCrewManagerId: string
}) {
  const { data } = useChart()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const currentTarget = useMemo<ExportTarget>(() => {
    if (viewMode === 'overview') {
      return selectedCrewDirectorId
        ? { kind: 'director', directorId: selectedCrewDirectorId }
        : { kind: 'full' }
    }

    if (selectedCrewManagerId) {
      return { kind: 'manager', crewManagerId: selectedCrewManagerId }
    }

    if (selectedOperationsManagerId) {
      return { kind: 'operations', operationsManagerId: selectedOperationsManagerId }
    }

    if (selectedCrewDirectorId) {
      return { kind: 'director', directorId: selectedCrewDirectorId }
    }

    return { kind: 'full' }
  }, [selectedCrewDirectorId, selectedCrewManagerId, selectedOperationsManagerId, viewMode])

  const fullTarget: ExportTarget = { kind: 'full' }
  const directorTarget: ExportTarget = selectedCrewDirectorId
    ? { kind: 'director', directorId: selectedCrewDirectorId }
    : { kind: 'full' }
  const operationsTarget: ExportTarget = selectedOperationsManagerId
    ? { kind: 'operations', operationsManagerId: selectedOperationsManagerId }
    : directorTarget
  const managerTarget: ExportTarget = selectedCrewManagerId
    ? { kind: 'manager', crewManagerId: selectedCrewManagerId }
    : operationsTarget

  const run = async (target: ExportTarget, kind: 'png' | 'svg') => {
    setBusy(true)
    markRequested(kind)
    try {
      if (kind === 'png') {
        await exportPng(data, target)
      } else {
        exportSvg(data, target)
      }
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

  const hasDirector = currentTarget.kind === 'director' || currentTarget.kind === 'operations' || currentTarget.kind === 'manager'
  const hasOperations = currentTarget.kind === 'operations' || currentTarget.kind === 'manager'

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

          <button onClick={() => void run(currentTarget, 'svg')} disabled={busy}>
            <FileType2 size={17} />
            <span>
              <strong>SVG vector</strong>
              <small>Current export scope</small>
            </span>
          </button>

          <button onClick={() => void run(currentTarget, 'png')} disabled={busy}>
            <FileImage size={17} />
            <span>
              <strong>High-resolution PNG</strong>
              <small>Current export scope</small>
            </span>
          </button>

          {viewMode === 'overview' && (
            <>
              <button onClick={() => void run(fullTarget, 'png')} disabled={busy}>
                <FileImage size={17} />
                <span>
                  <strong>Full chart PNG</strong>
                  <small>All Crew Directors</small>
                </span>
              </button>

              <button onClick={() => void run(directorTarget, 'png')} disabled={busy}>
                <FileImage size={17} />
                <span>
                  <strong>Crew Director team PNG</strong>
                  <small>{hasDirector ? 'Selected Crew Director' : 'Choose a Crew Director for a focused export'}</small>
                </span>
              </button>
            </>
          )}

          {viewMode === 'operations' && (
            <>
              <button onClick={() => void run(operationsTarget, 'png')} disabled={busy}>
                <FileImage size={17} />
                <span>
                  <strong>Crew Operations Manager team PNG</strong>
                  <small>{hasOperations ? 'Selected Crew Operations Manager' : 'Choose a Crew Operations Manager for a focused export'}</small>
                </span>
              </button>

              <button onClick={() => void run(managerTarget, 'png')} disabled={busy}>
                <FileImage size={17} />
                <span>
                  <strong>Crew Manager allocation PNG</strong>
                  <small>{selectedCrewManagerId ? 'Selected Crew Manager' : 'Choose a Crew Manager for a single-team export'}</small>
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
