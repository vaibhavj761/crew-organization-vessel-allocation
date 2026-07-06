import { Download } from 'lucide-react'
import { useChart } from '../state/ChartContext'

function downloadJson(data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `crew-planner-v2-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function ImportExportPanel() {
  const { data } = useChart()

  return <div className="backup-actions">
    <button className="button secondary" onClick={() => downloadJson(data)}><Download size={14} /> Export JSON</button>
    <p className="helper-copy">JSON import is deferred until the server-backed import endpoint is ready.</p>
  </div>
}
